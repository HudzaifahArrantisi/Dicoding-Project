import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'
import { apiError } from './api-response'

export interface User {
  id: string
  email: string
  role: 'admin' | 'mitra'
  partner_id: string | null
  partner_name?: string | null
  full_name: string
}

interface AuthResult {
  success: boolean
  error?: string
  role?: User['role']
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  logout: () => void
  quickLogin: (type: 'admin' | 'mitra') => Promise<AuthResult>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function clearStoredSession() {
  localStorage.removeItem('daisuki_token')
  localStorage.removeItem('daisuki_user')
}

function storeSession(token: string, user: User) {
  localStorage.setItem('daisuki_token', token)
  localStorage.setItem('daisuki_user', JSON.stringify(user))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const savedToken = localStorage.getItem('daisuki_token')
      if (!savedToken) {
        setIsLoading(false)
        return
      }

      try {
        const response = await api.me.get()
        if (response.error || !('user' in response.data)) {
          throw apiError(response.error, 'Sesi tidak valid')
        }

        if (!cancelled) {
          const restoredUser = response.data.user as User
          setToken(savedToken)
          setUser(restoredUser)
          storeSession(savedToken, restoredUser)
        }
      } catch {
        if (!cancelled) clearStoredSession()
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  const login = async (
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    try {
      const response = await api.auth.login.post({ email, password })
      if (
        response.error ||
        !('token' in response.data) ||
        !('user' in response.data) ||
        typeof response.data.token !== 'string'
      ) {
        throw apiError(response.error, 'Email atau kata sandi salah')
      }

      const nextUser = response.data.user as User
      const nextToken = response.data.token
      setToken(nextToken)
      setUser(nextUser)
      storeSession(nextToken, nextUser)
      return { success: true, role: nextUser.role }
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Server login belum dapat dihubungi',
      }
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    clearStoredSession()
  }

  const quickLogin = (type: 'admin' | 'mitra') => {
    const credentials = {
      admin: { email: 'admin@daisuki.test', password: 'password123' },
      mitra: { email: 'mitra1@daisuki.test', password: 'password123' },
    }[type]

    return login(credentials.email, credentials.password)
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, logout, quickLogin }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth harus dipakai di dalam AuthProvider')
  }
  return context
}
