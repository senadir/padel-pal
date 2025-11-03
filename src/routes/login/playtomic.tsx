import {
  createFileRoute,
  redirect,
  useLoaderData,
} from '@tanstack/react-router'
import { z } from 'zod'
import { PlaytomicForm } from '@/components/playtomic-form'
import {
  searchPlaytomicByPhone,
  searchPlaytomicByEmail,
} from '@/utils/playtomic'

export const Route = createFileRoute('/login/playtomic')({
  component: RouteComponent,
  validateSearch: z.object({
    email: z.string().optional(),
    redirect: z.string().optional(),
  }),
  beforeLoad: async ({ context, search }) => {
    const { authData } = context
    const { redirect: redirectUrl } = search

    // Redirect to login if not authenticated
    if (!authData?.user) {
      throw redirect({
        to: '/login',
        search: redirectUrl ? { redirect: redirectUrl } : undefined,
      })
    }

    // Redirect to OTP if phone not verified
    if (!authData.isPhoneVerified) {
      throw redirect({
        to: '/login/otp',
        search: redirectUrl ? { redirect: redirectUrl } : undefined,
      })
    }

    // Redirect to home if already has Playtomic profile
    if (authData.hasPlaytomicProfile) {
      throw redirect({
        to: redirectUrl || '/',
      })
    }
  },
  loaderDeps: ({ search: { email } }) => ({ email }),
  loader: async ({ context, deps }) => {
    const { authData } = context
    const { email } = deps

    // If email query param is present, search by email first
    if (email) {
      try {
        const playtomicProfile = await searchPlaytomicByEmail({
          data: { email },
        })
        return { playtomicProfile, searchMethod: 'email' as const }
      } catch (error) {
        console.error('Error searching Playtomic profile by email:', error)
        return { playtomicProfile: null, searchMethod: 'email' as const }
      }
    }

    // Otherwise search by phone
    if (authData?.player?.phone && typeof authData.player.phone === 'string') {
      try {
        const playtomicProfile = await searchPlaytomicByPhone({
          data: { phone: authData.player.phone },
        })
        return { playtomicProfile, searchMethod: 'phone' as const }
      } catch (error) {
        console.error('Error searching Playtomic profile by phone:', error)
        return { playtomicProfile: null, searchMethod: 'phone' as const }
      }
    }

    return { playtomicProfile: null, searchMethod: 'none' as const }
  },
})

function RouteComponent() {
  const { playtomicProfile, searchMethod } = useLoaderData({
    from: '/login/playtomic',
  })
  const { redirect } = Route.useSearch()

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <PlaytomicForm
          playtomicProfile={playtomicProfile}
          searchMethod={searchMethod}
          redirect={redirect}
        />
      </div>
    </div>
  )
}
