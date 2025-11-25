import { getSupabaseServerClient } from './supabase'
import { createServerFn } from '@tanstack/react-start'
import type { User } from '@supabase/supabase-js'
import type { Player, AppRole } from './types'
import { withSentry } from './sentry'

export type AuthData = {
  user: User
  player: Player | null
  isPhoneVerified: boolean
  hasPlaytomicProfile: boolean
  role: AppRole
}

export const fetchUser = createServerFn({ method: 'GET' }).handler(
  withSentry(async () => {
    const supabase = getSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user?.id) {
      return null
    }

    // Check if user has verified their phone (phone_confirmed_at is set)
    const isPhoneVerified = !!data.user.phone_confirmed_at

    // Ensure phone is in E.164 format with + prefix
    const userPhone = data.user.phone
      ? data.user.phone.startsWith('+')
        ? data.user.phone
        : `+${data.user.phone}`
      : null

    // Get or create player data from database
    let { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('id', data.user.id)
      .single()

    // If player doesn't exist, create one
    if (!player && userPhone) {
      const { data: newPlayer, error: upsertError } = await supabase
        .from('players')
        .insert({
          id: data.user.id,
          phone: userPhone,
        })
        .select()
        .single()

      if (upsertError) {
        console.error('Error creating player:', upsertError)
      } else {
        player = newPlayer
      }
    }

    // Always sync phone from auth.users to players
    if (player && userPhone && player.phone !== userPhone) {
      const { data: updatedPlayer } = await supabase
        .from('players')
        .update({ phone: userPhone })
        .eq('id', player.id)
        .select()
        .single()

      if (updatedPlayer) {
        player = updatedPlayer
      }
    }

    // Fetch user's highest privilege role from user_roles table
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .order('role', { ascending: true }) // organizer comes before player alphabetically

    // Get the highest privilege role (organizer > player)
    const role =
      userRoles?.find((r) => r.role === 'organizer')?.role ||
      userRoles?.[0]?.role ||
      'player'

    return {
      user: data.user,
      player,
      isPhoneVerified,
      hasPlaytomicProfile: !!player?.playtomic_id,
      role,
    }
  }),
)

export const signInWithPhone = createServerFn({ method: 'POST' })
  .inputValidator((d: { phone: string }) => d)
  .handler(
    withSentry(async ({ data }) => {
      const supabase = getSupabaseServerClient()
      const { data: response, error } = await supabase.auth.signInWithOtp({
        phone: data.phone,
        options: {
          channel: 'whatsapp',
          shouldCreateUser: true,
        },
      })

      if (error) {
        throw new Error(error.message)
      }

      // For OTP sign in, user will be null until they verify
      // Just check that we got a response (messageId indicates OTP was sent)
      if (!response) {
        throw new Error('Failed to send OTP')
      }

      return response
    }),
  )

export const verifyOtp = createServerFn({ method: 'POST' })
  .inputValidator((d: { token: string; phone: string }) => d)
  .handler(
    withSentry(async ({ data }) => {
      const supabase = getSupabaseServerClient()

      const { data: response, error } = await supabase.auth.verifyOtp({
        phone: data.phone,
        token: data.token,
        type: 'sms',
      })

      if (error) {
        throw new Error(error.message)
      }

      if (!response.user) {
        throw new Error('Failed to verify OTP')
      }

      // Ensure phone is in E.164 format with + prefix
      const phone = data.phone.startsWith('+') ? data.phone : `+${data.phone}`

      // CHANGE: Use upsert instead of insert to handle both new and returning users
      // This prevents "duplicate key" errors when existing users log in again
      // The upsert will create a new record for first-time users, or update the phone
      // for existing users (in case they changed their number)
      const { data: player, error: playerError } = await supabase
        .from('players')
        .upsert(
          {
            id: response.user.id,
            phone: phone,
          },
          {
            onConflict: 'id', // Conflict on primary key (user ID)
            ignoreDuplicates: false, // Update the record if it exists
          },
        )
        .select()
        .single()

      if (playerError) {
        console.error('Error upserting player in verifyOtp:', playerError)
        throw new Error('Failed to create or update player profile')
      }

      return player
    }),
  )

export const linkPlaytomicProfile = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: { playtomicId: string; name: string; avatar: string }) => d,
  )
  .handler(
    withSentry(async ({ data }) => {
      const supabase = getSupabaseServerClient()

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      // Parse playtomicId to number
      const playtomicIdNumber = parseInt(data.playtomicId, 10)

      if (isNaN(playtomicIdNumber)) {
        throw new Error('Invalid Playtomic ID')
      }

      // Update player record
      const { data: player, error } = await supabase
        .from('players')
        .update({
          playtomic_id: playtomicIdNumber,
          name: data.name,
          avatar: data.avatar,
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error linking Playtomic profile:', error)
        throw new Error('Failed to link Playtomic profile')
      }

      return player
    }),
  )

export const logout = createServerFn({ method: 'POST' }).handler(
  withSentry(async () => {
    const supabase = getSupabaseServerClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw new Error(error.message)
    }

    return { success: true }
  }),
)

// Utility function to determine redirect path based on user status
export function getLoginRedirectPath(authData: AuthData | null): string | null {
  if (!authData) {
    return null // User not logged in, stay on current login step
  }

  const { isPhoneVerified, hasPlaytomicProfile } = authData

  // If user is fully set up, redirect to home
  if (isPhoneVerified && hasPlaytomicProfile) {
    return '/'
  }

  // If user is logged in but not verified, go to OTP
  if (!isPhoneVerified) {
    return '/login/otp'
  }

  // If user is verified but no Playtomic profile, go to Playtomic
  if (isPhoneVerified && !hasPlaytomicProfile) {
    return '/login/playtomic'
  }

  return null
}
