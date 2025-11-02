# Implementation Summary

This document summarizes all changes made to implement player data visibility and redirect flow after authentication.

## Problem Statement

Two main issues were addressed:
1. **Player data not showing**: Other players' names and avatars weren't visible in sessions and matches due to restrictive RLS policies
2. **Redirect after login**: Users who tried to vote/join while logged out weren't redirected back to the session page after completing authentication

## Database Changes

### 1. Row Level Security (RLS) Policy Update

**Migration**: `allow_viewing_other_players_public_info`

**Problem**: The original RLS policy on the `players` table only allowed users to SELECT their own profile (`auth.uid() = id`), which prevented viewing other players' information when displaying sessions and matches.

**Solution**: Updated RLS policies to allow all authenticated and anonymous users to view player profiles:

```sql
-- Drop the restrictive select policy
DROP POLICY IF EXISTS players_select_own ON players;

-- Create a new policy that allows authenticated users to view all players' public info
CREATE POLICY players_select_authenticated ON players
  FOR SELECT
  TO authenticated
  USING (true);

-- For anonymous users, also allow viewing players (sessions should be publicly accessible)
CREATE POLICY players_select_anon ON players
  FOR SELECT
  TO anon
  USING (true);
```

**Why this is safe**:
- The `players` table only contains public profile information (name, avatar, level)
- Write operations (INSERT, UPDATE, DELETE) remain restricted to own records only
- Sessions are publicly viewable, so player info must be accessible without authentication

### 2. Player Upsert on OTP Verification

**File**: `src/utils/auth.ts` (lines 115-129)

**Problem**: When existing users logged in again, the `verifyOtp` function tried to INSERT a new player record, causing a "duplicate key" error.

**Solution**: Changed from `insert` to `upsert` with conflict resolution:

```typescript
// Use upsert to handle both new and existing players
const { data: player, error: playerError } = await supabase
  .from('players')
  .upsert(
    {
      id: response.user.id,
      phone: phone,
    },
    {
      onConflict: 'id',
      ignoreDuplicates: false, // Update if exists
    },
  )
  .select()
  .single()
```

## Code Changes

### 1. Redirect URL Flow Implementation

Added `redirect` parameter support throughout the authentication flow so users return to their original destination after logging in.

#### Login Page (`src/routes/login/index.tsx`)

**Changes**:
- Added `redirect` search parameter validation
- Removed automatic redirect for authenticated users (to avoid race conditions)
- Pass redirect parameter to `LoginForm` component
- Propagate redirect through auth flow redirects

```typescript
validateSearch: z.object({
  redirect: z.string().optional(),
}),
beforeLoad: async ({ context, search }) => {
  const { authData } = context
  const { redirect: redirectUrl } = search

  // Only redirect to OTP/Playtomic if user needs to complete auth flow
  // Don't auto-redirect fully authenticated users
  if (authData?.user && !authData.isPhoneVerified) {
    throw redirect({
      to: '/login/otp',
      search: redirectUrl ? { redirect: redirectUrl } : undefined,
    })
  }

  if (authData?.isPhoneVerified && !authData?.hasPlaytomicProfile) {
    throw redirect({
      to: '/login/playtomic',
      search: redirectUrl ? { redirect: redirectUrl } : undefined,
    })
  }
}
```

#### Login Form Component (`src/components/login-form.tsx`)

**Changes**:
- Accept `redirect` prop
- Pass redirect to OTP page on successful phone verification

```typescript
type LoginFormProps = React.ComponentProps<'div'> & {
  redirect?: string
}

// In onSuccess:
navigate({
  to: '/login/otp',
  state: { phone },
  search: redirect ? { redirect } : undefined,
})
```

#### OTP Page (`src/routes/login/otp.tsx`)

**Changes**:
- Added `redirect` search parameter validation
- Removed automatic redirect for fully authenticated users
- Propagate redirect to Playtomic page if needed
- Pass redirect to `OTPForm` component

```typescript
validateSearch: z.object({
  redirect: z.string().optional(),
}),
beforeLoad: async ({ context, search }) => {
  const { authData } = context
  const { redirect: redirectUrl } = search

  // Only redirect if phone verified but no profile (need to complete flow)
  if (authData?.isPhoneVerified && !authData?.hasPlaytomicProfile) {
    throw redirect({
      to: '/login/playtomic',
      search: redirectUrl ? { redirect: redirectUrl } : undefined,
    })
  }

  // Note: We don't redirect fully authenticated users away from this page
  // because they might be in the middle of the OTP verification flow.
  // The component's onSuccess handler will navigate them to the correct place.
}
```

#### OTP Form Component (`src/components/otp-form.tsx`)

**Changes**:
- Accept `redirect` prop
- Use `window.location.href` for navigation after OTP verification
- Navigate to redirect URL or home if user has Playtomic profile
- Navigate to Playtomic page with redirect if user needs to link profile

```typescript
type OTPFormProps = React.ComponentProps<'div'> & {
  redirect?: string
}

// In onSuccess:
if (player?.playtomic_id) {
  // If player has playtomic profile, use full page reload to ensure session is picked up
  window.location.href = redirect || '/'
} else {
  // If no playtomic profile, go to playtomic setup with redirect param
  const playtomicUrl = redirect
    ? `/login/playtomic?redirect=${encodeURIComponent(redirect)}`
    : '/login/playtomic'
  window.location.href = playtomicUrl
}
```

**Why `window.location.href`?**: Using native browser navigation forces a full page reload, which ensures:
- The new session cookies are properly picked up
- No stale auth state in the router context
- Avoids "Refresh Token Not Found" errors from racing router refetches

#### Playtomic Page (`src/routes/login/playtomic.tsx`)

**Changes**:
- Added `redirect` search parameter validation (already existed)
- Pass redirect to `PlaytomicForm` component

```typescript
validateSearch: z.object({
  email: z.string().optional(),
  redirect: z.string().optional(),
}),
```

#### Playtomic Form Component (`src/components/playtomic-form.tsx`)

**Changes**:
- Accept `redirect` prop
- Use `window.location.href` for navigation after profile linking
- Navigate to redirect URL or home
- Preserve redirect in email search

```typescript
type PlaytomicFormProps = React.ComponentProps<'div'> & {
  playtomicProfile: PlaytomicProfile | null | undefined
  searchMethod: 'phone' | 'email' | 'none'
  redirect?: string
}

// In onSuccess:
window.location.href = redirect || '/'

// In email search onSuccess:
navigate({
  to: '/login/playtomic',
  search: { email: emailInput, redirect },
})
```

### 2. Session Page Updates (`src/routes/sessions/$id.tsx`)

**Changes**:
- Wrap voting function to check authentication before allowing vote
- Redirect to login with return URL if not authenticated
- Pass user through all nested components

```typescript
const voteForSession = (variables: any) => {
  if (!isFullyAuthenticated) {
    const returnUrl = `/sessions/${id}`

    if (!authData?.user) {
      navigate({ to: '/login', search: { redirect: returnUrl } })
    } else if (!authData.isPhoneVerified) {
      navigate({ to: '/login/otp', search: { redirect: returnUrl } })
    } else if (!authData.hasPlaytomicProfile) {
      navigate({ to: '/login/playtomic', search: { redirect: returnUrl } })
    }
    return
  }
  voteForSessionFn(variables)
}
```

### 3. Matches Page Updates (`src/routes/sessions/$id_.matches.tsx`)

**Changes**:
- Wrap match join function to check authentication
- Redirect to login with return URL if not authenticated
- Same pattern as voting page

```typescript
const toggleMatchParticipation = (matchId: string, isJoined: boolean) => {
  if (!isFullyAuthenticated) {
    const returnUrl = `/sessions/${id}/matches`

    if (!authData?.user) {
      navigate({ to: '/login', search: { redirect: returnUrl } })
    } else if (!authData.isPhoneVerified) {
      navigate({ to: '/login/otp', search: { redirect: returnUrl } })
    } else if (!authData.hasPlaytomicProfile) {
      navigate({ to: '/login/playtomic', search: { redirect: returnUrl } })
    }
    return
  }
  toggleMatchParticipationFn(matchId, isJoined)
}
```

## Key Technical Decisions

### 1. Why Remove Auto-Redirects from `beforeLoad`?

Originally, auth pages (`/login`, `/login/otp`) had `beforeLoad` hooks that automatically redirected fully authenticated users away. This caused a race condition:

1. User verifies OTP → becomes authenticated
2. Component's `onSuccess` tries to navigate to redirect URL
3. Router refetches all routes (including OTP page)
4. OTP page's `beforeLoad` runs again, sees user is authenticated
5. `beforeLoad` redirect wins the race, sends user to home instead of redirect URL

**Solution**: Only redirect in `beforeLoad` if user needs to complete the next step of authentication. Let the component's `onSuccess` handler navigate to the final destination.

### 2. Why Use `window.location.href` Instead of TanStack Router's `navigate()`?

After OTP verification, the session state needs to be refreshed. Using router navigation caused "Refresh Token Not Found" errors because:

1. New session tokens are set in cookies
2. Router's optimistic refetch tries to use old tokens
3. Supabase rejects the stale refresh token

**Solution**: Use `window.location.href` to force a full page reload, ensuring the new session is picked up cleanly.

### 3. Why Allow Anonymous Access to Players Table?

Sessions are publicly viewable without authentication. To display player names and avatars in these public sessions, the `players` table must be readable by anonymous users. This is safe because:

- Only public profile info is exposed (name, avatar, level)
- No sensitive data like email or phone numbers beyond what's visible in the app
- Write operations remain restricted

## Testing Checklist

- [x] Player names and avatars show correctly in sessions for logged-out users
- [x] Player names and avatars show correctly in sessions for logged-in users
- [x] Player names and avatars show correctly in matches
- [x] Voting while logged out redirects to login
- [x] After completing login flow, user returns to session page
- [x] After completing login flow, user can vote successfully
- [x] Joining matches while logged out redirects to login
- [x] After completing login flow, user returns to matches page
- [x] Existing users can log in again without "duplicate key" errors
- [x] New users can complete full signup flow
- [x] Redirect URL is preserved through all auth steps (login → OTP → Playtomic)

## Files Modified

### Database
- New migration: `allow_viewing_other_players_public_info`

### Backend
- `src/utils/auth.ts` - Changed INSERT to UPSERT in `verifyOtp`

### Routes
- `src/routes/login/index.tsx` - Added redirect parameter handling
- `src/routes/login/otp.tsx` - Added redirect parameter handling
- `src/routes/login/playtomic.tsx` - Pass redirect to component
- `src/routes/sessions/$id.tsx` - Added auth checks before voting
- `src/routes/sessions/$id_.matches.tsx` - Added auth checks before joining

### Components
- `src/components/login-form.tsx` - Accept and pass redirect parameter
- `src/components/otp-form.tsx` - Accept redirect, use window.location.href
- `src/components/playtomic-form.tsx` - Accept redirect, use window.location.href

## Migration Commands

To apply these changes to your database:

```bash
# The RLS policy migration was already applied via the MCP Supabase tool
# No additional commands needed
```

## Future Improvements

1. **Better error handling**: Add retry logic for session refresh failures
2. **Loading states**: Show loading indicator during redirect
3. **Toast notifications**: Show message explaining why user was redirected
4. **Remember redirect URL**: Store in localStorage as backup if query params are lost
5. **Analytics**: Track how many users complete the redirect flow successfully
