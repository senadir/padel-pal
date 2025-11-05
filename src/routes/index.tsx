import {
  Link,
  createFileRoute,
  redirect,
  useSearch,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useSuspenseQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarPlus, ChevronRight, Plus } from 'lucide-react'
import { sessionsQueryOptions } from '@/utils/sessions'
import { Button } from '@/components/ui/button'
import { useAuth, useIsOrganizer } from '@/contexts/auth'
import { Separator } from '@/components/ui/separator'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export const Route = createFileRoute('/')({
  component: App,
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(
      sessionsQueryOptions(),
    )
    return { sessions: data }
  },
  validateSearch: (search: Record<string, unknown>) => {
    return {
      error: search.error as string | undefined,
      message: search.message as string | undefined,
    }
  },
  beforeLoad: async ({ context, location }) => {
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
})

function App() {
  const { authData } = useAuth()
  const search = useSearch({ from: '/' })
  const { data: sessions } = useSuspenseQuery(sessionsQueryOptions())
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
            <div className="flex gap-2">
              {isOrganizer && (
                <Button asChild>
                  <Link to="/sessions/new">Create Session</Link>
                </Button>
              )}
              <Button variant="outline">Get updated</Button>
            </div>
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
              <Button asChild>
                <Link to="/sessions/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Session
                </Link>
              </Button>
            )}
          </div>
          <Separator />
          <div className="flex flex-col gap-4">
            {sessions.map((session) => {
              const now = new Date()

              return (
                <Link
                  key={session.id}
                  to={
                    session.hasMatches
                      ? '/sessions/$id/matches'
                      : '/sessions/$id'
                  }
                  params={{ id: session.id }}
                  className="block"
                >
                  <div className="flex items-center justify-between p-6 border rounded-lg hover:bg-accent transition-colors">
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold mb-2">
                        {format(session.date, 'EEEE, MMMM do')}
                      </h2>
                      <p className="text-muted-foreground mb-1">
                        {session.venueName}
                      </p>
                      {session.votingClosesAt && (
                        <p className="text-sm text-muted-foreground">
                          Voting closes:{' '}
                          {format(session.votingClosesAt, 'EEEE, MMMM do')} at{' '}
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
