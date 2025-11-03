// contexts/auth.tsx
import { createContext, useContext, ReactNode } from 'react'
import { useRouteContext } from '@tanstack/react-router'
import type { Player, AppRole } from '@/utils/types'
import { User } from '@supabase/supabase-js'

type AuthData = {
  user: User | null
  player: Player | null
  isPhoneVerified: boolean
  hasPlaytomicProfile: boolean
  role: AppRole
}

type AuthContextType = {
  authData: AuthData | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={{ authData: null, isLoading: false }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  // Get auth data directly from router context (set by root route's beforeLoad)
  const context = useRouteContext({ from: '__root__' })

  return {
    authData: context.authData || null,
    isLoading: false,
  }
}

/**
 * Hook to get the current user's role
 * @returns The user's role ('player' or 'organizer'), defaults to 'player' if not authenticated
 */
export function useRole(): AppRole {
  const { authData } = useAuth()
  return authData?.role || 'player'
}

/**
 * Hook to check if the current user is an organizer
 * @returns true if the user has the 'organizer' role, false otherwise
 */
export function useIsOrganizer(): boolean {
  const role = useRole()
  return role === 'organizer'
}
