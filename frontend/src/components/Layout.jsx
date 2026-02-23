import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function Icon({ path }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Layout() {
  const { user, logout, authDebug } = useAuth()
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
    { path: '/buildings', label: 'Buildings', icon: 'M4 20h16V8L12 3 4 8v12zM9 20v-5h6v5' },
    { path: '/readings', label: 'Readings', icon: 'M5 19V9M12 19V5M19 19v-8' },
    { path: '/alerts', label: 'Alerts', icon: 'M12 3l8 14H4L12 3zm0 5v4m0 3h.01' },
    { path: '/reports', label: 'Reports', icon: 'M4 19h16M7 16V9m5 7V6m5 10v-4' },
    { path: '/admin/manual-entry', label: 'Manual Entry', icon: 'M4 5h16M4 12h16M4 19h16' },
  ]
  const adminItems = [
    { path: '/admin/import', label: 'Import Data', icon: 'M12 16V4m0 0l-4 4m4-4 4 4M4 19h16' },
    { path: '/admin/iot-devices', label: 'IoT Devices', icon: 'M5 12a7 7 0 0114 0M8 12a4 4 0 018 0M12 12h.01M4 18h16' },
  ]

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[270px_1fr]">
      <aside className="hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen border-r border-slate-200/80 bg-white/70 backdrop-blur-xl">
        <div className="px-5 py-5 border-b border-slate-200/80">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Utility Intelligence</p>
          <h1 className="mt-1 text-2xl sc-title">SmartCampus</h1>
        </div>
        <nav className="px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sc-nav-link ${isActive(item.path) ? 'sc-nav-link-active' : ''}`}
            >
              <Icon path={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
          {user?.role === 'admin' && (
            <div className="pt-3 mt-3 border-t border-slate-200/80 space-y-1">
              {adminItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sc-nav-link ${isActive(item.path) ? 'sc-nav-link-active' : ''}`}
                >
                  <Icon path={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>
        <div className="mt-auto p-4 border-t border-slate-200/80">
          <div className="text-sm font-semibold text-slate-800">{user?.full_name}</div>
          <button onClick={logout} className="sc-btn sc-btn-secondary mt-3 w-full px-4 py-2 text-sm">
            Logout
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <nav className="md:hidden bg-white/85 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-20">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-xl sc-title">SmartCampus</span>
            <button onClick={logout} className="sc-btn sc-btn-secondary px-3 py-1.5 text-xs">
              Logout
            </button>
          </div>
          <div className="px-3 pb-3 flex gap-2 overflow-x-auto">
            {[...navItems, ...(user?.role === 'admin' ? adminItems : [])].map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  isActive(item.path)
                    ? 'bg-gradient-to-r from-teal-600 to-cyan-500 text-white shadow'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon path={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
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
    </div>
  )
}
