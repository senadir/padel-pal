# Playtomic Match Integration Design

**Date:** 2025-01-15
**Status:** Approved

## Overview

Integrate Playtomic match data into the matches view to show real-time payment status and player sync state. Organizers manually link Playtomic matches to our internal matches, then we periodically sync data to track payment status and player roster differences.

## Goals

1. Store Playtomic match data in database with periodic sync tracking
2. Compare our match players vs Playtomic match players using `playtomic_id`
3. Visual indication of player sync status via color-coded avatar rings
4. Track post-match data (status, score)

## Database Schema

### New Table: `playtomic_matches`

```sql
CREATE TABLE playtomic_matches (
  id BIGSERIAL PRIMARY KEY,
  playtomic_match_id TEXT NOT NULL UNIQUE,
  match_url TEXT NOT NULL,
  club_name TEXT NOT NULL,
  court_name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  playtomic_players JSONB NOT NULL DEFAULT '[]'::jsonb,
  match_status TEXT CHECK (match_status IN ('scheduled', 'played', 'cancelled')),
  score JSONB,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Fields:**
- `playtomic_match_id`: Unique ID from Playtomic API
- `match_url`: Full URL to view match on Playtomic
- `club_name`, `court_name`: Venue details
- `start_time`, `end_time`: Match scheduling
- `playtomic_players`: JSONB array of `{ playtomic_id, name, avatar, payment_status }`
- `match_status`: Post-match tracking ('scheduled' | 'played' | 'cancelled')
- `score`: Post-match score as `{ team1: number, team2: number }`
- `last_synced_at`: Timestamp of last Playtomic API sync

### Update `matches` Table

```sql
ALTER TABLE matches
ADD COLUMN playtomic_match_id BIGINT REFERENCES playtomic_matches(id) ON DELETE SET NULL;
```

Nullable foreign key allows matches to exist without Playtomic links.

## TypeScript Types

```typescript
// Playtomic player data from API
export type PlaytomicPlayer = {
  playtomic_id: number
  name: string
  avatar: string | null
  payment_status: 'paid' | 'pending'
}

// Playtomic match stored in database
export type PlaytomicMatchData = {
  id: number
  playtomic_match_id: string
  match_url: string
  club_name: string
  court_name: string
  start_time: string
  end_time: string
  playtomic_players: PlaytomicPlayer[]
  match_status: 'scheduled' | 'played' | 'cancelled' | null
  score: { team1: number; team2: number } | null
  last_synced_at: string
  created_at: string
  updated_at: string
}

// Player sync status for UI
export type PlayerSyncStatus =
  | 'synced_paid'      // In both systems + paid
  | 'synced_unpaid'    // In both systems + unpaid
  | 'only_local'       // Only in our match
  | 'only_playtomic'   // Only in Playtomic

// Extended player for match display
export type MatchPlayer = Player & {
  syncStatus: PlayerSyncStatus
  playtomicPaymentStatus?: 'paid' | 'pending'
}

// Updated Match interface
export interface Match extends Option {
  sessionId: string
  playtomicMatch: PlaytomicMatchData | null
  status: 'played' | 'scheduled' | 'draft' | 'cancelled'
  players: Array<
    Option['players'][number] & { status?: 'paid' | 'pending' | 'draft' }
  >
}
```

## Player Sync Logic

Player comparison happens by matching `playtomic_id` fields:

1. **Players in both systems**: Check payment status → 'synced_paid' or 'synced_unpaid'
2. **Only in our match**: Not found in Playtomic → 'only_local'
3. **Only in Playtomic**: Not in our player list → 'only_playtomic'

```typescript
// src/utils/match-sync.ts
export function computePlayerSyncStatus(
  localPlayers: Player[],
  playtomicPlayers: PlaytomicPlayer[]
): MatchPlayer[]
```

Creates maps of both player lists, iterates to determine sync status for each player.

## UI Color Scheme

Avatar border colors indicate sync status:

| Status | Color | Meaning |
|--------|-------|---------|
| `synced_paid` | **Emerald** (`border-emerald-500`) | Player exists in both systems and has paid |
| `synced_unpaid` | **Amber** (`border-amber-500`) | Player exists in both systems but hasn't paid |
| `only_local` | **Rose** (`border-rose-500`) | Player only in our match, not in Playtomic |
| `only_playtomic` | **Violet** (`border-violet-500`) | Player only in Playtomic, not in our match |

## Implementation in MatchCard

```typescript
const playerAvatarVariants = cva('size-10 border-2', {
  variants: {
    syncStatus: {
      synced_paid: 'border-emerald-500',
      synced_unpaid: 'border-amber-500',
      only_local: 'border-rose-500',
      only_playtomic: 'border-violet-500',
    },
  },
})

function MatchCard({ match, session }) {
  const syncedPlayers = match.playtomicMatch
    ? computePlayerSyncStatus(match.players, match.playtomicMatch.playtomic_players)
    : match.players.map(p => ({ ...p, syncStatus: 'only_local' }))

  // Render avatars with color-coded rings
}
```

## RLS Policies

Following existing pattern:
- **SELECT**: Public access (anyone can view)
- **INSERT/UPDATE/DELETE**: Organizers only

## Migration Checklist

1. Create `playtomic_matches` table
2. Add `playtomic_match_id` FK to `matches` table
3. Enable RLS and create policies
4. Create indexes for performance
5. Add trigger for `updated_at` timestamp (if function exists)

## Future Work

- Playtomic API sync implementation (periodic background job)
- Organizer UI for linking Playtomic matches
- Post-match score entry UI
- Match status workflow (scheduled → played/cancelled)
