# Playtomic Match Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Playtomic match data storage with player sync status visualization using color-coded avatar rings.

**Architecture:** Create `playtomic_matches` table to store synced data from Playtomic API, link to existing `matches` via FK, compute player sync status by comparing `playtomic_id` fields, and render color-coded avatars in MatchCard component.

**Tech Stack:** Supabase (PostgreSQL + RLS), TypeScript, React, CVA (class-variance-authority), Tailwind CSS

---

## Task 1: Create Database Migration

**Files:**
- Create: `supabase/migrations/20250115000000_add_playtomic_matches.sql`

**Step 1: Write the migration SQL**

Create the migration file with the following content:

```sql
-- Create playtomic_matches table
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

-- Add foreign key to matches table
ALTER TABLE matches
ADD COLUMN playtomic_match_id BIGINT REFERENCES playtomic_matches(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE playtomic_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies (following existing pattern)
-- Public read access
CREATE POLICY "playtomic_matches_select_public" ON playtomic_matches
  FOR SELECT USING (true);

-- Organizers can manage
CREATE POLICY "playtomic_matches_insert_organizer" ON playtomic_matches
  FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'user_role')::public.app_role = 'organizer');

CREATE POLICY "playtomic_matches_update_organizer" ON playtomic_matches
  FOR UPDATE
  USING ((auth.jwt() ->> 'user_role')::public.app_role = 'organizer');

CREATE POLICY "playtomic_matches_delete_organizer" ON playtomic_matches
  FOR DELETE
  USING ((auth.jwt() ->> 'user_role')::public.app_role = 'organizer');

-- Create indexes for faster lookups
CREATE INDEX idx_playtomic_matches_match_id ON playtomic_matches(playtomic_match_id);
CREATE INDEX idx_matches_playtomic_match_id ON matches(playtomic_match_id);
```

**Step 2: Apply the migration**

Run: `npx supabase db push`

Expected: Migration applies successfully, tables and policies created.

**Step 3: Commit the migration**

```bash
git add supabase/migrations/20250115000000_add_playtomic_matches.sql
git commit -m "feat: add playtomic_matches table and link to matches"
```

---

## Task 2: Regenerate Database Types

**Files:**
- Modify: `src/utils/database.types.ts` (auto-generated)

**Step 1: Generate TypeScript types from database schema**

Run: `npx supabase gen types typescript --local > src/utils/database.types.ts`

Expected: File updated with new `playtomic_matches` table types and `matches.playtomic_match_id` field.

**Step 2: Verify types are correct**

Run: `npx tsc --noEmit`

Expected: No type errors.

**Step 3: Commit the generated types**

```bash
git add src/utils/database.types.ts
git commit -m "chore: regenerate database types for playtomic_matches"
```

---

## Task 3: Add TypeScript Type Definitions

**Files:**
- Modify: `src/utils/types.ts:16-29`

**Step 1: Replace PlaytomicMatch type with comprehensive types**

In `src/utils/types.ts`, replace lines 16-20 (the existing `PlaytomicMatch` type) with:

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
  | 'synced_paid'      // In both systems + paid (Emerald ring)
  | 'synced_unpaid'    // In both systems + unpaid (Amber ring)
  | 'only_local'       // Only in our match (Rose ring)
  | 'only_playtomic'   // Only in Playtomic (Violet ring)

// Extended player for match display
export type MatchPlayer = Player & {
  syncStatus: PlayerSyncStatus
  playtomicPaymentStatus?: 'paid' | 'pending'
}
```

**Step 2: Update Match interface**

In `src/utils/types.ts`, update the `Match` interface (line 22-29) to change `playtomicMatch` type:

```typescript
export interface Match extends Option {
  sessionId: string
  playtomicMatch: PlaytomicMatchData | null  // Changed from basic PlaytomicMatch
  status: 'played' | 'scheduled' | 'draft' | 'cancelled'
  players: Array<
    Option['players'][number] & { status?: 'paid' | 'pending' | 'draft' }
  >
}
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`

Expected: No type errors.

**Step 4: Commit type definitions**

```bash
git add src/utils/types.ts
git commit -m "feat: add Playtomic match types and player sync status"
```

---

## Task 4: Create Player Sync Logic Utility

**Files:**
- Create: `src/utils/match-sync.ts`

**Step 1: Write the player sync computation function**

Create `src/utils/match-sync.ts` with:

```typescript
import type { Player, PlaytomicPlayer, PlayerSyncStatus, MatchPlayer } from './types'

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
  playtomicPlayers: PlaytomicPlayer[]
): MatchPlayer[] {
  // Create maps for efficient lookup
  const playtomicMap = new Map(
    playtomicPlayers.map(p => [p.playtomic_id, p])
  )

  const localMap = new Map(
    localPlayers.map(p => [p.playtomic_id!, p])
  )

  const result: MatchPlayer[] = []

  // Process local players - check if they exist in Playtomic
  for (const player of localPlayers) {
    const playtomicPlayer = playtomicMap.get(player.playtomic_id!)

    if (playtomicPlayer) {
      // Player exists in both systems - check payment status
      const syncStatus: PlayerSyncStatus =
        playtomicPlayer.payment_status === 'paid'
          ? 'synced_paid'
          : 'synced_unpaid'

      result.push({
        ...player,
        syncStatus,
        playtomicPaymentStatus: playtomicPlayer.payment_status
      })

      // Mark as processed
      playtomicMap.delete(player.playtomic_id!)
    } else {
      // Player only in our system (not in Playtomic)
      result.push({
        ...player,
        syncStatus: 'only_local'
      })
    }
  }

  // Process remaining Playtomic players (not in our system)
  for (const [playtomicId, playtomicPlayer] of playtomicMap) {
    result.push({
      // Create a temporary player record for display
      id: `playtomic-${playtomicId}`,
      playtomic_id: playtomicId,
      name: playtomicPlayer.name,
      avatar: playtomicPlayer.avatar,
      phone: null,
      level: null,
      status: null,
      created_at: new Date().toISOString(),
      syncStatus: 'only_playtomic',
      playtomicPaymentStatus: playtomicPlayer.payment_status
    })
  }

  return result
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`

Expected: No type errors.

**Step 3: Commit the sync utility**

```bash
git add src/utils/match-sync.ts
git commit -m "feat: add player sync status computation utility"
```

---

## Task 5: Update MatchCard Component

**Files:**
- Modify: `src/routes/sessions/-components/matches-view.tsx:1-137`

**Step 1: Add imports for sync logic and CVA**

At the top of `src/routes/sessions/-components/matches-view.tsx`, add these imports after line 8:

```typescript
import type { MatchPlayer } from '@/utils/types'
import { computePlayerSyncStatus } from '@/utils/match-sync'
```

**Step 2: Add player avatar variants**

After the `levelBadgeVariants` definition (around line 42), add:

```typescript
const playerAvatarVariants = cva('size-10 border-2', {
  variants: {
    syncStatus: {
      synced_paid: 'border-emerald-500',      // In both + paid
      synced_unpaid: 'border-amber-500',      // In both + unpaid
      only_local: 'border-rose-500',          // Only in our match
      only_playtomic: 'border-violet-500',    // Only in Playtomic
    },
  },
})
```

**Step 3: Update MatchCard component to compute sync status**

In the `MatchCard` function (line 44), add this after the `const participants = match.players` line:

```typescript
function MatchCard({ match, session }: { match: Match; session: Session }) {
  const participants = match.players
  const startTime = format(new Date(match.slot.range[0]), 'HH:mm')
  const endTime = format(new Date(match.slot.range[1]), 'HH:mm')
  const sessionDate = format(new Date(session.date), 'EEEE, MMMM do')

  // Compute synced players with status
  const syncedPlayers: MatchPlayer[] = match.playtomicMatch
    ? computePlayerSyncStatus(
        match.players,
        match.playtomicMatch.playtomic_players
      )
    : match.players.map(p => ({ ...p, syncStatus: 'only_local' as const }))

  // Rest of component...
```

**Step 4: Update avatar rendering to use sync status**

Replace the player avatars section (lines 87-101) with:

```typescript
{/* Player Avatars */}
<div className="flex gap-2">
  {syncedPlayers.map((player) => (
    <Avatar
      key={player.id}
      className={playerAvatarVariants({ syncStatus: player.syncStatus })}
    >
      <AvatarImage
        src={player.avatar || undefined}
        alt={player.name || 'Player'}
      />
      <AvatarFallback>
        {player.name?.charAt(0).toUpperCase() || 'P'}
      </AvatarFallback>
    </Avatar>
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
```

**Step 5: Verify types compile**

Run: `npx tsc --noEmit`

Expected: No type errors.

**Step 6: Check for linting issues**

Run: `npm run lint`

Expected: No errors (or only auto-fixable warnings).

**Step 7: Commit the UI updates**

```bash
git add src/routes/sessions/-components/matches-view.tsx
git commit -m "feat: add color-coded player sync status to match cards"
```

---

## Task 6: Verify Build

**Step 1: Run development build**

Run: `npm run build`

Expected: Build completes successfully with no errors.

**Step 2: Verify type checking passes**

Run: `npx tsc --noEmit`

Expected: No type errors.

**Step 3: Commit any necessary fixes if build revealed issues**

Only if there were issues found and fixed:

```bash
git add .
git commit -m "fix: resolve build issues for Playtomic integration"
```

---

## Summary

This implementation adds:

1. ✅ Database table `playtomic_matches` with RLS policies
2. ✅ Foreign key relationship from `matches` to `playtomic_matches`
3. ✅ TypeScript types for Playtomic data and player sync status
4. ✅ Player sync computation logic matching by `playtomic_id`
5. ✅ Color-coded avatar rings (Emerald/Amber/Rose/Violet) in UI

**Future work (not in this plan):**
- Playtomic API integration for syncing match data
- Organizer UI for linking Playtomic matches
- Post-match score entry and status updates
