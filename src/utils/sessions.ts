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
import {
  formatISO,
  setHours,
  setMinutes,
  getMinutes,
  getHours,
  format,
} from 'date-fns'
import { getMockSession } from './mock'
import { getSupabaseServerClient } from './supabase'
import type { Match, Player, Session, SessionForm } from './types'

export const fetchSessions = createServerFn({ method: 'GET' }).handler(
  async () => {
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
  },
)

export const sessionsQueryOptions = () =>
  queryOptions({
    queryKey: ['sessions'],
    queryFn: () => fetchSessions(),
  })

export const fetchSession = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data }): Promise<Session> => {
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
      const timeSlotsRaw = sessionRow.time_slots
        ? typeof sessionRow.time_slots === 'string'
          ? JSON.parse(sessionRow.time_slots)
          : sessionRow.time_slots
        : []

      // Add players to options based on votes
      const timeSlots = timeSlotsRaw.map((slot: any) => ({
        ...slot,
        options: slot.options.map((option: any) => {
          // Find all votes for this option
          const votesForOption = votesData?.filter(
            (vote) => vote.option_id === option.id,
          )

          // Transform votes to players with votedAt timestamp
          const players =
            votesForOption?.map((vote) => ({
              ...(vote.players as any),
              votedAt: new Date(vote.voted_at),
            })) || []

          return {
            ...option,
            players,
          }
        }),
      }))

      const session: Session = {
        id: sessionRow.public_id,
        venueName: sessionRow.venue_name || '',
        venueLocation: sessionRow.venue_location || '',
        date: sessionDate,
        time: sessionDate, // Use the same date for time since date contains the full datetime
        levels: sessionRow.levels || [],
        timeSlots,
        limitPlayers: sessionRow.limit_players || false,
        playersPerSlot: sessionRow.players_per_slot || undefined,
      }

      return session
    } catch (err) {
      console.error('Error fetching session:', err)
      if (err instanceof Error && err.message.includes('404')) {
        throw notFound()
      }
      throw err
    }
  })

export const fetchMatches = createServerFn({ method: 'GET' })
  .inputValidator((sessionId: string) => sessionId)
  .handler(async ({ data: sessionPublicId }) => {
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

      // Fetch all matches for this session with participants
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(
          `
          *,
          match_participants (
            *,
            players (*)
          )
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
      const matches = matchesData.map((match) => {
        const participants = (match.match_participants as any[]) || []
        const players = participants.map((p) => ({
          ...(p.players as any),
          status: 'draft' as const, // Default status for now
        }))

        return {
          id: match.public_id,
          sessionId: sessionPublicId,
          slot: {
            id: match.time_slot_id,
            range: [new Date(match.start_time), new Date(match.end_time)],
          },
          level: match.level,
          players,
          playtomicMatch: null, // No Playtomic integration yet
          status: 'draft' as const, // Default status
        }
      })

      return matches
    } catch (err) {
      console.error('Error in fetchMatches:', err)
      return []
    }
  })

export const sessionQueryOptions = (sessionId: string) =>
  queryOptions({
    queryKey: ['session', sessionId],
    queryFn: () => fetchSession({ data: sessionId }),
  })

export const matchQueryOptions = (sessionId: string) =>
  queryOptions({
    queryKey: ['matches', sessionId],
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
  .handler(async ({ data }) => {
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
      throw new Error(`Failed to vote: ${error.message}`)
    }

    return { success: true }
  })

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
  .handler(async ({ data }) => {
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
  })

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
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()

    // Get match ID from public_id
    const { data: matchRow, error: matchError } = await supabase
      .from('matches')
      .select('id, max_players, start_time, end_time, session_id')
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
      if (error.message.includes('already in a match during this time slot')) {
        throw new Error('You are already in a match during this time slot')
      }
      throw new Error(`Failed to join match: ${error.message}`)
    }

    return { success: true }
  })

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
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()

    // Get match ID from public_id
    const { data: matchRow, error: matchError } = await supabase
      .from('matches')
      .select('id')
      .eq('public_id', data.matchPublicId)
      .single()

    if (matchError || !matchRow) {
      throw new Error('Match not found')
    }

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

    return { success: true }
  })

// Generate matches from voting results (hybrid approach)
export const generateMatches = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.object({ sessionPublicId: z.string() })))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()
    const uid = new ShortUniqueId({ length: 8 })

    // Get session
    const { data: sessionRow, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('public_id', data.sessionPublicId)
      .single()

    if (sessionError || !sessionRow) {
      throw new Error('Session not found')
    }

    // Get all votes for this session
    const { data: votes, error: votesError } = await supabase
      .from('session_votes')
      .select('*, players(*)')
      .eq('session_id', sessionRow.id)

    if (votesError) {
      throw new Error(`Failed to fetch votes: ${votesError.message}`)
    }

    // Parse time slots
    const timeSlots =
      typeof sessionRow.time_slots === 'string'
        ? JSON.parse(sessionRow.time_slots)
        : sessionRow.time_slots

    const matchesToCreate: any[] = []
    const participantsToCreate: any[] = []

    // Group votes by time slot and level
    for (const timeSlot of timeSlots) {
      for (const option of timeSlot.options) {
        const votersForOption = votes?.filter(
          (vote) => vote.option_id === option.id,
        )

        if (!votersForOption || votersForOption.length === 0) {
          // No votes for this option, create empty match slots
          const matchId = uid.rnd()
          matchesToCreate.push({
            session_id: sessionRow.id,
            public_id: matchId,
            time_slot_id: timeSlot.id,
            level: option.level,
            start_time: timeSlot.range[0],
            end_time: timeSlot.range[1],
            max_players: sessionRow.limit_players
              ? sessionRow.players_per_slot || 4
              : 4,
          })
        } else {
          // Create matches based on votes (4 players per match)
          const playersPerMatch = sessionRow.limit_players
            ? sessionRow.players_per_slot || 4
            : 4

          const matchesNeeded = Math.ceil(
            votersForOption.length / playersPerMatch,
          )

          for (let i = 0; i < matchesNeeded; i++) {
            const matchId = uid.rnd()
            matchesToCreate.push({
              session_id: sessionRow.id,
              public_id: matchId,
              time_slot_id: timeSlot.id,
              level: option.level,
              start_time: timeSlot.range[0],
              end_time: timeSlot.range[1],
              max_players: playersPerMatch,
            })

            // Assign players to this match
            const playersForThisMatch = votersForOption.slice(
              i * playersPerMatch,
              (i + 1) * playersPerMatch,
            )

            for (const vote of playersForThisMatch) {
              participantsToCreate.push({
                match_public_id: matchId,
                player_id: vote.player_id,
                source: 'vote',
              })
            }
          }

          // If last match isn't full, it has open slots for manual joining
        }
      }
    }

    // Insert matches
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
    const participantsWithIds = participantsToCreate.map((p) => ({
      match_id: matchIdMap.get(p.match_public_id),
      player_id: p.player_id,
      source: p.source,
    }))

    // Insert participants
    if (participantsWithIds.length > 0) {
      const { error: participantsError } = await supabase
        .from('match_participants')
        .insert(participantsWithIds)

      if (participantsError) {
        console.error('Error creating participants:', participantsError)
        throw new Error(
          `Failed to add players to matches: ${participantsError.message}`,
        )
      }
    }

    return { success: true, matchesCreated: insertedMatches.length }
  })

export const useVoteForSession = ({
  sessionId,
  currentUser,
}: {
  sessionId: string
  currentUser: Player
}) => {
  const queryClient = useQueryClient()

  const { mutate: voteForSession } = useMutation({
    mutationFn: async (variables: {
      timeSlot: string
      level: string
      session: Session
    }): Promise<void> => {
      // Find the option for this time slot + level combination
      const slot = variables.session.timeSlots.find(
        (ts) => ts.id === variables.timeSlot,
      )
      const option = slot?.options.find((o) => o.level === variables.level)

      if (!option) {
        throw new Error('Option not found')
      }

      // Check if user already voted for this option (toggle behavior)
      const alreadyVoted = option.players.some(
        (player) => player.id === currentUser.id,
      )

      if (alreadyVoted) {
        // Unvote
        await unvoteForOption({
          data: {
            sessionPublicId: sessionId,
            optionId: option.id,
            playerId: currentUser.id,
          },
        })
      } else {
        // Remove votes from other levels in same time slot first
        const otherOptionsInSlot =
          slot?.options.filter((o) => o.level !== variables.level) || []
        const unvotePromises = otherOptionsInSlot
          .filter((otherOption) =>
            otherOption.players.some((p) => p.id === currentUser.id),
          )
          .map((otherOption) =>
            unvoteForOption({
              data: {
                sessionPublicId: sessionId,
                optionId: otherOption.id,
                playerId: currentUser.id,
              },
            }),
          )
        await Promise.all(unvotePromises)

        // Vote for the new option
        await voteForOption({
          data: {
            sessionPublicId: sessionId,
            optionId: option.id,
            playerId: currentUser.id,
          },
        })
      }
    },
    // Optimistic update BEFORE mutation
    onMutate: async (variables) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['session', sessionId] })

      // Snapshot the previous value
      const previousSession = queryClient.getQueryData<Session>([
        'session',
        sessionId,
      ])

      // Check if this is a vote or unvote
      const slot = variables.session.timeSlots.find(
        (ts) => ts.id === variables.timeSlot,
      )
      const option = slot?.options.find((o) => o.level === variables.level)
      const isUnvoting =
        option?.players.some((player) => player.id === currentUser.id) ?? false

      // Optimistically update to the new value
      queryClient.setQueryData<Session>(['session', sessionId], (old) => {
        if (!old) return old

        const optionsInSlot = old.timeSlots.find(
          (timeSlot) => timeSlot.id === variables.timeSlot,
        )?.options

        if (!optionsInSlot) {
          return old
        }

        const updatedGamesInSlot = optionsInSlot.map((option) => {
          // If the currently selected level is the same as the one we are voting for, we should remove the vote.
          if (
            option.level === variables.level &&
            option.players.some((player) => player.id === currentUser.id)
          ) {
            return {
              ...option,
              players: option.players.filter(
                (player) => player.id !== currentUser.id,
              ),
            }
          }

          // Remove the current user from all levels in this time slot first
          const playersWithoutCurrentUser = option.players.filter(
            (player) => player.id !== currentUser.id,
          )

          // Add the user only to the selected level
          if (option.level === variables.level) {
            return {
              ...option,
              players: [
                {
                  ...currentUser,
                  level: variables.level,
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
          timeSlots: old.timeSlots.map((timeSlot) => {
            if (timeSlot.id === variables.timeSlot) {
              return { ...timeSlot, options: updatedGamesInSlot }
            }
            return timeSlot
          }),
        }
      })

      // Return context with the snapshot and whether this is unvoting
      return { previousSession, isUnvoting }
    },
    onError: (error, _variables, context) => {
      // Rollback to previous value on error
      if (context?.previousSession) {
        queryClient.setQueryData(
          ['session', sessionId],
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
    onSuccess: (_data, variables, context) => {
      // Find the time slot to get the start time
      const slot = variables.session.timeSlots.find(
        (ts) => ts.id === variables.timeSlot,
      )
      const timeSlotStart = slot?.range[0] ? format(slot.range[0], 'HH:mm') : ''
      const level = variables.level.toLowerCase()

      if (context?.isUnvoting) {
        toast.success(
          `You removed your vote from the ${timeSlotStart} ${level} slot`,
        )
      } else {
        toast.success(`You voted for the ${timeSlotStart} ${level} slot`)
      }
    },
    // Always refetch after error or success to sync with server
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
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
      // Get match data from query cache
      const matches = queryClient.getQueryData<Match[]>(['matches', sessionId])
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
      queryClient.invalidateQueries({ queryKey: ['matches', sessionId] })
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
      // Get match data from query cache
      const matches = queryClient.getQueryData<Match[]>(['matches', sessionId])
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
      queryClient.invalidateQueries({ queryKey: ['matches', sessionId] })
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

export const createSessionValidator: z.ZodType<SessionForm> = z.object({
  venueName: z.string().min(1, { message: 'Venue name is required' }),
  venueLocation: z
    .string()
    .url({ message: 'Please enter a valid URL for the venue' }),
  date: z.date(),
  levels: z
    .array(z.string())
    .min(1, { message: 'At least one level must be selected' }),
  timeBlocks: z.enum(['60', '90']),
  timeSlots: z
    .array(z.object({ id: z.string(), range: z.tuple([z.date(), z.date()]) }))
    .min(1, { message: 'At least one time slot must be selected' }),
  limitPlayers: z.boolean(),
  playersPerSlot: z
    .number()
    .min(4, { message: 'Players per slot must be at least 4' })
    .multipleOf(4, { message: 'Players per slot must be a multiple of 4' })
    .optional(),
  votingClosesAt: z.date().optional(),
})

export const createSession = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(createSessionValidator))
  .handler(async ({ data }: { data: SessionForm }): Promise<string> => {
    try {
      const supabase = getSupabaseServerClient()

      // Generate unique session ID
      const uid = new ShortUniqueId({ length: 8 })

      // Insert session into Supabase
      const sessionData = {
        public_id: uid.rnd(),
        venue_name: data.venueName,
        venue_location: data.venueLocation,
        // Combine session.date and session.time into a single ISO datetime string for the "date" field.
        date: formatISO(data.date),
        levels: data.levels,
        time_blocks: parseInt(data.timeBlocks),
        time_slots: JSON.stringify(
          data.timeSlots.map((timeSlot) => ({
            id: timeSlot.id,
            range: timeSlot.range,
            options: data.levels.map((level) => ({
              id: uid.rnd(),
              slot: timeSlot,
              level,
              players: [],
            })),
          })),
        ),
        limit_players: data.limitPlayers,
        players_per_slot: data.playersPerSlot,
        status: 'draft' as const, // Always create sessions as draft
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
  })
