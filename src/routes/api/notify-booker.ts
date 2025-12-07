import { createFileRoute } from '@tanstack/react-router'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { format } from 'date-fns'
import { sendBookerNotification } from '@/utils/twilio'
import type { Database } from '@/utils/database.types'

/**
 * Webhook endpoint for sending booker notifications.
 * Called by Supabase Database Webhooks when:
 * 1. A session status changes to 'open' (notify all bookers)
 * 2. A match's booker_id changes while session is 'open' (notify new booker)
 *
 * Supabase Database Webhook payload format:
 * {
 *   type: 'INSERT' | 'UPDATE' | 'DELETE',
 *   table: 'sessions' | 'matches',
 *   schema: 'public',
 *   record: { ...row data... },
 *   old_record: { ...previous row data... } // For UPDATE
 * }
 *
 * Setup in Supabase Dashboard:
 * 1. Go to Database > Webhooks
 * 2. Create webhook for 'sessions' table on UPDATE, filter: status = 'open'
 * 3. Create webhook for 'matches' table on UPDATE, when booker_id changes
 */

interface SupabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: Record<string, unknown>
  old_record?: Record<string, unknown>
}

export const Route = createFileRoute('/api/notify-booker')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // Verify the request is from Supabase using webhook secret
          // Fail closed: reject all requests if secret is not configured
          const authHeader = request.headers.get('Authorization')
          const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET

          if (!expectedSecret) {
            console.error('Webhook secret not configured - rejecting request')
            return new Response(
              JSON.stringify({ error: 'Webhook not configured' }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          if (authHeader !== `Bearer ${expectedSecret}`) {
            console.error('Unauthorized webhook request')
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const payload = (await request.json()) as SupabaseWebhookPayload
          console.log('Received Supabase webhook:', payload.table, payload.type)

          // Create Supabase client with service role for full access
          const supabaseUrl = process.env.SUPABASE_URL
          const supabaseKey = process.env.SUPABASE_PRIVATE_KEY

          if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase configuration missing')
          }

          const supabase = createClient<Database>(supabaseUrl, supabaseKey)

          // Handle based on table
          if (payload.table === 'sessions') {
            await handleSessionWebhook(supabase, payload)
          } else if (payload.table === 'matches') {
            await handleMatchWebhook(supabase, payload)
          } else {
            console.log('Ignoring webhook for table:', payload.table)
          }

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('Error processing webhook:', error)
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})

/**
 * Handle session table webhooks - notify bookers when session opens
 */
async function handleSessionWebhook(
  supabase: SupabaseClient<Database>,
  payload: SupabaseWebhookPayload,
) {
  // Only process UPDATE events where status changed to 'open'
  if (payload.type !== 'UPDATE') return

  const newStatus = payload.record.status as string
  const oldStatus = payload.old_record?.status as string | undefined

  // Only notify when status changes TO 'open' (not when already open)
  if (newStatus !== 'open' || oldStatus === 'open') {
    console.log(`Session status: ${oldStatus} -> ${newStatus}, skipping`)
    return
  }

  const sessionId = payload.record.id as number
  const venueName = (payload.record.venue_name as string) || 'the venue'

  console.log(`Session ${sessionId} opened, notifying bookers...`)

  // Get all matches with their bookers for this session
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select(
      `
      id,
      start_time,
      booker_id,
      booker:match_participants!matches_booker_id_fkey(
        player_id,
        players(phone, name)
      )
    `,
    )
    .eq('session_id', sessionId)
    .not('booker_id', 'is', null)

  if (matchesError || !matches) {
    throw new Error(
      `Failed to fetch matches: ${matchesError?.message || 'No matches found'}`,
    )
  }

  // Send notifications to each unique booker
  const sentToPhones = new Set<string>()

  for (const match of matches) {
    const booker = match.booker as unknown as {
      player_id: string
      players: { phone: string | null; name: string | null } | null
    } | null

    if (!booker?.players?.phone) {
      console.log(`Booker for match ${match.id} has no phone number, skipping`)
      continue
    }

    const phone = booker.players.phone

    // Skip if we've already sent to this phone number
    if (sentToPhones.has(phone)) {
      continue
    }

    const matchTime = format(
      new Date(match.start_time),
      "EEEE, MMM d 'at' HH:mm",
    )

    try {
      const result = await sendBookerNotification({
        toPhone: phone,
        venueName,
        matchTime,
      })

      if (result.success) {
        sentToPhones.add(phone)
        console.log(
          `Sent booker notification to ${booker.players.name} (${phone})`,
        )
      } else {
        console.error(`Failed to send notification to ${phone}:`, result.error)
      }
    } catch (error) {
      console.error(`Error sending notification to ${phone}:`, error)
    }
  }

  console.log(
    `Session ${sessionId} opened: sent notifications to ${sentToPhones.size} bookers`,
  )
}

/**
 * Handle match table webhooks - notify new booker when assigned
 */
async function handleMatchWebhook(
  supabase: SupabaseClient<Database>,
  payload: SupabaseWebhookPayload,
) {
  // Only process UPDATE events where booker_id changed
  if (payload.type !== 'UPDATE') return

  const newBookerId = payload.record.booker_id as number | null
  const oldBookerId = payload.old_record?.booker_id as number | null | undefined

  // Only notify when booker_id changes to a new non-null value
  if (!newBookerId || newBookerId === oldBookerId) {
    console.log(`Booker unchanged: ${oldBookerId} -> ${newBookerId}, skipping`)
    return
  }

  const sessionId = payload.record.session_id as number
  const startTime = payload.record.start_time as string

  // Check if session is open
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('status, venue_name')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    throw new Error(
      `Failed to fetch session: ${sessionError?.message || 'Session not found'}`,
    )
  }

  // Only send notification if session is open
  if (session.status !== 'open') {
    console.log(
      `Session status is ${session.status}, not sending booker notification`,
    )
    return
  }

  // Get the new booker's player info
  const { data: participant, error: participantError } = await supabase
    .from('match_participants')
    .select('player_id, players(phone, name)')
    .eq('id', newBookerId)
    .single()

  if (participantError || !participant) {
    throw new Error(
      `Failed to fetch participant: ${participantError?.message || 'Participant not found'}`,
    )
  }

  const player = participant.players as unknown as {
    phone: string | null
    name: string | null
  } | null

  if (!player?.phone) {
    console.log('New booker has no phone number, skipping notification')
    return
  }

  const matchTime = format(new Date(startTime), "EEEE, MMM d 'at' HH:mm")
  const venueName = session.venue_name || 'the venue'

  try {
    const result = await sendBookerNotification({
      toPhone: player.phone,
      venueName,
      matchTime,
    })

    if (result.success) {
      console.log(
        `Sent booker notification to ${player.name} (${player.phone})`,
      )
    } else {
      console.error(
        `Failed to send notification to ${player.phone}:`,
        result.error,
      )
    }
  } catch (error) {
    console.error(`Error sending notification to ${player.phone}:`, error)
  }
}
