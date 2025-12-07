import { format } from 'date-fns'
import {
  Clock,
  Loader2,
  UserRound,
  ChevronDown,
  Check,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Match, Session } from '@/utils/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cva } from 'class-variance-authority'
import { updateMatchBooker, updateSessionStatus } from '@/utils/sessions'

interface PollClosedViewProps {
  matches: Match[]
  session: Session
}

export function PollClosedView({ matches, session }: PollClosedViewProps) {
  const queryClient = useQueryClient()

  // Open session mutation
  const openSessionMutation = useMutation({
    mutationFn: () =>
      updateSessionStatus({
        data: { sessionPublicId: session.id, status: 'open' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['matches', session.id] })
      toast.success('Session opened! Bookers have been notified via WhatsApp.')
    },
    onError: (error) => {
      console.error('Error opening session:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error('Failed to open session', {
        description: errorMessage,
      })
    },
  })

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-medium mb-2">Poll closed - Review matches</h3>
        <p className="text-sm text-muted-foreground">
          Review the generated matches and assign bookers before opening the
          session. Bookers will receive a WhatsApp notification when you open
          the session.
        </p>
      </div>

      <div className="space-y-4">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} session={session} />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={() => openSessionMutation.mutate()}
          disabled={openSessionMutation.isPending}
          className="w-full"
          size="lg"
        >
          {openSessionMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Open session and notify bookers
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          This will send WhatsApp messages to all bookers
        </p>
      </div>
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

function MatchCard({ match, session }: { match: Match; session: Session }) {
  const queryClient = useQueryClient()
  const startTime = format(new Date(match.slot.range[0]), 'HH:mm')
  const endTime = format(new Date(match.slot.range[1]), 'HH:mm')

  // Update booker mutation
  const updateBookerMutation = useMutation({
    mutationFn: (participantId: number) =>
      updateMatchBooker({
        data: { matchPublicId: match.id, participantId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', session.id] })
      toast.success('Booker updated')
    },
    onError: (error) => {
      console.error('Error updating booker:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error('Failed to update booker', {
        description: errorMessage,
      })
    },
  })

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header with time and level */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <span className="font-medium">
              {startTime} - {endTime}
            </span>
          </div>
          <Badge className={levelBadgeVariants({ level: match.level as 'beginner' | 'improver' | 'intermediate' | 'advanced' })}>
            {match.level}
          </Badge>
        </div>

        {/* Players list - avatars only */}
        <div className="flex items-center gap-1">
          {match.players.map((player) => (
            <Avatar key={player.id} className="size-8">
              <AvatarImage
                src={player.avatar || undefined}
                alt={player.name || 'Player'}
              />
              <AvatarFallback className="text-xs">
                {player.name?.charAt(0).toUpperCase() || 'P'}
              </AvatarFallback>
            </Avatar>
          ))}
          {/* Empty slots */}
          {Array.from({ length: Math.max(0, 4 - match.players.length) }).map(
            (_, i) => (
              <div
                key={`empty-${i}`}
                className="size-8 rounded-full border border-dashed bg-muted/30"
              />
            ),
          )}
        </div>

        {/* Booker selector */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <UserRound className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Booker:</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={
                  match.players.length === 0 || updateBookerMutation.isPending
                }
              >
                {updateBookerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : match.booker ? (
                  <>
                    <Avatar className="size-5">
                      <AvatarImage
                        src={match.booker.avatar || undefined}
                        alt={match.booker.name || 'Booker'}
                      />
                      <AvatarFallback className="text-xs">
                        {match.booker.name?.charAt(0).toUpperCase() || 'B'}
                      </AvatarFallback>
                    </Avatar>
                    <span>{match.booker.name || 'Unknown'}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Select booker</span>
                )}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Select Booker</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {match.players
                .filter((player) => player.participantId != null)
                .map((player) => (
                  <DropdownMenuItem
                    key={player.id}
                    onClick={() => {
                      updateBookerMutation.mutate(player.participantId!)
                    }}
                    className="gap-2"
                  >
                    <Avatar className="size-5">
                      <AvatarImage
                        src={player.avatar || undefined}
                        alt={player.name || 'Player'}
                      />
                      <AvatarFallback className="text-xs">
                        {player.name?.charAt(0).toUpperCase() || 'P'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1">{player.name || 'Unknown'}</span>
                    {match.booker?.playerId === player.id && (
                      <Check className="h-4 w-4" />
                    )}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}
