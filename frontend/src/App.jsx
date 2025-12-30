import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/common/ProtectedRoute.jsx'
import RoleGuard from './components/common/RoleGuard.jsx'
import LoadingScreen from './components/common/LoadingScreen.jsx'
import LoginPage from './pages/LoginPage.jsx'
import EmployeeLayout from './pages/employee/EmployeeLayout.jsx'
import EmployeeDashboardPage from './pages/employee/EmployeeDashboardPage.jsx'
import EmployeeHistoryPage from './pages/employee/EmployeeHistoryPage.jsx'
import EmployeeMonthlySummaryPage from './pages/employee/EmployeeMonthlySummaryPage.jsx'
import EmployeeWeeklyReportPage from './pages/employee/EmployeeWeeklyReportPage.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx'
import AdminDailyViewPage from './pages/admin/AdminDailyViewPage.jsx'
import AdminExportPage from './pages/admin/AdminExportPage.jsx'
import AdminWeeklyReportsPage from './pages/admin/AdminWeeklyReportsPage.jsx'
import { useAuth } from './context/AuthContext.jsx'

function App() {
  const { loading } = useAuth()

  if (loading) {
    return <LoadingScreen message="データを読み込み中です" />
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<RoleGuard allowedRoles={['employee', 'admin']} />}>
          <Route path="/employee" element={<EmployeeLayout />}>
            <Route index element={<EmployeeDashboardPage />} />
            <Route path="history" element={<EmployeeHistoryPage />} />
            <Route path="summary" element={<EmployeeMonthlySummaryPage />} />
            <Route path="weekly-report" element={<EmployeeWeeklyReportPage />} />
          </Route>
        </Route>

        <Route element={<RoleGuard allowedRoles={['admin']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="daily" element={<AdminDailyViewPage />} />
            <Route path="export" element={<AdminExportPage />} />
            <Route path="weekly-reports" element={<AdminWeeklyReportsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
