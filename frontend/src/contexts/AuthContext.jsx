import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)
const DEFAULT_CAMPUS = 'VIT Vellore'

function decodeJwt(token) {
  if (!token) return null
  try {
    const [, payload] = token.split('.')
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return decoded
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('token')
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (token) {
      if (import.meta?.env?.DEV) {
        const payload = decodeJwt(token)
        console.debug('[Auth] Existing token on boot', {
          tokenPrefix: token.slice(0, 12),
          sub: payload?.sub,
          role: payload?.role,
          exp: payload?.exp,
        })
      }
      fetchUser()
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const fetchUser = async () => {
    try {
      if (import.meta?.env?.DEV) {
        console.debug('[Auth] Fetching /auth/me')
      }
      const response = await api.get('/auth/me')
      setUser(response.data)
      if (import.meta?.env?.DEV) {
        console.debug('[Auth] /auth/me OK', {
          email: response.data?.email,
          role: response.data?.role,
        })
      }
    } catch (error) {
      if (import.meta?.env?.DEV) {
        console.warn('[Auth] /auth/me failed, clearing token', {
          status: error?.response?.status,
          detail: error?.response?.data?.detail,
        })
      }
      try {
        localStorage.removeItem('token')
      } catch {
        // ignore
      }
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    const params = new URLSearchParams()
    params.append('username', email)
    params.append('password', password)

    const response = await api.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    const { access_token } = response.data

    if (import.meta?.env?.DEV) {
      const payload = decodeJwt(access_token)
      const expIso = payload?.exp ? new Date(payload.exp * 1000).toISOString() : null
      console.debug('[Auth] Login OK, token issued', {
        tokenPrefix: access_token.slice(0, 12),
        sub: payload?.sub,
        role: payload?.role,
        exp: payload?.exp,
        expIso,
      })
    }

    try {
      localStorage.setItem('token', access_token)
    } catch {
      // ignore storage failures
    }
    setToken(access_token)

    await fetchUser()
    return response.data
  }

  const logout = () => {
    try {
      localStorage.removeItem('token')
    } catch {
      // ignore
    }
    setToken(null)
    setUser(null)
    if (import.meta?.env?.DEV) {
      console.debug('[Auth] Logged out, token cleared')
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        defaultCampus: DEFAULT_CAMPUS,
        token,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
