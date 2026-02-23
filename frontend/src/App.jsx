import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Buildings from './pages/Buildings'
import Readings from './pages/Readings'
import Alerts from './pages/Alerts'
import Reports from './pages/Reports'
import Layout from './components/Layout'
import AdminRoute from './components/AdminRoute'
import ManualEntry from './pages/admin/ManualEntry'
import ImportData from './pages/admin/ImportData'
import IoTDevices from './pages/admin/IoTDevices'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return user ? children : <Navigate to="/login" />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="buildings" element={<Buildings />} />
        <Route path="readings" element={<Readings />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="reports" element={<Reports />} />
        {/* Admin tooling */}
        <Route path="admin/manual-entry" element={<ManualEntry />} />
        <Route
          path="admin/import"
          element={
            <AdminRoute>
              <ImportData />
            </AdminRoute>
          }
        />
        <Route
          path="admin/iot-devices"
          element={
            <AdminRoute>
              <IoTDevices />
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  )
}

export default App
