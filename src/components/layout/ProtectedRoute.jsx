import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../context/AuthContext.jsx';

const ProtectedRoute = ({ children, requiredPermission, requiredRole }) => {
  const { user, loading, hasPermission, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
