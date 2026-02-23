import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { user, logout, authDebug } = useAuth()
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/buildings', label: 'Buildings' },
    { path: '/readings', label: 'Readings' },
    { path: '/alerts', label: 'Alerts' },
    { path: '/reports', label: 'Reports' },
    { path: '/admin/manual-entry', label: 'Manual Entry' },
  ]

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-white/75 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-2xl font-extrabold tracking-tight text-slate-900">
                  SmartCampus
                </span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold transition-colors ${
                      isActive(item.path)
                        ? 'border-teal-600 text-slate-900'
                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                {user?.role === 'admin' && (
                  <>
                    <Link
                      to="/admin/import"
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold transition-colors ${
                        isActive('/admin/import')
                          ? 'border-teal-600 text-slate-900'
                          : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                      }`}
                    >
                      Import Data
                    </Link>
                    <Link
                      to="/admin/iot-devices"
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold transition-colors ${
                        isActive('/admin/iot-devices')
                          ? 'border-teal-600 text-slate-900'
                          : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                      }`}
                    >
                      IoT Devices
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-sm font-medium text-slate-700 mr-4">{user?.full_name}</span>
              <button
                onClick={logout}
                className="sc-btn sc-btn-secondary px-4 py-2 text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="sc-page max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {import.meta?.env?.DEV && (
          <details className="mb-4 sc-card-soft p-2 text-xs text-slate-700">
            <summary className="cursor-pointer font-medium select-none">Session Diagnostics</summary>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1">
              <div>User: {authDebug?.userEmail || 'none'} ({authDebug?.userRole || 'n/a'})</div>
              <div>Token: {authDebug?.tokenPresent ? 'present' : 'missing'} {authDebug?.isTokenExpired ? '(expired)' : ''}</div>
              <div>Token exp: {authDebug?.tokenExpiryIso || 'n/a'}</div>
              <div>
                Last API: {authDebug?.lastApiStatus?.method || 'n/a'} {authDebug?.lastApiStatus?.url || ''} [{authDebug?.lastApiStatus?.status ?? (authDebug?.lastApiStatus?.phase || 'n/a')}]
              </div>
            </div>
          </details>
        )}
        <Outlet />
      </main>
    </div>
  )
}
