import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

const ZONE_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#0f766e', '#9333ea']

export default function Reports() {
  const { user, authResolved, loading, defaultCampus } = useAuth()
  const [reportType, setReportType] = useState('monthly')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const [report, setReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState(null)

  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState(null)

  const [buildings, setBuildings] = useState([])
  const [buildingsError, setBuildingsError] = useState(null)
  const [analyticsScope, setAnalyticsScope] = useState('overall')
  const [selectedUtility, setSelectedUtility] = useState('water')
  const [zoneFilter, setZoneFilter] = useState('')
  const [selectedBuildings, setSelectedBuildings] = useState([])

  useEffect(() => {
    if (!authResolved || !user) return
    fetchBuildings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authResolved, user])

  const fetchBuildings = async () => {
    setBuildingsError(null)
    try {
      const response = await api.get('/buildings', { params: { campus_name: defaultCampus || 'VIT Vellore', limit: 500 } })
      setBuildings(response.data || [])
    } catch (err) {
      setBuildingsError(err?.response?.data?.detail || 'Failed to load buildings for analytics filters.')
      setBuildings([])
    }
  }

  const generateReport = async () => {
    setReportLoading(true)
    setReportError(null)
    try {
      const response =
        reportType === 'monthly'
          ? await api.get('/reports/monthly', { params: { year, month } })
          : await api.get('/reports/custom', { params: { start_date: startDate, end_date: endDate } })
      setReport(response.data)
    } catch (err) {
      setReport(null)
      setReportError(err?.response?.data?.detail || 'Error generating report.')
    } finally {
      setReportLoading(false)
    }
  }

  const runAnalytics = async () => {
    if (analyticsScope === 'category' && !zoneFilter) {
      setAnalytics(null)
      setAnalyticsError('Select a zone/category for category analytics.')
      return
    }
    if (analyticsScope === 'building' && selectedBuildings.length === 0) {
      setAnalytics(null)
      setAnalyticsError('Select at least one building for building analytics.')
      return
    }
    setAnalyticsLoading(true)
    setAnalyticsError(null)
    try {
      const response = await api.get('/analytics/insights', {
        // Scope rules:
        // overall: no zone/building filter
        // category: zone filter only
        // building: building_ids only
        params: {
          utility_type: selectedUtility,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          zone: analyticsScope === 'category' ? (zoneFilter || undefined) : undefined,
          building_ids: analyticsScope === 'building' && selectedBuildings.length ? selectedBuildings.join(',') : undefined,
          moving_window: 7,
        },
      })
      setAnalytics(response.data)
    } catch (err) {
      setAnalytics(null)
      setAnalyticsError(err?.response?.data?.detail || 'Analytics request failed.')
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const zonePieData = useMemo(() => {
    return (analytics?.per_zone || []).map((z) => ({ name: z.label, value: z.total }))
  }, [analytics])

  if (loading || !authResolved) {
    return <div className="text-center py-12">Resolving session...</div>
  }

  return (
    <div className="sc-page px-4 py-6 space-y-6">
      <h1 className="text-3xl sc-title">Reports & Analytics</h1>

      <div className="sc-card p-6">
        <h2 className="text-xl font-bold mb-4">Generate Report</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <select className="sc-input block w-full" value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <option value="monthly">Monthly Report</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {reportType === 'monthly' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Year</label>
                <input type="number" className="sc-input mt-1 block w-full" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10) || year)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Month</label>
                <input type="number" min="1" max="12" className="sc-input mt-1 block w-full" value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10) || month)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <input type="date" className="sc-input mt-1 block w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <input type="date" className="sc-input mt-1 block w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          )}

          <button onClick={generateReport} disabled={reportLoading} className="sc-btn sc-btn-primary px-4 py-2 disabled:opacity-50">
            {reportLoading ? 'Generating...' : 'Generate Report'}
          </button>
          {reportError && <p className="text-sm text-red-600">{reportError}</p>}
        </div>
      </div>

      {report && (
        <div className="space-y-6">
          <div className="sc-card p-6">
            <h2 className="text-2xl font-bold mb-4">Report Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Period</p>
                <p className="text-lg font-semibold">{format(new Date(report.period_start), 'MMM dd, yyyy')} - {format(new Date(report.period_end), 'MMM dd, yyyy')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Water</p>
                <p className="text-lg font-semibold text-blue-600">{Number(report.total_water || 0).toFixed(2)} L</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Electricity</p>
                <p className="text-lg font-semibold text-green-600">{Number(report.total_electricity || 0).toFixed(2)} kWh</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Alerts Generated</p>
                <p className="text-lg font-semibold">{report.alerts_generated}</p>
              </div>
            </div>
          </div>

          <div className="sc-card p-6">
            <h3 className="text-xl font-bold mb-4">Top Consumers (Water)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={report.top_consumers || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="building_name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total_consumption" fill="#3b82f6" name="Water (L)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="sc-card p-6">
        <h2 className="text-xl font-bold mb-4">Advanced Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Scope</label>
            <select className="sc-input mt-1 block w-full" value={analyticsScope} onChange={(e) => setAnalyticsScope(e.target.value)}>
              <option value="overall">Overall</option>
              <option value="category">Category (Zone)</option>
              <option value="building">Particular Building</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Utility</label>
            <select className="sc-input mt-1 block w-full" value={selectedUtility} onChange={(e) => setSelectedUtility(e.target.value)}>
              <option value="water">Water</option>
              <option value="electricity">Electricity</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Start</label>
            <input type="date" className="sc-input mt-1 block w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">End</label>
            <input type="date" className="sc-input mt-1 block w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Zone</label>
            <select
              className="sc-input mt-1 block w-full disabled:bg-gray-100"
              value={zoneFilter}
              disabled={analyticsScope !== 'category'}
              onChange={(e) => setZoneFilter(e.target.value)}
            >
              <option value="">All zones</option>
              <option value="academic">Academic</option>
              <option value="residential">Residential</option>
              <option value="common">Common</option>
              <option value="administration">Administration</option>
              <option value="research">Research</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Buildings {analyticsScope === 'building' ? '(select one or more)' : '(disabled for current scope)'}
          </label>
          <select
            multiple
            className="sc-input mt-1 block w-full min-h-[120px] disabled:bg-gray-100"
            disabled={analyticsScope !== 'building'}
            value={selectedBuildings.map(String)}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions).map((o) => Number(o.value))
              setSelectedBuildings(values)
            }}
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
          {buildings.length === 0 && (
            <p className="text-xs text-amber-700 mt-1">
              {buildingsError || 'No buildings available for filters (auth issue, empty database, or API error).'}
            </p>
          )}
        </div>

        <button onClick={runAnalytics} disabled={analyticsLoading} className="sc-btn sc-btn-primary px-4 py-2 disabled:opacity-50">
          {analyticsLoading ? 'Running...' : 'Run Analytics'}
        </button>
        {analyticsError && <p className="text-sm text-red-600 mt-2">{analyticsError}</p>}
      </div>

      {analytics && (
        <div className="space-y-6">
          <div className="sc-card p-6">
            <h3 className="text-xl font-bold mb-3">Statistics Summary</h3>
            <p className="text-sm text-gray-600 mb-3">
              Filters: scope={analyticsScope}, utility={analytics.utility_type}, zone={analytics.filters?.zone || 'all'}, buildings={analytics.filters?.building_ids?.length || 0},
              range={format(new Date(analytics.start_date), 'yyyy-MM-dd')} to {format(new Date(analytics.end_date), 'yyyy-MM-dd')}, sample_size={analytics.sample_size}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-gray-500">Mean</p><p className="font-semibold">{Number(analytics.mean).toFixed(2)}</p></div>
              <div><p className="text-gray-500">Median</p><p className="font-semibold">{Number(analytics.median).toFixed(2)}</p></div>
              <div><p className="text-gray-500">Variance</p><p className="font-semibold">{Number(analytics.variance).toFixed(2)}</p></div>
              <div><p className="text-gray-500">Std Dev</p><p className="font-semibold">{Number(analytics.std_dev).toFixed(2)}</p></div>
              <div><p className="text-gray-500">Cumulative Sum</p><p className="font-semibold">{Number(analytics.cumulative_sum).toFixed(2)}</p></div>
              <div><p className="text-gray-500">Moving Avg Window</p><p className="font-semibold">{analytics.moving_average_window}</p></div>
              <div><p className="text-gray-500">Threshold Breaches</p><p className="font-semibold text-orange-600">{analytics.threshold_breaches}</p></div>
              <div><p className="text-gray-500">Z-score Anomalies</p><p className="font-semibold text-red-600">{analytics.anomalies_detected}</p></div>
            </div>
          </div>

          <div className="sc-card p-6">
            <h3 className="text-xl font-bold mb-4">Trend, Moving Average, Cumulative Sum</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={analytics.series || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'MM-dd')} />
                <YAxis />
                <Tooltip labelFormatter={(v) => format(new Date(v), 'MMM dd, yyyy HH:mm')} />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#2563eb" name="Raw Value" dot={false} />
                <Line type="monotone" dataKey="moving_average" stroke="#16a34a" name="Moving Avg" dot={false} />
                <Line type="monotone" dataKey="cumulative_sum" stroke="#9333ea" name="Cumulative Sum" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="sc-card p-6">
              <h3 className="text-xl font-bold mb-4">Per-Building Aggregation</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.per_building || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" hide />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#3b82f6" name="Total" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 max-h-56 overflow-y-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left">Building</th>
                      <th className="px-2 py-1 text-right">Total</th>
                      <th className="px-2 py-1 text-right">Mean</th>
                      <th className="px-2 py-1 text-right">Breaches</th>
                      <th className="px-2 py-1 text-right">Anomalies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.per_building || []).map((row) => (
                      <tr key={row.key} className="border-t">
                        <td className="px-2 py-1">{row.label}</td>
                        <td className="px-2 py-1 text-right">{Number(row.total).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{Number(row.mean).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{row.threshold_breaches}</td>
                        <td className="px-2 py-1 text-right">{row.anomalies}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold mb-4">Per-Zone Aggregation</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={zonePieData} dataKey="value" nameKey="name" outerRadius={100} label>
                    {zonePieData.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={ZONE_COLORS[index % ZONE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 max-h-56 overflow-y-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left">Zone</th>
                      <th className="px-2 py-1 text-right">Total</th>
                      <th className="px-2 py-1 text-right">Samples</th>
                      <th className="px-2 py-1 text-right">Breaches</th>
                      <th className="px-2 py-1 text-right">Anomalies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.per_zone || []).map((row) => (
                      <tr key={row.key} className="border-t">
                        <td className="px-2 py-1">{row.label}</td>
                        <td className="px-2 py-1 text-right">{Number(row.total).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{row.sample_size}</td>
                        <td className="px-2 py-1 text-right">{row.threshold_breaches}</td>
                        <td className="px-2 py-1 text-right">{row.anomalies}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
