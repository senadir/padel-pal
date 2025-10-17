import { queryOptions, useMutation } from '@tanstack/react-query'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { mockMatches, mockSession } from './mock'
import type { Player, Session } from './types'

export const fetchSessions = createServerFn({ method: 'GET' }).handler(
  async () => {
    console.info('Fetching sessions...')
    return Promise.resolve([mockSession])
  },
)

export const sessionsQueryOptions = () =>
  queryOptions({
    queryKey: ['sessions'],
    queryFn: () => fetchSessions(),
  })

export const fetchSession = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data }) => {
    console.info(`Fetching session with id ${data}...`)
    return Promise.resolve(mockSession).catch((err) => {
      console.error(err)
      if (err.status === 404) {
        throw notFound()
      }
      throw err
    })
  })

const currentUser: Player = {
  id: '123456789',
  name: 'Nadir Seghir',
  phone: '+1234567890',
  level: '1.54',
  avatar:
    'https://res.cloudinary.com/playtomic/image/upload/c_limit,w_1280/v1/pro/users/10504108/1753865118506',
}
export const fetchMatches = createServerFn({ method: 'GET' })
  .inputValidator((sessionId: string) => sessionId)
  .handler(async (sessionId) => {
    console.info(`Fetching matches with id ${sessionId}...`)
    return Promise.resolve(mockMatches)
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
    mutationFn: ({
      timeSlot,
      level,
    }: {
      timeSlot: string
      level: string
    }): Promise<Session> => {
      return Promise.resolve(mockSession)
    },
    onSuccess: (_data, variables, _onMutationResult, context) => {
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
