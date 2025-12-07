import type {
  Player,
  PlaytomicPlayer,
  PlayerSyncStatus,
  MatchPlayer,
} from './types'

/**
 * Compares local match players with Playtomic match players to determine sync status.
 * Matches players by playtomic_id.
 *
 * @param localPlayers - Players from our matches table
 * @param playtomicPlayers - Players from Playtomic API (stored in playtomic_matches)
 * @returns Array of players with sync status for UI rendering
 */
export function computePlayerSyncStatus(
  localPlayers: Player[],
  playtomicPlayers: PlaytomicPlayer[],
): MatchPlayer[] {
  // Create map for efficient lookup
  const playtomicMap = new Map(playtomicPlayers.map((p) => [Number(p.id), p]))
  const result: MatchPlayer[] = []
  // Process local players - check if they exist in Playtomic
  for (const player of localPlayers) {
    const playtomicPlayer = playtomicMap.get(Number(player.playtomic_id))

    if (playtomicPlayer) {
      // Player exists in both systems - check payment status
      const syncStatus: PlayerSyncStatus =
        playtomicPlayer.payment_status === 'paid'
          ? 'synced_paid'
          : 'synced_unpaid'

      result.push({
        ...player,
        syncStatus,
        playtomicPaymentStatus: playtomicPlayer.payment_status,
      })

      // Mark as processed
      playtomicMap.delete(Number(player.playtomic_id))
    } else {
      // Player only in our system (not in Playtomic)
      result.push({
        ...player,
        syncStatus: 'only_local',
      })
    }
  }

  // Process remaining Playtomic players (not in our system)
  for (const [playtomicId, playtomicPlayer] of playtomicMap) {
    result.push({
      // Create a temporary player record for display
      id: `playtomic-${playtomicId}`,
      playtomic_id: playtomicId,
      name: playtomicPlayer.full_name,
      avatar: playtomicPlayer.picture,
      phone: null,
      level: null,
      status: null,
      is_blocked: false,
      created_at: new Date().toISOString(),
      syncStatus: 'only_playtomic',
      playtomicPaymentStatus: playtomicPlayer.payment_status,
    })
  }

  return result
}
