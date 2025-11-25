import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/utils/database.types'
import type {
  PlaytomicApiMatch,
  PlaytomicApiUser,
} from '@/utils/playtomic.types.ts'

// =============================================================================
// TYPES
// =============================================================================

interface PlaytomicPlayerData {
  id: string
  full_name: string | null
  picture: string | null
  payment_status: 'paid' | 'pending'
}

interface MatchWithPlaytomic {
  id: number
  public_id: string
  start_time: string
  end_time: string
  playtomic_match_id: number | null
  session_id: number
  playtomic: {
    playtomic_match_id: string
    match_url: string
    playtomic_players: PlaytomicPlayerData[]
    start_time: string
    end_time: string
  } | null
}

interface SyncResult {
  success: boolean
  message: string
  details?: {
    playersAdded: number
    playersAlreadyInMatch: number
    playersNotInDb: number
    playtomicPlayers: PlaytomicPlayerData[]
  }
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
// PLAYTOMIC API
// =============================================================================

async function fetchAndUpdatePlaytomicMatch(
  playtomicMatchId: string,
): Promise<PlaytomicPlayerData[] | null> {
  try {
    const res = await fetch(
      `https://api.playtomic.io/v1/matches/${playtomicMatchId}`,
    )
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

    // Update the playtomic_matches table with fresh data
    const supabase = getSupabaseServiceClient()
    await supabase
      .from('playtomic_matches')
      .update({
        playtomic_players: players as unknown as Json,
        start_time: new Date(data.start_date + 'Z').toISOString(),
        end_time: new Date(data.end_date + 'Z').toISOString(),
        club_name: data.tenant?.tenant_name ?? 'Unknown',
        court_name: data.resource_name ?? 'Unknown',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('playtomic_match_id', playtomicMatchId)

    return players
  } catch (e) {
    console.error('Error fetching Playtomic match:', e)
    return null
  }
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

async function getMatchByPublicId(
  publicMatchId: string,
): Promise<MatchWithPlaytomic | null> {
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
      session_id,
      playtomic:playtomic_matches!matches_playtomic_match_id_fkey(
        playtomic_match_id,
        match_url,
        playtomic_players,
        start_time,
        end_time
      )
    `,
    )
    .eq('public_id', publicMatchId)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    public_id: data.public_id,
    start_time: data.start_time,
    end_time: data.end_time,
    playtomic_match_id: data.playtomic_match_id,
    session_id: data.session_id,
    playtomic: data.playtomic as MatchWithPlaytomic['playtomic'],
  }
}

async function findPlayersByPlaytomicIds(
  playtomicIds: string[],
): Promise<Map<number, string>> {
  if (playtomicIds.length === 0) return new Map()

  const supabase = getSupabaseServiceClient()

  // Convert string IDs to numbers for the query
  const numericIds = playtomicIds
    .map((id) => parseInt(id, 10))
    .filter((id) => !isNaN(id))

  const { data, error } = await supabase
    .from('players')
    .select('id, playtomic_id')
    .in('playtomic_id', numericIds)

  if (error || !data) return new Map()

  // Map playtomic_id to player.id (UUID)
  return new Map(
    data
      .filter((p) => p.playtomic_id !== null)
      .map((p) => [p.playtomic_id as number, p.id]),
  )
}

async function getExistingParticipants(matchId: number): Promise<Set<string>> {
  const supabase = getSupabaseServiceClient()

  const { data } = await supabase
    .from('match_participants')
    .select('player_id')
    .eq('match_id', matchId)

  return new Set(data?.map((p) => p.player_id) ?? [])
}

async function addMatchParticipant(
  matchId: number,
  playerId: string,
  source: string = 'playtomic_sync',
): Promise<boolean> {
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('match_participants').insert({
    match_id: matchId,
    player_id: playerId,
    source,
    joined_at: new Date().toISOString(),
  })

  if (error) {
    // Ignore unique constraint violations (player already in match)
    if (error.code === '23505') return true
    console.error('Error adding participant:', error)
    return false
  }

  return true
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export const Route = createFileRoute('/api/sync-match/$publicMatchId')({
  server: {
    handlers: {
      POST: async ({ params }: { params: { publicMatchId: string } }) => {
        const { publicMatchId } = params

        console.log(`[SyncMatch] Syncing match: ${publicMatchId}`)

        // 1. Get match with Playtomic data
        const match = await getMatchByPublicId(publicMatchId)

        if (!match) {
          return Response.json(
            { success: false, message: 'Match not found' },
            { status: 404 },
          )
        }

        // 2. Check if match has Playtomic link
        if (!match.playtomic_match_id || !match.playtomic) {
          return Response.json(
            { success: false, message: 'Match has no Playtomic link' },
            { status: 400 },
          )
        }

        // 3. Fetch fresh data from Playtomic API and update our record
        const freshPlayers = await fetchAndUpdatePlaytomicMatch(
          match.playtomic.playtomic_match_id,
        )

        if (!freshPlayers) {
          return Response.json(
            { success: false, message: 'Could not fetch Playtomic match data' },
            { status: 502 },
          )
        }

        // 4. Get Playtomic player IDs
        const playtomicPlayerIds = freshPlayers.map((p) => p.id)

        // 5. Find which Playtomic players exist in our DB
        const playtomicToDbMap =
          await findPlayersByPlaytomicIds(playtomicPlayerIds)

        // 6. Get existing match participants
        const existingParticipants = await getExistingParticipants(match.id)

        // 7. Sync players
        let playersAdded = 0
        let playersAlreadyInMatch = 0
        let playersNotInDb = 0

        for (const playtomicPlayer of freshPlayers) {
          const playtomicIdNum = parseInt(playtomicPlayer.id, 10)
          const dbPlayerId = playtomicToDbMap.get(playtomicIdNum)

          if (!dbPlayerId) {
            // Player not in our DB - they stay in playtomic_players only
            playersNotInDb++
            continue
          }

          if (existingParticipants.has(dbPlayerId)) {
            // Player already a participant
            playersAlreadyInMatch++
            continue
          }

          // Add player as participant
          const added = await addMatchParticipant(match.id, dbPlayerId)
          if (added) {
            playersAdded++
          }
        }

        const result: SyncResult = {
          success: true,
          message: `Sync completed: ${playersAdded} added, ${playersAlreadyInMatch} already in match, ${playersNotInDb} not in our database`,
          details: {
            playersAdded,
            playersAlreadyInMatch,
            playersNotInDb,
            playtomicPlayers: freshPlayers,
          },
        }

        console.log(`[SyncMatch] ${result.message}`)

        return Response.json(result)
      },

      GET: async ({ params }: { params: { publicMatchId: string } }) => {
        // GET endpoint to check sync status without modifying
        const { publicMatchId } = params

        const match = await getMatchByPublicId(publicMatchId)

        if (!match) {
          return Response.json(
            { success: false, message: 'Match not found' },
            { status: 404 },
          )
        }

        if (!match.playtomic) {
          return Response.json({
            success: true,
            hasPlaytomicLink: false,
            match: {
              public_id: match.public_id,
              start_time: match.start_time,
              end_time: match.end_time,
            },
          })
        }

        return Response.json({
          success: true,
          hasPlaytomicLink: true,
          match: {
            public_id: match.public_id,
            start_time: match.start_time,
            end_time: match.end_time,
          },
          playtomic: {
            matchId: match.playtomic.playtomic_match_id,
            matchUrl: match.playtomic.match_url,
            players: match.playtomic.playtomic_players,
          },
        })
      },
    },
  },
})
