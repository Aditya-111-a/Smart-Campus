import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      if (err?.response?.status === 0 || err?.message?.includes('Network Error')) {
        setError('Cannot reach backend API. Ensure backend is running at http://localhost:8000.')
      } else {
        setError(err?.response?.data?.detail || err?.message || 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 sc-page">
        <div>
          <h2 className="mt-6 text-center text-3xl sc-title">
            SmartCampus Utilities Dashboard
          </h2>
          <p className="mt-2 text-center text-sm sc-subtitle">
            Sign in to your account
          </p>
        </div>
        <form className="mt-8 space-y-6 sc-card p-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}
          <div className="rounded-xl shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2.5 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-xl focus:outline-none focus:ring-sky-400 focus:border-sky-400 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2.5 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-xl focus:outline-none focus:ring-sky-400 focus:border-sky-400 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="sc-btn sc-btn-primary group relative w-full flex justify-center py-2.5 px-4 text-sm disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
          <div className="text-sm sc-subtitle text-center">
            <p>Demo credentials:</p>
            <p>Admin: admin@campus.edu / admin123</p>
            <p>User: user@campus.edu / user123</p>
          </div>
        </form>
      </div>
    </div>
  )
}
