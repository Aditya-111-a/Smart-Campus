import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import api, { subscribeApiStatus } from '../services/api'

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
  const [lastApiStatus, setLastApiStatus] = useState(null)
  const [systemHealth, setSystemHealth] = useState(null)
  const [authError, setAuthError] = useState(null)
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
      setUser(null)
      setSystemHealth(null)
      setAuthError(null)
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    return subscribeApiStatus((status) => {
      setLastApiStatus(status)
    })
  }, [])

  const fetchUser = useCallback(async ({ strict = false } = {}) => {
    try {
      setAuthError(null)
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
      try {
        const healthRes = await api.get('/system/health')
        setSystemHealth(healthRes.data)
      } catch {
        setSystemHealth(null)
      }
    } catch (error) {
      const status = error?.response?.status
      const isAuthError = status === 401 || status === 403
      if (import.meta?.env?.DEV) {
        console.warn('[Auth] /auth/me failed', {
          status,
          detail: error?.response?.data?.detail,
          isAuthError,
        })
      }
      if (isAuthError) {
        try {
          localStorage.removeItem('token')
        } catch {
          // ignore
        }
        setToken(null)
        setUser(null)
        setSystemHealth(null)
      } else {
        setUser(null)
      }
      setAuthError(
        error?.response?.data?.detail
          || error?.message
          || 'Unable to verify session with backend.',
      )
      if (strict) {
        throw error
      }
    } finally {
      setLoading(false)
    }
  }, [])

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

    await fetchUser({ strict: true })
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
    setSystemHealth(null)
    setAuthError(null)
    if (import.meta?.env?.DEV) {
      console.debug('[Auth] Logged out, token cleared')
    }
  }

  const tokenPayload = useMemo(() => decodeJwt(token), [token])
  const tokenExpiryIso = tokenPayload?.exp ? new Date(tokenPayload.exp * 1000).toISOString() : null
  const isTokenExpired = tokenPayload?.exp ? Date.now() >= tokenPayload.exp * 1000 : false

  const authDebug = useMemo(
    () => ({
      tokenPresent: Boolean(token),
      tokenPrefix: token ? token.slice(0, 12) : null,
      tokenSub: tokenPayload?.sub || null,
      tokenRole: tokenPayload?.role || null,
      tokenExp: tokenPayload?.exp || null,
      tokenExpiryIso,
      isTokenExpired,
      userEmail: user?.email || null,
      userRole: user?.role || null,
      loading,
      authError,
      lastApiStatus,
      systemHealth,
    }),
    [token, tokenPayload, tokenExpiryIso, isTokenExpired, user, loading, authError, lastApiStatus, systemHealth],
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authResolved: !loading,
        login,
        logout,
        defaultCampus: DEFAULT_CAMPUS,
        token,
        authDebug,
        refreshUser: fetchUser,
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
