import { format } from 'date-fns'
import { Clock, ExternalLink, MapPin, PlusIcon, Share2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { cva } from 'class-variance-authority'
import { useSuspenseQuery } from '@tanstack/react-query'
import type {
  Match,
  MatchPlayer,
  PlayerSyncStatus,
  Session,
} from '@/utils/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { computePlayerSyncStatus } from '@/utils/match-sync'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth'
import { matchQueryOptions } from '@/utils/sessions'

interface MatchesViewProps {
  matches: Array<Match>
  session: Session
}

export function MatchesView({ matches, session }: MatchesViewProps) {
  return (
    <div className="space-y-4">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} session={session} />
      ))}
    </div>
  )
}

const levelBadgeVariants = cva('capitalize', {
  variants: {
    level: {
      beginner:
        'border-transparent bg-green-100 text-green-800 hover:bg-green-100/80',
      improver:
        'border-transparent bg-blue-100 text-blue-800 hover:bg-blue-100/80',
      intermediate:
        'border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80',
      advanced:
        'border-transparent bg-red-100 text-red-800 hover:bg-red-100/80',
    },
  },
  defaultVariants: {
    level: 'beginner',
  },
})

const playerAvatarVariants = cva('size-10 border-2', {
  variants: {
    syncStatus: {
      synced_paid: 'border-emerald-500', // In both + paid
      synced_unpaid: 'border-amber-500', // In both + unpaid
      only_local: 'border-rose-500', // Only in our match
      only_playtomic: 'border-violet-500', // Only in Playtomic
      unconnected: 'border-gray-500', // Match not connected to Playtomic
    },
  },
})

const getPlayerSyncStatusTooltip = (syncStatus: PlayerSyncStatus) => {
  switch (syncStatus) {
    case 'synced_paid':
      return 'Paid on Playtomic'
    case 'synced_unpaid':
      return 'Unpaid on Playtomic'
    case 'only_local':
      return 'Not on Playtomic'
    case 'only_playtomic':
      return 'Player only exists on Playtomic'
    case 'unconnected':
      return 'Player not connected to Playtomic'
    default:
      return 'Unknown sync status'
  }
}

function MatchCard({ match, session }: { match: Match; session: Session }) {
  const { authData } = useAuth()
  const currentUser = authData?.player
  const { data: matches } = useSuspenseQuery(matchQueryOptions(session.id))

  const startTime = format(new Date(match.slot.range[0]), 'HH:mm')
  const endTime = format(new Date(match.slot.range[1]), 'HH:mm')
  const sessionDate = format(new Date(session.date), 'EEEE, MMMM do')

  // Compute synced players with status
  const syncedPlayers: Array<MatchPlayer> = match.playtomicMatch
    ? computePlayerSyncStatus(
        match.players,
        match.playtomicMatch.playtomic_players,
      )
    : match.players.map((p) => ({ ...p, syncStatus: 'unconnected' as const }))

  const handleShare = async () => {
    const playerNames = syncedPlayers
      .map((p) => p.name)
      .filter(Boolean)
      .join(', ')
    const shareUrl = `${window.location.origin}/share/match/${match.id}`
    const shareText = [
      `${match.level} Padel Match`,
      `${sessionDate} at ${startTime}`,
      `${session.venues[0]?.name || 'TBD'}`,
      playerNames ? `Players: ${playerNames}` : 'Join us!',
    ].join('\n')

    if (typeof navigator.share !== 'undefined') {
      await navigator.share({
        title: `${match.level} Padel Match`,
        text: shareText,
        url: shareUrl,
      })
      toast.success('Shared to other apps')
    } else {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`)
      toast.success('Copied to clipboard')
    }
  }

  /**
   * Can the current user join this match?
   * - If currentUser is not defined: true (allow join for guests, will prompt login)
   * - Else, return true if the user is not already in this match,
   *   AND the user is not already in another match with an overlapping time slot
   */
  const canJoinMatch = (matchId: string): boolean => {
    if (!currentUser) return true

    // Find this match
    const targetMatch = matches.find((m) => m.id === matchId)
    if (!targetMatch) return true // Defensive: if match not found, allow

    // Is current user already in this match?
    if (targetMatch.players.some((p) => p.id === currentUser.id)) {
      return false
    }

    // Is current user in a conflicting match (overlapping time slot)?
    const targetStart = new Date(targetMatch.slot.range[0])
    const targetEnd = new Date(targetMatch.slot.range[1])

    const hasOverlap = matches.some((m) => {
      if (m.id === matchId) return false // exclude this match itself
      // Is user in this match?
      const isInThisMatch = m.players.some((p) => p.id === currentUser.id)
      if (!isInThisMatch) return false
      // Check for overlap in time
      const mStart = new Date(m.slot.range[0])
      const mEnd = new Date(m.slot.range[1])
      // Overlaps if starts before other's end and ends after other's start
      return mStart < targetEnd && mEnd > targetStart
    })

    return !hasOverlap
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6 space-y-3">
        {/* Header with date and status */}
        <div className="flex items-start justify-between">
          <h3 className="text font-semibold">{sessionDate}</h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={handleShare}
              aria-label="Share match"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Badge variant={session.status === 'open' ? 'default' : 'outline'}>
              {session.status === 'open' ? 'Open' : session.status}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {/* Venue */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="size-4" />
            <span className="text-xs font-medium">
              {session.venues[0]?.name}
            </span>
          </div>

          {/* Time */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" />
            <span className="text-xs font-medium">
              {startTime} - {endTime}
            </span>
          </div>

          {/* Level Badge */}
          <div>
            <Badge className={levelBadgeVariants({ level: match.level })}>
              {match.level}
            </Badge>
          </div>
        </div>

        {/* Player Avatars */}
        <div className="flex gap-2">
          {syncedPlayers.map((player) => {
            const avatarElement = (
              <Link
                to="/sessions/$id/$matchId"
                params={{ id: session.id, matchId: match.id }}
              >
                <Avatar
                  className={playerAvatarVariants({
                    syncStatus: player.syncStatus,
                  })}
                >
                  <AvatarImage
                    src={player.avatar || undefined}
                    alt={player.name || 'Player'}
                  />
                  <AvatarFallback>
                    {player.name?.charAt(0).toUpperCase() || 'P'}
                  </AvatarFallback>
                </Avatar>
              </Link>
            )

            // Only show tooltip when match is connected to Playtomic
            if (!match.playtomicMatch) {
              return <div key={player.id}>{avatarElement}</div>
            }

            return (
              <Tooltip key={player.id}>
                <TooltipTrigger asChild>{avatarElement}</TooltipTrigger>
                <TooltipContent>
                  <p>{getPlayerSyncStatusTooltip(player.syncStatus)}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
          {/* Show empty slots - clickable to join */}
          {Array.from({ length: Math.max(0, 4 - syncedPlayers.length) }).map(
            (_, i) => (
              <Link
                key={`empty-${i}`}
                to="/sessions/$id/$matchId"
                params={{ id: session.id, matchId: match.id }}
              >
                <Avatar
                  className={cn(
                    'size-10 border-2 border-dashed  transition-colors cursor-default',
                    {
                      'cursor-pointer hover:border-primary': canJoinMatch(
                        match.id,
                      ),
                    },
                  )}
                >
                  <AvatarFallback className="bg-muted/50">
                    <PlusIcon className="h-4 w-4 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
              </Link>
            ),
          )}
        </div>

        {match.playtomicMatch ? (
          <Button className="w-full" asChild variant="outline" size="lg">
            <a
              href={match.playtomicMatch.match_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              Open in Playtomic
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        ) : (
          <Button className="w-full" asChild variant="outline" size="lg">
            <Link
              to="/sessions/$id/$matchId"
              params={{ id: session.id, matchId: match.id }}
            >
              {canJoinMatch(match.id) ? 'Join match' : 'Match details'}
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
