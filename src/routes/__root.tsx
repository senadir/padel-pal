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
        title: 'TanStack Start Starter',
      },
    ],
    links: [
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
        href: 'https://fonts.googleapis.com/css2?family=Onest:wght@100..900&display=swap',
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
      <NavigationProgress />
      <Header />
      <div className="mx-auto max-w-md px-8">
        <div className="mx-auto max-w-3xl my-8">
          <Outlet />
        </div>
      </div>
      <Toaster />
      <TanStackDevtools
        plugins={[
          TanStackQueryDevtools,
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
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
