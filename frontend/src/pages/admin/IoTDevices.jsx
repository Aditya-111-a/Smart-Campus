import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

export default function IoTDevices() {
  const { loading: authLoading, authResolved, user } = useAuth()
  const [devices, setDevices] = useState([])
  const [buildings, setBuildings] = useState([])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    device_id: '',
    name: '',
    building_id: '',
    utility_type: 'water',
    device_key: '',
    is_active: true,
  })

  useEffect(() => {
    if (!authResolved || !user) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authResolved, user])

  const load = async () => {
    try {
      setError(null)
      const [dRes, bRes] = await Promise.all([
        api.get('/iot/devices'),
        api.get('/buildings', { params: { limit: 500, campus_name: 'VIT Vellore' } }),
      ])
      setDevices(dRes.data || [])
      setBuildings(bRes.data || [])
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load IoT devices')
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/iot/devices', {
        ...form,
        building_id: Number(form.building_id),
      })
      setForm({
        device_id: '',
        name: '',
        building_id: '',
        utility_type: 'water',
        device_key: '',
        is_active: true,
      })
      await load()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create device')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (device) => {
    try {
      await api.put(`/iot/devices/${device.id}`, { is_active: !device.is_active })
      await load()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to update device')
    }
  }

  const handleDelete = async (device) => {
    if (!window.confirm(`Delete device ${device.device_id}?`)) return
    try {
      await api.delete(`/iot/devices/${device.id}`)
      await load()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to delete device')
    }
  }

  if (authLoading || !authResolved) return <div className="text-center py-12">Resolving session...</div>

  return (
    <div className="sc-page px-4 py-6 space-y-6">
      <h1 className="text-3xl sc-title">IoT Device Integration</h1>
      <p className="text-sm sc-subtitle">
        Register building devices now, then send real-time data to <code>/api/iot/ingest</code> with either global API key or per-device key.
      </p>

      {error && <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="sc-card p-6">
        <h2 className="text-lg font-semibold mb-4">Register Device</h2>
        <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={handleCreate}>
          <input
            className="sc-input px-3 py-2"
            placeholder="Device ID"
            value={form.device_id}
            onChange={(e) => setForm({ ...form, device_id: e.target.value })}
            required
          />
          <input
            className="sc-input px-3 py-2"
            placeholder="Device Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <select
            className="sc-input px-3 py-2"
            value={form.building_id}
            onChange={(e) => setForm({ ...form, building_id: e.target.value })}
            required
          >
            <option value="">Select Building</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </select>
          <select
            className="sc-input px-3 py-2"
            value={form.utility_type}
            onChange={(e) => setForm({ ...form, utility_type: e.target.value })}
          >
            <option value="water">Water</option>
            <option value="electricity">Electricity</option>
          </select>
          <input
            className="sc-input px-3 py-2 md:col-span-2"
            placeholder="Device Key (secret)"
            value={form.device_key}
            onChange={(e) => setForm({ ...form, device_key: e.target.value })}
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="sc-btn sc-btn-primary px-4 py-2 disabled:opacity-50 md:col-span-3"
          >
            {saving ? 'Saving...' : 'Add Device'}
          </button>
        </form>
      </div>

      <div className="sc-card p-6">
        <h2 className="text-lg font-semibold mb-4">Registered Devices</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm sc-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Device</th>
                <th className="px-3 py-2 text-left">Building ID</th>
                <th className="px-3 py-2 text-left">Utility</th>
                <th className="px-3 py-2 text-left">Last Seen</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2">{d.device_id} - {d.name}</td>
                  <td className="px-3 py-2">{d.building_id}</td>
                  <td className="px-3 py-2">{d.utility_type}</td>
                  <td className="px-3 py-2">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : 'Never'}</td>
                  <td className="px-3 py-2">{d.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => handleToggle(d)} className="sc-btn sc-btn-secondary text-xs px-2 py-1">Toggle</button>
                      <button onClick={() => handleDelete(d)} className="sc-btn sc-btn-danger text-xs px-2 py-1">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {devices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-500">No devices configured yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
