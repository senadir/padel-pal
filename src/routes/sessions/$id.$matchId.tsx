import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Ban,
  EllipsisVertical,
  ExternalLink,
  PlusIcon,
  UserMinus,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Match, Player } from '@/utils/types'
import {
  addPlayerToMatch,
  matchQueryOptions,
  removePlayerFromMatch,
  sessionQueryOptions,
  toggleBlockPlayer,
  useMatchActions,
} from '@/utils/sessions'
import { useAuth, useIsOrganizer } from '@/contexts/auth'
import { PlayerSearch } from '@/components/player-search'
import {
  DrawerDialog,
  DrawerDialogClose,
  DrawerDialogContent,
  DrawerDialogDescription,
  DrawerDialogFooter,
  DrawerDialogHeader,
  DrawerDialogTitle,
} from '@/components/ui/drawer-dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/sessions/$id/$matchId')({
  component: MatchModalComponent,
  pendingComponent: MatchModalPendingComponent,
  pendingMs: 0,
  pendingMinMs: 2000,
  loader: async ({ params: { id, matchId }, context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions(id),
    )
    const matches = await context.queryClient.ensureQueryData(
      matchQueryOptions(id),
    )
    const match = matches.find((m) => m.id === matchId)
    return { session, match, matches }
  },
  head: ({ loaderData }) => {
    if (!loaderData?.match || !loaderData?.session) {
      return {
        meta: [
          { title: 'Match | Padel Pal' },
          { property: 'og:title', content: 'Match | Padel Pal' },
          {
            property: 'og:description',
            content: 'View match details and players.',
          },
          { property: 'og:image', content: '/api/og' },
          { name: 'twitter:title', content: 'Match | Padel Pal' },
          {
            name: 'twitter:description',
            content: 'View match details and players.',
          },
          { name: 'twitter:image', content: '/api/og' },
        ],
      }
    }
    const { match, session } = loaderData
    const time = format(match.slot.range[0], 'HH:mm')
    const date = format(session.date, 'MMM d')
    const title = `${match.level} ${time} - ${date} | Padel Pal`
    const description = `${match.level} match at ${time} on ${format(session.date, 'EEE, MMM d')}`
    const ogImage = `/api/og?type=match&id=${match.id}`

    return {
      meta: [
        { title },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:image', content: ogImage },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: ogImage },
      ],
    }
  },
})

function MatchModalPendingComponent() {
  return (
    <DrawerDialog open={true} setOpen={() => {}}>
      <DrawerDialogContent>
        <DrawerDialogHeader>
          <DrawerDialogTitle className="text-center capitalize flex items-center justify-center">
            <Skeleton className="h-4 w-[200px]" />
          </DrawerDialogTitle>
          <DrawerDialogDescription className="text-center text-muted-foreground capitalize">
            <Skeleton className="h-2 w-[300px]" />
          </DrawerDialogDescription>
        </DrawerDialogHeader>
        <div className="p-4 flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <DrawerDialogFooter>
          <DrawerDialogClose asChild>
            <Skeleton className="h-10 w-[150px]" />
          </DrawerDialogClose>
        </DrawerDialogFooter>
      </DrawerDialogContent>
    </DrawerDialog>
  )
}

function MatchModalComponent() {
  const { id: sessionId, matchId } = Route.useParams()
  const navigate = useNavigate({ from: Route.fullPath })
  const { authData } = useAuth()
  const currentUser = authData?.player
  const isOrganizer = useIsOrganizer()

  const { data: matches } = useQuery(matchQueryOptions(sessionId))
  const activeMatch = matches?.find((match) => match.id === matchId)

  const isCurrentUserInMatch =
    activeMatch?.players.some((p) => p.id === currentUser?.id) ?? false

  const { toggleMatchParticipation, isLoading: isMatchActionLoading } =
    useMatchActions({
      sessionId,
      currentUserId: currentUser?.id ?? '',
    })

  const handleClose = () => {
    navigate({ to: '/sessions/$id', params: { id: sessionId } })
  }

  const returnUrl = `/sessions/${sessionId}/${matchId}`

  const handleJoinMatch = () => {
    if (!activeMatch) return
    if (!currentUser?.id) {
      navigate({ to: '/login', replace: true, search: { redirect: returnUrl } })
      return
    }
    toggleMatchParticipation(activeMatch.id, false)
  }

  const handleLeaveMatch = () => {
    if (!activeMatch) return
    if (!currentUser?.id) {
      navigate({ to: '/login', replace: true, search: { redirect: returnUrl } })
      return
    }
    toggleMatchParticipation(activeMatch.id, true)
  }

  if (!activeMatch) {
    return null
  }

  const matchesForSlotLevel = (matches ?? []).filter(
    (m) => m.slot.id === activeMatch.slot.id && m.level === activeMatch.level,
  )
  const gameIndex =
    matchesForSlotLevel.findIndex((m) => m.id === activeMatch.id) + 1

  const hasEmptySlots = activeMatch.players.length < 4

  return (
    <DrawerDialog open={true} setOpen={(open) => !open && handleClose()}>
      <DrawerDialogContent>
        <DrawerDialogHeader>
          <DrawerDialogTitle className="text-center capitalize">
            {activeMatch.level} - {format(activeMatch.slot.range[0], 'HH:mm')} -
            Game {gameIndex}
          </DrawerDialogTitle>
          <DrawerDialogDescription className="text-center text-muted-foreground capitalize">
            Check playtomic for more details
          </DrawerDialogDescription>
        </DrawerDialogHeader>
        <div className="p-4 flex flex-col gap-4">
          {activeMatch.players.map((player) => (
            <MatchPlayerListItem
              key={player.id}
              player={player}
              match={activeMatch}
              sessionId={sessionId}
              currentUser={currentUser}
              isOrganizer={isOrganizer}
              onLeaveMatch={handleLeaveMatch}
              isLoading={isMatchActionLoading}
            />
          ))}
          {hasEmptySlots &&
            Array.from({
              length: 4 - activeMatch.players.length,
            }).map((_, i) => (
              <Button
                key={`empty-${i}`}
                className="flex gap-2 items-center justify-start p-0"
                variant="ghost"
                type="button"
                onClick={handleJoinMatch}
                disabled={
                  isCurrentUserInMatch || isMatchActionLoading || !currentUser
                }
              >
                <div className="size-8 flex items-center justify-center rounded-full border-1 border-dashed border">
                  <PlusIcon className="size-4 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground text-sm">
                  Spare place
                </span>
              </Button>
            ))}

          {/* Add Player UI for organizers */}
          {hasEmptySlots && (
            <PlayerSearch
              excludeIds={activeMatch.players.map((p) => p.id)}
              onAddPlayer={(playerId) =>
                addPlayerToMatch({ data: { matchPublicId: matchId, playerId } })
              }
              successMessage="Player added to match"
            />
          )}
        </div>
        <DrawerDialogFooter>
          <DrawerDialogClose asChild>
            <Button
              variant="outline"
              type="button"
              className="w-full"
              onClick={handleClose}
            >
              Close
            </Button>
          </DrawerDialogClose>
        </DrawerDialogFooter>
      </DrawerDialogContent>
    </DrawerDialog>
  )
}

const MatchPlayerListItem = ({
  player,
  match: currentMatch,
  sessionId,
  currentUser,
  isOrganizer,
  onLeaveMatch,
  isLoading,
}: {
  player: Match['players'][number]
  match: Match
  sessionId: string
  currentUser: Player | null | undefined
  isOrganizer: boolean
  onLeaveMatch: () => void
  isLoading: boolean
}) => {
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false)
  const isCurrentUser = currentUser?.id === player.id

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
        <div className="truncate font-medium">
          {player.name}
          {isCurrentUser && ' (You)'}
        </div>
        <div className="text-muted-foreground text-xs">
          {player.level} on Playtomic
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
            <MatchPlayerOptionDialog
              player={player}
              matchId={currentMatch.id}
              sessionId={sessionId}
              isCurrentUser={isCurrentUser}
              isOrganizer={isOrganizer}
              onLeaveMatch={onLeaveMatch}
              isLoading={isLoading}
              onClose={() => setPlayerDialogOpen(false)}
            />
          )}
        </DropdownMenu>
      )}
    </div>
  )
}

const MatchPlayerOptionDialog = ({
  player,
  matchId,
  sessionId,
  isCurrentUser,
  isOrganizer,
  onLeaveMatch,
  isLoading,
  onClose,
}: {
  player: Match['players'][number]
  matchId: string
  sessionId: string
  isCurrentUser: boolean
  isOrganizer: boolean
  onLeaveMatch: () => void
  isLoading: boolean
  onClose: () => void
}) => {
  const queryClient = useQueryClient()

  // Remove player from match mutation (organizer only)
  const removePlayerMutation = useMutation({
    mutationFn: () =>
      removePlayerFromMatch({
        data: { matchPublicId: matchId, playerId: player.id },
      }),
    onSuccess: () => {
      toast.success(`${player.name} removed from match`)
      queryClient.invalidateQueries({
        queryKey: ['sessions', sessionId, 'matches'],
      })
      onClose()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove player',
      )
    },
  })

  // Block player mutation (organizer only)
  const blockPlayerMutation = useMutation({
    mutationFn: () =>
      toggleBlockPlayer({ data: { playerId: player.id, isBlocked: true } }),
    onSuccess: () => {
      toast.success(`${player.name} has been blocked`)
      onClose()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to block player',
      )
    },
  })

  const handleCopyNumber = async () => {
    if (!player.phone) {
      toast.error('No phone number available')
      return
    }
    await navigator.clipboard.writeText(player.phone)
    toast.success('Phone number copied')
  }

  const isActionPending =
    isLoading || removePlayerMutation.isPending || blockPlayerMutation.isPending

  return (
    <DropdownMenuContent className="w-56" align="end">
      {isCurrentUser && (
        <>
          <DropdownMenuItem onClick={onLeaveMatch} disabled={isActionPending}>
            Leave match
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
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

      {/* Organizer-only options */}
      {isOrganizer && !isCurrentUser && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => removePlayerMutation.mutate()}
            disabled={isActionPending}
            className="text-destructive focus:text-destructive"
          >
            <UserMinus className="mr-2 h-4 w-4" />
            Remove from match
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => blockPlayerMutation.mutate()}
            disabled={isActionPending}
            className="text-destructive focus:text-destructive"
          >
            <Ban className="mr-2 h-4 w-4" />
            Block player
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  )
}
