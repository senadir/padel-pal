import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { OTPForm } from '@/components/otp-form'
import { LoginForm } from '@/components/login-form'

export const Route = createFileRoute('/login')({
  component: RouteComponent,
  validateSearch: z.object({
    step: z.enum(['login', 'otp']).default('login'),
    phone: z.string().optional(),
  }),
})

function RouteComponent() {
  const { step, phone } = Route.useSearch()
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        {step === 'login' ? (
          <LoginForm phone={phone} />
        ) : (
          <OTPForm phone={phone} />
        )}
      </div>
    </div>
  )
}
