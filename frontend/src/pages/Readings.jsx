import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import LoadingState from '../components/ui/LoadingState'
import ConfirmModal from '../components/ui/ConfirmModal'

export default function Readings() {
  const { user, authResolved, loading, defaultCampus } = useAuth()
  const [readings, setReadings] = useState([])
  const [buildings, setBuildings] = useState([])
  const [pageLoading, setPageLoading] = useState(false)
  const [error, setError] = useState(null)
  const [buildingsReason, setBuildingsReason] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ value: '', reading_date: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    if (!authResolved || !user) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authResolved, user])

  const fetchData = async () => {
    setPageLoading(true)
    setError(null)
    setBuildingsReason(null)
    try {
      const [buildingsRes, readingsRes] = await Promise.all([
        api.get('/buildings', { params: { campus_name: defaultCampus || 'VIT Vellore', limit: 500 } }),
        api.get('/readings', { params: { limit: 100 } }),
      ])
      const buildingList = buildingsRes.data || []
      setBuildings(buildingList)
      setReadings(readingsRes.data || [])

      if (buildingList.length === 0) {
        setBuildingsReason('empty_db')
      }
    } catch (err) {
      const status = err?.response?.status
      if (status === 401) {
        setBuildingsReason('auth')
        setError('Authentication failed for readings API. Please login again.')
      } else {
        setBuildingsReason('api_error')
        setError(err?.response?.data?.detail || 'Failed to load readings/buildings.')
      }
    } finally {
      setPageLoading(false)
    }
  }

  const buildingLookup = useMemo(() => {
    const map = new Map()
    buildings.forEach((b) => map.set(b.id, b))
    return map
  }, [buildings])

  const handleEditReading = async (reading) => {
    setEditTarget(reading)
    setEditForm({
      value: String(reading.value ?? ''),
      reading_date: format(new Date(reading.reading_date), "yyyy-MM-dd'T'HH:mm"),
    })
  }

  const saveReadingEdit = async () => {
    if (!editTarget) return
    const nextValue = Number(editForm.value)
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      // eslint-disable-next-line no-alert
      alert('Invalid value')
      return
    }
    try {
      await api.put(`/readings/${editTarget.id}`, {
        building_id: editTarget.building_id,
        utility_type: editTarget.utility_type,
        value: nextValue,
        reading_date: new Date(editForm.reading_date).toISOString(),
        notes: editTarget.notes || undefined,
      })
      setEditTarget(null)
      await fetchData()
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err?.response?.data?.detail || 'Failed to update reading')
    }
  }

  const handleDeleteReading = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/readings/${deleteTarget.id}`)
      setDeleteTarget(null)
      await fetchData()
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err?.response?.data?.detail || 'Failed to delete reading')
    }
  }

  if (loading || !authResolved) {
    return <LoadingState label="Resolving session..." />
  }

  if (pageLoading) {
    return <LoadingState label="Loading readings..." />
  }

  return (
    <div className="sc-page px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl sc-title">Readings</h1>
          <p className="text-sm sc-subtitle mt-1">
            Add new readings from{' '}
            <Link to="/admin/manual-entry" className="text-blue-600 hover:underline">Manual Entry</Link>.
          </p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>}
      {buildings.length === 0 && (
        <div className="mb-4 p-3 rounded border border-amber-200 bg-amber-50 text-amber-800 text-sm">
          {buildingsReason === 'empty_db' && 'No buildings exist in the campus database.'}
          {buildingsReason === 'auth' && 'No buildings loaded due to authentication issue.'}
          {buildingsReason === 'api_error' && 'No buildings loaded due to API error.'}
        </div>
      )}

      <div className="sc-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 sc-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Building</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                {user?.role === 'admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {readings.map((reading) => {
                const building = buildingLookup.get(reading.building_id)
                return (
                  <tr key={reading.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {building?.name || `Building ${reading.building_id}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${reading.utility_type === 'water' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {reading.utility_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Number(reading.value).toFixed(2)} {reading.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(reading.reading_date), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{reading.notes || '-'}</td>
                    {user?.role === 'admin' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditReading(reading)}
                            className="sc-btn sc-btn-secondary text-xs px-2 py-1"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(reading)}
                            className="sc-btn sc-btn-danger text-xs px-2 py-1"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
              {readings.length === 0 && (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 6 : 5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No readings available yet. Use Manual Entry to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Reading"
        description={deleteTarget ? `Delete reading #${deleteTarget.id}?` : ''}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteReading}
      />

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
            onClick={() => setEditTarget(null)}
            aria-label="Close edit modal"
          />
          <div className="relative w-full max-w-md sc-card p-6">
            <h3 className="text-lg sc-title">Edit Reading</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Value</label>
                <input
                  type="number"
                  className="sc-input block w-full"
                  value={editForm.value}
                  onChange={(e) => setEditForm((v) => ({ ...v, value: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  className="sc-input block w-full"
                  value={editForm.reading_date}
                  onChange={(e) => setEditForm((v) => ({ ...v, reading_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="sc-btn sc-btn-secondary px-3 py-2 text-sm" onClick={() => setEditTarget(null)}>
                Cancel
              </button>
              <button type="button" className="sc-btn sc-btn-primary px-3 py-2 text-sm" onClick={saveReadingEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
