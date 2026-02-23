import { useEffect, useState } from 'react'
import api from '../services/api'
import { format } from 'date-fns'

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchAlerts()
  }, [filter])

  const fetchAlerts = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {}
      const response = await api.get('/alerts', { params })
      setAlerts(response.data)
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
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

  if (loading) {
    return <div className="text-center py-12">Loading alerts...</div>
  }

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-md ${
              filter === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('acknowledged')}
            className={`px-4 py-2 rounded-md ${
              filter === 'acknowledged' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Acknowledged
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-4 py-2 rounded-md ${
              filter === 'resolved' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Resolved
          </button>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {alerts.length === 0 ? (
            <li className="px-6 py-4 text-center text-gray-500">No alerts found</li>
          ) : (
            alerts.map((alert) => (
              <li key={alert.id} className="px-6 py-4">
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
                        {alert.alert_type.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">{alert.building_name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
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
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                        >
                          Resolve
                        </button>
                      </>
                    )}
                    {alert.status === 'acknowledged' && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
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
    </div>
  )
}
