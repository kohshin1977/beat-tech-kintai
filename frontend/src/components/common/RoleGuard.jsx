import PropTypes from 'prop-types'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from './LoadingScreen.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

const RoleGuard = ({ allowedRoles }) => {
  const { profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingScreen message="権限を確認しています" />
  }

  if (!profile?.role || !allowedRoles.includes(profile.role)) {
    const fallbackPath = profile?.role === 'admin' ? '/admin' : '/employee'
    return <Navigate to={fallbackPath} replace state={{ from: location }} />
  }

  return <Outlet />
}

RoleGuard.propTypes = {
  allowedRoles: PropTypes.arrayOf(PropTypes.string).isRequired,
}

export default RoleGuard
