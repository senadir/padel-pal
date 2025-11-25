import { format } from 'date-fns'
import { MapPin, Clock, ExternalLink, PlusIcon, Share2 } from 'lucide-react'
import type {
  Match,
  Session,
  MatchPlayer,
  PlayerSyncStatus,
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
import { toast } from 'sonner'
import { cva } from 'class-variance-authority'
import { computePlayerSyncStatus } from '@/utils/match-sync'

interface MatchesViewProps {
  matches: Match[]
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
  const startTime = format(new Date(match.slot.range[0]), 'HH:mm')
  const endTime = format(new Date(match.slot.range[1]), 'HH:mm')
  const sessionDate = format(new Date(session.date), 'EEEE, MMMM do')

  // Compute synced players with status
  const syncedPlayers: MatchPlayer[] = match.playtomicMatch
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

    if (navigator.share) {
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
          {syncedPlayers.map((player) => (
            <Tooltip key={player.id}>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>
                <p>{getPlayerSyncStatusTooltip(player.syncStatus)}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          {/* Show empty slots */}
          {Array.from({ length: Math.max(0, 4 - syncedPlayers.length) }).map(
            (_, i) => (
              <Avatar
                key={`empty-${i}`}
                className="size-10 border-2 border-dashed"
              >
                <AvatarFallback className="bg-muted/50">
                  <PlusIcon className="h-4 w-4 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
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
          <Button className="w-full" disabled variant="outline" size="lg">
            Not on playtomic yet
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
