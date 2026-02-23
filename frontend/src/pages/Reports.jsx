import { useState } from 'react'
import api from '../services/api'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function Reports() {
  const [reportType, setReportType] = useState('monthly')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateReport = async () => {
    setLoading(true)
    setError(null)
    try {
      let response
      if (reportType === 'monthly') {
        response = await api.get(`/reports/monthly?year=${year}&month=${month}`)
      } else {
        response = await api.get(`/reports/custom?start_date=${startDate}&end_date=${endDate}`)
      }
      setReport(response.data)
    } catch (error) {
      setError(error.response?.data?.detail || 'Error generating report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Reports</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Generate Report</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="monthly">Monthly Report</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {reportType === 'monthly' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Year</label>
                <input
                  type="number"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Month</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <button
            onClick={generateReport}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          {error && (
            <p className="text-sm text-red-600 mt-2">
              {error}
            </p>
          )}
        </div>
      </div>

      {report && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Report Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Period</p>
                <p className="text-lg font-semibold">
                  {format(new Date(report.period_start), 'MMM dd, yyyy')} - {format(new Date(report.period_end), 'MMM dd, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Water</p>
                <p className="text-lg font-semibold text-blue-600">{report.total_water.toFixed(2)} L</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Electricity</p>
                <p className="text-lg font-semibold text-green-600">{report.total_electricity.toFixed(2)} kWh</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Alerts Generated</p>
                <p className="text-lg font-semibold">{report.alerts_generated}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-4">Top Consumers</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={report.top_consumers}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="building_name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total_consumption" fill="#3b82f6" name="Water (L)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-4">Building Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Building</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Water (L)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Electricity (kWh)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.building_summaries.map((building) => (
                    <tr key={building.building_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{building.building_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">{building.water.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{building.electricity.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
