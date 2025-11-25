import { createRouter } from '@tanstack/react-router'
import * as Sentry from '@sentry/tanstackstart-react'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import * as TanstackQuery from './integrations/tanstack-query/root-provider'
import { AuthProvider } from './contexts/auth'
// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Create a new router instance
export const getRouter = () => {
  const rqContext = TanstackQuery.getContext()

  const router = createRouter({
    routeTree,
    context: { ...rqContext, authData: null },
    defaultPreload: 'intent',
    Wrap: (props: { children: React.ReactNode }) => {
      return (
        <TanstackQuery.Provider {...rqContext}>
          <AuthProvider>{props.children}</AuthProvider>
        </TanstackQuery.Provider>
      )
    },
    defaultViewTransition: true,
    defaultStructuralSharing: true,
  })

  if (!router.isServer) {
    Sentry.init({
      dsn: 'https://27680c5f06cb6131551721666063787f@o75551.ingest.us.sentry.io/4510425888260096',

      // Adds request headers and IP for users, for more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/configuration/options/#sendDefaultPii
      sendDefaultPii: true,

      // Performance monitoring - capture 100% of transactions in dev, 10% in prod
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

      integrations: [
        // TanStack Router integration for automatic route change tracking
        Sentry.tanstackRouterBrowserTracingIntegration(router),
      ],
    })
  }
  setupRouterSsrQueryIntegration({ router, queryClient: rqContext.queryClient })

  return router
}
