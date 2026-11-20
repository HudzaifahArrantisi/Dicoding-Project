import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SESSION_EXPIRED_EVENT } from './api/client'
import {
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  setCsrfToken,
  type User,
} from './api'

export type { User } from './api'

interface AuthResult {
  success: boolean
  error?: string
  role?: User['role']
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  refreshUser: () => Promise<User>
  logout: () => Promise<void>
  clearSession: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const userRef = useRef<User | null>(null)

  const clearSession = useCallback(() => {
    userRef.current = null
    setCsrfToken(null)
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    const handleSessionExpired = () => {
      if (!userRef.current) return
      clearSession()
      toast.error('Sesi login telah berakhir. Silakan login kembali.')
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [clearSession])

  const refreshUser = async (): Promise<User> => {
    const data = await getCurrentUser()
    userRef.current = data.user
    setUser(data.user)
    return data.user
  }

  useEffect(() => {
    const status = { cancelled: false }
    void (async () => {
      try {
        const data = await getCurrentUser()
        if (!status.cancelled) {
          userRef.current = data.user
          setUser(data.user)
        }
      } finally {
        if (!status.cancelled) setIsLoading(false)
      }
    })().catch(() => {
      if (!status.cancelled) setIsLoading(false)
    })
    return () => {
      status.cancelled = true
    }
  }, [])

  const login = async (email: string, password: string): Promise<AuthResult> => {
    try {
      await apiLogin({ email, password })
      queryClient.clear()
      const nextUser = await refreshUser()
      return { success: true, role: nextUser.role }
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error && error.message.trim() ? error.message : 'Email atau password salah',
      }
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await apiLogout()
    } finally {
      clearSession()
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, refreshUser, logout, clearSession }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return context
}
