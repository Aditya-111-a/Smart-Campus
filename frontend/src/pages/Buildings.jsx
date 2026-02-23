import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

export default function Buildings() {
  const { defaultCampus, user } = useAuth()
  const [buildings, setBuildings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
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
  const [buildingStats, setBuildingStats] = useState({})

  useEffect(() => {
    fetchBuildings()
  }, [])

  const fetchBuildings = async () => {
    try {
      const response = await api.get('/buildings', {
        params: { campus_name: defaultCampus || 'VIT Vellore', limit: 500 },
      })
      const list = response.data || []
      setBuildings(list)

      // Fetch aggregated consumption per building for the last 30 days
      const end = new Date()
      const start = new Date()
      start.setDate(end.getDate() - 30)
      try {
        const reportRes = await api.get('/reports/custom', {
          params: {
            start_date: start.toISOString(),
            end_date: end.toISOString(),
          },
        })
        const summaries = reportRes.data?.building_summaries || []
        const map = {}
        summaries.forEach((s) => {
          map[s.building_id] = {
            water: Number(s.water || 0),
            electricity: Number(s.electricity || 0),
          }
        })
        setBuildingStats(map)
      } catch (err) {
        // Safe to continue without stats; list still renders
        // eslint-disable-next-line no-console
        console.warn('Failed to fetch building consumption summaries', err)
      }
    } catch (error) {
      console.error('Error fetching buildings:', error)
    } finally {
      setLoading(false)
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
      fetchBuildings()
    } catch (error) {
      alert(error.response?.data?.detail || 'Error creating building')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading buildings...</div>
  }

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Buildings</h1>
        {user?.role === 'admin' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            {showForm ? 'Cancel' : 'Add Building'}
          </button>
        )}
      </div>

      {showForm && user?.role === 'admin' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Add New Building</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Code</label>
              <input
                type="text"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={formData.water_threshold}
                  onChange={(e) => setFormData({ ...formData, water_threshold: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Electricity Threshold (kWh)</label>
                <input
                  type="number"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={formData.electricity_threshold}
                  onChange={(e) => setFormData({ ...formData, electricity_threshold: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Zone</label>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Create Building
            </button>
          </form>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Zone</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Water (30d)</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Electricity (30d)</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Thresholds</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Flags</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">IoT</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {buildings.map((building) => {
                const stats = buildingStats[building.id] || { water: 0, electricity: 0 }
                return (
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
                    <td className="px-4 py-2 whitespace-nowrap text-blue-600">
                      {stats.water.toFixed(2)} L
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-green-600">
                      {stats.electricity.toFixed(2)} kWh
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                      <div>Water: {building.water_threshold} L</div>
                      <div>Elec: {building.electricity_threshold} kWh</div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                      <div className="flex flex-col gap-1">
                        {building.is_24x7 && <span className="text-purple-600 text-xs">24x7</span>}
                        {building.tags && <span className="text-xs text-gray-500">Tags: {building.tags}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            building.iot_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {building.iot_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        {user?.role === 'admin' && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await api.put(`/buildings/${building.id}`, {
                                  iot_enabled: !building.iot_enabled,
                                })
                                fetchBuildings()
                              } catch (error) {
                                // eslint-disable-next-line no-alert
                                alert(error.response?.data?.detail || 'Failed to toggle IoT setting')
                              }
                            }}
                            className="text-xs px-2 py-0.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                          >
                            {building.iot_enabled ? 'Disable' : 'Enable'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {buildings.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-4 text-center text-sm text-gray-500"
                  >
                    No buildings found. If this is unexpected, ensure you are logged in and run the “Create default VIT
                    buildings” action from Manual Entry.
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
