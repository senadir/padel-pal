import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ExternalLink, PlusIcon, EllipsisVertical } from 'lucide-react'
import { useState } from 'react'
import type { Match, Player } from '@/utils/types'
import { matchQueryOptions, useMatchActions } from '@/utils/sessions'
import { sessionQueryOptions } from './$id'
import { useAuth } from '@/contexts/auth'
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
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
          { property: 'og:description', content: 'View match details and players.' },
          { property: 'og:image', content: '/api/og' },
          { name: 'twitter:title', content: 'Match | Padel Pal' },
          { name: 'twitter:description', content: 'View match details and players.' },
          { name: 'twitter:image', content: '/api/og' },
        ],
      }
    }
    const { match, session } = loaderData
    const time = format(match.slot.range[0], 'HH:mm')
    const date = format(session.date, 'MMM d')
    const title = `${match.level} ${time} - ${date} | Padel Pal`
    const description = `${match.level} match at ${time} on ${format(session.date, 'EEEE, MMMM d')}`
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

  const handleJoinMatch = () => {
    if (!activeMatch || !currentUser?.id) return
    toggleMatchParticipation(activeMatch.id, false)
  }

  const handleLeaveMatch = () => {
    if (!activeMatch || !currentUser?.id) return
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

  return (
    <DrawerDialog open={true} setOpen={(open) => !open && handleClose()}>
      <DrawerDialogContent>
        <DrawerDialogHeader>
          <DrawerDialogTitle className="text-center capitalize">
            {activeMatch.level} -{' '}
            {format(activeMatch.slot.range[0] ?? new Date(), 'HH:mm')} - Game{' '}
            {gameIndex}
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
              currentUser={currentUser}
              onLeaveMatch={handleLeaveMatch}
              isLoading={isMatchActionLoading}
            />
          ))}
          {activeMatch.players.length < 4 &&
            Array.from({
              length: 4 - activeMatch.players.length,
            }).map((_, i) => (
              <Button
                key={`empty-${i}`}
                className="flex gap-2 items-center justify-start p-0"
                variant="ghost"
                type="button"
                onClick={handleJoinMatch}
                disabled={isCurrentUserInMatch || isMatchActionLoading || !currentUser}
              >
                <div className="size-8 flex items-center justify-center rounded-full border-1 border-dashed border">
                  <PlusIcon className="size-4 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground text-sm">
                  {!currentUser ? 'Login to join' : 'Click to join'}
                </span>
              </Button>
            ))}
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
  currentUser,
  onLeaveMatch,
  isLoading,
}: {
  player: Match['players'][number]
  match: Match
  currentUser: Player | null | undefined
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
      <DropdownMenu open={playerDialogOpen} onOpenChange={setPlayerDialogOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">
            <span className="sr-only">Open menu</span>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        {playerDialogOpen && (
          <MatchPlayerOptionDialog
            player={player}
            currentMatch={currentMatch}
            isCurrentUser={isCurrentUser}
            onLeaveMatch={onLeaveMatch}
            isLoading={isLoading}
          />
        )}
      </DropdownMenu>
    </div>
  )
}

const MatchPlayerOptionDialog = ({
  player,
  isCurrentUser,
  onLeaveMatch,
  isLoading,
}: {
  player: Match['players'][number]
  currentMatch: Match
  isCurrentUser: boolean
  onLeaveMatch: () => void
  isLoading: boolean
}) => {
  return (
    <DropdownMenuContent className="w-56" align="start">
      <DropdownMenuLabel>Manage player</DropdownMenuLabel>
      <DropdownMenuGroup>
        {isCurrentUser && (
          <DropdownMenuItem onClick={onLeaveMatch} disabled={isLoading}>
            Leave match
            <DropdownMenuShortcut>⌘L</DropdownMenuShortcut>
          </DropdownMenuItem>
        )}
        {!isCurrentUser && (
          <>
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
            </DropdownMenuSub>
          </>
        )}
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
