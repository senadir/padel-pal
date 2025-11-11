import { format } from 'date-fns'
import { useState } from 'react'
import { ChevronsDownUp, ChevronsUpDown, PlusIcon } from 'lucide-react'
import { useNavigate, Link } from '@tanstack/react-router'
import type { Match, Player, Session } from '@/utils/types'
import { FieldLegend } from '@/components/ui/field'
import { SeparatorWithTitle } from '@/components/ui/separator-title'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Item, ItemActions, ItemContent, ItemMedia } from '@/components/ui/item'
import { useMatchActions } from '@/utils/sessions'
import { useAuth } from '@/contexts/auth'
import { Route } from '../$id'

export const MatchesView = ({
  session,
  matches,
}: {
  session: Session
  matches: Match[]
}) => {
  const navigate = useNavigate({ from: Route.fullPath })
  const sessionId = session.id
  const { authData } = useAuth()

  // Check if user is fully authenticated
  const currentUser = authData?.player
  const isFullyAuthenticated = !!(
    authData?.user &&
    authData.isPhoneVerified &&
    authData.hasPlaytomicProfile
  )

  const { isLoading } = useMatchActions({
    sessionId,
    currentUserId: currentUser?.id || '',
  })

  // Group matches by timeSlot and level
  const groupedMatches: Record<string, Record<string, Array<Match>>> = {}
  matches.forEach((match) => {
    const timeSlot = match.slot
    const level = match.level
    if (!groupedMatches[timeSlot.id]) {
      groupedMatches[timeSlot.id] = {}
    }
    if (!groupedMatches[timeSlot.id][level]) {
      groupedMatches[timeSlot.id][level] = []
    }
    groupedMatches[timeSlot.id][level].push(match as Match)
  })

  return (
    <div className="flex flex-col gap-12">
      {Object.entries(groupedMatches).map(([timeSlotId, levels]) =>
        Object.entries(levels).map(([level, ms]) => (
          <div
            key={timeSlotId + '-' + level}
            className="flex flex-col gap-4 relative"
          >
            <SeparatorWithTitle
              leftTitle={timeSlotId}
              rightTitle={level}
              className="sticky top-0 z-10 bg-background"
            />
            <div className="flex flex-col gap-4">
              {ms.map((match) => (
                <MatchSlot
                  key={match.id}
                  match={match}
                  currentUser={currentUser}
                  isLoading={isLoading}
                />
              ))}
            </div>
          </div>
        )),
      )}
    </div>
  )
}

const MatchSlot = ({
  match,
  currentUser,
  isLoading,
  defaultOpen = false,
}: {
  match: Match
  currentUser: Player | null | undefined
  isLoading: boolean
  defaultOpen?: boolean
}) => {
  const [open, setOpen] = useState(defaultOpen)
  const { id: sessionId } = Route.useParams()

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Item variant="outline" size="default">
        <CollapsibleTrigger asChild>
          <div className="flex w-full items-center cursor-pointer">
            <ItemMedia>
              <div className="*:data-[slot=avatar]:ring-background flex space-x-2 *:data-[slot=avatar]:ring-2">
                {match.players.map((player: Player) => (
                  <Avatar key={player.id} className="size-6">
                    <AvatarImage
                      src={player.avatar ?? undefined}
                      alt={player.name ?? undefined}
                    />
                    <AvatarFallback delayMs={700}>
                      {player.name?.charAt(0) || '?'}
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
              <div className="grid grid-cols-2 gap-2">
                {match.players.map((player: Player) => {
                  const isCurrentUser = currentUser?.id === player.id
                  return (
                    <Link
                      key={player.id}
                      to="/sessions/$id/$matchId"
                      params={{ id: sessionId, matchId: match.id }}
                      disabled={isLoading}
                      preload="render"
                      className="flex gap-2 items-center cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Avatar className="size-8">
                        <AvatarImage
                          src={player.avatar ?? undefined}
                          alt={player.name ?? undefined}
                        />
                        <AvatarFallback delayMs={700}>
                          {player.name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-sm font-medium">
                        {player.name}
                        {isCurrentUser && ' (You)'}
                      </div>
                    </Link>
                  )
                })}
                {match.players.length < 4 &&
                  Array.from({ length: 4 - match.players.length }).map(
                    (_, i) => (
                      <Link
                        key={`empty-${i}`}
                        to="/sessions/$id/$matchId"
                        params={{ id: sessionId, matchId: match.id }}
                        preload="render"
                        disabled={isLoading}
                        className="flex gap-2 items-center cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="size-8 flex items-center justify-center rounded-full border-1 border-dashed border">
                          <PlusIcon className="size-4 text-muted-foreground" />
                        </div>
                        <span className="text-muted-foreground text-sm">
                          {isLoading ? 'Loading...' : 'Click to join'}
                        </span>
                      </Link>
                    ),
                  )}
              </div>
            </CollapsibleContent>
          </ItemContent>
        )}
      </Item>
    </Collapsible>
  )
}
