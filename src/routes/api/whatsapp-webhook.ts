import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/utils/database.types'
import type {
  PlaytomicApiMatch,
  PlaytomicApiUser,
  PlaytomicApiURL,
} from '@/utils/playtomic.types.ts'

// =============================================================================
// TYPES
// =============================================================================

interface PlaytomicLinkData {
  matchId: string | null
  shortCode: string | null
}

interface ActiveMatch {
  id: number
  public_id: string
  start_time: string
  end_time: string
  playtomic_match_id: number | null
  playtomic_match_uuid: string | null
  playtomic_match_url: string | null
}

interface PlaytomicMatchDetails {
  matchId: string
  matchUrl: string
  clubName: string
  courtName: string
  startTime: string
  endTime: string
  players: PlaytomicPlayerData[]
}

interface PlaytomicPlayerData {
  id: string
  full_name: string | null
  picture: string | null
  payment_status: 'paid' | 'pending'
}

// =============================================================================
// SUPABASE CLIENT
// =============================================================================

function getSupabaseServiceClient() {
  return createClient<Database>(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PRIVATE_KEY!,
  )
}

// =============================================================================
// TWIML RESPONSES
// =============================================================================

function twimlResponse(message?: string): Response {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`

  return new Response(body, {
    headers: { 'Content-Type': 'text/xml' },
    status: 200,
  })
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// =============================================================================
// PLAYTOMIC LINK EXTRACTION
// =============================================================================

function extractPlaytomicLink(message: string): PlaytomicLinkData {
  // Full match URL: https://app.playtomic.io/matches/{uuid}
  const fullMatch = message.match(
    /https?:\/\/(?:www\.)?app\.playtomic\.io\/matches\/([a-f0-9-]{36})/i,
  )
  if (fullMatch) {
    return { matchId: fullMatch[1], shortCode: null }
  }

  // Short URL: https://app.playtomic.io/t/{code}
  const shortMatch = message.match(
    /https?:\/\/(?:www\.)?app\.playtomic\.io\/t\/([a-zA-Z0-9_-]+)/i,
  )
  if (shortMatch) {
    return { matchId: null, shortCode: shortMatch[1] }
  }

  return { matchId: null, shortCode: null }
}

// =============================================================================
// PLAYTOMIC API
// =============================================================================

async function resolvePlaytomicMatchId(
  link: PlaytomicLinkData,
): Promise<{ matchId: string; matchUrl: string } | null> {
  if (link.shortCode) {
    try {
      const res = await fetch(
        `https://api.playtomic.io/v1/short_urls/${link.shortCode}`,
      )
      const data = (await res.json()) as PlaytomicApiURL
      const uuidMatch = data.full_url.match(
        /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
      )
      if (uuidMatch) {
        return { matchId: uuidMatch[0], matchUrl: data.full_url }
      }
    } catch (e) {
      console.error('Error resolving short URL:', e)
    }
    return null
  }

  if (link.matchId) {
    return {
      matchId: link.matchId,
      matchUrl: `https://app.playtomic.io/matches/${link.matchId}`,
    }
  }

  return null
}

async function fetchPlaytomicMatch(
  matchId: string,
  matchUrl: string,
): Promise<PlaytomicMatchDetails | null> {
  try {
    const res = await fetch(`https://api.playtomic.io/v1/matches/${matchId}`)
    if (!res.ok) return null

    const data = (await res.json()) as PlaytomicApiMatch

    // Extract player IDs from teams
    const rawPlayers = [
      ...(data.teams?.[0]?.players ?? []),
      ...(data.teams?.[1]?.players ?? []),
    ]

    const playerIds = rawPlayers
      .map((p: unknown) => {
        if (typeof p === 'string' || typeof p === 'number') return String(p)
        if (typeof p === 'object' && p !== null) {
          const obj = p as { id?: unknown; user_id?: unknown }
          return String(obj.id ?? obj.user_id ?? '')
        }
        return ''
      })
      .filter(Boolean)

    // Fetch full player details
    let playerDetails: PlaytomicApiUser[] = []
    if (playerIds.length > 0) {
      try {
        const usersRes = await fetch(
          `https://api.playtomic.io/v2/users?user_id=${playerIds.join(',')}`,
        )
        if (usersRes.ok) {
          const usersData = (await usersRes.json()) as PlaytomicApiUser[]

          playerDetails = Array.isArray(usersData) ? usersData : []
        }
      } catch (e) {
        console.error('Error fetching user details:', e)
      }
    }

    const playerMap = new Map(playerDetails.map((p) => [String(p.user_id), p]))

    // Build payment status map
    const paymentMap = new Map(
      data.registration_info?.registrations?.map((r) => [
        String(r.user_id),
        r.payable_by_player === false ? 'paid' : 'pending',
      ]) ?? [],
    )

    const players: PlaytomicPlayerData[] = playerIds.map((id) => {
      const details = playerMap.get(id)
      return {
        id,
        full_name: details?.full_name ?? null,
        picture: details?.picture ?? null,
        payment_status: (paymentMap.get(id) ?? 'pending') as 'paid' | 'pending',
      }
    })

    return {
      matchId: data.match_id,
      matchUrl,
      clubName: data.tenant?.tenant_name ?? 'Unknown',
      courtName: data.resource_name ?? 'Unknown',
      startTime: new Date(data.start_date + 'Z').toISOString(),
      endTime: new Date(data.end_date + 'Z').toISOString(),
      players,
    }
  } catch (e) {
    console.error('Error fetching Playtomic match:', e)
    return null
  }
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

async function findPlayerByPhone(phone: string) {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('players')
    .select('id, playtomic_id')
    .eq('phone', phone)
    .single()
  return data
}

async function findActiveMatchesForPlayer(
  playerId: string,
): Promise<ActiveMatch[]> {
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('matches')
    .select(
      `
      id,
      public_id,
      start_time,
      end_time,
      playtomic_match_id,
      booker:match_participants!matches_booker_id_fkey(player_id),
      session:sessions!matches_session_id_fkey(status),
      playtomic:playtomic_matches!matches_playtomic_match_id_fkey(playtomic_match_id, match_url)
    `,
    )
    .gt('start_time', new Date().toISOString())

  if (error || !data) return []

  // Filter: session is open AND player is the booker
  return data
    .filter((m) => {
      const booker = m.booker as { player_id: string } | null
      const session = m.session as { status: string } | null
      return booker?.player_id === playerId && session?.status === 'open'
    })
    .map((m) => {
      const playtomic = m.playtomic as {
        playtomic_match_id: string
        match_url: string
      } | null
      return {
        id: m.id,
        public_id: m.public_id,
        start_time: m.start_time,
        end_time: m.end_time,
        playtomic_match_id: m.playtomic_match_id,
        playtomic_match_uuid: playtomic?.playtomic_match_id ?? null,
        playtomic_match_url: playtomic?.match_url ?? null,
      }
    })
}

async function upsertPlaytomicMatch(
  details: PlaytomicMatchDetails,
): Promise<number | null> {
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('playtomic_matches')
    .upsert(
      {
        playtomic_match_id: details.matchId,
        match_url: details.matchUrl,
        club_name: details.clubName,
        court_name: details.courtName,
        start_time: details.startTime,
        end_time: details.endTime,
        playtomic_players: details.players as unknown as Json,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'playtomic_match_id' },
    )
    .select('id')
    .single()

  if (error) {
    console.error('Error upserting playtomic match:', error)
    return null
  }

  return data?.id ?? null
}

async function linkMatchToPlaytomic(
  matchId: number,
  playtomicDbId: number,
): Promise<boolean> {
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('matches')
    .update({
      playtomic_match_id: playtomicDbId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)

  if (error) {
    console.error('Error linking match:', error)
    return false
  }

  return true
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export const Route = createFileRoute('/api/whatsapp-webhook')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const formData = await request.formData()
          const from = (formData.get('From') as string)?.replace(
            'whatsapp:',
            '',
          )
          const body = formData.get('Body') as string

          if (!from || !body) {
            return new Response('Bad Request', { status: 400 })
          }

          console.log(
            `[WhatsApp] From: ${from}, Body: ${body.substring(0, 100)}...`,
          )

          // 1. Check if player exists
          const player = await findPlayerByPhone(from)
          if (!player) {
            console.log('[WhatsApp] Player not found')
            return twimlResponse()
          }

          // 2. Check if player has active matches (as booker)
          const activeMatches = await findActiveMatchesForPlayer(player.id)
          if (activeMatches.length === 0) {
            console.log('[WhatsApp] No active matches for player')
            return twimlResponse()
          }

          // 3. Check for Playtomic link in message
          const link = extractPlaytomicLink(body)
          if (!link.matchId && !link.shortCode) {
            console.log('[WhatsApp] No Playtomic link in message')
            return twimlResponse()
          }

          // 4. Resolve the Playtomic match ID
          const resolved = await resolvePlaytomicMatchId(link)
          if (!resolved) {
            console.log('[WhatsApp] Could not resolve Playtomic link')
            return twimlResponse()
          }

          // 5. Fetch Playtomic match details
          const playtomicDetails = await fetchPlaytomicMatch(
            resolved.matchId,
            resolved.matchUrl,
          )
          if (!playtomicDetails) {
            console.log('[WhatsApp] Could not fetch Playtomic match')
            return twimlResponse()
          }

          // 6. Find matching active match by start time
          const playtomicStart = new Date(playtomicDetails.startTime).getTime()
          const matchingMatch = activeMatches.find(
            (m) => new Date(m.start_time).getTime() === playtomicStart,
          )

          if (!matchingMatch) {
            console.log(
              '[WhatsApp] No active match matches Playtomic start time:',
              playtomicDetails.startTime,
            )
            return twimlResponse()
          }

          // 7. Check if already linked to the SAME Playtomic match
          if (matchingMatch.playtomic_match_uuid === resolved.matchId) {
            console.log('[WhatsApp] Already linked to same Playtomic match')
            return twimlResponse()
          }

          // 8. Store/update Playtomic match data
          const playtomicDbId = await upsertPlaytomicMatch(playtomicDetails)
          if (!playtomicDbId) {
            return twimlResponse('Something went wrong. Please try again.')
          }

          // 9. Check if there was a previous link
          const previousUrl = matchingMatch.playtomic_match_url

          // 10. Link the match
          const linked = await linkMatchToPlaytomic(
            matchingMatch.id,
            playtomicDbId,
          )
          if (!linked) {
            return twimlResponse('Something went wrong. Please try again.')
          }

          // 11. Respond based on whether this is new or updated link
          if (previousUrl) {
            return twimlResponse(
              `Match linked successfully! Previously was: ${previousUrl}`,
            )
          }

          return twimlResponse('Match linked successfully!')
        } catch (error) {
          console.error('[WhatsApp] Error:', error)
          return new Response('Internal Server Error', { status: 500 })
        }
      },
    },
  },
})
