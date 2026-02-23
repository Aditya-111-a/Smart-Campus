import { useEffect, useState } from 'react'
import api from '../services/api'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'

function prettifyAlertType(type) {
  if (!type) return 'Alert'
  const map = {
    spike: 'Spike',
    threshold_breach: 'Threshold Breach',
    continuous_high: 'Continuous High Usage',
    rule_trigger: 'Rule-based Alert',
  }
  return map[type] || type.replace('_', ' ')
}

function sanitizeAlertMessage(message) {
  if (!message) return ''
  // Backward compatibility for previously stored internal/debug-like messages.
  return message
    .replace(/^\[[^\]]+\]\s*/g, '')
    .replace(/^Dynamic rule triggered:\s*/i, '')
}

export default function Alerts() {
  const { loading: authLoading, authResolved, user } = useAuth()
  const [alerts, setAlerts] = useState([])
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState(null)
  const [ruleForm, setRuleForm] = useState({
    name: '',
    scope_type: 'global',
    zone: '',
    building_id: '',
    utility_type: 'water',
    condition_type: 'threshold',
    threshold_value: '',
    comparison_window_days: 7,
    consecutive_count: 1,
    severity: 'medium',
  })
  const [buildings, setBuildings] = useState([])

  useEffect(() => {
    if (!authResolved || !user) return
    fetchAlerts()
    fetchRules()
    fetchBuildings()
  }, [filter, authResolved, user])

  const fetchAlerts = async () => {
    try {
      setError(null)
      const params = filter !== 'all' ? { status: filter } : {}
      const response = await api.get('/alerts', { params })
      setAlerts(response.data)
    } catch (error) {
      console.error('Error fetching alerts:', error)
      setError(error?.response?.data?.detail || 'Failed to load alerts.')
    } finally {
      setLoading(false)
    }
  }

  const fetchRules = async () => {
    try {
      const response = await api.get('/alerts/rules')
      setRules(response.data || [])
    } catch {
      setRules([])
    }
  }

  const fetchBuildings = async () => {
    try {
      const response = await api.get('/buildings', { params: { campus_name: 'VIT Vellore', limit: 500 } })
      setBuildings(response.data || [])
    } catch {
      setBuildings([])
    }
  }

  const handleAcknowledge = async (alertId) => {
    try {
      await api.put(`/alerts/${alertId}/acknowledge`)
      fetchAlerts()
    } catch (error) {
      alert(error.response?.data?.detail || 'Error acknowledging alert')
    }
  }

  const handleResolve = async (alertId) => {
    const notes = prompt('Enter resolution notes (optional):')
    try {
      await api.put(`/alerts/${alertId}/resolve`, {
        resolution_notes: notes || undefined,
      })
      fetchAlerts()
    } catch (error) {
      alert(error.response?.data?.detail || 'Error resolving alert')
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-red-100 text-red-800'
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleCreateRule = async (e) => {
    e.preventDefault()
    try {
      await api.post('/alerts/rules', {
        name: ruleForm.name,
        scope_type: ruleForm.scope_type,
        zone: ruleForm.scope_type === 'zone' ? ruleForm.zone : undefined,
        building_id: ruleForm.scope_type === 'building' ? Number(ruleForm.building_id) : undefined,
        utility_type: ruleForm.utility_type,
        condition_type: ruleForm.condition_type,
        threshold_value: Number(ruleForm.threshold_value),
        comparison_window_days: Number(ruleForm.comparison_window_days),
        consecutive_count: Number(ruleForm.consecutive_count),
        severity: ruleForm.severity,
        is_active: true,
      })
      setRuleForm({
        name: '',
        scope_type: 'global',
        zone: '',
        building_id: '',
        utility_type: 'water',
        condition_type: 'threshold',
        threshold_value: '',
        comparison_window_days: 7,
        consecutive_count: 1,
        severity: 'medium',
      })
      fetchRules()
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err?.response?.data?.detail || 'Failed to create alert rule')
    }
  }

  const toggleRule = async (rule) => {
    try {
      await api.put(`/alerts/rules/${rule.id}`, { is_active: !rule.is_active })
      fetchRules()
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err?.response?.data?.detail || 'Failed to update rule')
    }
  }

  const deleteRule = async (rule) => {
    if (!window.confirm(`Delete rule ${rule.name}?`)) return
    try {
      await api.delete(`/alerts/rules/${rule.id}`)
      fetchRules()
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err?.response?.data?.detail || 'Failed to delete rule')
    }
  }

  if (authLoading || !authResolved) {
    return <div className="text-center py-12">Resolving session...</div>
  }

  if (loading) {
    return <div className="text-center py-12">Loading alerts...</div>
  }

  return (
    <div className="sc-page px-4 py-6">
      <div className="sc-card p-4 mb-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <h1 className="text-3xl sc-title">Alerts</h1>
          <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`sc-btn px-4 py-2 ${
              filter === 'all' ? 'sc-btn-primary text-white' : 'sc-btn-secondary'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`sc-btn px-4 py-2 ${
              filter === 'pending' ? 'sc-btn-primary text-white' : 'sc-btn-secondary'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('acknowledged')}
            className={`sc-btn px-4 py-2 ${
              filter === 'acknowledged' ? 'sc-btn-primary text-white' : 'sc-btn-secondary'
            }`}
          >
            Acknowledged
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`sc-btn px-4 py-2 ${
              filter === 'resolved' ? 'sc-btn-primary text-white' : 'sc-btn-secondary'
            }`}
          >
            Resolved
          </button>
          </div>
        </div>
      </div>

      <div className="sc-card p-0 overflow-hidden">
        <ul className="divide-y divide-gray-200">
          {error && (
            <li className="px-6 py-4 text-center text-red-600 text-sm">{error}</li>
          )}
          {alerts.length === 0 ? (
            <li className="px-6 py-4 text-center text-gray-500">
              {error ? 'Alerts unavailable due to API/auth error.' : 'No alerts found for current filter.'}
            </li>
          ) : (
            alerts.map((alert) => (
              <li key={alert.id} className="px-6 py-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(alert.status)}`}>
                        {alert.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {prettifyAlertType(alert.alert_type)}
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">{alert.building_name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{sanitizeAlertMessage(alert.message)}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Created: {format(new Date(alert.created_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                    {alert.resolution_notes && (
                      <p className="text-sm text-gray-600 mt-2 italic">
                        Resolution: {alert.resolution_notes}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex gap-2">
                    {alert.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="sc-btn sc-btn-secondary px-3 py-1 text-sm"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="sc-btn sc-btn-primary px-3 py-1 text-sm"
                        >
                          Resolve
                        </button>
                      </>
                    )}
                    {alert.status === 'acknowledged' && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="sc-btn sc-btn-primary px-3 py-1 text-sm"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {user?.role === 'admin' && (
        <div className="mt-8 space-y-4">
          <div className="sc-card p-6">
            <h2 className="text-xl font-bold mb-4">Dynamic Alert Rules</h2>
            <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={handleCreateRule}>
              <input
                className="sc-input px-3 py-2"
                placeholder="Rule name"
                value={ruleForm.name}
                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                required
              />
              <select className="sc-input px-3 py-2" value={ruleForm.scope_type} onChange={(e) => setRuleForm({ ...ruleForm, scope_type: e.target.value })}>
                <option value="global">Global</option>
                <option value="zone">Category (Zone)</option>
                <option value="building">Building</option>
              </select>
              <select className="sc-input px-3 py-2" value={ruleForm.utility_type} onChange={(e) => setRuleForm({ ...ruleForm, utility_type: e.target.value })}>
                <option value="water">Water</option>
                <option value="electricity">Electricity</option>
              </select>
              <select className="sc-input px-3 py-2" value={ruleForm.condition_type} onChange={(e) => setRuleForm({ ...ruleForm, condition_type: e.target.value })}>
                <option value="threshold">Threshold</option>
                <option value="zscore">Z-score</option>
                <option value="rate_of_change">Rate of change (%)</option>
              </select>
              <input
                className="sc-input px-3 py-2"
                type="number"
                step="any"
                placeholder="Threshold / Trigger value"
                value={ruleForm.threshold_value}
                onChange={(e) => setRuleForm({ ...ruleForm, threshold_value: e.target.value })}
                required
              />
              <select className="sc-input px-3 py-2" value={ruleForm.severity} onChange={(e) => setRuleForm({ ...ruleForm, severity: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              {ruleForm.scope_type === 'zone' && (
                <select className="sc-input px-3 py-2 md:col-span-2" value={ruleForm.zone} onChange={(e) => setRuleForm({ ...ruleForm, zone: e.target.value })} required>
                  <option value="">Select zone</option>
                  <option value="academic">Academic</option>
                  <option value="residential">Residential</option>
                  <option value="common">Common</option>
                  <option value="administration">Administration</option>
                  <option value="research">Research</option>
                </select>
              )}
              {ruleForm.scope_type === 'building' && (
                <select className="sc-input px-3 py-2 md:col-span-2" value={ruleForm.building_id} onChange={(e) => setRuleForm({ ...ruleForm, building_id: e.target.value })} required>
                  <option value="">Select building</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              )}
              <input
                className="rounded border-gray-300"
                type="number"
                min={1}
                placeholder="Window days"
                value={ruleForm.comparison_window_days}
                onChange={(e) => setRuleForm({ ...ruleForm, comparison_window_days: Number(e.target.value) })}
              />
              <input
                className="rounded border-gray-300"
                type="number"
                min={1}
                placeholder="Consecutive count"
                value={ruleForm.consecutive_count}
                onChange={(e) => setRuleForm({ ...ruleForm, consecutive_count: Number(e.target.value) })}
              />
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md md:col-span-3" type="submit">
                Add Rule
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">Configured Rules</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Scope</th>
                    <th className="px-3 py-2 text-left">Utility</th>
                    <th className="px-3 py-2 text-left">Condition</th>
                    <th className="px-3 py-2 text-left">Value</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2">{r.scope_type}{r.zone ? ` (${r.zone})` : ''}{r.building_id ? ` (B#${r.building_id})` : ''}</td>
                      <td className="px-3 py-2">{r.utility_type}</td>
                      <td className="px-3 py-2">{r.condition_type}</td>
                      <td className="px-3 py-2">{r.threshold_value}</td>
                      <td className="px-3 py-2">{r.is_active ? 'Active' : 'Disabled'}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => toggleRule(r)} className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-700">
                            Toggle
                          </button>
                          <button type="button" onClick={() => deleteRule(r)} className="text-xs px-2 py-1 rounded border border-red-300 text-red-700">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rules.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-center text-gray-500">No dynamic rules configured.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
