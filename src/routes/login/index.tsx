import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginForm } from '@/components/login-form'

export const Route = createFileRoute('/login/')({
  component: RouteComponent,
  // CHANGE: Added redirect parameter to support return-to-origin flow
  // When users try to vote/join while logged out, they're redirected here with
  // a redirect param (e.g., /login?redirect=/sessions/JDBU83MQ)
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  beforeLoad: async ({ context, search }) => {
    const { authData } = context
    const { redirect: redirectUrl } = search

    // Redirect to OTP if user exists but not verified (need to complete flow)
    // CHANGE: Propagate redirect parameter through the auth flow
    if (authData?.user && !authData.isPhoneVerified) {
      throw redirect({
        to: '/login/otp',
        search: redirectUrl ? { redirect: redirectUrl } : undefined,
      })
    }

    // Redirect to playtomic if verified but no profile (need to complete flow)
    // CHANGE: Propagate redirect parameter through the auth flow
    if (authData?.isPhoneVerified && !authData?.hasPlaytomicProfile) {
      throw redirect({
        to: '/login/playtomic',
        search: redirectUrl ? { redirect: redirectUrl } : undefined,
      })
    }

    // CHANGE: Removed automatic redirect for fully authenticated users
    // This prevents race conditions where beforeLoad redirects compete with
    // component navigation after auth completion. Fully authenticated users
    // accessing this page directly can just see the login form (harmless).
  },
})

function RouteComponent() {
  const { redirect: redirectUrl } = Route.useSearch()

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm redirect={redirectUrl} />
      </div>
    </div>
  )
}
