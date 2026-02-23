import { useEffect, useState } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import LoadingState from '../components/ui/LoadingState'

const ZONE_COLORS = {
  academic: '#0ea5a4',
  residential: '#0284c7',
  common: '#2563eb',
  administration: '#f97316',
  research: '#14b8a6',
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const labelText = (() => {
    const asDate = new Date(label)
    return Number.isNaN(asDate.getTime()) ? String(label ?? '') : format(asDate, 'MMM dd, yyyy')
  })()
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      <p className="text-xs font-semibold text-slate-500 mb-1">{labelText}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="text-xs flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-700">{entry.name}:</span>
          <span className="font-semibold text-slate-900">{Number(entry.value).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { user, loading: authLoading, authResolved } = useAuth()
  const [totals, setTotals] = useState(null)
  const [rankings, setRankings] = useState({ water: [], electricity: [] })
  const [summary, setSummary] = useState([])
  const [zoneBreakdown, setZoneBreakdown] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    utility: 'water',
    days: 30,
  })

  useEffect(() => {
    if (!authResolved || !user) return
    fetchDashboardData()
  }, [filters.utility, filters.days, authResolved, user])

  const fetchDashboardData = async () => {
    setLoading(true)
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - filters.days)
    const startIso = start.toISOString()
    const endIso = end.toISOString()

    try {
      setError(null)
      const [totalsRes, waterRankings, elecRankings, summaryRes, statsRes] = await Promise.all([
        api.get('/analytics/totals', { params: { start_date: startIso, end_date: endIso } }),
        api.get('/analytics/rankings', { params: { utility_type: 'water', limit: 5, start_date: startIso, end_date: endIso } }),
        api.get('/analytics/rankings', { params: { utility_type: 'electricity', limit: 5, start_date: startIso, end_date: endIso } }),
        api.get('/analytics/summary', { params: { period: 'daily', start_date: startIso, end_date: endIso } }),
        api.get('/analytics/stats', {
          params: {
            utility_type: filters.utility,
            start_date: startIso,
            end_date: endIso,
          },
        }),
      ])

      setTotals({ ...totalsRes.data, filters: { start_date: startIso, end_date: endIso } })
      setRankings({ water: waterRankings.data, electricity: elecRankings.data })
      setSummary(summaryRes.data.slice(-filters.days)) // up to last N days
      setZoneBreakdown(statsRes.data.per_zone || [])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setError(error?.response?.data?.detail || 'Dashboard API failed.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !authResolved) {
    return <LoadingState label="Resolving session..." />
  }

  if (loading) {
    return <LoadingState label="Loading dashboard data..." />
  }

  return (
    <div className="sc-page px-4 py-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <h1 className="text-3xl sc-title">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm sc-subtitle">Utility</span>
            <select
              className="sc-input text-sm px-2 py-1.5"
              value={filters.utility}
              onChange={(e) => setFilters((f) => ({ ...f, utility: e.target.value }))}
            >
              <option value="water">Water</option>
              <option value="electricity">Electricity</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm sc-subtitle">Range</span>
            <select
              className="sc-input text-sm px-2 py-1.5"
              value={filters.days}
              onChange={(e) => setFilters((f) => ({ ...f, days: Number(e.target.value) || 30 }))}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      {/* Total Consumption Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="sc-card sc-stat-card p-6 transition hover:-translate-y-0.5 hover:shadow-xl">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Water Consumption</h3>
          <p className="text-3xl font-extrabold text-cyan-600">
            {totals?.total_water?.toLocaleString('en-US', { maximumFractionDigits: 2 }) || 0} L
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {format(new Date(totals?.period_start || new Date()), 'MMM dd, yyyy')} –{' '}
            {format(new Date(totals?.period_end || new Date()), 'MMM dd, yyyy')}
          </p>
        </div>
        <div className="sc-card sc-stat-card p-6 transition hover:-translate-y-0.5 hover:shadow-xl">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Electricity Consumption</h3>
          <p className="text-3xl font-extrabold text-blue-700">
            {totals?.total_electricity?.toLocaleString('en-US', { maximumFractionDigits: 2 }) || 0} kWh
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {format(new Date(totals?.period_start || new Date()), 'MMM dd, yyyy')} –{' '}
            {format(new Date(totals?.period_end || new Date()), 'MMM dd, yyyy')}
          </p>
        </div>
      </div>

      {/* Consumption Trend Chart */}
      <div className="sc-card p-6 mb-8">
        <h2 className="text-xl sc-title mb-4">Consumption Trend (Last {filters.days} Days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={summary}>
            <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => format(new Date(date), 'MMM dd')}
            />
            <YAxis />
            <Tooltip content={<ChartTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="total_water" stroke="#0891b2" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} name="Water (L)" />
            <Line type="monotone" dataKey="total_electricity" stroke="#2563eb" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} name="Electricity (kWh)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Zone contribution + Building Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="sc-card p-6">
          <h2 className="text-xl sc-title mb-4">Zone Contribution ({filters.utility})</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                dataKey="total"
                data={zoneBreakdown}
                nameKey="zone"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ zone }) => zone}
              >
                {zoneBreakdown.map((z, idx) => (
                  <Cell key={z.zone || idx} fill={ZONE_COLORS[z.zone] || '#9ca3af'} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-4 space-y-1 text-sm">
            {zoneBreakdown.map((z) => (
              <li key={z.zone}>
                <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: ZONE_COLORS[z.zone] || '#9ca3af' }} />
                {z.zone}: {z.total.toFixed(2)} {filters.utility === 'water' ? 'L' : 'kWh'}
              </li>
            ))}
          </ul>
        </div>

        <div className="sc-card p-6 lg:col-span-2">
          <h2 className="text-xl sc-title mb-4">Top Consumers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Water</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rankings.water}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis dataKey="building_name" hide />
                  <YAxis />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="total_consumption" fill="#0891b2" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2">
                {rankings.water.map((building, idx) => (
                  <div key={building.building_id} className="flex justify-between py-1 text-sm">
                    <span>{idx + 1}. {building.building_name}</span>
                    <span className="text-blue-600">{building.total_consumption.toFixed(2)} L</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Electricity</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rankings.electricity}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis dataKey="building_name" hide />
                  <YAxis />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="total_consumption" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2">
                {rankings.electricity.map((building, idx) => (
                  <div key={building.building_id} className="flex justify-between py-1 text-sm">
                    <span>{idx + 1}. {building.building_name}</span>
                    <span className="text-green-600">{building.total_consumption.toFixed(2)} kWh</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dev-only: quick reset to VIT default demo state */}
      {import.meta?.env?.DEV && user?.role === 'admin' && (
        <div className="mt-8 sc-card p-4 border-dashed border-red-300">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Reset to VIT default state (dev only)</h2>
              <p className="text-xs text-gray-500">
                Drops and recreates the database, then reseeds canonical VIT buildings, demo users, and sample readings.
              </p>
            </div>
            <button
              type="button"
              className="sc-btn sc-btn-danger self-start md:self-auto inline-flex items-center px-3 py-1.5 text-xs"
              onClick={async () => {
                if (!window.confirm('Reset the database to VIT default demo data? This will erase current data.')) return
                try {
                  await api.post('/admin/reset-vit-demo')
                  window.location.reload()
                } catch (error) {
                  // eslint-disable-next-line no-alert
                  alert(error.response?.data?.detail || 'Failed to reset demo state')
                }
              }}
            >
              Reset demo data
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
