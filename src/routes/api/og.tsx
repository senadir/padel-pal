import { createFileRoute } from '@tanstack/react-router'
import { ImageResponse } from 'workers-og'
import { createServerClient } from '@supabase/ssr'
import { format, formatDistanceToNow } from 'date-fns'
import type { Database } from '@/utils/database.types'
import type { TimeSlot } from '@/utils/types'
import Logo from '../../../public/favicon.svg'

// =============================================================================
// Constants & Configuration
// =============================================================================

const colors = {
  text: '#172554',
  textMuted: '#64748b',
  background: '#f5f3ef',
  accent: '#22c55e',
}

const levelLabels: Record<string, string> = {
  beginner: 'Beginner',
  improver: 'Improver',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

function randomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16)
}

// =============================================================================
// Types
// =============================================================================

type MatchData = {
  type: 'match'
  level: string
  time: string
  date: string
  location: string
  players: Array<{ name: string | null; avatar: string | null }>
  maxPlayers: number
}

type SessionData = {
  type: 'session'
  date: string
  location: string
  status: 'voting' | 'open' | 'closed' | 'cancelled' | 'draft'
  votingClosesAt: Date | null
  openMatchesCount: number
  levels: string[]
}

type OGData = MatchData | SessionData | null

// =============================================================================
// Supabase Client
// =============================================================================

function getSupabaseClient() {
  return createServerClient<Database>(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLIC_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  )
}

// =============================================================================
// Font Loading
// =============================================================================

async function loadGoogleFont(font: string, text?: string) {
  let url = ''
  if (text) {
    url = `https://fonts.googleapis.com/css2?family=${font}&text=${encodeURIComponent(text)}`
  } else {
    url = `https://fonts.googleapis.com/css2?family=${font}`
  }
  const css = await (await fetch(url)).text()
  const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/)

  if (resource) {
    const response = await fetch(resource[1])
    if (response.status == 200) {
      return await response.arrayBuffer()
    }
  }

  throw new Error('failed to load font data')
}

// =============================================================================
// Data Fetching
// =============================================================================

async function fetchMatchData(
  matchPublicId: string,
): Promise<MatchData | null> {
  const supabase = getSupabaseClient()

  const { data: matchRow, error: matchError } = await supabase
    .from('matches')
    .select(
      `
      *,
      sessions!inner(*),
      match_participants!match_participants_match_id_fkey(
        players(name, avatar)
      )
    `,
    )
    .eq('public_id', matchPublicId)
    .single()

  if (matchError || !matchRow) {
    console.error('Error fetching match:', matchError)
    return null
  }

  const session = matchRow.sessions
  const participants = matchRow.match_participants

  return {
    type: 'match',
    level: matchRow.level,
    time: format(new Date(matchRow.start_time), 'HH:mm'),
    date: format(new Date(matchRow.start_time), 'EEEE, MMM d'),
    location: session.venue_name || 'TBD',
    players: participants.map((p) => ({
      name: p.players?.name || null,
      avatar: p.players?.avatar || null,
    })),
    maxPlayers: matchRow.max_players,
  }
}

async function fetchSessionData(
  sessionPublicId: string,
): Promise<SessionData | null> {
  const supabase = getSupabaseClient()

  const { data: sessionRow, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('public_id', sessionPublicId)
    .single()

  if (sessionError || !sessionRow) {
    console.error('Error fetching session:', sessionError)
    return null
  }

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .eq('session_id', sessionRow.id)

  let levels: string[] = []
  console.log(matches)
  if (matches && matches.length > 0) {
    levels = matches.map((match) => match.level)
  } else {
    levels = (JSON.parse(sessionRow.time_slots as string) as TimeSlot[])
      .map((slot) => slot.options.map((option) => option.level))
      .flat()
      .filter((level, index, self) => self.indexOf(level) === index)
  }

  return {
    type: 'session',
    date: sessionRow.date
      ? format(new Date(sessionRow.date), 'EEEE, MMM d')
      : 'TBD',
    location: sessionRow.venue_name || 'TBD',
    status: sessionRow.status,
    votingClosesAt: sessionRow.voting_closes_at
      ? new Date(sessionRow.voting_closes_at)
      : null,
    openMatchesCount: matches?.length || 0,
    levels: levels || [],
  }
}

// =============================================================================
// Icon Components
// =============================================================================

function LocationIcon({ color }: { color: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function ClockIcon({ color }: { color: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function UsersIcon({ color }: { color: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.textMuted}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

// =============================================================================
// UI Components
// =============================================================================

function BrandHeader({ logoSrc }: { logoSrc: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <img src={logoSrc} alt="Padel Pal" width={48} height={48} />
      <span
        style={{
          fontSize: '28px',
          fontWeight: 700,
          color: colors.text,
          letterSpacing: '-0.02em',
          fontFamily: 'Stack Sans Notch',
        }}
      >
        Padel Pal
      </span>
    </div>
  )
}

function LocationRow({ location }: { location: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '24px',
        color: colors.textMuted,
        marginTop: '8px',
      }}
    >
      {location}
    </div>
  )
}

function LevelBadge({
  level,
  size = 'normal',
}: {
  level: string
  size?: 'normal' | 'small'
}) {
  const isSmall = size === 'small'
  return (
    <div
      style={{
        backgroundColor: 'transparent',
        border: `2px solid ${colors.accent}`,
        color: colors.accent,
        padding: isSmall ? '8px 16px' : '8px 20px',
        borderRadius: '24px',
        fontSize: isSmall ? '18px' : '20px',
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
      {levelLabels[level] || level}
    </div>
  )
}

function PlayerAvatar({
  player,
}: {
  player: { name: string | null; avatar: string | null } | undefined
}) {
  const style = {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: player ? '#e2e8f0' : '#f1f5f9',
    border: '1px solid #f5f3ef',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  }
  if (player && player.avatar) {
    return (
      <div style={style}>
        <img
          src={player.avatar}
          alt={player.name || ''}
          width={56}
          height={56}
          style={{ objectFit: 'cover' }}
        />
      </div>
    )
  }

  if (player && player.name) {
    return (
      <div style={{ ...style, backgroundColor: randomColor() }}>
        <span
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'white',
          }}
        >
          {player.name?.charAt(0) || '?'}
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        ...style,
        border: `2px dashed ${colors.textMuted}`,
        backgroundColor: 'transparent',
        opacity: 0.5,
      }}
    >
      <PlusIcon />
    </div>
  )
}

function PlayerAvatars({ data }: { data: MatchData }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {Array.from({ length: data.maxPlayers }).map((_, index) => (
        <PlayerAvatar key={index} player={data.players[index]} />
      ))}
    </div>
  )
}

function StatusRow({
  icon,
  children,
}: {
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '24px',
        color: colors.text,
      }}
    >
      {icon && icon}
      <span>{children}</span>
    </div>
  )
}

function LevelBadges({ levels }: { levels: string[] }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      {levels.map((level) => (
        <LevelBadge key={level} level={level} size="small" />
      ))}
    </div>
  )
}

function PadelImage({ imageUrl }: { imageUrl: string }) {
  return (
    <div
      style={{
        width: '480px',
        height: '100%',
        display: 'flex',
        position: 'relative',
      }}
    >
      <img
        src={imageUrl}
        alt="Padel"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '80px',
          // background: `linear-gradient(to right, ${colors.background}, transparent)`,
        }}
      />
    </div>
  )
}

// =============================================================================
// Match Content Component
// =============================================================================

function MatchContent({ data, logoSrc }: { data: MatchData; logoSrc: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        padding: '48px',
        justifyContent: 'space-between',
      }}
    >
      <BrandHeader logoSrc={logoSrc} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            fontSize: '72px',
            fontWeight: 700,
            color: colors.text,
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          {data.time}
        </div>
        <div
          style={{
            fontSize: '32px',
            fontWeight: 500,
            color: colors.textMuted,
          }}
        >
          {data.date}
        </div>
        <LocationRow location={data.location} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <PlayerAvatars data={data} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LevelBadge level={data.level} />
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Session Content Component
// =============================================================================

function SessionContent({
  data,
  logoSrc,
}: {
  data: SessionData
  logoSrc: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        padding: '48px',
        justifyContent: 'space-between',
      }}
    >
      <BrandHeader logoSrc={logoSrc} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            fontSize: '56px',
            fontWeight: 700,
            color: colors.text,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}
        >
          {data.date}
        </div>
        <LocationRow location={data.location} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {data.status === 'voting' && data.votingClosesAt && (
          <StatusRow>
            Voting closes{' '}
            {formatDistanceToNow(data.votingClosesAt, { addSuffix: true })}
          </StatusRow>
        )}
        {data.status === 'voting' && !data.votingClosesAt && (
          <StatusRow>Vote for your time slot</StatusRow>
        )}
        {data.status === 'open' && (
          <StatusRow>
            {data.openMatchesCount} match
            {data.openMatchesCount !== 1 ? 'es' : ''} available
          </StatusRow>
        )}
        <LevelBadges levels={data.levels} />
      </div>
    </div>
  )
}

// =============================================================================
// Default OG Layout
// =============================================================================

function DefaultOGLayout({ logoSrc }: { logoSrc: string }) {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        fontFamily: 'Onest',
        display: 'flex',
        backgroundColor: colors.background,
        padding: '60px',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <img src={logoSrc} alt="Padel Pal" width={80} height={80} />
        <span
          style={{
            fontSize: '64px',
            fontWeight: 700,
            color: colors.text,
            letterSpacing: '-0.02em',
            fontFamily: 'Stack Sans Notch',
          }}
        >
          Padel Pal
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// Main OG Layout
// =============================================================================

function OGLayout({
  data,
  logoSrc,
  padelImageUrl,
}: {
  data: MatchData | SessionData
  logoSrc: string
  padelImageUrl: string
}) {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        fontFamily: 'Onest',
        display: 'flex',
        backgroundColor: colors.background,
      }}
    >
      {data.type === 'match' ? (
        <MatchContent data={data} logoSrc={logoSrc} />
      ) : (
        <SessionContent data={data} logoSrc={logoSrc} />
      )}
      <PadelImage imageUrl={padelImageUrl} />
    </div>
  )
}

// =============================================================================
// Route Handler
// =============================================================================

export const Route = createFileRoute('/api/og')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const type = url.searchParams.get('type') as 'match' | 'session' | null
        const id = url.searchParams.get('id')

        const logoSrc = Logo.replace(
          '%23fafafa',
          `${colors.text.replace('#', '%23')}`,
        ).replace('%230a0a0a', `${colors.text.replace('#', '%23')}`)

        // Fetch data based on type
        let data: OGData = null
        if (type === 'match' && id) {
          data = await fetchMatchData(id)
        } else if (type === 'session' && id) {
          data = await fetchSessionData(id)
        }

        const fonts = [
          {
            name: 'Onest',
            data: await loadGoogleFont('Onest'),
          },
          {
            name: 'Stack Sans Notch',
            data: await loadGoogleFont('Stack Sans Notch:wght@700'),
          },
        ]

        // Default OG image when no data
        if (!data) {
          return new ImageResponse(<DefaultOGLayout logoSrc={logoSrc} />, {
            width: 1200,
            height: 630,
            fonts,
          })
        }

        // Build the padel image URL
        const padelImageUrl = `${url.origin}/padel.jpg`

        return new ImageResponse(
          (
            <OGLayout
              data={data}
              logoSrc={logoSrc}
              padelImageUrl={padelImageUrl}
            />
          ),
          {
            width: 1200,
            height: 630,
            fonts,
          },
        )
      },
    },
  },
})
