import { queryOptions, useMutation } from '@tanstack/react-query'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { toast } from 'sonner'
import ShortUniqueId from 'short-unique-id'
import { formatISO, setHours, setMinutes, getMinutes, getHours } from 'date-fns'
import { getMockMatches, getMockSession } from './mock'
import { getSupabaseServerClient } from './supabase'
import type { Player, Session, SessionForm } from './types'

export const fetchSessions = createServerFn({ method: 'GET' }).handler(
  async () => {
    console.info('Fetching sessions...')
    return Promise.resolve([getMockSession()])
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
    console.info(`Fetching session with id ${data}...`)

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

      // Transform database row to Session type
      const sessionDate = sessionRow.date
        ? new Date(sessionRow.date)
        : new Date()
      const session: Session = {
        id: sessionRow.public_id,
        venueName: sessionRow.venue_name || '',
        venueLocation: sessionRow.venue_location || '',
        date: sessionDate,
        time: sessionDate, // Use the same date for time since date contains the full datetime
        levels: sessionRow.levels || [],
        timeBlocks: sessionRow.time_blocks?.toString() || '60',
        timeSlots: sessionRow.time_slots
          ? typeof sessionRow.time_slots === 'string'
            ? JSON.parse(sessionRow.time_slots)
            : sessionRow.time_slots
          : [],
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
  .handler(async (sessionId) => {
    console.info(`Fetching matches with id ${sessionId}...`)
    return Promise.resolve(getMockMatches())
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

export const useVoteForSession = ({
  sessionId,
  currentUser,
}: {
  sessionId: string
  currentUser: Player
}) => {
  const { mutate: voteForSession } = useMutation({
    mutationFn: (variables: {
      timeSlot: string
      level: string
    }): Promise<Session> => {
      // TODO: Implement actual voting logic using variables.timeSlot and variables.level
      console.log('Voting for session:', {
        sessionId,
        timeSlot: variables.timeSlot,
        level: variables.level,
      })
      return Promise.resolve(getMockSession())
    },
    onError: (error) => {
      console.error('Error voting for session:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error('Failed to vote for session', {
        description: errorMessage,
      })
    },
    onSuccess: (_data, variables, _onMutationResult, context) => {
      toast.success('Vote recorded successfully!', {
        description: 'Your vote has been recorded for this session.',
      })
      context.client.setQueryData(
        ['session', sessionId],
        (previousSession: Session) => {
          const optionsInSlot = previousSession.timeSlots.find(
            (timeSlot) => timeSlot.id === variables.timeSlot,
          )?.options

          if (!optionsInSlot) {
            return previousSession
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
            ...previousSession,
            timeSlots: previousSession.timeSlots.map((timeSlot) => {
              if (timeSlot.id === variables.timeSlot) {
                return { ...timeSlot, options: updatedGamesInSlot }
              }
              return timeSlot
            }),
          }
        },
      )
    },
  })
  return { voteForSession }
}

export const createSessionValidator: z.ZodType<SessionForm> = z.object({
  venueName: z.string().min(1, { message: 'Venue name is required' }),
  venueLocation: z
    .string()
    .url({ message: 'Please enter a valid URL for the venue' }),
  date: z.date(),
  time: z.date(),
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
})

export const createSession = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(createSessionValidator))
  .handler(async ({ data }: { data: SessionForm }): Promise<string> => {
    console.log('Creating session:', data)

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
        date: formatISO(
          setHours(
            setMinutes(data.date, getMinutes(data.time)),
            getHours(data.time),
          ),
        ),
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
