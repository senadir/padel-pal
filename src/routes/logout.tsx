import { createFileRoute, redirect } from '@tanstack/react-router'
import { logout } from '@/utils/auth'

export const Route = createFileRoute('/logout')({
  beforeLoad: async () => {
    // Call the logout server function to clear session
    await logout()

    // Redirect to home page
    throw redirect({ to: '/' })
  },
})
