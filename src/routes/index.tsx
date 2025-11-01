import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/contexts/auth'

export const Route = createFileRoute('/')({
  component: App,
  beforeLoad: async ({ context }) => {
    const { authData } = context

    // Redirect to login if not authenticated
    if (!authData?.user) {
      throw redirect({
        to: '/login',
      })
    }

    // Redirect to OTP if phone not verified
    if (!authData.isPhoneVerified) {
      throw redirect({
        to: '/login/otp',
      })
    }

    // Redirect to playtomic if no profile
    if (!authData.hasPlaytomicProfile) {
      throw redirect({
        to: '/login/playtomic',
      })
    }
  },
})

function App() {
  const { authData } = useAuth()
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold">Welcome to Padel Pal!</h1>
      <p className="mt-4">You are fully authenticated.</p>
      {authData?.player && (
        <div className="mt-4">
          <p>Phone: {authData.player.phone}</p>
          <p>Playtomic ID: {authData.player.playtomic_id}</p>
        </div>
      )}
    </div>
  )
}
