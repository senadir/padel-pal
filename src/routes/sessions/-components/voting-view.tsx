import { Link, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import {
  Ban,
  EllipsisVertical,
  ExternalLink,
  Loader2,
  UserMinus,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Route } from '../$id'
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
import { PlayerSearch } from '@/components/player-search'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  toggleBlockPlayer,
  unvoteForOption,
  updateSessionStatus,
  useVoteForSession,
  voteForOption,
} from '@/utils/sessions'
import { useAuth, useIsOrganizer } from '@/contexts/auth'

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
    currentUserId: currentUser?.id ?? '',
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
      status:
        | 'draft'
        | 'voting'
        | 'poll_closed'
        | 'open'
        | 'cancelled'
        | 'closed',
    ) =>
      updateSessionStatus({
        data: { sessionPublicId: sessionId, status },
      }),
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      // Also invalidate matches when poll closes since matches are created
      if (status === 'poll_closed') {
        queryClient.invalidateQueries({
          queryKey: ['sessions', sessionId, 'matches'],
        })
      }

      if (status === 'poll_closed') {
        toast.success(
          'Poll closed and matches created. You can now assign bookers.',
        )
      } else if (status === 'open') {
        toast.success('Session opened! Bookers have been notified.')
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
                onClick={() => updateStatusMutation.mutate('poll_closed')}
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
                <DrawerDialogDescription className="text-center text-muted-foreground">
                  View all players and vote times
                </DrawerDialogDescription>
              </DrawerDialogHeader>
              <PlayerListDialog
                currentGame={activeOption}
                sessionId={session.id}
              />
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
                  .sort((a, b) => b.votedAt.getTime() - a.votedAt.getTime())
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

const PlayerListDialog = ({
  currentGame,
  sessionId,
}: {
  currentGame: Option
  sessionId: string
}) => {
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
            sessionId={sessionId}
          />
        ))}
      {/* Add player search (organizer only) */}
      <PlayerSearch
        excludeIds={currentGame.players.map((p) => p.id)}
        onAddPlayer={(playerId) =>
          voteForOption({
            data: {
              sessionPublicId: sessionId,
              optionId: currentGame.id,
              playerId,
            },
          })
        }
        successMessage="Player added to vote"
      />
    </div>
  )
}

const PlayerListItem = ({
  player,
  option: currentGame,
  sessionId,
}: {
  player: Option['players'][number]
  option: Option
  sessionId: string
}) => {
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false)
  const { authData } = useAuth()
  const currentUser = authData?.player

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
      {currentUser && (
        <DropdownMenu
          open={playerDialogOpen}
          onOpenChange={setPlayerDialogOpen}
        >
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <span className="sr-only">Open menu</span>
              <EllipsisVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          {playerDialogOpen && (
            <PlayerOptionDialog
              player={player}
              currentGame={currentGame}
              sessionId={sessionId}
            />
          )}
        </DropdownMenu>
      )}
    </div>
  )
}

const PlayerOptionDialog = ({
  player,
  currentGame,
  sessionId,
}: {
  player: Player
  currentGame: Option
  sessionId: string
}) => {
  const queryClient = useQueryClient()
  const isOrganizer = useIsOrganizer()

  const handleCopyNumber = async () => {
    if (!player.phone) {
      toast.error('No phone number available')
      return
    }
    await navigator.clipboard.writeText(player.phone)
    toast.success('Phone number copied')
  }

  // Remove vote mutation (organizer only)
  const removeVoteMutation = useMutation({
    mutationFn: () =>
      unvoteForOption({
        data: {
          sessionPublicId: sessionId,
          optionId: currentGame.id,
          playerId: player.id,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId] })
      toast.success(`${player.name || 'Player'}'s vote removed`)
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error('Failed to remove vote', { description: errorMessage })
    },
  })

  // Block player mutation (organizer only)
  const blockPlayerMutation = useMutation({
    mutationFn: () =>
      toggleBlockPlayer({
        data: {
          playerId: player.id,
          isBlocked: !player.is_blocked,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId] })
      toast.success(
        player.is_blocked
          ? `${player.name || 'Player'} unblocked`
          : `${player.name || 'Player'} blocked`,
      )
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error('Failed to update player', { description: errorMessage })
    },
  })

  return (
    <DropdownMenuContent className="w-56" align="end">
      <DropdownMenuItem onClick={handleCopyNumber} disabled={!player.phone}>
        Copy number
      </DropdownMenuItem>
      {player.phone && (
        <DropdownMenuItem asChild>
          <a
            href={`https://wa.me/${player.phone.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Chat on WhatsApp
            <ExternalLink className="ml-auto h-3 w-3" />
          </a>
        </DropdownMenuItem>
      )}
      {player.playtomic_id && (
        <DropdownMenuItem asChild>
          <a
            href={`https://app.playtomic.io/profile/user/${player.playtomic_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Playtomic
            <ExternalLink className="ml-auto h-3 w-3" />
          </a>
        </DropdownMenuItem>
      )}
      {isOrganizer && (
        <>
          <DropdownMenuItem
            onClick={() => removeVoteMutation.mutate()}
            disabled={removeVoteMutation.isPending}
            className="text-destructive focus:text-destructive"
          >
            <UserMinus className="mr-2 h-4 w-4" />
            Remove vote
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => blockPlayerMutation.mutate()}
            disabled={blockPlayerMutation.isPending}
            className="text-destructive focus:text-destructive"
          >
            <Ban className="mr-2 h-4 w-4" />
            {player.is_blocked ? 'Unblock player' : 'Block player'}
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  )
}
