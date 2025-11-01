import { createFileRoute, redirect } from '@tanstack/react-router'
import { OTPForm } from '@/components/otp-form'

export const Route = createFileRoute('/login/otp')({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    const { authData } = context

    // Redirect to home if already fully authenticated
    if (authData?.isPhoneVerified && authData?.hasPlaytomicProfile) {
      throw redirect({
        to: '/',
      })
    }

    // Redirect to playtomic setup if phone verified but no profile
    if (authData?.isPhoneVerified && !authData?.hasPlaytomicProfile) {
      throw redirect({
        to: '/login/playtomic',
      })
    }
  },
})

function RouteComponent() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <OTPForm />
      </div>
    </div>
  )
}
