import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import LoadingState from '../../components/ui/LoadingState'

interface Building {
  id: number
  name: string
  code: string
}

type BuildingsReason = 'empty_db' | 'auth' | 'api_error' | null

const OTHER_OPTION = '__other__'

export default function ManualEntry() {
  const { defaultCampus, authResolved, user, loading } = useAuth()
  const [buildings, setBuildings] = useState<Building[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [buildingsReason, setBuildingsReason] = useState<BuildingsReason>(null)
  const [formData, setFormData] = useState({
    building_id: '',
    utility_type: 'water' as 'water' | 'electricity',
    value: '',
    reading_date: new Date().toISOString().slice(0, 16),
    notes: '',
    new_building_name: '',
    new_building_code: '',
    new_building_description: '',
  })

  const isOther = formData.building_id === OTHER_OPTION

  const getApiError = useCallback((err: unknown): string => {
    const ax = err as { response?: { status?: number; data?: { detail?: string | Array<{ loc?: string[]; msg?: string }> } } }
    if (ax?.response?.status === 401) return 'Authentication failed for manual reading entry.'
    if (ax?.response?.status === 403) return 'You do not have permission to perform this action.'
    const d = ax?.response?.data?.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d) && d.length) return d.map((e) => e.msg || e.loc?.join('.') || '').filter(Boolean).join('; ')
    return ''
  }, [])

  const fetchBuildings = useCallback(async () => {
    setPageLoading(true)
    setMessage(null)
    setFieldErrors({})
    setBuildingsReason(null)
    try {
      const res = await api.get('/buildings', { params: { limit: 500, campus_name: defaultCampus || 'VIT Vellore' } })
      const list: Building[] = (Array.isArray(res.data) ? res.data : [])
        .map((b: unknown) => {
          const x = b as { id?: number; name?: string; code?: string }
          return { id: Number(x.id), name: String(x.name ?? ''), code: String(x.code ?? '') }
        })
        .filter((b) => Boolean(b.id && b.name))

      setBuildings(list)
      if (list.length === 0) setBuildingsReason('empty_db')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setBuildings([])
      if (status === 401) setBuildingsReason('auth')
      else setBuildingsReason('api_error')
      setMessage({ type: 'error', text: getApiError(err) || 'Failed to load buildings for manual entry.' })
    } finally {
      setPageLoading(false)
    }
  }, [defaultCampus, getApiError])

  useEffect(() => {
    if (!authResolved || !user) return
    fetchBuildings()
  }, [authResolved, user, fetchBuildings])

  const sortedBuildings = [...buildings].sort((a, b) => a.name.localeCompare(b.name))

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.building_id) errors.building_id = 'Select a building.'
    if (isOther && user?.role !== 'admin') errors.building_id = 'Only admin can create a new building from this page.'
    if (isOther && !formData.new_building_name.trim()) errors.new_building_name = 'Enter building name.'
    if (formData.value === '' || formData.value === null || formData.value === undefined) errors.value = 'Enter a value.'
    else {
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

    setSubmitLoading(true)
    try {
      let buildingId = parseInt(String(formData.building_id), 10)

      if (isOther) {
        const created = await api.post('/buildings', {
          name: formData.new_building_name.trim(),
          code: formData.new_building_code.trim() || undefined,
          description: formData.new_building_description.trim() || undefined,
          campus_name: defaultCampus || 'VIT Vellore',
          zone: 'academic',
          water_threshold: 10000,
          electricity_threshold: 5000,
        })
        buildingId = created.data.id
      }

      const value = parseFloat(String(formData.value))
      await api.post('/readings', {
        building_id: buildingId,
        utility_type: formData.utility_type,
        value,
        reading_date: new Date(formData.reading_date).toISOString(),
        notes: formData.notes || undefined,
      })

      setMessage({ type: 'success', text: 'Reading added successfully.' })
      setFormData((prev) => ({
        ...prev,
        value: '',
        notes: '',
        new_building_name: '',
        new_building_code: '',
        new_building_description: '',
      }))
      await fetchBuildings()
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getApiError(err) || 'Failed to add reading.' })
    } finally {
      setSubmitLoading(false)
    }
  }

  if (loading || !authResolved) {
    return <LoadingState label="Resolving session..." />
  }

  if (pageLoading) {
    return <LoadingState label="Loading buildings..." />
  }

  return (
    <div className="sc-page px-4 py-6">
      <h1 className="text-3xl sc-title mb-6">Manual Entry</h1>
      <p className="text-sm sc-subtitle mb-4">
        Select existing building (scroll list), or choose <strong>Others</strong> to create a new building and add reading in one flow.
      </p>
      <p className="text-sm sc-subtitle mb-4">
        Building metadata can also be managed in <Link to="/buildings" className="text-blue-600 hover:underline">Buildings</Link>.
      </p>

      <div className="sc-card p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
            <select
              required
              size={14}
              aria-invalid={!!fieldErrors.building_id}
              className={`sc-input block w-full ${fieldErrors.building_id ? 'border-red-500' : ''}`}
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
              <option value={OTHER_OPTION}>Others (Add new building)</option>
            </select>
            {fieldErrors.building_id && <p className="text-red-600 text-sm mt-1">{fieldErrors.building_id}</p>}
            <p className="text-xs text-gray-500 mt-1">
              {sortedBuildings.length > 0 && `${sortedBuildings.length} seeded buildings loaded.`}
              {sortedBuildings.length === 0 && buildingsReason === 'empty_db' && 'No buildings in DB.'}
              {sortedBuildings.length === 0 && buildingsReason === 'auth' && 'No buildings loaded due to authentication failure.'}
              {sortedBuildings.length === 0 && buildingsReason === 'api_error' && 'No buildings loaded due to API/backend error.'}
            </p>
          </div>

          {isOther && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="md:col-span-2 text-sm font-medium text-gray-700">New Building Details</div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  className={`sc-input block w-full ${fieldErrors.new_building_name ? 'border-red-500' : ''}`}
                  value={formData.new_building_name}
                  onChange={(e) => setFormData({ ...formData, new_building_name: e.target.value })}
                />
                {fieldErrors.new_building_name && <p className="text-red-600 text-sm mt-1">{fieldErrors.new_building_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code (optional)</label>
                <input
                  type="text"
                  className="sc-input block w-full"
                  value={formData.new_building_code}
                  onChange={(e) => setFormData({ ...formData, new_building_code: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  className="sc-input block w-full"
                  value={formData.new_building_description}
                  onChange={(e) => setFormData({ ...formData, new_building_description: e.target.value })}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Utility</label>
            <select
              className="sc-input block w-full"
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
              className={`sc-input block w-full ${fieldErrors.value ? 'border-red-500' : ''}`}
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
              className="sc-input block w-full"
              value={formData.reading_date}
              onChange={(e) => setFormData({ ...formData, reading_date: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              className="sc-input block w-full"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          {message && <p className={message.type === 'success' ? 'text-green-600 text-sm' : 'text-red-600 text-sm'}>{message.text}</p>}
          <button
            type="submit"
            disabled={submitLoading || (sortedBuildings.length === 0 && !isOther)}
            className="sc-btn sc-btn-primary px-4 py-2 disabled:opacity-50"
          >
            {submitLoading ? 'Saving...' : 'Add Reading'}
          </button>
        </form>
      </div>
    </div>
  )
}
