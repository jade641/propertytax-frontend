import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import RoleGuard from '../components/RoleGuard'
import Audit from '../pages/Audit'
import Compliance from '../pages/Compliance'
import Dashboard from '../pages/Dashboard'
import Filing from '../pages/Filing'
import ForgotPassword from '../pages/ForgotPassword'
import Landing from '../pages/Landing'
import Login from '../pages/Login'
import PaymentManagement from '../pages/PaymentManagement'
import PropertyRegistration from '../pages/PropertyRegistration'
import Reporting from '../pages/Reporting'
import Settings from '../pages/Settings'
import TaxCalculation from '../pages/TaxCalculation'
import Users from '../pages/Users'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route
        path="/app"
        element={(
          <RoleGuard>
            <AppLayout />
          </RoleGuard>
        )}
      >
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="property-registration" element={<PropertyRegistration />} />
        <Route path="properties" element={<Navigate to="/app/property-registration" replace />} />
        <Route path="tax-calculation" element={<TaxCalculation />} />
        <Route path="payment-management" element={<PaymentManagement />} />
        <Route path="payments" element={<Navigate to="/app/payment-management" replace />} />
        <Route path="compliance" element={<Compliance />} />
        <Route
          path="filing"
          element={(
            <RoleGuard allowedRoles={["Admin", "Accountant", "Staff"]}>
              <Filing />
            </RoleGuard>
          )}
        />
        <Route path="reporting" element={<Reporting />} />
        <Route path="audit" element={<Audit />} />
        <Route path="users" element={<Users />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}