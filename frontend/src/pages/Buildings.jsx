import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import LoadingState from '../components/ui/LoadingState'
import ConfirmModal from '../components/ui/ConfirmModal'

function formatTrend(value) {
  if (!Number.isFinite(value)) return '0.0%'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function formatMetric(value, unit = '') {
  const n = toFiniteNumber(value, 0)
  return `${n.toFixed(2)}${unit ? ` ${unit}` : ''}`
}

export default function Buildings() {
  const { defaultCampus, user, authResolved, loading } = useAuth()
  const [overview, setOverview] = useState(null)
  const [buildings, setBuildings] = useState([])
  const [pageLoading, setPageLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', code: '', description: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    water_threshold: 10000,
    electricity_threshold: 5000,
    zone: 'academic',
    is_24x7: false,
    tags: '',
  })

  useEffect(() => {
    if (!authResolved || !user) return
    fetchOverview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authResolved, user, defaultCampus])

  const fetchOverview = async () => {
    setPageLoading(true)
    setError(null)
    try {
      const response = await api.get('/buildings/overview', {
        params: {
          campus_name: defaultCampus || 'VIT Vellore',
          days: 30,
        },
      })
      const nextOverview = response.data
      setOverview(nextOverview)
      setBuildings(nextOverview?.buildings || [])
    } catch (err) {
      const status = err?.response?.status
      if (status === 401) {
        setError('Authentication required. Your session is not valid for buildings API access.')
      } else {
        setError(err?.response?.data?.detail || 'Failed to load building overview.')
      }
      setOverview(null)
      setBuildings([])
    } finally {
      setPageLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/buildings', {
        ...formData,
        water_threshold: Number(formData.water_threshold) || 10000,
        electricity_threshold: Number(formData.electricity_threshold) || 5000,
        campus_name: defaultCampus || 'VIT Vellore',
        tags: formData.tags || undefined,
      })
      setShowForm(false)
      setFormData({
        name: '',
        code: '',
        description: '',
        water_threshold: 10000,
        electricity_threshold: 5000,
        zone: 'academic',
        is_24x7: false,
        tags: '',
      })
      fetchOverview()
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err?.response?.data?.detail || 'Error creating building')
    }
  }

  const handleEdit = async (building) => {
    setEditTarget(building)
    setEditForm({
      name: building.name || '',
      code: building.code || '',
      description: building.description || '',
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/buildings/${deleteTarget.id}`)
      setDeleteTarget(null)
      await fetchOverview()
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err?.response?.data?.detail || 'Failed to delete building')
    }
  }

  const submitEdit = async () => {
    if (!editTarget) return
    try {
      await api.put(`/buildings/${editTarget.id}`, {
        name: editForm.name.trim(),
        code: editForm.code.trim() || editTarget.code,
        description: editForm.description.trim() || undefined,
        campus_name: editTarget.campus_name || defaultCampus || 'VIT Vellore',
        zone: editTarget.zone || 'academic',
        tags: editTarget.tags || undefined,
        is_24x7: Boolean(editTarget.is_24x7),
      })
      setEditTarget(null)
      await fetchOverview()
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err?.response?.data?.detail || 'Failed to update building')
    }
  }

  const totals = useMemo(() => {
    return buildings.reduce(
      (acc, b) => {
        acc.water += toFiniteNumber(b.water_total)
        acc.electricity += toFiniteNumber(b.electricity_total)
        acc.total += toFiniteNumber(b.total_consumption)
        return acc
      },
      { water: 0, electricity: 0, total: 0 },
    )
  }, [buildings])

  if (loading || !authResolved) {
    return <LoadingState label="Resolving session..." />
  }

  if (pageLoading) {
    return <LoadingState label="Loading building overview..." />
  }

  return (
    <div className="sc-page px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl sc-title">All Buildings Overview</h1>
        {user?.role === 'admin' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="sc-btn sc-btn-primary px-4 py-2"
          >
            {showForm ? 'Cancel' : 'Add Building'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="sc-card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Campus</p>
            <p className="font-semibold">{overview?.campus_name || defaultCampus || 'VIT Vellore'}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Water (30d)</p>
            <p className="font-semibold text-blue-600">{formatMetric(totals.water, 'L')}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Electricity (30d)</p>
            <p className="font-semibold text-green-600">{formatMetric(totals.electricity, 'kWh')}</p>
          </div>
          <div>
            <p className="text-gray-500">Sample Size</p>
            <p className="font-semibold">{overview?.sample_size || 0}</p>
          </div>
        </div>
      </div>

      {showForm && user?.role === 'admin' && (
        <div className="sc-card p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Add New Building</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                className="sc-input mt-1 block w-full"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Code</label>
              <input
                type="text"
                className="sc-input mt-1 block w-full"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                className="sc-input mt-1 block w-full"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Water Threshold (L)</label>
                <input
                  type="number"
                  required
                  className="sc-input mt-1 block w-full"
                  value={formData.water_threshold}
                  onChange={(e) => setFormData({ ...formData, water_threshold: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Electricity Threshold (kWh)</label>
                <input
                  type="number"
                  required
                  className="sc-input mt-1 block w-full"
                  value={formData.electricity_threshold}
                  onChange={(e) => setFormData({ ...formData, electricity_threshold: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Zone</label>
                <select
                  className="sc-input mt-1 block w-full"
                  value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                >
                  <option value="academic">Academic</option>
                  <option value="residential">Residential (Hostel)</option>
                  <option value="common">Common</option>
                  <option value="administration">Administration</option>
                  <option value="research">Research</option>
                </select>
              </div>
              <div className="flex items-center mt-6">
                <input
                  id="form-iot-24x7"
                  type="checkbox"
                  className="h-4 w-4 text-teal-600 border-gray-300 rounded"
                  checked={formData.is_24x7}
                  onChange={(e) => setFormData({ ...formData, is_24x7: e.target.checked })}
                />
                <label htmlFor="form-iot-24x7" className="ml-2 text-sm text-gray-700">
                  24x7 usage
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tags (optional)</label>
              <input
                type="text"
                className="sc-input mt-1 block w-full"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>
            <button
              type="submit"
              className="sc-btn sc-btn-primary px-4 py-2"
            >
              Create Building
            </button>
          </form>
        </div>
      )}

      <div className="sc-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm sc-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Zone</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Water (30d)</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Electricity (30d)</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Total (30d)</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Thresholds</th>
                {user?.role === 'admin' && (
                  <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {buildings.map((building) => (
                <tr key={building.id}>
                  <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-900">
                    {building.name}
                    {building.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{building.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700">{building.code}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                    {building.zone || '—'}
                    <div className="text-xs text-gray-400">{building.campus_name || defaultCampus || 'VIT Vellore'}</div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-blue-600">{formatMetric(building.water_total, 'L')}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-green-600">{formatMetric(building.electricity_total, 'kWh')}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700">{formatMetric(building.total_consumption)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                    <div className="text-blue-600">Water: {formatTrend(toFiniteNumber(building.water_trend_pct, 0))}</div>
                    <div className="text-green-600">Elec: {formatTrend(toFiniteNumber(building.electricity_trend_pct, 0))}</div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                    <div>Water: {formatMetric(building.water_threshold, 'L')}</div>
                    <div>Elec: {formatMetric(building.electricity_threshold, 'kWh')}</div>
                  </td>
                  {user?.role === 'admin' && (
                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api.put(`/buildings/${building.id}`, { iot_enabled: !building.iot_enabled })
                              await fetchOverview()
                            } catch (err) {
                              // eslint-disable-next-line no-alert
                              alert(err?.response?.data?.detail || 'Failed to toggle IoT')
                            }
                          }}
                          className="sc-btn sc-btn-secondary text-xs px-2 py-1"
                        >
                          IoT {building.iot_enabled ? 'On' : 'Off'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(building)}
                          className="sc-btn sc-btn-secondary text-xs px-2 py-1"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(building)}
                          className="sc-btn sc-btn-danger text-xs px-2 py-1"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {buildings.length === 0 && (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 9 : 8} className="px-4 py-4 text-center text-sm text-gray-500">
                    No buildings found for {defaultCampus || 'VIT Vellore'}. Reason: {error ? 'API error or auth issue.' : 'database has no building records.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Building"
        description={deleteTarget ? `Delete ${deleteTarget.name}? This will remove associated readings, alerts, IoT devices, and rules.` : ''}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
            onClick={() => setEditTarget(null)}
            aria-label="Close edit modal"
          />
          <div className="relative w-full max-w-lg sc-card p-6">
            <h3 className="text-lg sc-title">Edit Building</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  className="sc-input block w-full"
                  value={editForm.name}
                  onChange={(e) => setEditForm((v) => ({ ...v, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                <input
                  className="sc-input block w-full"
                  value={editForm.code}
                  onChange={(e) => setEditForm((v) => ({ ...v, code: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  className="sc-input block w-full"
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm((v) => ({ ...v, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="sc-btn sc-btn-secondary px-3 py-2 text-sm" onClick={() => setEditTarget(null)}>
                Cancel
              </button>
              <button type="button" className="sc-btn sc-btn-primary px-3 py-2 text-sm" onClick={submitEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
