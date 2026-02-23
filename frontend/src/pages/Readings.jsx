import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

export default function Readings() {
  const { user, authResolved, loading, defaultCampus } = useAuth()
  const [readings, setReadings] = useState([])
  const [buildings, setBuildings] = useState([])
  const [pageLoading, setPageLoading] = useState(false)
  const [error, setError] = useState(null)
  const [buildingsReason, setBuildingsReason] = useState(null)

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
    const nextValueRaw = window.prompt('Reading value', String(reading.value ?? ''))
    if (nextValueRaw === null) return
    const nextValue = Number(nextValueRaw)
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      // eslint-disable-next-line no-alert
      alert('Invalid value')
      return
    }
    const nextDateInput = window.prompt(
      'Reading date/time (YYYY-MM-DDTHH:mm)',
      format(new Date(reading.reading_date), "yyyy-MM-dd'T'HH:mm"),
    )
    if (!nextDateInput) return

    try {
      await api.put(`/readings/${reading.id}`, {
        building_id: reading.building_id,
        utility_type: reading.utility_type,
        value: nextValue,
        reading_date: new Date(nextDateInput).toISOString(),
        notes: reading.notes || undefined,
      })
      await fetchData()
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err?.response?.data?.detail || 'Failed to update reading')
    }
  }

  const handleDeleteReading = async (reading) => {
    if (!window.confirm(`Delete reading ${reading.id}?`)) return
    try {
      await api.delete(`/readings/${reading.id}`)
      await fetchData()
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err?.response?.data?.detail || 'Failed to delete reading')
    }
  }

  if (loading || !authResolved) {
    return <div className="text-center py-12">Resolving session...</div>
  }

  if (pageLoading) {
    return <div className="text-center py-12">Loading readings...</div>
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
                            onClick={() => handleDeleteReading(reading)}
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
    </div>
  )
}
