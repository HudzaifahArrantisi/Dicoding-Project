import React, { createContext, useContext, useEffect, useState } from 'react'
import { api, setCsrfToken } from './api'
import { apiError } from './api-response'
import type { RegionCodes } from '@/components/inventory/region-picker'

export interface User {
  id: string
  email: string
  role: 'admin' | 'mitra'
  partner_id: string | null
  partner_name?: string | null
  partner_pic_name?: string | null
  partner_phone?: string | null
  partner_address?: string | null
  partner_photo?: string | null
  partner_region?: RegionCodes | null
  full_name: string
}

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = async (): Promise<User> => {
    const response = await api.me.get()
    if (response.error || !('user' in response.data) || !('csrf_token' in response.data)) {
      throw apiError(response.error, 'Sesi tidak valid')
    }
    const nextUser = response.data.user as User
    setCsrfToken(response.data.csrf_token as string)
    setUser(nextUser)
    return nextUser
  }

  useEffect(() => {
    const status = { cancelled: false }
    void (async () => {
      try {
        const response = await api.me.get()
        if (response.error || !('user' in response.data) || !('csrf_token' in response.data)) return
        if (!status.cancelled) {
          setCsrfToken(response.data.csrf_token as string)
          setUser(response.data.user as User)
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
      const response = await api.auth.login.post({ email, password })
      if (response.error) throw apiError(response.error, 'Email atau password salah')
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
    const response = await api.auth.logout.post()
    if (response.error) throw apiError(response.error, 'Gagal keluar. Coba lagi.')
    setCsrfToken(null)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, isLoading, login, refreshUser, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return context
}
