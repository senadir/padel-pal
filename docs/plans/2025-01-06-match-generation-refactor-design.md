# Match Generation Refactor Design

**Date:** 2025-01-06
**Status:** Approved

## Problem Statement

When moving a session from "voting" to "open" status:
1. The "Close Poll" button doesn't actually update the session status - it just navigates to `/matches`
2. The button is disabled when there are no votes (this is acceptable since there's nothing to generate)
3. Match generation logic is tightly coupled with database operations, making it hard to test or replace with an external engine in the future

## Goals

1. Fix the "Close Poll" button to properly trigger status change and match generation
2. Extract match generation logic into a pure, testable function
3. Consolidate voting and matches pages into a single route (separate commit)

## Design

### Part 1: External Match Generation Function

Create a pure function `generateMatchesFromVotes()` that handles game splitting logic independently of database concerns.

**Function Signature:**

```typescript
interface VoteInput {
  optionId: string
  playerId: string
}

interface TimeSlotOption {
  id: string // option ID
  timeSlotId: string
  level: string
  startTime: Date
  endTime: Date
}

interface GeneratedMatch {
  optionId: string
  timeSlotId: string
  level: string
  startTime: Date
  endTime: Date
  maxPlayers: number
  playerIds: string[]
}

function generateMatchesFromVotes(
  options: TimeSlotOption[],
  votes: VoteInput[]
): GeneratedMatch[]
```

**Logic:**

For each option:
- Find all votes for that option
- If zero votes → skip this option entirely
- If 1+ votes → split into matches of 4 players each:
  - Full matches: groups of exactly 4 players
  - Remainder match: leftover players (1-3) get their own match with open slots

Example: 7 voters → Match 1 (4 players full) + Match 2 (3 players, 1 open slot)

**Benefits:**
- Pure function, easy to test
- No database/Supabase coupling
- Ready for future replacement with external matching engine
- Clear separation of concerns

### Part 2: Integration with Existing Code

Refactor the existing `generateMatchesHelper()` function (lines 487-624 in `src/utils/sessions.ts`):

**New Structure:**

1. **Fetch session data and votes** (keep existing)
2. **Transform to function input:**
   - Parse `time_slots` JSON into flat `TimeSlotOption[]`
   - Transform `session_votes` rows into `VoteInput[]`
3. **Call pure function:**
   ```typescript
   const generatedMatches = generateMatchesFromVotes(options, votes)
   ```
4. **Transform back to database format:**
   - Generate public IDs with `ShortUniqueId`
   - Map `GeneratedMatch[]` to database insert objects
   - Build `matchesToCreate` and `participantsToCreate` arrays
5. **Insert into Supabase** (keep existing)

**Changes from current implementation:**
- Remove nested loops iterating `timeSlots.options`
- Remove code that creates empty matches for zero votes (lines 528-539)
- Move splitting logic (lines 540-576) into pure function

### Part 3: Fix "Close Poll" Button

**Location:** `/sessions/$id.tsx:281-287`

**Current Issue:** Button contains a `<Link>` that navigates to `/matches` without triggering status update.

**Solution:**

```typescript
<Button
  type="button"
  onClick={() => updateStatusMutation.mutate('open')}
  disabled={!generatedGamesCount || updateStatusMutation.isPending}
>
  {updateStatusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {generatedGamesCount === 0
    ? 'Close poll'
    : `Close poll and create ${generatedGamesCount} matches`}
</Button>
```

**Changes:**
1. Keep button disabled when no votes (`!generatedGamesCount`)
2. Remove `<Link>` and call `updateStatusMutation.mutate('open')` on click
3. Show loading state while mutation pending
4. Update mutation's `onSuccess` to navigate to `/matches` after completion

**Flow:** Button click → Status updates to "open" → Backend calls `generateMatchesHelper()` → Matches generated → Navigate to matches page

### Part 4: Route Consolidation (Separate Commit)

**Goal:** Merge voting and matches pages into single route.

**Approach:**

1. Keep main route at `/sessions/$id.tsx`
2. Conditional rendering based on `session.status`:
   - `'voting'` or `'draft'` → Show voting UI
   - `'open'` → Show matches UI (reuse components from `$id_.matches.tsx`)
   - Other statuses → Show appropriate message/redirect
3. Update loader to fetch both session and matches data
4. Delete `/sessions/$id_.matches.tsx`
5. Update all navigation to remove `/matches` suffix

**Benefits:**
- One session = one URL (simpler mental model)
- Automatic progression after closing poll
- Less route complexity

**Trade-offs:**
- Larger component file
- Both datasets always loaded (minimal overhead since matches returns empty array during voting)

## Implementation Plan

### Commit 1: Match Generation Refactor
1. Create `generateMatchesFromVotes()` pure function
2. Refactor `generateMatchesHelper()` to use new function
3. Fix "Close Poll" button to trigger status update
4. Add tests for pure function (optional but recommended)

### Commit 2: Route Consolidation
1. Move matches UI components into `/sessions/$id.tsx`
2. Add conditional rendering based on session status
3. Update loader to fetch matches data
4. Delete `/sessions/$id_.matches.tsx`
5. Update navigation throughout app

## Testing Strategy

**Manual Testing:**
- Session with 0 votes → Button disabled
- Session with 1-3 votes → Creates 1 match with open slots
- Session with 4 votes → Creates 1 full match
- Session with 5-7 votes → Creates 2 matches (1 full, 1 partial)
- Session with 8 votes → Creates 2 full matches
- Multiple time slots and levels → Each option handled independently

**Edge Cases:**
- No votes at all across all options
- Votes only in some options, not others
- Single voter in an option
- Exactly divisible by 4 voters

## Notes

- `limitPlayers` session setting is for voting restrictions only, not match generation
- Backend match generation is already triggered by status change (line 1326-1348 in `updateSessionStatus`)
- Options with zero votes should be skipped entirely (no empty matches created)
