import { createContext, useState, useContext, useEffect } from 'react';
import api from '../config/api.js';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('bdmtiles_token'));

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const storedToken = localStorage.getItem('bdmtiles_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      const response = await api.get('/auth/me');
      if (response.success) {
        setUser(response.user);
        setToken(storedToken);
      } else {
        clearAuth();
      }
    } catch (error) {
      console.error('Auth check failed:', error.message);
      // Only clear on explicit auth errors, not network errors
      if (error.message?.includes('401') || error.message?.includes('Invalid')) {
        clearAuth();
      } else {
        // Try to restore from localStorage
        const savedUser = localStorage.getItem('bdmtiles_user');
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (e) {
            clearAuth();
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });

      if (response.success) {
        setUser(response.user);
        setToken(response.token);
        localStorage.setItem('bdmtiles_token', response.token);
        localStorage.setItem('bdmtiles_user', JSON.stringify(response.user));
        return { success: true };
      }
      return { success: false, error: response.message || 'Login failed' };
    } catch (error) {
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore logout API errors
    } finally {
      clearAuth();
    }
  };

  const clearAuth = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('bdmtiles_token');
    localStorage.removeItem('bdmtiles_user');
  };

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;

    const perms = user.permissions || [];
    if (perms.includes('*')) return true;
    if (perms.includes(permission)) return true;

    // Check module-level wildcard (e.g., "product.*" grants "product.master")
    const module = permission.split('.')[0];
    if (perms.includes(`${module}.*`)) return true;
    if (perms.includes(module)) return true;

    return false;
  };

  /**
   * Check if user has any of the given permissions
   */
  const hasAnyPermission = (permissions = []) => {
    return permissions.some((p) => hasPermission(p));
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === 'super_admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
