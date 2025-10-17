import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import {
  ChevronsDownUp,
  ChevronsUpDown,
  EllipsisVertical,
  ExternalLink,
} from 'lucide-react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { z } from 'zod'
import type { Match, Player } from '@/utils/types'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
  matchQueryOptions,
  sessionQueryOptions,
  useVoteForSession,
} from '@/utils/sessions'
import { Session } from '@/utils/types'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Item, ItemActions, ItemContent, ItemMedia } from '@/components/ui/item'
import {
  DrawerDialog,
  DrawerDialogClose,
  DrawerDialogContent,
  DrawerDialogDescription,
  DrawerDialogFooter,
  DrawerDialogHeader,
  DrawerDialogTitle,
} from '@/components/ui/drawer-dialog'

export const Route = createFileRoute('/sessions/$id_/matches')({
  component: RouteComponent,
  head: () => ({
    meta: [
      {
        title: 'Matches for session',
      },
    ],
  }),
  validateSearch: z.object({
    mine: z.boolean().default(true),
    matchId: z.string().optional(),
  }),
  loaderDeps: ({ search: { mine, matchId } }) => ({ mine, matchId }),
  loader: async ({ params: { id }, context, deps }) => {
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
})

const currentUser: Player = {
  id: '123456789',
  name: 'Nadir Seghir',
  phone: '+1234567890',
  level: '1.54',
  avatar:
    'https://res.cloudinary.com/playtomic/image/upload/c_limit,w_1280/v1/pro/users/10504108/1753865118506',
}

function RouteComponent() {
  const { id } = Route.useParams()
  const { data: session } = useSuspenseQuery(sessionQueryOptions(id))
  const { mine, matchId } = Route.useSearch()
  const { data: matches } = useSuspenseQuery(matchQueryOptions(id))
  const navigate = useNavigate({ from: Route.fullPath })

  // Group matches by timeSlot and level
  const groupedMatches: Record<string, Record<string, Array<Match>>> = {}
  matches.forEach((match: Match) => {
    const timeSlot = match.slot
    const level = match.level
    if (!groupedMatches[timeSlot.id]) {
      groupedMatches[timeSlot.id] = {}
    }
    if (!groupedMatches[timeSlot.id][level]) {
      groupedMatches[timeSlot.id][level] = []
    }
    groupedMatches[timeSlot.id][level].push(match)
  })

  const [joinMatchDrawerOpen, setJoinMatchDrawerOpen] = useState(() =>
    matchId ? true : false,
  )

  // Sync drawer state with matchId query parameter
  useEffect(() => {
    setJoinMatchDrawerOpen(!!matchId)
  }, [matchId])

  const toggleDialog = (isOpen: boolean) => {
    setJoinMatchDrawerOpen(isOpen)
    if (!isOpen) {
      navigate({ to: '.' })
    }
  }

  const activeMatch = useMemo(() => {
    return matches.find((match) => match.id === matchId)
  }, [matches, matchId])

  return (
    <form className="flex flex-col gap-6">
      <FieldSet>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">
            {format(session.date, 'EE, MMM d')} matches
          </h1>
          <FieldLegend className="text-muted-foreground text-sm">
            View your games and others, and see which games you can join.
          </FieldLegend>
        </div>
        <div className="flex flex-col gap-12">
          {Object.entries(groupedMatches).map(([timeSlotId, levels]) =>
            Object.entries(levels).map(([level, ms]) => (
              <div
                key={timeSlotId + '-' + level}
                className="flex flex-col gap-8 relative"
              >
                <SeparatorWithTitle
                  leftTitle={timeSlotId}
                  rightTitle={level}
                  className="sticky top-0"
                />
                <div className="flex flex-col gap-4">
                  {ms.map((match) => (
                    <MatchSlot key={match.id} match={match} />
                  ))}
                </div>
              </div>
            )),
          )}
        </div>
        <DrawerDialog open={joinMatchDrawerOpen} setOpen={toggleDialog}>
          <DrawerDialogContent>
            <DrawerDialogHeader>
              <DrawerDialogTitle className="text-center capitalize">
                {activeMatch?.level} -{' '}
                {format(activeMatch?.slot.range[0] ?? new Date(), 'HH:mm')} -{' '}
                {activeMatch
                  ? (() => {
                      // Find all matches in the same slot+level to get index
                      const matchesForSlotLevel = matches.filter(
                        (m) =>
                          m.slot.id === activeMatch.slot.id &&
                          m.level === activeMatch.level,
                      )
                      const gameIndex =
                        matchesForSlotLevel.findIndex(
                          (m) => m.id === activeMatch.id,
                        ) + 1
                      return `Game ${gameIndex}`
                    })()
                  : null}
              </DrawerDialogTitle>
              <DrawerDialogDescription className="text-center text-muted-foreground capitalize">
                Check playtomic for more details
              </DrawerDialogDescription>
            </DrawerDialogHeader>
            <div className="p-4 flex flex-col gap-3">
              {activeMatch?.players.map((player) => (
                <PlayerListItem key={player.id} player={player} />
              ))}
            </div>
            <DrawerDialogFooter>
              <DrawerDialogClose asChild>
                <Button variant="outline" type="button" className="w-full">
                  Close
                </Button>
              </DrawerDialogClose>
            </DrawerDialogFooter>
          </DrawerDialogContent>
        </DrawerDialog>
      </FieldSet>
    </form>
  )
}

const MatchSlot = ({
  match,
  defaultOpen = false,
}: {
  match: Match
  defaultOpen?: boolean
}) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Item variant="outline" size="default">
        <CollapsibleTrigger asChild>
          <div className="flex w-full items-center cursor-pointer">
            <ItemMedia>
              <div className="*:data-[slot=avatar]:ring-background flex space-x-2 *:data-[slot=avatar]:ring-2">
                {match.players.map((player: Player) => (
                  <Avatar key={player.id} className="size-6">
                    <AvatarImage src={player.avatar} alt={player.name} />
                    <AvatarFallback delayMs={700}>
                      {player.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {match.players.length < 4 &&
                  Array.from({ length: 4 - match.players.length }).map(
                    (_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="size-6 flex items-center justify-center rounded-full border-1 border-dashed border"
                      ></div>
                    ),
                  )}
              </div>
            </ItemMedia>

            <ItemActions className="ml-auto">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                tabIndex={-1}
                type="button"
                aria-label="Toggle"
              >
                {open ? <ChevronsDownUp /> : <ChevronsUpDown />}
                <span className="sr-only">Toggle</span>
              </Button>
            </ItemActions>
          </div>
        </CollapsibleTrigger>
        {open && (
          <ItemContent>
            <CollapsibleContent>
              <Link
                className="grid grid-cols-2 gap-2"
                to="."
                replace
                search={{ matchId: match.id }}
              >
                {match.players.map((player: Player) => (
                  <div className="flex gap-2 items-center">
                    <Avatar key={player.id} className="size-8">
                      <AvatarImage src={player.avatar} alt={player.name} />
                      <AvatarFallback delayMs={700}>
                        {player.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-sm font-medium">{player.name}</div>
                  </div>
                ))}
              </Link>
            </CollapsibleContent>
          </ItemContent>
        )}
      </Item>
    </Collapsible>
  )
}

const PlayerListItem = ({
  player,
  match: currentMatch,
}: {
  player: Match['players'][number]
  match: Match
}) => {
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false)
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-8">
        <AvatarImage src={player.avatar} alt={player.name} />
        <AvatarFallback delayMs={700}>{player.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{player.name}</div>
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
          <PlayerOptionDialog player={player} currentMatch={currentMatch} />
        )}
      </DropdownMenu>
    </div>
  )
}

const PlayerOptionDialog = ({
  player,
  currentMatch,
}: {
  player: Match['players'][number]
  currentMatch: Match
}) => {
  const { data: matches } = useQuery(matchQueryOptions(currentMatch.sessionId))
  if (!matches) {
    return null
  }

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
