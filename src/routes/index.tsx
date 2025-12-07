import {
  createFileRoute,
  Link,
  redirect,
  useSearch,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { format, subDays } from 'date-fns'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { ChevronRight, CalendarPlus, Plus } from 'lucide-react'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { sessionsQueryOptions } from '@/utils/sessions'
import { useIsOrganizer } from '@/contexts/auth'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      {
        title: 'Open Sessions | Padel Pal',
      },
      {
        property: 'og:title',
        content: 'Open Sessions | Padel Pal',
      },
      {
        property: 'og:description',
        content: 'Browse and join open padel sessions near you.',
      },
      {
        property: 'og:image',
        content: '/api/og?title=Open%20Sessions&subtitle=Browse%20and%20join%20padel%20sessions&type=session',
      },
      {
        name: 'twitter:title',
        content: 'Open Sessions | Padel Pal',
      },
      {
        name: 'twitter:description',
        content: 'Browse and join open padel sessions near you.',
      },
      {
        name: 'twitter:image',
        content: '/api/og?title=Open%20Sessions&subtitle=Browse%20and%20join%20padel%20sessions&type=session',
      },
    ],
  }),
  beforeLoad: ({ context, location }) => {
    const { authData } = context

    // Redirect to login if not authenticated
    if (!authData?.user) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }

    // Redirect to OTP if phone not verified
    if (!authData.isPhoneVerified) {
      throw redirect({
        to: '/login/otp',
        search: {
          redirect: location.href,
        },
      })
    }

    // Redirect to playtomic if no profile
    if (!authData.hasPlaytomicProfile) {
      throw redirect({
        to: '/login/playtomic',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  validateSearch: z.object({
    error: z.string().optional(),
    message: z.string().optional(),
  }),
  loader: async ({ context }) => {
    const allSessions = await context.queryClient.ensureQueryData(
      sessionsQueryOptions(),
    )
    const { authData } = context

    // Filter sessions based on user role
    const isOrganizer = authData?.role === 'organizer'
    let sessions = allSessions

    if (!isOrganizer) {
      // Players see only voting, open, or recently ended (closed within last 2 days) sessions
      const twoDaysAgo = subDays(new Date(), 2)
      sessions = allSessions.filter((session) => {
        if (session.status === 'draft') {
          return false
        }
        if (session.status === 'voting' || session.status === 'open') {
          return true
        }
        if (session.status === 'closed') {
          // Show closed sessions that ended within the last 2 days
          const sessionDate = session.date
          return sessionDate && sessionDate >= twoDaysAgo
        }
        // Exclude cancelled sessions
        return false
      })
    }

    return { sessions }
  },
  component: App,
})

function App() {
  const search = useSearch({ from: Route.id })
  const { sessions } = Route.useLoaderData()
  const isOrganizer = useIsOrganizer()

  // Show error toast if redirected with error
  useEffect(() => {
    if (search.error === 'unauthorized' && search.message) {
      toast.error('Access Denied', {
        description: search.message,
      })
    }
  }, [search.error, search.message])

  return (
    <div className="flex flex-col gap-6 py-6">
      {sessions.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarPlus />
            </EmptyMedia>
            <EmptyTitle>No Open Sessions Yet</EmptyTitle>
            <EmptyDescription>
              There are no open sessions yet. Check back later.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {isOrganizer && (
              <Button asChild>
                <Link to="/sessions/new">Create Session</Link>
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Open sessions</h1>
              <p className="text-muted-foreground mt-1">
                Below are the open sessions that you can vote for or join.
              </p>
            </div>
            {isOrganizer && (
              <Button asChild size="icon" variant="outline">
                <Link to="/sessions/new">
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">Create session</span>
                </Link>
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-4">
            {sessions.map((session) => {
              return (
                <Link
                  key={session.id}
                  to="/sessions/$id"
                  params={{ id: session.id }}
                  className="block"
                >
                  <div className="flex items-center justify-between p-6 border rounded-lg hover:bg-accent transition-colors">
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold mb-2">
                        {format(session.date, 'EEE, MMM do')}
                      </h2>
                      <p className="text-muted-foreground mb-1">
                        {session.venueName}
                      </p>
                      {session.votingClosesAt && (
                        <p className="text-sm text-muted-foreground">
                          Voting closes:{' '}
                          {format(session.votingClosesAt, 'EEE, MMM do')} at{' '}
                          {format(session.votingClosesAt, 'ha')}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
