# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Padel Pal is a padel session management application built with TanStack Start (full-stack React framework with SSR), Supabase for authentication and database, and Tailwind CSS. The app supports phone-based authentication (WhatsApp OTP), session management, and player matching.

## Development Commands

```bash
# Development
npm run dev              # Start dev server on http://localhost:3000

# Build & Deploy
npm run build           # Build for production
npm run preview         # Preview production build
npm run deploy          # Deploy to Cloudflare Workers

# Code Quality
npm run cf-typegen      # Generate Cloudflare types (runs automatically on postinstall)
```

## Architecture

### TanStack Start Framework

This app uses TanStack Start, a full-stack React framework with file-based routing, SSR, and server functions:

- **Router setup**: The router is created in `src/router.tsx` using `getRouter()`, which integrates TanStack Query and wraps the app with `AuthProvider`
- **Root route**: `src/routes/__root.tsx` defines the document shell with head metadata, theme provider, and devtools
- **Server functions**: Use `createServerFn()` for server-side operations (see `src/utils/auth.ts` for examples)
- **Route tree**: Auto-generated at `src/routeTree.gen.ts` based on file-based routing

### Authentication Flow

Multi-step authentication using Supabase phone OTP via WhatsApp:

1. **Phone Input** (`/login`): User enters phone number → sends WhatsApp OTP via `signInWithPhone()`
2. **OTP Verification** (`/login/otp`): User enters 6-digit code → verifies with `verifyOtp()` → creates player record
3. **Playtomic Setup** (`/login/playtomic`): User links their Playtomic profile (searched by phone, fallback to email)
4. **Home** (`/`): Fully authenticated user can access sessions

**Key files:**

- `src/utils/auth.ts`: Server functions for auth operations (`fetchUser`, `signInWithPhone`, `verifyOtp`, `linkPlaytomicProfile`)
- `src/utils/playtomic.ts`: Server functions for Playtomic API integration (`searchPlaytomicByPhone`, `searchPlaytomicByEmail`)
- `src/routes/__root.tsx`: Root route with `beforeLoad` hook that fetches auth data and adds it to router context
- `src/contexts/auth.tsx`: Auth context provider for components to access user state via `useAuth()`
- `src/components/playtomic-form.tsx`: Component for linking Playtomic profiles with email search fallback
- `src/utils/supabase.ts`: Server-side Supabase client with cookie-based session management

**How auth works with TanStack Router:**

- The root route (`__root.tsx`) fetches auth data in its `beforeLoad` hook on every route change
- Auth data is passed through router context and accessible in all route loaders via `context.authData`
- Each route's `beforeLoad` hook checks auth state and redirects as needed using `throw redirect()`
- Components can use `useAuth()` hook to access auth data from router context (reads via `useRouteContext`)
- Player records are automatically created and phone numbers are synced from `auth.users` to `players` table

**Test credentials:**

- Phone: +34697745564
- OTP: 000000

**Auth state structure:**

```typescript
{
  user: User | null,              // Supabase user object
  player: Player | null,          // Player profile from database
  isPhoneVerified: boolean,       // Has verified phone OTP
  hasPlaytomicProfile: boolean    // Has Playtomic credentials
}
```

### State Management

- **TanStack Query**: Primary state management for server data (configured in `src/integrations/tanstack-query/`)
- **React Context**: Auth state via `AuthProvider` in `src/contexts/auth.tsx`
- **SSR Integration**: Router and Query Client are integrated via `setupRouterSsrQueryIntegration()`

### Supabase Integration

- **Client**: Server-side only using `@supabase/ssr` with cookie-based sessions
- **Auth**: Phone OTP via WhatsApp channel
- **Database**: PostgreSQL (schema types in `src/utils/database.types.ts`)
- **Environment variables**:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLIC_KEY`

#### Database Schema

**Core Tables:**

1. **`players`** - User profiles linked to Supabase auth
   - `id` (UUID, PK): Matches Supabase auth.users.id
   - `name` (TEXT): Player's full name (from Playtomic)
   - `avatar` (TEXT): Profile picture URL (from Playtomic)
   - `phone` (TEXT): Phone number in E.164 format
   - `playtomic_id` (BIGINT): Playtomic user ID for API integration
   - `level` (INT): Skill level (1-10 scale)
   - `status` (TEXT): Player status
   - `created_at` (TIMESTAMPTZ): Record creation timestamp

2. **`sessions`** - Padel session events
   - `id` (BIGSERIAL, PK): Internal session ID
   - `public_id` (TEXT, UNIQUE): Public-facing ID (e.g., "JDBU83MQ")
   - `date` (DATE): Session date
   - `venue_name` (TEXT): Venue name
   - `venue_location` (TEXT): Venue location/address
   - `levels` (TEXT[]): Available skill levels for this session
   - `time_slots` (JSONB): Array of time slot configurations
   - `players_per_slot` (INT): Max players per time slot
   - `limit_players` (BOOLEAN): Whether to enforce player limits
   - `time_blocks` (INT): Number of time blocks
   - `created_at` (TIMESTAMPTZ): Record creation timestamp

3. **`session_votes`** - Player votes for session time slots
   - `id` (BIGSERIAL, PK): Vote ID
   - `player_id` (UUID, FK → players): Player who voted
   - `session_id` (BIGINT, FK → sessions): Target session
   - `option_id` (TEXT): ID of the time slot option voted for
   - `voted_at` (TIMESTAMPTZ): When the vote was cast
   - `created_at` (TIMESTAMPTZ): Record creation timestamp
   - **Constraint**: UNIQUE(player_id, session_id, option_id)

4. **`matches`** - Generated matches from session votes
   - `id` (BIGSERIAL, PK): Internal match ID
   - `public_id` (TEXT, UNIQUE): Public-facing match ID
   - `session_id` (BIGINT, FK → sessions): Parent session
   - `time_slot_id` (TEXT): Time slot identifier
   - `level` (TEXT): Skill level for this match
   - `start_time` (TIMESTAMPTZ): Match start time
   - `end_time` (TIMESTAMPTZ): Match end time
   - `max_players` (INT, DEFAULT 4): Maximum players per match
   - `created_at` (TIMESTAMPTZ): Record creation timestamp
   - `updated_at` (TIMESTAMPTZ): Last update timestamp

5. **`match_participants`** - Players in matches
   - `id` (BIGSERIAL, PK): Participant ID
   - `match_id` (BIGINT, FK → matches): Target match
   - `player_id` (UUID, FK → players): Player participating
   - `source` (TEXT, DEFAULT 'manual'): How player joined ('vote' or 'manual')
   - `joined_at` (TIMESTAMPTZ): When player joined
   - `created_at` (TIMESTAMPTZ): Record creation timestamp
   - **Constraint**: UNIQUE(match_id, player_id)
   - **Trigger**: Validates no time overlap for same player

6. **`games`** (Legacy) - Older game tracking table
   - `id` (BIGSERIAL, PK): Game ID
   - `session_id` (BIGINT, FK → sessions): Parent session
   - `playtomic_id` (TEXT): Playtomic booking ID
   - `level` (TEXT): Skill level
   - `starting_time` (TIMESTAMPTZ): Game start time
   - `status` (TEXT): Game status
   - `players` (JSONB[]): Array of player objects
   - `created_at` (TIMESTAMPTZ): Record creation timestamp

**Row Level Security (RLS) Policies:**

- **`players` table**:
  - SELECT: Allowed for all users (authenticated and anonymous) - sessions are publicly viewable
  - INSERT/UPDATE/DELETE: Restricted to own records only (auth.uid() = id)

- **Other tables**: Follow similar patterns with appropriate read/write restrictions

**Important Notes:**

1. **Public Session Access**: Sessions and player profiles are publicly viewable without authentication to allow users to browse before signing up
2. **Time Overlap Prevention**: PostgreSQL trigger on `match_participants` prevents double-booking players in overlapping time slots
3. **Hybrid Match Generation**: Matches are created from votes, then manual joins are allowed for remaining slots
4. **UUID vs BIGINT**: `players.id` uses UUID to match Supabase auth, other IDs use BIGSERIAL for efficiency

### UI Components

- **Component library**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS v4 (configured via `@tailwindcss/vite`)
- **Theme**: Dark mode support via `next-themes` (see `src/components/theme-provider.tsx`)
- **Adding components**: Use `npx shadcn@latest add <component>` (as per `.cursorrules`)

### TypeScript Configuration

- Path alias: `@/*` maps to `./src/*`
- Strict mode enabled with additional linting rules
- Module resolution: bundler mode
- No emit (bundler handles compilation)

## Code Style

Prettier configuration:

- No semicolons
- Single quotes
- Trailing commas everywhere

ESLint: Uses `@tanstack/eslint-config`

## Important Patterns

### Server Functions

Always use `createServerFn()` for server-side operations:

```typescript
export const myServerFn = createServerFn({ method: 'POST' })
  .inputValidator((d: InputType) => d)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()
    // Server-side logic
  })
```

### Route Protection

Use `beforeLoad` hooks to check auth state from context and redirect as needed:

```typescript
export const Route = createFileRoute('/protected')({
  beforeLoad: async ({ context }) => {
    const { authData } = context

    // Redirect if not authenticated
    if (!authData?.user) {
      throw redirect({ to: '/login' })
    }

    // Redirect based on incomplete auth steps
    if (!authData.isPhoneVerified) {
      throw redirect({ to: '/login/otp' })
    }
  },
  component: ProtectedPage,
})
```

### TanStack Query Integration

Auth data is fetched server-side via the root route's `beforeLoad` and made available through:

1. **In route loaders**: Access via `context.authData`
2. **In components**: Use the `useAuth()` hook (powered by TanStack Query)

```typescript
// In a component:
const { authData, isLoading } = useAuth()
```

## Deployment

The app is configured for Cloudflare Workers deployment:

- Vite plugin: `@cloudflare/vite-plugin` configured for SSR environment
- Deploy command: `npm run deploy` (uses Wrangler CLI)
- Types generated via `npm run cf-typegen`
