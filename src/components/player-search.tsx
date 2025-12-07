import { useState } from 'react'
import { Loader2, Search, UserPlus } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useParams } from '@tanstack/react-router'
import { searchPlayers } from '@/utils/sessions'
import { useDebounce } from '@/hooks/use-debounce'
import { useIsOrganizer } from '@/contexts/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export type PlayerSearchResult = {
  id: string
  name: string | null
  phone: string | null
  avatar: string | null
  level: number | null
  playtomic_id: number | null
  is_blocked: boolean
}

interface PlayerSearchProps {
  /** IDs of players to exclude from search results */
  excludeIds: Array<string>
  /** Called when a player is selected */
  onAddPlayer: (playerId: string) => Promise<unknown>
  /** Success message to show */
  successMessage?: string
}

export function PlayerSearch({
  excludeIds,
  onAddPlayer,
  successMessage = 'Player added',
}: PlayerSearchProps) {
  const isOrganizer = useIsOrganizer()
  const queryClient = useQueryClient()
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { id: sessionId } = useParams({ from: '/sessions/$id' })
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Search players query
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['players', 'search', debouncedSearch, excludeIds],
    queryFn: () =>
      searchPlayers({
        data: {
          query: debouncedSearch,
          excludeIds,
        },
      }),
    enabled: debouncedSearch.length >= 1 && showSearch,
  })

  // Add player mutation
  const addPlayerMutation = useMutation({
    mutationFn: onAddPlayer,
    onSuccess: () => {
      toast.success(successMessage)
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId] })
      setShowSearch(false)
      setSearchQuery('')
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to add player',
      )
    },
  })

  const handleCancel = () => {
    setShowSearch(false)
    setSearchQuery('')
  }

  if (!isOrganizer) {
    return null
  }

  if (!showSearch) {
    return (
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowSearch(true)}
      >
        <UserPlus className="size-4 mr-2" />
        Add a player
      </Button>
    )
  }

  return (
    <div className="space-y-3 border rounded-lg p-3">
      <div className="relative">
        <Input
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-9"
          autoFocus
        />
        {isSearching ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin" />
        ) : (
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        )}
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1">
        {!isSearching && searchResults?.length === 0 && debouncedSearch && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No players found
          </p>
        )}
        {searchResults?.map((player) => (
          <button
            key={player.id}
            type="button"
            className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-accent transition-colors"
            onClick={() => addPlayerMutation.mutate(player.id)}
            disabled={addPlayerMutation.isPending}
          >
            <Avatar className="size-8">
              <AvatarImage
                src={player.avatar ?? undefined}
                alt={player.name ?? undefined}
              />
              <AvatarFallback>{player.name?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">{player.name}</div>
              {player.phone && (
                <div className="text-xs text-muted-foreground">
                  {player.phone}
                </div>
              )}
            </div>
            <UserPlus className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={handleCancel}
      >
        Cancel
      </Button>
    </div>
  )
}
