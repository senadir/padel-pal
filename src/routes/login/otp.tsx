import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { OTPForm } from '@/components/otp-form'

export const Route = createFileRoute('/login/otp')({
  head: () => ({
    meta: [
      {
        title: 'Verify OTP | Padel Pal',
      },
    ],
  }),
  component: RouteComponent,
  // CHANGE: Added redirect parameter to support return-to-origin flow
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  beforeLoad: async ({ context, search }) => {
    const { authData } = context
    const { redirect: redirectUrl } = search

    // Only redirect if phone verified but no profile (need to complete flow)
    // CHANGE: Propagate redirect parameter to Playtomic setup page
    if (authData?.isPhoneVerified && !authData?.hasPlaytomicProfile) {
      throw redirect({
        to: '/login/playtomic',
        search: redirectUrl ? { redirect: redirectUrl } : undefined,
      })
    }

    // CHANGE: Removed automatic redirect for fully authenticated users
    // This prevents race conditions. After OTP verification succeeds, the auth
    // state gets updated which triggers router refetch. If we redirect here,
    // it competes with the component's onSuccess navigation and can cause the
    // user to be sent to home instead of the intended redirect URL.
    // The OTPForm component's onSuccess handler will navigate correctly.
  },
})

function RouteComponent() {
  const { redirect: redirectUrl } = Route.useSearch()

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <OTPForm redirect={redirectUrl} />
      </div>
    </div>
  )
}
