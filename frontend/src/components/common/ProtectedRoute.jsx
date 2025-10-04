import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from './LoadingScreen.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

const ProtectedRoute = () => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingScreen message="認証状態を確認しています" />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export default ProtectedRoute
