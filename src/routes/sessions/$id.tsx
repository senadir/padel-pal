import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { format } from 'date-fns'
import { CircleAlert } from 'lucide-react'
import { FieldSet, FieldLegend, FieldDescription } from '@/components/ui/field'
import { fetchSession, matchQueryOptions } from '@/utils/sessions'
import { MatchesView } from './-components/matches-view'
import { VotingView } from './-components/voting-view'

export const Route = createFileRoute('/sessions/$id')({
  component: RouteComponent,
  beforeLoad: async ({ params: { id }, context }) => {
    const { authData } = context

    // Fetch session to check status
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions(id),
    )

    // Check if session is draft and user is not organizer
    if (session.status === 'draft') {
      const isOrganizer = authData?.role === 'organizer'
      if (!isOrganizer) {
        throw redirect({
          to: '/',
          search: {
            error: 'unauthorized',
            message: 'Draft sessions are only accessible to organizers',
          },
        })
      }
    }
  },
  loader: async ({ params: { id }, context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions(id),
    )

    const matches = await context.queryClient.ensureQueryData(
      matchQueryOptions(id),
    )

    return {
      session,
      matches,
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.session
          ? `${format(loaderData.session.date, 'EEEE, MMM d')} | Padel Pal`
          : 'Session | Padel Pal',
      },
    ],
  }),
  validateSearch: z.object({
    slot: z.string().optional(),
    matchId: z.string().optional(),
  }),
})

export const sessionQueryOptions = (sessionId: string) =>
  queryOptions({
    queryKey: ['sessions', sessionId],
    queryFn: () => fetchSession({ data: sessionId }),
  })

function RouteComponent() {
  const { id } = Route.useParams()
  const { data: session } = useSuspenseQuery(sessionQueryOptions(id))
  const { data: matches } = useSuspenseQuery(matchQueryOptions(id))

  // Determine which view to show based on session status
  const showMatchesView = ['open', 'closed', 'cancelled'].includes(
    session.status || '',
  )

  return (
    <form className="flex flex-col gap-6">
      <FieldSet>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">
            {format(session.date, 'EEEE, MMMM d')}
          </h1>
          <FieldLegend className="flex flex-col gap-2">
            <div>
              <a
                href={session.venues[0].location}
                target="_blank"
                className="text-sm text-muted-foreground underline"
              >
                {session.venues[0].name}
              </a>
              {session.venues.length === 2 && (
                <span className="text-muted-foreground text-sm">
                  {' '}
                  and{' '}
                  <Link
                    to={session.venues[1].location}
                    target="_blank"
                    className="items-baseline text-sm text-muted-foreground"
                  >
                    <span className="underline">{session.venues[1].name}</span>
                  </Link>
                </span>
              )}
              {session.venues.length > 2 && (
                <span className="text-muted-foreground text-sm">
                  and {session.venues.length - 2} other venues
                </span>
              )}
            </div>
            <FieldDescription className="text-muted-foreground text-sm">
              {showMatchesView
                ? 'View your games and others, and see which games you can join.'
                : 'Vote for which slots you want to play, each vote count as a option.'}
            </FieldDescription>
            {session.votingClosesAt && (
              <p className="text-sm flex items-center gap-1">
                <CircleAlert className="size-4" />
                Voting closes at{' '}
                {format(session.votingClosesAt, 'EEE, MMM d • HH:mm')}
              </p>
            )}
          </FieldLegend>
        </div>
        {showMatchesView ? (
          <MatchesView session={session} matches={matches} />
        ) : (
          <VotingView session={session} />
        )}
      </FieldSet>
    </form>
  )
}
