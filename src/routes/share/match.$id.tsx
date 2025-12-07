import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect } from 'react'
import { format } from 'date-fns'
import { getSupabaseServerClient } from '@/utils/supabase'
import { Loader2 } from 'lucide-react'

// Server function to fetch match data for OG and redirect
const fetchMatchForShare = createServerFn({ method: 'GET' })
  .inputValidator((matchId: string) => matchId)
  .handler(async ({ data: matchId }) => {
    const supabase = getSupabaseServerClient()

    const { data: match, error } = await supabase
      .from('matches')
      .select(
        `
        *,
        sessions!inner(public_id, venue_name, date),
        match_participants!match_participants_match_id_fkey(
          players(name)
        )
      `,
      )
      .eq('public_id', matchId)
      .single()

    if (error || !match) {
      return null
    }

    return {
      matchId: match.public_id,
      sessionId: match.sessions.public_id,
      level: match.level,
      startTime: match.start_time,
      venueName: match.sessions.venue_name,
      sessionDate: match.sessions.date,
      players: match.match_participants
        .map((p) => p.players?.name)
        .filter(Boolean),
    }
  })

export const Route = createFileRoute('/share/match/$id')({
  loader: async ({ params }) => {
    const match = await fetchMatchForShare({ data: params.id })
    return { match }
  },
  head: ({ loaderData, params }) => {
    const match = loaderData?.match

    if (!match) {
      return {
        meta: [
          { title: 'Match | Padel Pal' },
          { property: 'og:title', content: 'Match | Padel Pal' },
          {
            property: 'og:description',
            content: 'View match details and join the game.',
          },
          { property: 'og:image', content: '/api/og' },
          { name: 'twitter:card', content: 'summary_large_image' },
          { name: 'twitter:title', content: 'Match | Padel Pal' },
          {
            name: 'twitter:description',
            content: 'View match details and join the game.',
          },
          { name: 'twitter:image', content: '/api/og' },
        ],
      }
    }

    const time = format(new Date(match.startTime), 'HH:mm')
    const date = match.sessionDate
      ? format(new Date(match.sessionDate), 'EEEE, MMM d')
      : 'TBD'
    const title = `${match.level} Match at ${time} | Padel Pal`
    const playerNames =
      match.players.length > 0
        ? `Players: ${match.players.join(', ')}`
        : 'Join this match!'
    const description = `${date} at ${match.venueName}. ${playerNames}`
    const ogImage = `/api/og?type=match&id=${params.id}`

    return {
      meta: [
        { title },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:image', content: ogImage },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: ogImage },
      ],
    }
  },
  component: ShareMatchRedirect,
})

function ShareMatchRedirect() {
  const { match } = Route.useLoaderData()
  const navigate = useNavigate()

  useEffect(() => {
    if (match) {
      // Redirect to the actual match page
      navigate({
        to: '/sessions/$id/$matchId',
        params: { id: match.sessionId, matchId: match.matchId },
        replace: true,
      })
    } else {
      // If match not found, redirect to home
      navigate({ to: '/', replace: true })
    }
  }, [match, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading match...</p>
      </div>
    </div>
  )
}
