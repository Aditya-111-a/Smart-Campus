import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

interface ImportErrorRow {
  row_number: number
  error: string
}

interface ImportSummary {
  total_rows: number
  success_count: number
  failed_count: number
  failed_rows: ImportErrorRow[]
}

export default function ImportData() {
  const { loading: authLoading, authResolved } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setFile(f || null)
    setResult(null)
    setError(null)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a CSV or Excel file.')
      return
    }
    const suffix = file.name.split('.').pop()?.toLowerCase()
    if (suffix !== 'csv' && suffix !== 'xlsx') {
      setError('Only .csv and .xlsx files are allowed.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await api.post<ImportSummary>('/admin/import-readings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(response.data)
      setFile(null)
      ;(e.target as HTMLFormElement).reset()
    } catch (err: unknown) {
      const msg = getApiError(err) || 'Import failed. Check file format and that you are logged in as admin.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function getApiError(err: unknown): string {
    const ax = err as { response?: { status?: number; data?: { detail?: string | Array<{ msg?: string; loc?: string[] }> } } }
    if (ax?.response?.status === 401) return 'Authentication failed for admin import. Please re-authenticate.'
    if (ax?.response?.status === 403) return 'You need admin rights to import. Log in with an admin account.'
    const d = ax?.response?.data?.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d) && d.length) return d.map((e) => e.msg || e.loc?.join('.') || '').filter(Boolean).join('; ') || 'Validation error'
    return ''
  }

  return (
    <div className="px-4 py-6">
      {(authLoading || !authResolved) && (
        <div className="mb-4 p-3 rounded border border-gray-200 bg-gray-50 text-sm text-gray-700">
          Resolving session before import actions...
        </div>
      )}
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Import Data</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Supported CSV / Excel format</h2>
        <p className="text-gray-600 mb-2">Use a <strong>.csv</strong> or <strong>.xlsx</strong> file with these columns (headers are case-insensitive):</p>
        <ul className="list-disc list-inside text-gray-600 mb-2 space-y-1">
          <li><strong>timestamp</strong> – date/time of the reading (e.g. 2025-02-20 14:30:00 or ISO format)</li>
          <li><strong>building</strong> – building name or code (e.g. TT, MH-A, SJT, Ladies Hostel A Block)</li>
          <li><strong>utility</strong> – <code className="bg-gray-100 px-1">water</code> or <code className="bg-gray-100 px-1">electricity</code></li>
          <li><strong>value</strong> – numeric consumption (liters for water, kWh for electricity)</li>
        </ul>
        <p className="text-sm text-gray-500">If a building name/code is not in the system, it will be created automatically. Extra columns are ignored.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Upload file</h2>
        <p className="text-gray-600 mb-4">Choose a CSV or Excel file with the columns above.</p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">File *</label>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700"
            />
          </div>
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-red-700 text-sm">{error}</p>
              {(error.toLowerCase().includes('log in') || error.toLowerCase().includes('session')) && (
                <Link to="/login" className="text-blue-600 hover:underline text-sm font-medium mt-2 inline-block">Go to login</Link>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !file}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
          >
            {loading ? 'Importing...' : 'Import'}
          </button>
        </form>
      </div>

      {result && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Import Result</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500">Total rows</p>
              <p className="text-lg font-semibold">{result.total_rows}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Success</p>
              <p className="text-lg font-semibold text-green-600">{result.success_count}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-lg font-semibold text-red-600">{result.failed_count}</p>
            </div>
          </div>
          {result.failed_rows.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Failed rows</h3>
              <div className="overflow-x-auto max-h-48 overflow-y-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Row</th>
                      <th className="px-3 py-2 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.failed_rows.map((row) => (
                      <tr key={row.row_number} className="border-t">
                        <td className="px-3 py-2">{row.row_number}</td>
                        <td className="px-3 py-2 text-red-600">{row.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
