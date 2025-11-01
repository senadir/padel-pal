// contexts/auth.tsx
import { createContext, useContext, ReactNode } from 'react'
import { useRouteContext } from '@tanstack/react-router'
import type { Player } from '@/utils/types'
import { User } from '@supabase/supabase-js'

type AuthData = {
  user: User | null
  player: Player | null
  isPhoneVerified: boolean
  hasPlaytomicProfile: boolean
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
