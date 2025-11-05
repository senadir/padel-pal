import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { EllipsisVertical, ExternalLink, Loader2 } from 'lucide-react'
import {
  queryOptions,
  useMutation,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { z } from 'zod'
import { toast } from 'sonner'
import type { Option, Player, Session } from '@/utils/types'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field'
import { SeparatorWithTitle } from '@/components/ui/separator-title'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  deleteSession,
  fetchSession,
  useVoteForSession,
} from '@/utils/sessions'
import { useAuth, useIsOrganizer } from '@/contexts/auth'
import {
  DrawerDialog,
  DrawerDialogClose,
  DrawerDialogContent,
  DrawerDialogDescription,
  DrawerDialogFooter,
  DrawerDialogHeader,
  DrawerDialogTitle,
} from '@/components/ui/drawer-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export const Route = createFileRoute('/sessions/$id')({
  component: RouteComponent,
  head: () => ({
    meta: [
      {
        title: 'Vote for session',
      },
    ],
  }),
  loader: async ({ params: { id }, context }) => {
    const data = await context.queryClient.ensureQueryData(
      sessionQueryOptions(id),
    )

    return {
      session: data,
    }
  },
  validateSearch: z.object({
    slot: z.string().optional(),
  }),
})

export const sessionQueryOptions = (sessionId: string) =>
  queryOptions({
    queryKey: ['session', sessionId],
    queryFn: () => fetchSession({ data: sessionId }),
  })

function RouteComponent() {
  const { id } = Route.useParams()
  const { slot } = Route.useSearch()
  const { data: session } = useSuspenseQuery(sessionQueryOptions(id))
  const { authData } = useAuth()
  const navigate = useNavigate({ from: Route.fullPath })
  const isOrganizer = useIsOrganizer()

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: () => deleteSession({ data: { sessionPublicId: id } }),
    onSuccess: () => {
      toast.success('Session deleted successfully')
      navigate({ to: '/' })
    },
    onError: (error) => {
      console.error('Error deleting session:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error('Failed to delete session', {
        description: errorMessage,
      })
    },
  })

  // Check if user is fully authenticated
  const currentUser = authData?.player
  const isFullyAuthenticated = !!(
    authData?.user &&
    authData.isPhoneVerified &&
    authData.hasPlaytomicProfile
  )

  // Create a no-op user for unauthenticated state
  const userForVoting = currentUser || {
    id: '',
    name: null,
    phone: null,
    level: null,
    avatar: null,
    playtomic_id: null,
    status: null,
    created_at: '',
  }

  const { voteForSession: voteForSessionFn } = useVoteForSession({
    sessionId: id,
    currentUser: userForVoting,
  })

  // CHANGE: Wrap voting function to check authentication before allowing vote
  // This enables public viewing of sessions while requiring auth for interactions
  const voteForSession = (variables: any) => {
    if (!isFullyAuthenticated) {
      // Store return URL for after login - user will come back here after auth
      const returnUrl = `/sessions/${id}`

      // Redirect to appropriate login step based on auth state
      // The redirect parameter will be propagated through the entire auth flow
      if (!authData?.user) {
        navigate({ to: '/login', search: { redirect: returnUrl } })
      } else if (!authData.isPhoneVerified) {
        navigate({ to: '/login/otp', search: { redirect: returnUrl } })
      } else if (!authData.hasPlaytomicProfile) {
        navigate({ to: '/login/playtomic', search: { redirect: returnUrl } })
      }
      return
    }
    // User is fully authenticated, proceed with voting
    voteForSessionFn(variables)
  }
  const generatedGamesCount = useMemo(() => {
    return session.timeSlots.reduce((acc, timeSlot) => {
      return (
        acc +
        timeSlot.options.reduce((acc, option) => {
          return acc + Math.ceil(option.players.length / 4)
        }, 0)
      )
    }, 0)
  }, [session.timeSlots])

  const [slotDrawerOpen, setSlotDrawerOpen] = useState(() =>
    slot ? true : false,
  )
  const activeOption = useMemo(() => {
    return session.timeSlots
      .flatMap((timeSlot) => timeSlot.options)
      .find((option) => option.id === slot)
  }, [session.timeSlots, slot])
  // Sync drawer state with matchId query parameter
  useEffect(() => {
    setSlotDrawerOpen(!!slot)
  }, [slot])

  const toggleDialog = (isOpen: boolean) => {
    setSlotDrawerOpen(isOpen)
    if (!isOpen) {
      navigate({ to: '.' })
    }
  }

  return (
    <form className="flex flex-col gap-6">
      <FieldSet>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">
            Vote for {format(session.date, 'EE, MMM d')}'s session
          </h1>
          <FieldLegend className="text-muted-foreground text-sm">
            vote for which slots you want to play, each vote count as a option.
          </FieldLegend>
        </div>
        {session.timeSlots.map((timeSlot) => (
          <TimeSlot
            key={timeSlot.id}
            timeSlot={timeSlot}
            session={session}
            currentUser={userForVoting}
            voteForSession={voteForSession}
          />
        ))}
        {isOrganizer && (
          <>
            <FieldSeparator />
            <Field>
              <Button type="submit" disabled={!generatedGamesCount}>
                <Link to={Route.fullPath + '/matches'}>
                  {generatedGamesCount === 0
                    ? 'Close poll'
                    : `Close poll and create ${generatedGamesCount} options`}
                </Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full"
                    disabled={deleteSessionMutation.isPending}
                  >
                    {deleteSessionMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Delete session
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this session and all
                      associated votes. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => deleteSessionMutation.mutate()}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Field>
          </>
        )}
      </FieldSet>

      <DrawerDialog open={slotDrawerOpen} setOpen={toggleDialog}>
        <DrawerDialogContent>
          {activeOption && (
            <>
              <DrawerDialogHeader>
                <DrawerDialogTitle className="text-center capitalize">
                  {activeOption.level} -{' '}
                  {format(activeOption.slot.range[0], 'HH:mm')}
                </DrawerDialogTitle>
                <DrawerDialogDescription className="text-center text-muted-foreground capitalize">
                  View all players and vote times
                </DrawerDialogDescription>
              </DrawerDialogHeader>
              <PlayerListDialog currentGame={activeOption} />
            </>
          )}
          <DrawerDialogFooter>
            <DrawerDialogClose asChild>
              <Button variant="outline" type="button" className="w-full">
                Close
              </Button>
            </DrawerDialogClose>
          </DrawerDialogFooter>
        </DrawerDialogContent>
      </DrawerDialog>
    </form>
  )
}

const TimeSlot = ({
  timeSlot,
  session,
  currentUser,
  voteForSession,
}: {
  timeSlot: Session['timeSlots'][number]
  session: Session
  currentUser: Player
  voteForSession: (v: {
    timeSlot: string
    level: string
    session: Session
  }) => void
}) => {
  return (
    <div className="w-full" key={timeSlot.id}>
      <FieldSet>
        <SeparatorWithTitle title={timeSlot.id} titlePosition="left" />
        <FieldDescription>
          Select the level you want to play in, you can only select one level
          per time slot.
        </FieldDescription>
        {(() => {
          const selectedLevel =
            timeSlot.options.find((option: Option) =>
              option.players.some(
                (player: Player) => player.id === currentUser.id,
              ),
            )?.level ?? ''

          return (
            <RadioGroup
              className="grid grid-cols-2 gap-3"
              orientation="horizontal"
              value={selectedLevel}
              onValueChange={(value) => {
                voteForSession({ timeSlot: timeSlot.id, level: value, session })
              }}
            >
              {timeSlot.options.map((option: Option) => (
                <GameSlot
                  key={option.id}
                  option={option}
                  selectedLevel={selectedLevel}
                  session={session}
                  clearVoteForTimeSlot={voteForSession}
                />
              ))}
            </RadioGroup>
          )
        })()}
      </FieldSet>
    </div>
  )
}

const GameSlot = ({
  option,
  selectedLevel,
  session,
  clearVoteForTimeSlot,
}: {
  option: Option
  selectedLevel: string
  session: Session
  clearVoteForTimeSlot: (variables: {
    timeSlot: string
    level: string
    session: Session
  }) => void
}) => {
  return (
    <FieldLabel htmlFor={option.id} className="shrink-0">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle className="capitalize mb-2">{option.level}</FieldTitle>
          {option.players.length === 0 ? (
            <div className="border-muted-foreground aspect-square size-5 rounded-full border border-dashed" />
          ) : (
            <Link to="." search={{ slot: option.id }} replace>
              <button
                type="button"
                className="*:data-[slot=avatar]:ring-background flex -space-x-0.5 *:data-[slot=avatar]:ring-2"
                title="View all players and vote times"
              >
                {option.players.slice(0, 4).map((player: Player) => (
                  <Avatar key={player.id} className="size-5">
                    <AvatarImage src={player.avatar} alt={player.name} />
                    <AvatarFallback delayMs={700}>
                      {player.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {option.players.length > 4 && (
                  <div className="size-5 flex items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                    +{option.players.length - 4}
                  </div>
                )}
              </button>
            </Link>
          )}
        </FieldContent>
        <RadioGroupItem
          value={option.level}
          id={option.id}
          onClick={() => {
            if (selectedLevel === option.level) {
              clearVoteForTimeSlot({
                timeSlot: option.slot.id,
                level: option.level,
                session,
              })
            }
          }}
        />
      </Field>
    </FieldLabel>
  )
}
const PlayerListDialog = ({ currentGame }: { currentGame: Option }) => {
  return (
    <div className="flex flex-col gap-3 max-h-[60vh] overflow-auto p-4">
      {[...currentGame.players]
        .sort((a, b) => {
          const at = a.votedAt ? new Date(a.votedAt).getTime() : 0
          const bt = b.votedAt ? new Date(b.votedAt).getTime() : 0
          return bt - at
        })
        .map((player) => (
          <PlayerListItem
            key={player.id}
            player={player}
            option={currentGame}
          />
        ))}
    </div>
  )
}

const PlayerListItem = ({
  player,
  option: currentGame,
}: {
  player: Option['players'][number]
  option: Option
}) => {
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false)
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-8">
        <AvatarImage src={player.avatar} alt={player.name} />
        <AvatarFallback delayMs={700}>
          {player.name?.charAt(0) || '?'}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{player.name}</div>
        <div className="text-muted-foreground text-xs">
          {player.votedAt
            ? `${format(new Date(player.votedAt), 'EEE, MMM d • HH:mm')}`
            : 'No vote time'}
        </div>
      </div>
      <DropdownMenu open={playerDialogOpen} onOpenChange={setPlayerDialogOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">
            <span className="sr-only">Open menu</span>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        {playerDialogOpen && (
          <PlayerOptionDialog player={player} currentGame={currentGame} />
        )}
      </DropdownMenu>
    </div>
  )
}

const PlayerOptionDialog = ({
  player,
  currentGame,
}: {
  player: Player
  currentGame: Option
}) => {
  const { data: session } = useQuery(sessionQueryOptions(currentGame.slot.id))
  const { voteForSession } = useVoteForSession({
    sessionId: currentGame.slot.id,
    currentUser: player,
  })
  if (!session) {
    return null
  }

  const isSlotDisabled = (option: Option) => {
    // Games in the current time slot should not be disabled (so we an move between them).
    if (currentGame.slot.id === option.slot.id) {
      return false
    }
    // If the slot already has the player, it should be disabled, so we don't end up assiging a player to 2 options in the same time slot.
    if (
      session.timeSlots.some(
        (slot) =>
          slot.id !== currentGame.slot.id &&
          slot.options.some((option) =>
            option.players.some((_player) => _player.id === player.id),
          ),
      )
    ) {
      return true
    }
    return false
  }
  const filtered = session.timeSlots
    .map((slot) => ({
      ...slot,
      options: slot.options.filter((option) =>
        option.players.some((_player) => _player.id === player.id),
      ),
    }))
    .filter((slot) => slot.options.length > 0)
    .reduce(
      (acc, slot) => {
        acc[slot.id] = slot.options[0].id
        return acc
      },
      {} as Record<string, string>,
    )

  return (
    <DropdownMenuContent className="w-56" align="start">
      <DropdownMenuLabel>Manage player</DropdownMenuLabel>
      <DropdownMenuGroup>
        <DropdownMenuItem>
          Remove
          <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          Block
          <DropdownMenuShortcut>⌃⌘B</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Move</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {session.timeSlots.map((timeSlot) => (
                <>
                  <DropdownMenuLabel key={timeSlot.id}>
                    {timeSlot.id}
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={filtered[timeSlot.id] ?? ''}
                    onValueChange={(value) => {
                      const option = timeSlot.options.find(
                        (opt) => opt.id === value,
                      )
                      if (option) {
                        voteForSession({
                          timeSlot: timeSlot.id,
                          level: option.level,
                          session,
                        })
                      }
                    }}
                  >
                    {timeSlot.options.map((option) => (
                      <DropdownMenuRadioItem
                        key={option.id}
                        value={option.id}
                        disabled={isSlotDisabled(option)}
                      >
                        {option.level}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                </>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          Copy number
          <DropdownMenuShortcut>⌃⌘C</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`https://wa.me/${player.phone.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            Chat on WhatsApp
            <ExternalLink className="ml-auto h-3 w-3" />
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`https://app.playtomic.io/profile/user/${player.playtomicId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            Open in Playtomic
            <ExternalLink className="ml-auto h-3 w-3" />
          </a>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  )
}
