import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import appCss from '../styles.css?url'
import type { QueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import type { Player } from '@/utils/types'
import { getThemeServerFn } from '@/lib/theme'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Header } from '@/components/header'
import { Toaster } from '@/components/ui/sonner'
import { NavigationProgress } from '@/components/navigation-progress'
import { fetchUser } from '@/utils/auth'

type AuthData = {
  user: User | null
  player: Player | null
  isPhoneVerified: boolean
  hasPlaytomicProfile: boolean
}

interface MyRouterContext {
  queryClient: QueryClient
  authData: AuthData | null
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
      },
      {
        title: 'Padel Pal',
      },
      {
        name: 'description',
        content:
          'Organize padel sessions, vote for time slots, and find matches with your friends.',
      },
      // Open Graph
      {
        property: 'og:site_name',
        content: 'Padel Pal',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:title',
        content: 'Padel Pal',
      },
      {
        property: 'og:description',
        content:
          'Organize padel sessions, vote for time slots, and find matches with your friends.',
      },
      {
        property: 'og:image',
        content:
          '/api/og?title=Padel%20Pal&subtitle=Organize%20your%20padel%20sessions',
      },
      {
        property: 'og:image:width',
        content: '1200',
      },
      {
        property: 'og:image:height',
        content: '630',
      },
      // Twitter
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: 'Padel Pal',
      },
      {
        name: 'twitter:description',
        content:
          'Organize padel sessions, vote for time slots, and find matches with your friends.',
      },
      {
        name: 'twitter:image',
        content:
          '/api/og?title=Padel%20Pal&subtitle=Organize%20your%20padel%20sessions',
      },
    ],
    links: [
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Onest:wght@100..900&display=swap&family=Stack+Sans+Notch:wght@600&text=PadelPal',
      },
    ],
  }),

  beforeLoad: async () => {
    // Fetch auth data on every route change
    const authData = await fetchUser()
    return { authData }
  },

  component: RootComponent,
  notFoundComponent: () => {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-muted-foreground">Page not found</p>
      </div>
    )
  },

  shellComponent: RootDocument,
  loader: () => getThemeServerFn(),
})

function RootComponent() {
  const theme = Route.useLoaderData()

  return (
    <ThemeProvider theme={theme}>
      <TooltipProvider delayDuration={0}>
        <NavigationProgress />
        <Header />
        <div className="mx-auto max-w-md px-8">
          <div className="mx-auto max-w-3xl my-8">
            <Outlet />
          </div>
        </div>
        <Toaster />
        {import.meta.env.DEV && (
          <TanStackDevtools
            plugins={[
              TanStackQueryDevtools,
              {
                name: 'TanStack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
      </TooltipProvider>
    </ThemeProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const theme = Route.useLoaderData()

  return (
    <html lang="en" className={theme} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
