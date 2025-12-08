import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { toast } from 'sonner'
import ShortUniqueId from 'short-unique-id'
import { format, formatISO } from 'date-fns'
import { getSupabaseServerClient } from './supabase'
import { upsertVenue } from './venues'
import { withSentry } from './sentry'
import type {
  Match,
  Player,
  Session,
  SessionForm,
  SessionVenue,
  TimeSlot,
} from './types'

// Types for match generation function
interface VoteInput {
  optionId: string
  playerId: string
}

interface TimeSlotOption {
  id: string // option ID
  timeSlotId: string
  level: string
  startTime: Date
  endTime: Date
}

interface GeneratedMatch {
  optionId: string
  timeSlotId: string
  level: string
  startTime: Date
  endTime: Date
  maxPlayers: number
  playerIds: Array<string>
}

/**
 * Helper function to select the best booker for a match.
 * Prioritizes players who are not already bookers in other matches in the session.
 */
async function selectBestBooker(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  matchId: number,
  sessionId: number,
): Promise<number | null> {
  // Get all participants of this match
  const { data: participants, error: participantsError } = await supabase
    .from('match_participants')
    .select('id, player_id')
    .eq('match_id', matchId)

  if (participantsError || !participants || participants.length === 0) {
    return null
  }

  // Get player IDs who are already bookers in other matches
  const playersAlreadyBookers = new Set<string>()

  // Query booker player IDs directly
  const { data: bookerData, error: bookerError } = await supabase
    .from('matches')
    .select(
      `
      booker_id,
      booker:match_participants!matches_booker_id_fkey(player_id)
    `,
    )
    .eq('session_id', sessionId)
    .neq('id', matchId)
    .not('booker_id', 'is', null)

  if (!bookerError && bookerData) {
    for (const match of bookerData) {
      const booker = match.booker as { player_id: string } | null
      if (booker?.player_id) {
        playersAlreadyBookers.add(booker.player_id)
      }
    }
  }

  // Shuffle participants randomly
  const shuffled = [...participants].sort(() => Math.random() - 0.5)

  // Sort so that players who are already bookers come last
  shuffled.sort((a, b) => {
    const aIsBooker = playersAlreadyBookers.has(a.player_id)
    const bIsBooker = playersAlreadyBookers.has(b.player_id)
    if (aIsBooker && !bIsBooker) return 1
    if (!aIsBooker && bIsBooker) return -1
    return 0
  })

  // Return the best candidate's participant ID
  return shuffled[0].id
}

/**
 * Pure function to generate matches from voting results.
 * This is the external matching engine that can be replaced in the future.
 *
 * @param options - All available time slot options (time + level combinations)
 * @param votes - All votes cast by players
 * @returns Array of matches to create, each with assigned players
 *
 * Logic:
 * - For each option, find all votes
 * - If zero votes → skip option (no empty matches)
 * - If 1+ votes → split into matches of 4 players each
 *   - Full matches: groups of exactly 4
 *   - Remainder: leftover players (1-3) get their own match with open slots
 */
export function generateMatchesFromVotes(
  options: Array<TimeSlotOption>,
  votes: Array<VoteInput>,
): Array<GeneratedMatch> {
  const matches: Array<GeneratedMatch> = []

  for (const option of options) {
    // Find all votes for this option
    const votesForOption = votes.filter((vote) => vote.optionId === option.id)

    // Skip options with no votes
    if (votesForOption.length === 0) {
      continue
    }

    // Split voters into matches of 4 players each
    const playersPerMatch = 4
    const matchesNeeded = Math.ceil(votesForOption.length / playersPerMatch)

    for (let i = 0; i < matchesNeeded; i++) {
      const playersForThisMatch = votesForOption.slice(
        i * playersPerMatch,
        (i + 1) * playersPerMatch,
      )

      matches.push({
        optionId: option.id,
        timeSlotId: option.timeSlotId,
        level: option.level,
        startTime: option.startTime,
        endTime: option.endTime,
        maxPlayers: playersPerMatch,
        playerIds: playersForThisMatch.map((vote) => vote.playerId),
      })
    }
  }

  return matches
}

// Database time slot types (stored as JSON)
interface RawTimeSlotOption {
  id: string
  slot: { id: string; range: [string, string] }
  level: string
  players: Array<unknown>
}

interface RawTimeSlot {
  id: string
  range: [string, string]
  options: Array<RawTimeSlotOption>
}

export const fetchSessions = createServerFn({ method: 'GET' }).handler(
  withSentry(async () => {
    try {
      const supabase = getSupabaseServerClient()

      // Fetch all sessions ordered by date (newest first)
      const { data: sessionsData, error } = await supabase
        .from('sessions')
        .select('*')
        .order('date', { ascending: false })

      if (error) {
        console.error('Error fetching sessions:', error)
        throw new Error(`Failed to fetch sessions: ${error.message}`)
      }

      if (!sessionsData || sessionsData.length === 0) {
        return []
      }

      // Fetch all matches for these sessions to determine phase
      const sessionIds = sessionsData.map((s) => s.id)
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('session_id, id')
        .in('session_id', sessionIds)

      if (matchesError) {
        console.error('Error fetching matches:', matchesError)
      }

      // Create a map of session_id to match count
      const matchCountMap = new Map<number, number>()
      matchesData?.forEach((match) => {
        const count = matchCountMap.get(match.session_id) || 0
        matchCountMap.set(match.session_id, count + 1)
      })

      // Transform sessions to include basic info and phase
      const sessions = sessionsData.map((sessionRow) => {
        const sessionDate = sessionRow.date
          ? new Date(sessionRow.date)
          : new Date()

        const hasMatches = (matchCountMap.get(sessionRow.id) || 0) > 0

        return {
          id: sessionRow.public_id,
          venueName: sessionRow.venue_name || '',
          venueLocation: sessionRow.venue_location || '',
          date: sessionDate,
          levels: sessionRow.levels || [],
          hasMatches,
          status: sessionRow.status,
          votingClosesAt: sessionRow.voting_closes_at
            ? new Date(sessionRow.voting_closes_at)
            : null,
        }
      })

      return sessions
    } catch (err) {
      console.error('Error in fetchSessions:', err)
      throw err
    }
  }),
)

export const sessionsQueryOptions = () =>
  queryOptions({
    queryKey: ['sessions'],
    queryFn: () => fetchSessions(),
  })

export const fetchUserParticipation = createServerFn({ method: 'GET' })
  .inputValidator((playerId: string) => playerId)
  .handler(
    withSentry(async ({ data: playerId }) => {
      try {
        const supabase = getSupabaseServerClient()

        // Fetch all votes by this player with session info
        const { data: votesData, error: votesError } = await supabase
          .from('session_votes')
          .select('session_id, sessions!inner(public_id)')
          .eq('player_id', playerId)

        if (votesError) {
          console.error('Error fetching votes:', votesError)
        }

        // Fetch all match participations by this player with session info
        // Use explicit FK reference to avoid ambiguity with booker_id relationship
        const { data: participationsData, error: participationsError } =
          await supabase
            .from('match_participants')
            .select(
              'match_id, matches!match_participants_match_id_fkey(session_id, sessions!inner(public_id))',
            )
            .eq('player_id', playerId)

        if (participationsError) {
          console.error('Error fetching participations:', participationsError)
        }

        // Build sets of session public_ids where user has voted or joined
        const votedSessionIds = new Set<string>()
        const joinedSessionIds = new Set<string>()

        votesData?.forEach((vote) => {
          const sessions = vote.sessions as { public_id: string } | null
          if (sessions?.public_id) {
            votedSessionIds.add(sessions.public_id)
          }
        })

        participationsData?.forEach((participation) => {
          const matches = participation.matches as {
            session_id: number
            sessions: { public_id: string }
          } | null
          if (matches?.sessions?.public_id) {
            joinedSessionIds.add(matches.sessions.public_id)
          }
        })

        return {
          votedSessionIds: Array.from(votedSessionIds),
          joinedSessionIds: Array.from(joinedSessionIds),
        }
      } catch (err) {
        console.error('Error in fetchUserParticipation:', err)
        return { votedSessionIds: [], joinedSessionIds: [] }
      }
    }),
  )

export const userParticipationQueryOptions = (playerId: string | undefined) =>
  queryOptions({
    queryKey: ['sessions', 'participation', playerId],
    queryFn: () =>
      playerId
        ? fetchUserParticipation({ data: playerId })
        : Promise.resolve({ votedSessionIds: [], joinedSessionIds: [] }),
    enabled: !!playerId,
  })

export const fetchSession = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(
    withSentry(async ({ data }): Promise<Session> => {
      try {
        const supabase = getSupabaseServerClient()

        // Fetch session from Supabase using public_id
        const { data: sessionRow, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('public_id', data)
          .single()

        if (error) {
          console.error('Supabase error:', error)
          if (error.code === 'PGRST116') {
            throw notFound()
          }
          throw new Error(`Failed to fetch session: ${error.message}`)
        }

        if (!sessionRow) {
          throw notFound()
        }

        // Fetch votes for this session
        const { data: votesData, error: votesError } = await supabase
          .from('session_votes')
          .select('*, players(*)')
          .eq('session_id', sessionRow.id)

        if (votesError) {
          console.error('Error fetching votes:', votesError)
        }

        // Transform database row to Session type
        const sessionDate = sessionRow.date
          ? new Date(sessionRow.date)
          : new Date()

        // Parse time slots from JSON
        const timeSlotsRaw: Array<RawTimeSlot> = sessionRow.time_slots
          ? typeof sessionRow.time_slots === 'string'
            ? JSON.parse(sessionRow.time_slots)
            : sessionRow.time_slots
          : []

        // Add players to options based on votes
        const timeSlots = timeSlotsRaw
          .map((slot) => ({
            id: slot.id,
            range: [new Date(slot.range[0]), new Date(slot.range[1])] as [
              Date,
              Date,
            ],
            options: slot.options.map((option) => {
              // Find all votes for this option
              const votesForOption = votesData?.filter(
                (vote) => vote.option_id === option.id,
              )

              // Transform votes to players with votedAt timestamp
              const players =
                votesForOption?.map((vote) => ({
                  ...(vote.players as Player),
                  votedAt: new Date(vote.voted_at),
                })) || []

              return {
                id: option.id,
                slot: {
                  id: slot.id,
                  range: [new Date(slot.range[0]), new Date(slot.range[1])] as [
                    Date,
                    Date,
                  ],
                },
                level: option.level,
                players,
              }
            }),
          }))
          .sort((a, b) => {
            // Sort time slots by start time
            const aTime = new Date(a.range[0]).getTime()
            const bTime = new Date(b.range[0]).getTime()
            return aTime - bTime
          })

        // Parse venues from JSON or create from legacy fields
        const venues: Array<SessionVenue> = sessionRow.venues
          ? typeof sessionRow.venues === 'string'
            ? JSON.parse(sessionRow.venues)
            : sessionRow.venues
          : [
              {
                name: sessionRow.venue_name || '',
                location: sessionRow.venue_location || '',
                isPrimary: true,
              },
            ]

        const session: Session = {
          id: sessionRow.public_id,
          venues,
          date: sessionDate,
          levels: (sessionRow.levels || []).map((level) => ({
            level,
            timeSlots: [],
          })),
          timeSlots,
          limitPlayers: sessionRow.limit_players || false,
          playersPerSlot: sessionRow.players_per_slot || undefined,
          votingClosesAt: sessionRow.voting_closes_at
            ? new Date(sessionRow.voting_closes_at)
            : undefined,
          status: sessionRow.status,
        }

        return session
      } catch (err) {
        console.error('Error fetching session:', err)
        if (err instanceof Error && err.message.includes('404')) {
          throw notFound()
        }
        throw err
      }
    }),
  )

export const fetchMatches = createServerFn({ method: 'GET' })
  .inputValidator((sessionId: string) => sessionId)
  .handler(
    withSentry(async ({ data: sessionPublicId }): Promise<Array<Match>> => {
      try {
        const supabase = getSupabaseServerClient()

        // Get session ID from public_id
        const { data: sessionRow, error: sessionError } = await supabase
          .from('sessions')
          .select('id')
          .eq('public_id', sessionPublicId)
          .single()

        if (sessionError || !sessionRow) {
          console.error('Session not found:', sessionError)
          return []
        }

        // Fetch all matches for this session with participants, booker, and Playtomic data
        // Use explicit FK reference to avoid ambiguity with booker_id relationship
        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select(
            `
          *,
          match_participants!match_participants_match_id_fkey (
            id,
            player_id,
            joined_at,
            source,
            players (*)
          ),
          booker:match_participants!matches_booker_id_fkey (
            id,
            player_id,
            players (id, name, phone, avatar)
          ),
          playtomic_matches (*)
        `,
          )
          .eq('session_id', sessionRow.id)
          .order('start_time', { ascending: true })

        if (matchesError) {
          console.error('Error fetching matches:', matchesError)
          return []
        }

        if (!matchesData || matchesData.length === 0) {
          // No matches generated yet
          return []
        }

        // Transform database matches to Match type
        const matches: Array<Match> = matchesData.map((match) => {
          const participants = match.match_participants
          const players = participants.map((p) => ({
            ...p.players,
            participantId: p.id,
            votedAt: new Date(p.joined_at), // Use joined_at as votedAt timestamp
            status: 'draft' as const, // Default status for now
          }))

          // Extract booker information
          const bookerData = match.booker as {
            id: number
            player_id: string
            players: {
              id: string
              name: string | null
              phone: string | null
              avatar: string | null
            } | null
          } | null
          const booker = bookerData?.players
            ? {
                participantId: bookerData.id,
                playerId: bookerData.player_id,
                name: bookerData.players.name,
                phone: bookerData.players.phone,
                avatar: bookerData.players.avatar,
              }
            : null

          // Transform Playtomic match data if it exists
          const playtomicMatch = match.playtomic_matches
            ? {
                id: match.playtomic_matches.id,
                playtomic_match_id: match.playtomic_matches.playtomic_match_id,
                match_url: match.playtomic_matches.match_url,
                club_name: match.playtomic_matches.club_name,
                court_name: match.playtomic_matches.court_name,
                start_time: match.playtomic_matches.start_time,
                end_time: match.playtomic_matches.end_time,
                playtomic_players: match.playtomic_matches
                  .playtomic_players as any,
                match_status: match.playtomic_matches.match_status as
                  | 'scheduled'
                  | 'played'
                  | 'cancelled'
                  | null,
                score: match.playtomic_matches.score as {
                  team1: number
                  team2: number
                } | null,
                last_synced_at: match.playtomic_matches.last_synced_at,
                created_at: match.playtomic_matches.created_at,
                updated_at: match.playtomic_matches.updated_at,
              }
            : null

          return {
            id: match.public_id,
            sessionId: sessionPublicId,
            slot: {
              id: match.time_slot_id,
              range: [new Date(match.start_time), new Date(match.end_time)],
            },
            level: match.level as
              | 'beginner'
              | 'improver'
              | 'intermediate'
              | 'advanced',
            players,
            playtomicMatch,
            booker,
            status: 'draft' as const, // Default status
          }
        })

        return matches
      } catch (err) {
        console.error('Error in fetchMatches:', err)
        return []
      }
    }),
  )

export const sessionQueryOptions = (sessionId: string) =>
  queryOptions({
    queryKey: ['sessions', sessionId],
    queryFn: () => fetchSession({ data: sessionId }),
  })

export const matchQueryOptions = (sessionId: string) =>
  queryOptions({
    queryKey: ['sessions', sessionId, 'matches'],
    queryFn: () => fetchMatches({ data: sessionId }),
  })

// Vote for an option (time slot + level combination)
export const voteForOption = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        sessionPublicId: z.string(),
        optionId: z.string(),
        playerId: z.string(),
      }),
    ),
  )
  .handler(
    withSentry(async ({ data }) => {
      const supabase = getSupabaseServerClient()

      // Get session ID from public_id
      const { data: sessionRow, error: sessionError } = await supabase
        .from('sessions')
        .select('id')
        .eq('public_id', data.sessionPublicId)
        .single()

      if (sessionError || !sessionRow) {
        throw new Error('Session not found')
      }

      // Insert or update vote (upsert on unique constraint)
      const { error } = await supabase.from('session_votes').upsert(
        {
          player_id: data.playerId,
          session_id: sessionRow.id,
          option_id: data.optionId,
        },
        {
          onConflict: 'player_id,session_id,option_id',
        },
      )

      if (error) {
        console.error('Error voting:', error)
        // Check for common error cases and provide user-friendly messages
        if (error.message.includes('row-level security policy')) {
          throw new Error(
            'Unable to add vote. The player may already have a vote in this time slot.',
          )
        }
        if (error.code === '23505') {
          // Unique constraint violation
          throw new Error('This player has already voted for this option.')
        }
        throw new Error(`Failed to vote: ${error.message}`)
      }

      return { success: true }
    }),
  )

// Remove vote for an option
export const unvoteForOption = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        sessionPublicId: z.string(),
        optionId: z.string(),
        playerId: z.string(),
      }),
    ),
  )
  .handler(
    withSentry(async ({ data }) => {
      const supabase = getSupabaseServerClient()

      // Get session ID from public_id
      const { data: sessionRow, error: sessionError } = await supabase
        .from('sessions')
        .select('id')
        .eq('public_id', data.sessionPublicId)
        .single()

      if (sessionError || !sessionRow) {
        throw new Error('Session not found')
      }

      // Delete the vote
      const { error } = await supabase
        .from('session_votes')
        .delete()
        .eq('player_id', data.playerId)
        .eq('session_id', sessionRow.id)
        .eq('option_id', data.optionId)

      if (error) {
        console.error('Error unvoting:', error)
        throw new Error(`Failed to remove vote: ${error.message}`)
      }

      return { success: true }
    }),
  )

// Join a match
export const joinMatch = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        matchPublicId: z.string(),
        playerId: z.string(),
        source: z.enum(['vote', 'manual']).default('manual'),
      }),
    ),
  )
  .handler(
    withSentry(async ({ data }) => {
      const supabase = getSupabaseServerClient()

      // Get match ID from public_id
      const { data: matchRow, error: matchError } = await supabase
        .from('matches')
        .select('id, max_players, start_time, end_time, session_id, booker_id')
        .eq('public_id', data.matchPublicId)
        .single()

      if (matchError || !matchRow) {
        throw new Error('Match not found')
      }

      // Check if match is full
      const { count, error: countError } = await supabase
        .from('match_participants')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', matchRow.id)

      if (countError) {
        throw new Error(`Failed to check match capacity: ${countError.message}`)
      }

      if (count !== null && count >= matchRow.max_players) {
        throw new Error('Match is full')
      }

      // Insert participant (trigger will check for time overlap)
      const { error } = await supabase.from('match_participants').insert({
        match_id: matchRow.id,
        player_id: data.playerId,
        source: data.source,
      })

      if (error) {
        console.error('Error joining match:', error)
        // Check if it's a time overlap error from the trigger
        if (
          error.message.includes('already in a match during this time slot')
        ) {
          throw new Error('You are already in a match during this time slot')
        }
        throw new Error(`Failed to join match: ${error.message}`)
      }

      // If match has no booker, assign the best one (considering session-wide fairness)
      if (!matchRow.booker_id) {
        const bestBookerId = await selectBestBooker(
          supabase,
          matchRow.id,
          matchRow.session_id,
        )
        if (bestBookerId) {
          const { error: updateError } = await supabase
            .from('matches')
            .update({ booker_id: bestBookerId })
            .eq('id', matchRow.id)

          if (updateError) {
            console.error('Error assigning booker:', updateError)
            // Don't fail the join operation for booker assignment
          }
        }
      }

      return { success: true }
    }),
  )

// Leave a match (unjoin)
export const unjoinMatch = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        matchPublicId: z.string(),
        playerId: z.string(),
      }),
    ),
  )
  .handler(
    withSentry(async ({ data }) => {
      const supabase = getSupabaseServerClient()

      // Get match ID from public_id along with booker info
      const { data: matchRow, error: matchError } = await supabase
        .from('matches')
        .select('id, session_id, booker_id')
        .eq('public_id', data.matchPublicId)
        .single()

      if (matchError || !matchRow) {
        throw new Error('Match not found')
      }

      // Get the participant ID before deleting (to check if they are the booker)
      const { data: participantRow, error: participantError } = await supabase
        .from('match_participants')
        .select('id')
        .eq('match_id', matchRow.id)
        .eq('player_id', data.playerId)
        .single()

      if (participantError || !participantRow) {
        throw new Error('Participant not found')
      }

      const leavingParticipantId = participantRow.id
      const isLeavingBooker = matchRow.booker_id === leavingParticipantId

      // Delete the participant
      const { error } = await supabase
        .from('match_participants')
        .delete()
        .eq('match_id', matchRow.id)
        .eq('player_id', data.playerId)

      if (error) {
        console.error('Error leaving match:', error)
        throw new Error(`Failed to leave match: ${error.message}`)
      }

      // If the leaving player was the booker, reassign to another participant
      if (isLeavingBooker) {
        const newBookerId = await selectBestBooker(
          supabase,
          matchRow.id,
          matchRow.session_id,
        )

        // Update booker_id (will be null if no participants left)
        const { error: updateError } = await supabase
          .from('matches')
          .update({ booker_id: newBookerId })
          .eq('id', matchRow.id)

        if (updateError) {
          console.error('Error reassigning booker:', updateError)
          // Don't fail the unjoin operation for booker reassignment
        }
      }

      return { success: true }
    }),
  )

// Update booker for a match (organizer only)
export const updateMatchBooker = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        matchPublicId: z.string(),
        participantId: z.number(),
      }),
    ),
  )
  .handler(
    withSentry(async ({ data }) => {
      const supabase = getSupabaseServerClient()

      // Get current user and verify organizer role
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('User not authenticated')
      }

      // Check if user is organizer
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'organizer')
        .single()

      if (!userRoles) {
        throw new Error('Only organizers can update match bookers')
      }

      // Get match ID from public_id
      const { data: matchRow, error: matchError } = await supabase
        .from('matches')
        .select('id')
        .eq('public_id', data.matchPublicId)
        .single()

      if (matchError || !matchRow) {
        throw new Error('Match not found')
      }

      // Verify participant exists and belongs to this match
      const { data: participant, error: participantError } = await supabase
        .from('match_participants')
        .select('id')
        .eq('id', data.participantId)
        .eq('match_id', matchRow.id)
        .single()

      if (participantError || !participant) {
        throw new Error('Participant not found in this match')
      }

      // Update the booker_id
      // Note: WhatsApp notification is handled by database trigger
      const { error: updateError } = await supabase
        .from('matches')
        .update({ booker_id: data.participantId })
        .eq('id', matchRow.id)

      if (updateError) {
        throw new Error(`Failed to update booker: ${updateError.message}`)
      }

      return { success: true }
    }),
  )

// Block/unblock a player (organizer only)
export const toggleBlockPlayer = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        playerId: z.string(),
        isBlocked: z.boolean(),
      }),
    ),
  )
  .handler(
    withSentry(async ({ data }) => {
      const supabase = getSupabaseServerClient()

      const { error } = await supabase
        .from('players')
        .update({ is_blocked: data.isBlocked })
        .eq('id', data.playerId)

      if (error) {
        console.error('Error toggling block status:', error)
        throw new Error(
          `Failed to ${data.isBlocked ? 'block' : 'unblock'} player`,
        )
      }

      return { success: true }
    }),
  )

// Remove a player from a match (organizer only)
export const removePlayerFromMatch = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        matchPublicId: z.string(),
        playerId: z.string(),
      }),
    ),
  )
  .handler(
    withSentry(async ({ data }) => {
      const supabase = getSupabaseServerClient()

      // Get match by public_id
      const { data: matchRow, error: matchError } = await supabase
        .from('matches')
        .select('id, booker_id, session_id')
        .eq('public_id', data.matchPublicId)
        .single()

      if (matchError || !matchRow) {
        throw new Error('Match not found')
      }

      // Get participant to check if they're the booker
      const { data: participantRow, error: participantError } = await supabase
        .from('match_participants')
        .select('id')
        .eq('match_id', matchRow.id)
        .eq('player_id', data.playerId)
        .single()

      if (participantError || !participantRow) {
        throw new Error('Player not in this match')
      }

      const removingParticipantId = participantRow.id
      const isRemovingBooker = matchRow.booker_id === removingParticipantId

      // Delete the participant
      const { error } = await supabase
        .from('match_participants')
        .delete()
        .eq('match_id', matchRow.id)
        .eq('player_id', data.playerId)

      if (error) {
        console.error('Error removing player from match:', error)
        throw new Error(`Failed to remove player: ${error.message}`)
      }

      // If the removed player was the booker, reassign to another participant
      if (isRemovingBooker) {
        const newBookerId = await selectBestBooker(
          supabase,
          matchRow.id,
          matchRow.session_id,
        )

        const { error: updateError } = await supabase
          .from('matches')
          .update({ booker_id: newBookerId })
          .eq('id', matchRow.id)

        if (updateError) {
          console.error('Error reassigning booker:', updateError)
        }
      }

      return { success: true }
    }),
  )

// Search players by name or phone (fuzzy search)
export const searchPlayers = createServerFn({ method: 'GET' })
  .inputValidator(
    zodValidator(
      z.object({
        query: z.string().min(1),
        excludeIds: z.array(z.string()).optional(),
      }),
    ),
  )
  .handler(
    withSentry(async ({ data }) => {
      const supabase = getSupabaseServerClient()

      // Search by name (case-insensitive, partial match) or phone
      let query = supabase
        .from('players')
        .select('id, name, phone, avatar, level, playtomic_id, is_blocked')
        .eq('is_blocked', false)
        .or(`name.ilike.%${data.query}%,phone.ilike.%${data.query}%`)
        .limit(10)

      if (data.excludeIds && data.excludeIds.length > 0) {
        query = query.not('id', 'in', `(${data.excludeIds.join(',')})`)
      }

      const { data: players, error } = await query

      if (error) {
        console.error('Error searching players:', error)
        throw new Error('Failed to search players')
      }

      return players ?? []
    }),
  )

// Add a player to a match (organizer only)
export const addPlayerToMatch = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        matchPublicId: z.string(),
        playerId: z.string(),
      }),
    ),
  )
  .handler(
    withSentry(async ({ data }) => {
      const supabase = getSupabaseServerClient()

      // Get match by public_id
      const { data: matchRow, error: matchError } = await supabase
        .from('matches')
        .select('id, max_players, session_id')
        .eq('public_id', data.matchPublicId)
        .single()

      if (matchError || !matchRow) {
        throw new Error('Match not found')
      }

      // Check current player count
      const { count, error: countError } = await supabase
        .from('match_participants')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', matchRow.id)

      if (countError) {
        throw new Error('Failed to check match capacity')
      }

      if ((count ?? 0) >= matchRow.max_players) {
        throw new Error('Match is full')
      }

      // Check if player is blocked
      const { data: playerRow, error: playerError } = await supabase
        .from('players')
        .select('is_blocked')
        .eq('id', data.playerId)
        .single()

      if (playerError || !playerRow) {
        throw new Error('Player not found')
      }

      if (playerRow.is_blocked) {
        throw new Error('Player is blocked')
      }

      // Add participant
      const { error: insertError } = await supabase
        .from('match_participants')
        .insert({
          match_id: matchRow.id,
          player_id: data.playerId,
          source: 'organizer',
        })

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('Player is already in this match')
        }
        console.error('Error adding player to match:', insertError)
        throw new Error(`Failed to add player: ${insertError.message}`)
      }

      return { success: true }
    }),
  )

// Helper function to generate matches from voting results
async function generateMatchesHelper(sessionPublicId: string) {
  const supabase = getSupabaseServerClient()
  const uid = new ShortUniqueId({ length: 8 })

  // Get session
  const { data: sessionRow, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('public_id', sessionPublicId)
    .single()

  if (sessionError || !sessionRow) {
    throw new Error('Session not found')
  }

  // Get all votes for this session
  const { data: votes, error: votesError } = await supabase
    .from('session_votes')
    .select('option_id, player_id')
    .eq('session_id', sessionRow.id)

  if (votesError) {
    throw new Error(`Failed to fetch votes: ${votesError.message}`)
  }

  // Parse time slots from JSON
  const timeSlots =
    typeof sessionRow.time_slots === 'string'
      ? JSON.parse(sessionRow.time_slots)
      : sessionRow.time_slots

  // Transform database format to function input
  const options: Array<TimeSlotOption> = []
  for (const timeSlot of timeSlots) {
    for (const option of timeSlot.options) {
      options.push({
        id: option.id,
        timeSlotId: timeSlot.id,
        level: option.level,
        startTime: new Date(timeSlot.range[0]),
        endTime: new Date(timeSlot.range[1]),
      })
    }
  }

  const voteInputs: Array<VoteInput> =
    votes?.map((vote) => ({
      optionId: vote.option_id,
      playerId: vote.player_id,
    })) || []

  // Call the pure match generation function
  const generatedMatches = generateMatchesFromVotes(options, voteInputs)

  // Transform domain model back to database format
  const matchesToCreate: Array<any> = []
  const participantsToCreate: Array<any> = []

  for (const match of generatedMatches) {
    const matchId = uid.rnd()
    matchesToCreate.push({
      session_id: sessionRow.id,
      public_id: matchId,
      time_slot_id: match.timeSlotId,
      level: match.level,
      start_time: match.startTime.toISOString(),
      end_time: match.endTime.toISOString(),
      max_players: match.maxPlayers,
    })

    // Add participants for this match
    for (const playerId of match.playerIds) {
      participantsToCreate.push({
        match_public_id: matchId,
        player_id: playerId,
        source: 'vote',
      })
    }
  }

  // Insert matches into database
  const { data: insertedMatches, error: matchesError } = await supabase
    .from('matches')
    .insert(matchesToCreate)
    .select()

  if (matchesError) {
    console.error('Error creating matches:', matchesError)
    throw new Error(`Failed to create matches: ${matchesError.message}`)
  }

  // Create a map of public_id to id for participants
  const matchIdMap = new Map(
    insertedMatches.map((match) => [match.public_id, match.id]),
  )

  // Update participants with actual match IDs
  const participantsWithIds = participantsToCreate
    .map((p) => ({
      match_id: matchIdMap.get(p.match_public_id),
      player_id: p.player_id,
      source: p.source,
    }))
    .filter((p) => p.match_id !== undefined) as Array<{
    match_id: number
    player_id: string
    source: string
  }>

  // Insert participants
  if (participantsWithIds.length > 0) {
    const { data: insertedParticipants, error: participantsError } =
      await supabase
        .from('match_participants')
        .insert(participantsWithIds)
        .select()

    if (participantsError) {
      console.error('Error creating participants:', participantsError)
      throw new Error(
        `Failed to add players to matches: ${participantsError.message}`,
      )
    }

    // Assign bookers to each match
    // Strategy: For each match, pick a random participant, but prefer players
    // who are not already bookers in other matches in this session
    if (insertedParticipants && insertedParticipants.length > 0) {
      // Group participants by match_id
      const participantsByMatch = new Map<number, typeof insertedParticipants>()
      for (const participant of insertedParticipants) {
        const existing = participantsByMatch.get(participant.match_id) || []
        existing.push(participant)
        participantsByMatch.set(participant.match_id, existing)
      }

      // Track which players are already assigned as bookers
      const playersAlreadyBookers = new Set<string>()

      // Process matches in order to assign bookers fairly
      for (const matchId of participantsByMatch.keys()) {
        const participants = participantsByMatch.get(matchId) || []

        if (participants.length === 0) continue

        // Shuffle participants randomly
        const shuffled = [...participants].sort(() => Math.random() - 0.5)

        // Sort so that players who are already bookers come last
        shuffled.sort((a, b) => {
          const aIsBooker = playersAlreadyBookers.has(a.player_id)
          const bIsBooker = playersAlreadyBookers.has(b.player_id)
          if (aIsBooker && !bIsBooker) return 1
          if (!aIsBooker && bIsBooker) return -1
          return 0
        })

        // Pick the first participant (least likely to be already a booker)
        const selectedBooker = shuffled[0]

        // Update the match with the booker_id
        const { error: updateError } = await supabase
          .from('matches')
          .update({ booker_id: selectedBooker.id })
          .eq('id', matchId)

        if (updateError) {
          console.error('Error assigning booker:', updateError)
          // Don't fail the entire operation for booker assignment
        } else {
          // Track this player as a booker
          playersAlreadyBookers.add(selectedBooker.player_id)
        }
      }
    }
  }

  return { success: true, matchesCreated: insertedMatches.length }
}

// Generate matches from voting results (hybrid approach)
export const generateMatches = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.object({ sessionPublicId: z.string() })))
  .handler(
    withSentry(async ({ data }) => {
      // Delegate to the helper function
      return generateMatchesHelper(data.sessionPublicId)
    }),
  )

export const useVoteForSession = ({
  sessionId,
  currentUserId,
}: {
  sessionId: string
  currentUserId: string
}) => {
  const queryClient = useQueryClient()

  const { mutate: voteForSession } = useMutation({
    mutationFn: async ({
      timeSlot,
      level,
      session,
      currentUser: user,
    }: {
      timeSlot: string
      level: string
      session: Session
      currentUser: Player
    }): Promise<void> => {
      // Find the option for this time slot + level combination
      const slot = session.timeSlots.find((ts) => ts.id === timeSlot)
      const option = slot?.options.find((o) => o.level === level)

      if (!option) {
        throw new Error('Option not found')
      }

      // Check if user already voted for this option (toggle behavior)
      const alreadyVoted = option.players.some(
        (player) => player.id === user.id,
      )

      if (alreadyVoted) {
        // Unvote
        await unvoteForOption({
          data: {
            sessionPublicId: sessionId,
            optionId: option.id,
            playerId: user.id,
          },
        })
      } else {
        // Remove votes from other levels in same time slot first
        const otherOptionsInSlot =
          slot?.options.filter((o) => o.level !== level) || []
        const unvotePromises = otherOptionsInSlot
          .filter((otherOption) =>
            otherOption.players.some((p) => p.id === user.id),
          )
          .map((otherOption) =>
            unvoteForOption({
              data: {
                sessionPublicId: sessionId,
                optionId: otherOption.id,
                playerId: user.id,
              },
            }),
          )
        await Promise.all(unvotePromises)

        // Vote for the new option
        await voteForOption({
          data: {
            sessionPublicId: sessionId,
            optionId: option.id,
            playerId: user.id,
          },
        })
      }
    },
    // Optimistic update BEFORE mutation
    onMutate: async ({ timeSlot, level, session, currentUser: user }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['sessions', sessionId] })

      // Snapshot the previous value
      const previousSession = queryClient.getQueryData<Session>([
        'sessions',
        sessionId,
      ])

      // Check if this is a vote or unvote
      const slot = session.timeSlots.find((ts) => ts.id === timeSlot)
      const option = slot?.options.find((o) => o.level === level)
      const isUnvoting =
        option?.players.some((player) => player.id === user.id) ?? false

      // Optimistically update to the new value
      queryClient.setQueryData<Session>(
        ['sessions', sessionId],
        (old: Session | undefined): Session | undefined => {
          if (!old) return old

          const optionsInSlot = old.timeSlots.find(
            (timeSlotObj) => timeSlotObj.id === timeSlot,
          )?.options

          if (!optionsInSlot) {
            return old
          }

          const updatedGamesInSlot = optionsInSlot.map((option) => {
            // If the currently selected level is the same as the one we are voting for, we should remove the vote.
            if (
              option.level === level &&
              option.players.some((player) => player.id === user.id)
            ) {
              return {
                ...option,
                players: option.players.filter(
                  (player) => player.id !== user.id,
                ),
              }
            }

            // Remove the current user from all levels in this time slot first
            const playersWithoutCurrentUser = option.players.filter(
              (player) => player.id !== user.id,
            )

            // Add the user only to the selected level
            if (option.level === level) {
              return {
                ...option,
                players: [
                  {
                    ...user,
                    votedAt: new Date(),
                  },
                  ...playersWithoutCurrentUser,
                ],
              }
            }

            return { ...option, players: playersWithoutCurrentUser }
          })

          return {
            ...old,
            timeSlots: old.timeSlots.map((ts) => {
              if (ts.id === timeSlot) {
                return { ...ts, options: updatedGamesInSlot }
              }
              return ts
            }),
          }
        },
      )

      // Return context with the snapshot and whether this is unvoting
      return { previousSession, isUnvoting }
    },
    onError: (error, _variables, context) => {
      // Rollback to previous value on error
      if (context?.previousSession) {
        queryClient.setQueryData(
          ['sessions', sessionId],
          context.previousSession,
        )
      }

      console.error('Error voting for session:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error('Failed to vote for session', {
        description: errorMessage,
      })
    },
    onSuccess: (_data, { timeSlot, level, session }, context) => {
      // Find the time slot to get the start time
      const slot = session.timeSlots.find((ts) => ts.id === timeSlot)
      const timeSlotStart = slot?.range[0] ? format(slot.range[0], 'HH:mm') : ''
      const levelStr = level.toLowerCase()

      if (context?.isUnvoting) {
        toast.success(
          `You removed your vote from the ${timeSlotStart} ${levelStr} slot`,
        )
      } else {
        toast.success(`You voted for the ${timeSlotStart} ${levelStr} slot`)
      }
    },
    // Always refetch after error or success to sync with server
    onSettled: () => {
      // Only invalidate when this is the last mutation in flight
      if (queryClient.isMutating({ mutationKey: ['vote', sessionId] }) === 1) {
        queryClient.invalidateQueries({ queryKey: ['sessions', sessionId] })
        queryClient.invalidateQueries({
          queryKey: ['sessions', 'participation', currentUserId],
        })
      }
    },
  })
  return { voteForSession }
}

// Hook for joining/unjoining matches
export const useMatchActions = ({
  sessionId,
  currentUserId,
}: {
  sessionId: string
  currentUserId: string
}) => {
  const queryClient = useQueryClient()

  const { mutate: joinMatchMutation, isPending: isJoining } = useMutation({
    mutationFn: async (matchPublicId: string) => {
      await joinMatch({
        data: {
          matchPublicId,
          playerId: currentUserId,
          source: 'manual',
        },
      })
    },
    onError: (error) => {
      console.error('Error joining match:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error('Failed to join match', {
        description: errorMessage,
      })
    },
    onSuccess: (_data, matchPublicId) => {
      // Get match data from query cache (using same key as matchQueryOptions)
      const matches = queryClient.getQueryData<Array<Match>>([
        'sessions',
        sessionId,
        'matches',
      ])
      const match = matches?.find((m) => m.id === matchPublicId)

      if (match) {
        const timeSlotStart = match.slot.range[0]
          ? format(match.slot.range[0], 'HH:mm')
          : ''
        const level = match.level.toLowerCase()
        toast.success(`You joined the ${timeSlotStart} ${level} match`)
      } else {
        toast.success('Successfully joined match!')
      }
      // Refetch matches to get updated data
      queryClient.invalidateQueries({
        queryKey: ['sessions', sessionId, 'matches'],
      })
    },
  })

  const { mutate: unjoinMatchMutation, isPending: isUnjoining } = useMutation({
    mutationFn: async (matchPublicId: string) => {
      await unjoinMatch({
        data: {
          matchPublicId,
          playerId: currentUserId,
        },
      })
    },
    onError: (error) => {
      console.error('Error leaving match:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error('Failed to leave match', {
        description: errorMessage,
      })
    },
    onSuccess: (_data, matchPublicId) => {
      // Get match data from query cache (using same key as matchQueryOptions)
      const matches = queryClient.getQueryData<Array<Match>>([
        'sessions',
        sessionId,
        'matches',
      ])
      const match = matches?.find((m) => m.id === matchPublicId)

      if (match) {
        const timeSlotStart = match.slot.range[0]
          ? format(match.slot.range[0], 'HH:mm')
          : ''
        const level = match.level.toLowerCase()
        toast.success(`You left the ${timeSlotStart} ${level} match`)
      } else {
        toast.success('Successfully left match!')
      }
      // Refetch matches to get updated data
      queryClient.invalidateQueries({
        queryKey: ['sessions', sessionId, 'matches'],
      })
    },
  })

  const toggleMatchParticipation = (
    matchPublicId: string,
    isCurrentlyJoined: boolean,
  ) => {
    if (isCurrentlyJoined) {
      unjoinMatchMutation(matchPublicId)
    } else {
      joinMatchMutation(matchPublicId)
    }
  }

  return {
    joinMatch: joinMatchMutation,
    unjoinMatch: unjoinMatchMutation,
    toggleMatchParticipation,
    isLoading: isJoining || isUnjoining,
  }
}

export const createSessionValidator = z.object({
  venues: z
    .array(
      z.object({
        name: z.string().min(1, { message: 'Venue name is required' }),
        location: z
          .string()
          .url({ message: 'Please enter a valid URL for the venue' }),
        placeId: z.string().optional(),
        isPrimary: z.boolean(),
      }),
    )
    .min(1, { message: 'At least one venue is required' })
    .refine((venues) => venues.filter((v) => v.isPrimary).length === 1, {
      message: 'Exactly one venue must be marked as primary',
    }),
  date: z.date(),
  levels: z
    .array(
      z.object({
        level: z.string(),
        timeSlots: z.array(
          z.object({ id: z.string(), range: z.tuple([z.date(), z.date()]) }),
        ),
      }),
    )
    .min(1, { message: 'At least one level must be selected' })
    .refine((levels) => levels.some((level) => level.timeSlots.length > 0), {
      message: 'At least one time slot must be selected for at least one level',
    }),
  timeBlocks: z.enum(['60', '90']),
  limitPlayers: z.boolean(),
  playersPerSlot: z
    .number()
    .min(4, { message: 'Players per slot must be at least 4' })
    .multipleOf(4, { message: 'Players per slot must be a multiple of 4' })
    .optional(),
  votingClosesAt: z.date().optional(),
})

export const createSession = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      createSessionValidator.extend({
        status: z
          .enum([
            'draft',
            'voting',
            'poll_closed',
            'open',
            'cancelled',
            'closed',
          ])
          .default('voting'),
      }),
    ),
  )
  .handler(
    withSentry(
      async ({
        data,
      }: {
        data: SessionForm & {
          status?:
            | 'draft'
            | 'voting'
            | 'poll_closed'
            | 'open'
            | 'cancelled'
            | 'closed'
        }
      }): Promise<string> => {
        try {
          const supabase = getSupabaseServerClient()

          // Save all venues to database for future autocomplete
          for (const venue of data.venues) {
            if (venue.name && venue.location && venue.placeId) {
              try {
                await upsertVenue({
                  data: {
                    label: venue.name,
                    mapsUrl: venue.location,
                    placeId: venue.placeId,
                  },
                })
              } catch (error) {
                // Log error but don't fail session creation
                console.error('Error saving venue:', error)
              }
            }
          }

          // Get primary venue for legacy fields
          const primaryVenue =
            data.venues.find((v) => v.isPrimary) || data.venues[0]

          // Generate unique session ID
          const uid = new ShortUniqueId({ length: 8 })

          // Transform the nested structure into the database format
          // Collect all unique time slots from all levels
          const allTimeSlotsMap = new Map<
            string,
            { id: string; range: [Date, Date] }
          >()
          data.levels.forEach((levelData) => {
            levelData.timeSlots.forEach((timeSlot) => {
              if (!allTimeSlotsMap.has(timeSlot.id)) {
                allTimeSlotsMap.set(timeSlot.id, timeSlot)
              }
            })
          })

          // Build time slots with options
          const timeSlots: Array<TimeSlot> = Array.from(
            allTimeSlotsMap.values(),
          ).map((timeSlot) => {
            // For each time slot, find which levels have it
            const options = data.levels
              .filter((levelData) =>
                levelData.timeSlots.some((ts) => ts.id === timeSlot.id),
              )
              .map((levelData) => ({
                id: uid.rnd(),
                slot: timeSlot,
                level: levelData.level,
                players: [],
              }))

            return {
              id: timeSlot.id,
              range: timeSlot.range,
              options,
            }
          })

          // Insert session into Supabase
          const sessionData = {
            public_id: uid.rnd(),
            venue_name: primaryVenue.name,
            venue_location: primaryVenue.location,
            venues: JSON.stringify(data.venues),
            // Combine session.date and session.time into a single ISO datetime string for the "date" field.
            date: formatISO(data.date),
            levels: data.levels.map((l) => l.level),
            time_blocks: parseInt(data.timeBlocks),
            time_slots: JSON.stringify(timeSlots),
            limit_players: data.limitPlayers,
            players_per_slot: data.playersPerSlot,
            status: data.status || 'voting',
            voting_closes_at: data.votingClosesAt
              ? formatISO(data.votingClosesAt)
              : null,
          }

          const { data: session, error } = await supabase
            .from('sessions')
            .insert(sessionData)
            .select()
            .single()

          if (error) {
            throw new Error(`Failed to create session: ${error.message}`)
          }

          return session.public_id
        } catch (error) {
          console.error('Error in createSession:', error)
          throw error
        }
      },
    ),
  )

// Save session as template
export const saveSessionTemplate = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        name: z.string().min(1, { message: 'Template name is required' }),
        templateData: z.object({
          venueName: z.string().optional(),
          venueLocation: z.string().optional(),
          venuePlaceId: z.string().optional(),
          levels: z.array(z.string()),
          timeBlocks: z.enum(['60', '90']),
          timeSlots: z.array(z.object({ id: z.string() })).optional(),
          limitPlayers: z.boolean(),
          playersPerSlot: z.number().optional(),
        }),
      }),
    ),
  )
  .handler(
    withSentry(async ({ data }) => {
      try {
        const supabase = getSupabaseServerClient()

        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          throw new Error('User not authenticated')
        }

        // Insert template
        const { data: template, error } = await supabase
          .from('session_templates')
          .insert({
            name: data.name,
            created_by: user.id,
            template_data: data.templateData,
          })
          .select()
          .single()

        if (error) {
          throw new Error(`Failed to save template: ${error.message}`)
        }

        return { success: true, templateId: template.id }
      } catch (error) {
        console.error('Error in saveSessionTemplate:', error)
        throw error
      }
    }),
  )

// Fetch all templates
export const fetchSessionTemplates = createServerFn({ method: 'GET' }).handler(
  withSentry(async () => {
    try {
      const supabase = getSupabaseServerClient()

      const { data: templates, error } = await supabase
        .from('session_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch templates: ${error.message}`)
      }

      return templates
    } catch (error) {
      console.error('Error in fetchSessionTemplates:', error)
      throw error
    }
  }),
)

// Update session status
export const updateSessionStatus = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        sessionPublicId: z.string(),
        status: z.enum([
          'draft',
          'voting',
          'poll_closed',
          'open',
          'cancelled',
          'closed',
        ]),
      }),
    ),
  )
  .handler(
    withSentry(async ({ data }) => {
      try {
        const supabase = getSupabaseServerClient()

        // Get session with current status
        const { data: sessionRow, error: sessionError } = await supabase
          .from('sessions')
          .select('id, status')
          .eq('public_id', data.sessionPublicId)
          .single()

        if (sessionError || !sessionRow) {
          throw new Error('Session not found')
        }

        const previousStatus = sessionRow.status

        // Update session status
        const { error: updateError } = await supabase
          .from('sessions')
          .update({ status: data.status })
          .eq('id', sessionRow.id)

        if (updateError) {
          throw new Error(
            `Failed to update session status: ${updateError.message}`,
          )
        }

        // If status changed from 'voting' to 'poll_closed', generate matches
        if (previousStatus === 'voting' && data.status === 'poll_closed') {
          // Check if matches already exist
          const { count: matchesCount, error: matchesCheckError } =
            await supabase
              .from('matches')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', sessionRow.id)

          if (matchesCheckError) {
            console.error('Error checking existing matches:', matchesCheckError)
            // Continue anyway - matches generation might still work
          }

          // Only generate matches if they don't already exist
          if (!matchesCount || matchesCount === 0) {
            try {
              await generateMatchesHelper(data.sessionPublicId)
            } catch (generateError) {
              console.error('Error generating matches:', generateError)
              // Don't fail the status update if match generation fails
              // Log the error but return success for status update
            }
          }
        }

        // Note: WhatsApp notifications are now handled by database triggers
        // that call the /api/notify-booker webhook when status changes to 'open'

        return { success: true }
      } catch (error) {
        console.error('Error in updateSessionStatus:', error)
        throw error
      }
    }),
  )

// Delete session
export const deleteSession = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.object({ sessionPublicId: z.string() })))
  .handler(
    withSentry(async ({ data }) => {
      try {
        const supabase = getSupabaseServerClient()

        // Get session ID from public_id
        const { data: sessionRow, error: sessionError } = await supabase
          .from('sessions')
          .select('id')
          .eq('public_id', data.sessionPublicId)
          .single()

        if (sessionError || !sessionRow) {
          throw new Error('Session not found')
        }

        // Delete session (cascading deletes will handle related records)
        const { error: deleteError } = await supabase
          .from('sessions')
          .delete()
          .eq('id', sessionRow.id)

        if (deleteError) {
          throw new Error(`Failed to delete session: ${deleteError.message}`)
        }

        return { success: true }
      } catch (error) {
        console.error('Error in deleteSession:', error)
        throw error
      }
    }),
  )
