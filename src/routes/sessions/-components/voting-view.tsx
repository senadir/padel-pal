import { Link, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { EllipsisVertical, ExternalLink, Loader2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Option, Player, Session } from '@/utils/types'
import {
  Field,
  FieldContent,
  FieldLabel,
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
import {
  deleteSession,
  updateSessionStatus,
  useVoteForSession,
} from '@/utils/sessions'
import { useAuth, useIsOrganizer } from '@/contexts/auth'
import { Route, sessionQueryOptions } from '../$id'

export const VotingView = ({ session }: { session: Session }) => {
  const { slot } = Route.useSearch()
  const { authData } = useAuth()
  const navigate = useNavigate({ from: Route.fullPath })
  const isOrganizer = useIsOrganizer()
  const queryClient = useQueryClient()
  const sessionId = session.id
  // Check if user is fully authenticated
  const currentUser = authData?.player
  const isFullyAuthenticated = !!(
    authData?.user &&
    authData.isPhoneVerified &&
    authData.hasPlaytomicProfile
  )

  const { voteForSession: voteForSessionFn } = useVoteForSession({
    sessionId,
  })

  // Wrap voting function to check authentication before allowing vote
  const voteForSession = (variables: any) => {
    if (!isFullyAuthenticated) {
      const returnUrl = `/sessions/${sessionId}`

      if (!authData?.user) {
        navigate({ to: '/login', search: { redirect: returnUrl } })
      } else if (!authData.isPhoneVerified) {
        navigate({ to: '/login/otp', search: { redirect: returnUrl } })
      } else if (!authData.hasPlaytomicProfile) {
        navigate({ to: '/login/playtomic', search: { redirect: returnUrl } })
      }
      return
    }
    voteForSessionFn({ ...variables, currentUser })
  }

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: () => deleteSession({ data: { sessionPublicId: sessionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
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

  // Update session status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (
      status: 'draft' | 'voting' | 'open' | 'cancelled' | 'closed',
    ) =>
      updateSessionStatus({
        data: { sessionPublicId: sessionId, status },
      }),
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['matches', sessionId] })

      if (status === 'open') {
        toast.success('Poll closed and matches created')
      } else {
        toast.success('Session marked as ready for voting')
      }
    },
    onError: (error) => {
      console.error('Error updating session status:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error('Failed to update session status', {
        description: errorMessage,
      })
    },
  })

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
    <>
      {session.timeSlots.map((timeSlot) => (
        <TimeSlot
          key={timeSlot.id}
          timeSlot={timeSlot}
          session={session}
          voteForSession={voteForSession}
        />
      ))}
      {isOrganizer && (
        <>
          <FieldSeparator />
          <Field>
            {session.status === 'draft' ? (
              <Button
                type="submit"
                onClick={() => updateStatusMutation.mutate('voting')}
                disabled={updateStatusMutation.isPending}
                className="w-full mb-2"
              >
                {updateStatusMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Mark as Ready for Voting
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => updateStatusMutation.mutate('open')}
                disabled={
                  !generatedGamesCount || updateStatusMutation.isPending
                }
              >
                {updateStatusMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {generatedGamesCount === 0
                  ? 'Close poll'
                  : `Close poll and create ${generatedGamesCount} matches`}
              </Button>
            )}
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
                    This will permanently delete this session and all associated
                    votes. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteSessionMutation.mutate()}
                    variant="destructive"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Field>
        </>
      )}
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
    </>
  )
}

const TimeSlot = ({
  timeSlot,
  session,
  voteForSession,
}: {
  timeSlot: Session['timeSlots'][number]
  session: Session
  voteForSession: (v: {
    timeSlot: string
    level: string
    session: Session
  }) => void
}) => {
  const { authData } = useAuth()
  const currentUser = authData?.player

  return (
    <div className="w-full" key={timeSlot.id}>
      <FieldSet>
        <SeparatorWithTitle title={timeSlot.id} titlePosition="left" />
        {(() => {
          const selectedLevel =
            timeSlot.options.find((option: Option) =>
              option.players.some(
                (player: Player) => player.id === currentUser?.id,
              ),
            )?.level ?? ''

          return (
            <RadioGroup
              className="flex flex-col gap-3"
              orientation="horizontal"
              value={selectedLevel}
              onValueChange={(value) => {
                voteForSession({
                  timeSlot: timeSlot.id,
                  level: value,
                  session,
                })
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
      <Field orientation="horizontal" className="!items-center">
        <FieldContent className="flex flex-row items-center gap-2 justify-between">
          <FieldTitle className="capitalize">{option.level}</FieldTitle>
          {option.players.length === 0 ? (
            <div className="border-muted-foreground aspect-square size-5 rounded-full border border-dashed" />
          ) : (
            <Link to="." search={{ slot: option.id }} replace>
              <button
                type="button"
                className="*:data-[slot=avatar]:ring-background flex -space-x-0.5 *:data-[slot=avatar]:ring-2"
                title="View all players and vote times"
              >
                {option.players
                  .sort((a, b) => b.votedAt - a.votedAt)
                  .slice(0, 4)
                  .map((player: Player) => (
                    <Avatar key={player.id} className="size-5">
                      <AvatarImage
                        src={player.avatar ?? undefined}
                        alt={player.name ?? undefined}
                      />
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
        <AvatarImage
          src={player.avatar ?? undefined}
          alt={player.name ?? undefined}
        />
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
  const { authData } = useAuth()
  const currentUser = authData?.player

  if (!currentUser) {
    return null
  }
  const { voteForSession } = useVoteForSession({
    sessionId: currentGame.slot.id,
  })
  if (!session) {
    return null
  }

  const isSlotDisabled = (option: Option) => {
    if (currentGame.slot.id === option.slot.id) {
      return false
    }
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
    .reduce<Record<string, string>>((acc, slot) => {
      acc[slot.id] = slot.options[0].id
      return acc
    }, {})

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
                          currentUser,
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
            href={`https://wa.me/${player.phone?.replace(/[^0-9]/g, '') ?? ''}`}
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
            href={`https://app.playtomic.io/profile/user/${player.playtomic_id}`}
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
