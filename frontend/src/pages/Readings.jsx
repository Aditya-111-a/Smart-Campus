import { useEffect, useState } from 'react'
import api from '../services/api'
import { format } from 'date-fns'

export default function Readings() {
  const [readings, setReadings] = useState([])
  const [buildings, setBuildings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    building_id: '',
    utility_type: 'water',
    value: '',
    reading_date: new Date().toISOString().slice(0, 16),
    notes: '',
  })

  useEffect(() => {
    fetchBuildings()
    fetchReadings()
  }, [])

  const fetchBuildings = async () => {
    try {
      const response = await api.get('/buildings')
      setBuildings(response.data)
    } catch (error) {
      console.error('Error fetching buildings:', error)
    }
  }

  const fetchReadings = async () => {
    try {
      const response = await api.get('/readings?limit=100')
      setReadings(response.data)
    } catch (error) {
      console.error('Error fetching readings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/readings', {
        ...formData,
        value: parseFloat(formData.value),
        reading_date: new Date(formData.reading_date).toISOString(),
      })
      setShowForm(false)
      setFormData({
        building_id: '',
        utility_type: 'water',
        value: '',
        reading_date: new Date().toISOString().slice(0, 16),
        notes: '',
      })
      fetchReadings()
    } catch (error) {
      alert(error.response?.data?.detail || 'Error creating reading')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading readings...</div>
  }

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Utility Readings</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          {showForm ? 'Cancel' : 'Add Reading'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Add New Reading</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Building</label>
              <select
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={formData.building_id}
                onChange={(e) => setFormData({ ...formData, building_id: parseInt(e.target.value) })}
              >
                <option value="">Select a building</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name} ({building.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Utility Type</label>
              <select
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={formData.utility_type}
                onChange={(e) => setFormData({ ...formData, utility_type: e.target.value })}
              >
                <option value="water">Water</option>
                <option value="electricity">Electricity</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Value</label>
              <input
                type="number"
                step="0.01"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Reading Date</label>
              <input
                type="datetime-local"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={formData.reading_date}
                onChange={(e) => setFormData({ ...formData, reading_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Submit Reading
            </button>
          </form>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Building
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {readings.map((reading) => {
                const building = buildings.find(b => b.id === reading.building_id)
                return (
                <tr key={reading.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {building?.name || `Building ${reading.building_id}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      reading.utility_type === 'water' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {reading.utility_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {reading.value.toFixed(2)} {reading.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(reading.reading_date), 'MMM dd, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {reading.notes || '-'}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
