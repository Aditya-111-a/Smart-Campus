import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

interface Building {
  id: number
  name: string
  code: string
}

export default function ManualEntry() {
  const { defaultCampus } = useAuth()
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    building_id: '',
    utility_type: 'water' as 'water' | 'electricity',
    value: '',
    reading_date: new Date().toISOString().slice(0, 16),
    notes: '',
  })
  const [buildingsEmptyReason, setBuildingsEmptyReason] = useState<'empty_db' | 'auth_or_error' | null>(null)
  const [seedLoading, setSeedLoading] = useState(false)

  /** Extract error message from API response (string or 422 validation list). */
  const getApiError = useCallback((err: unknown): string => {
    const ax = err as { response?: { status?: number; data?: { detail?: string | Array<{ loc?: string[]; msg?: string }> } } }
    if (ax?.response?.status === 401) {
      return 'Session expired or not logged in. Please log in again.'
    }
    if (ax?.response?.status === 403) {
      return 'You do not have permission to perform this action.'
    }
    const d = ax?.response?.data?.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d) && d.length) {
      return d.map((e) => e.msg || e.loc?.join('.') || '').filter(Boolean).join('; ') || 'Validation error'
    }
    return ''
  }, [])

  const fetchBuildings = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    setFieldErrors({})
    setBuildingsEmptyReason(null)
    try {
      const res = await api.get('/buildings', { params: { limit: 500, campus_name: defaultCampus || 'VIT Vellore' } })
      const raw = res.data
      console.log('[Buildings] raw response', res.status, raw)
      const list: unknown[] = Array.isArray(raw) ? raw : (Array.isArray((raw as { data?: unknown[] })?.data) ? (raw as { data: unknown[] }).data : (raw as { buildings?: unknown[] })?.buildings ?? [])
      const safe: Building[] = (list || []).map((b: unknown) => {
        const x = b as { id?: number; name?: string; code?: string }
        return { id: Number(x.id), name: String(x.name ?? ''), code: String(x.code ?? '') }
      }).filter((b): b is Building => Boolean(b.id && b.name))
      setBuildings(safe)
      if (safe.length === 0) {
        setBuildingsEmptyReason('empty_db')
        setMessage({ type: 'error', text: 'No buildings in the database. Use "Create default VIT buildings" below or add one via "Others (add new building)".' })
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      console.warn('[Buildings] request failed', status, (err as { response?: { data?: unknown } })?.response?.data)
      setBuildingsEmptyReason('auth_or_error')
      const msg = getApiError(err)
      setMessage({ type: 'error', text: msg || 'Failed to load buildings. Check that the backend is running.' })
      setBuildings([])
    } finally {
      setLoading(false)
    }
  }, [getApiError])

  useEffect(() => {
    fetchBuildings()
  }, [fetchBuildings])

  const isAddingNew = false
  const sortedBuildings = [...buildings].sort((a, b) => a.name.localeCompare(b.name))

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.building_id) errors.building_id = 'Select a building.'
    if (formData.value === '' || formData.value === null || formData.value === undefined) {
      errors.value = 'Enter a value.'
    } else {
      const v = parseFloat(String(formData.value))
      if (isNaN(v) || v < 0) errors.value = 'Enter a valid positive number.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setFieldErrors({})
    if (!validate()) return

    const buildingId = parseInt(String(formData.building_id), 10)

    const value = parseFloat(String(formData.value))
    setSubmitLoading(true)
    try {
      await api.post('/readings', {
        building_id: buildingId,
        utility_type: formData.utility_type,
        value,
        reading_date: new Date(formData.reading_date).toISOString(),
        notes: formData.notes || undefined,
      })
      setMessage({ type: 'success', text: 'Reading added successfully.' })
      setFormData({
        ...formData,
        value: '',
        notes: '',
      })
      setFieldErrors({})
    } catch (err: unknown) {
      const msg = getApiError(err)
      setMessage({ type: 'error', text: msg || 'Failed to add reading.' })
    } finally {
      setSubmitLoading(false)
    }
  }

  // Manual entry now strictly references existing buildings; creation is owned by Buildings page.

  if (loading) {
    return (
      <div className="px-4 py-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Manual Entry</h1>
        <p className="text-gray-500">Loading buildings...</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Manual Entry</h1>
      <p className="text-gray-600 mb-4">Add a single utility reading. Select a building from the list or add a new one using Others.</p>

      {message && (message.text || '').toLowerCase().includes('log in') && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 text-sm">{message.text}</p>
          <Link to="/login" className="text-blue-600 hover:underline text-sm font-medium mt-2 inline-block">Go to login</Link>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
            <select
              required={!isAddingNew}
              size={14}
              aria-invalid={!!fieldErrors.building_id}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${fieldErrors.building_id ? 'border-red-500' : ''}`}
              value={formData.building_id}
              onChange={(e) => {
                setFormData({ ...formData, building_id: e.target.value })
                setFieldErrors((prev) => ({ ...prev, building_id: '' }))
              }}
            >
              <option value="">— Select building —</option>
              {sortedBuildings.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            {fieldErrors.building_id && <p className="text-red-600 text-sm mt-1">{fieldErrors.building_id}</p>}
            <p className="text-xs text-gray-500 mt-1">
              {sortedBuildings.length > 0
                ? `${sortedBuildings.length} buildings. Scroll to see all, click to select.`
                : buildingsEmptyReason === 'empty_db'
                  ? 'Database has no buildings. Create default VIT buildings or add one via Others.'
                  : 'No buildings loaded. Check login or retry.'}
            </p>
            {sortedBuildings.length === 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {buildingsEmptyReason === 'empty_db' && (
                  <button
                    type="button"
                    disabled={seedLoading}
                    onClick={async () => {
                      setSeedLoading(true)
                      setMessage(null)
                      try {
                        const r = await api.post('/admin/seed-buildings')
                        const created = (r.data as { created?: number })?.created ?? 0
                        setMessage({ type: 'success', text: `Created ${created} default building(s).` })
                        await fetchBuildings()
                      } catch (err: unknown) {
                        setMessage({ type: 'error', text: getApiError(err) || 'Failed to seed buildings.' })
                      } finally {
                        setSeedLoading(false)
                      }
                    }}
                    className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {seedLoading ? 'Creating…' : 'Create default VIT buildings'}
                  </button>
                )}
                <button type="button" onClick={() => fetchBuildings()} className="text-sm text-blue-600 hover:underline">
                  Retry loading buildings
                </button>
              </div>
            )}
          </div>


          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Utility</label>
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={formData.utility_type}
              onChange={(e) => setFormData({ ...formData, utility_type: e.target.value as 'water' | 'electricity' })}
            >
              <option value="water">Water (L)</option>
              <option value="electricity">Electricity (kWh)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
            <input
              type="number"
              step="any"
              min={0}
              required
              aria-invalid={!!fieldErrors.value}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${fieldErrors.value ? 'border-red-500' : ''}`}
              value={formData.value}
              onChange={(e) => {
                setFormData({ ...formData, value: e.target.value })
                setFieldErrors((prev) => ({ ...prev, value: '' }))
              }}
            />
            {fieldErrors.value && <p className="text-red-600 text-sm mt-1">{fieldErrors.value}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date & time</label>
            <input
              type="datetime-local"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={formData.reading_date}
              onChange={(e) => setFormData({ ...formData, reading_date: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          {message && message.text && !message.text.toLowerCase().includes('log in') && (
            <p className={message.type === 'success' ? 'text-green-600 text-sm' : 'text-red-600 text-sm'}>{message.text}</p>
          )}
          <button
            type="submit"
            disabled={submitLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
          >
            {submitLoading ? 'Saving...' : isAddingNew ? 'Add building & reading' : 'Add Reading'}
          </button>
        </form>
      </div>
    </div>
  )
}
