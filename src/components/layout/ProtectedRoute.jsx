import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../context/AuthContext.jsx';

const ProtectedRoute = ({ children, requiredPermission, requiredAnyPermissions, requiredRole, requiredRoles }) => {
  const { user, loading, hasPermission, hasAnyPermission, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" tip="Loading..." ><span /></Spin>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredAnyPermissions?.length && !hasAnyPermission(requiredAnyPermissions)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
