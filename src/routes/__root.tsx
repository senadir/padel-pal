import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import appCss from '../styles.css?url'
import type { QueryClient } from '@tanstack/react-query'
import { getThemeServerFn } from '@/lib/theme'
import { ThemeProvider } from '@/components/theme-provider'
import { Header } from '@/components/header'

interface MyRouterContext {
  queryClient: QueryClient
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
    ],
  }),

  shellComponent: RootDocument,
  loader: () => getThemeServerFn(),
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const theme = Route.useLoaderData()
  return (
    <ThemeProvider theme={theme}>
      <html lang="en" className={theme} suppressHydrationWarning>
        <head>
          <HeadContent />
        </head>
        <body>
          <Header />
          <div className="mx-auto max-w-md px-8">
            <div className="mx-auto max-w-3xl my-8">{children}</div>
          </div>

          <Scripts />
        </body>
      </html>
    </ThemeProvider>
  )
}
