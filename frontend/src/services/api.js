import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

let lastApiStatus = null
const apiStatusListeners = new Set()

function emitApiStatus(status) {
  lastApiStatus = status
  apiStatusListeners.forEach((listener) => {
    try {
      listener(status)
    } catch {
      // ignore listener failures
    }
  })
}

export function subscribeApiStatus(listener) {
  apiStatusListeners.add(listener)
  if (lastApiStatus) {
    listener(lastApiStatus)
  }
  return () => apiStatusListeners.delete(listener)
}

export function getLastApiStatus() {
  return lastApiStatus
}

// Single source of truth for JWT: localStorage
function getStoredToken() {
  try {
    return localStorage.getItem('token')
  } catch {
    return null
  }
}

// Attach Authorization header for protected requests and add debug logging
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken()
    const url = config.url || ''

    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`

      if (import.meta?.env?.DEV) {
        console.debug('[API][req] auth', {
          method: config.method,
          url,
          hasAuth: true,
          tokenPrefix: token.slice(0, 12),
        })
      }
    }

    emitApiStatus({
      phase: 'request',
      at: new Date().toISOString(),
      method: (config.method || 'get').toUpperCase(),
      url,
      hasToken: Boolean(token),
    })

    return config
  },
  (error) => Promise.reject(error),
)

// Basic response logging for debugging auth / role issues
api.interceptors.response.use(
  (response) => {
    const url = response.config?.url || ''
    if (import.meta?.env?.DEV) {
      console.debug('[API][res]', {
        method: response.config?.method,
        url,
        status: response.status,
      })
    }
    emitApiStatus({
      phase: 'response',
      at: new Date().toISOString(),
      method: (response.config?.method || 'get').toUpperCase(),
      url,
      status: response.status,
      ok: true,
    })
    return response
  },
  (error) => {
    const response = error.response
    if (response && import.meta?.env?.DEV) {
      const url = response.config?.url || ''
      console.warn('[API][res][error]', {
        method: response.config?.method,
        url,
        status: response.status,
        detail: response.data?.detail,
      })
    }
    emitApiStatus({
      phase: 'response',
      at: new Date().toISOString(),
      method: (response?.config?.method || error.config?.method || 'get').toUpperCase(),
      url: response?.config?.url || error.config?.url || '',
      status: response?.status || null,
      ok: false,
      error: response?.data?.detail || error?.message || 'Request failed',
    })
    return Promise.reject(error)
  },
)

export default api
