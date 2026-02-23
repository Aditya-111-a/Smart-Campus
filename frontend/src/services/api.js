import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

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

    const isAuthEndpoint =
      url.startsWith('/auth/login') ||
      url.startsWith('/auth/register') ||
      url.startsWith('/auth/me')
    const isHealthEndpoint = url.startsWith('/system/health')

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
    } else if (!isAuthEndpoint && !isHealthEndpoint) {
      // Block unauthenticated calls to protected API routes
      if (import.meta?.env?.DEV) {
        console.debug('[API][req] blocked unauthenticated request', {
          method: config.method,
          url,
        })
      }
      return Promise.reject(new axios.Cancel('Unauthenticated – request blocked client-side'))
    }

    return config
  },
  (error) => Promise.reject(error),
)

// Basic response logging for debugging auth / role issues
api.interceptors.response.use(
  (response) => {
    if (import.meta?.env?.DEV) {
      const url = response.config?.url || ''
      console.debug('[API][res]', {
        method: response.config?.method,
        url,
        status: response.status,
      })
    }
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
    return Promise.reject(error)
  },
)

export default api
