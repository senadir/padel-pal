import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginForm } from '@/components/login-form'

export const Route = createFileRoute('/login/')({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    const { authData } = context

    // Redirect to home if already fully authenticated
    if (authData?.isPhoneVerified && authData?.hasPlaytomicProfile) {
      throw redirect({
        to: '/',
      })
    }

    // Redirect to OTP if user exists but not verified
    if (authData?.user && !authData.isPhoneVerified) {
      throw redirect({
        to: '/login/otp',
      })
    }

    // Redirect to playtomic if verified but no profile
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
        <LoginForm />
      </div>
    </div>
  )
}
