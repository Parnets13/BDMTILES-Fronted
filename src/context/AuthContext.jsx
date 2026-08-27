import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../config/api.js';

const AuthContext = createContext();
const ACTIVE_BRANCH_KEY = 'bdmtiles_active_branch';

const branchId = (branch) => String(branch?._id || branch || '');

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('bdmtiles_token'));
  const [activeBranch, setActiveBranchState] = useState(null);
  const [branchEpoch, setBranchEpoch] = useState(0);

  const applyUser = useCallback((nextUser) => {
    const branches = (nextUser?.assignedBranches || []).filter((branch) => branch?.status !== 'inactive');
    const savedId = localStorage.getItem(ACTIVE_BRANCH_KEY);
    const defaultId = branchId(nextUser?.defaultBranch);
    const selected = branches.find((branch) => branchId(branch) === savedId)
      || branches.find((branch) => branchId(branch) === defaultId)
      || branches[0]
      || null;

    setUser(nextUser);
    setActiveBranchState(selected);
    if (selected) localStorage.setItem(ACTIVE_BRANCH_KEY, branchId(selected));
    else localStorage.removeItem(ACTIVE_BRANCH_KEY);
    if (nextUser) localStorage.setItem('bdmtiles_user', JSON.stringify(nextUser));
  }, []);

  const applySession = useCallback((response) => {
    if (response?.token) {
      localStorage.setItem('bdmtiles_token', response.token);
      setToken(response.token);
    }
    if (response?.user) applyUser(response.user);
  }, [applyUser]);

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    setActiveBranchState(null);
    localStorage.removeItem('bdmtiles_token');
    localStorage.removeItem('bdmtiles_user');
    localStorage.removeItem(ACTIVE_BRANCH_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await api.get('/auth/me');
    if (response.success) {
      applyUser(response.user);
      setToken(localStorage.getItem('bdmtiles_token'));
      return response.user;
    }
    return null;
  }, [applyUser]);

  const checkAuth = useCallback(async () => {
    try {
      const nextUser = await refreshUser();
      if (!nextUser) clearAuth();
    } catch (error) {
      console.error('Auth check failed:', error.message);
      if (error.status === 401) clearAuth();
    } finally {
      setLoading(false);
    }
  }, [clearAuth, refreshUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearAuth();
      setLoading(false);
    };
    const handleRefreshed = (event) => applySession(event.detail);
    window.addEventListener('bdmtiles:auth-unauthorized', handleUnauthorized);
    window.addEventListener('bdmtiles:auth-refreshed', handleRefreshed);
    checkAuth();
    return () => {
      window.removeEventListener('bdmtiles:auth-unauthorized', handleUnauthorized);
      window.removeEventListener('bdmtiles:auth-refreshed', handleRefreshed);
    };
  }, [applySession, checkAuth, clearAuth]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password }, { skipAuthRefresh: true });
      if (!response.success) return { success: false, error: response.message || 'Login failed' };
      applySession(response);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const logout = async () => {
    try { await api.post('/auth/logout', null, { skipAuthRefresh: true }); }
    catch { /* Local logout remains authoritative. */ }
    finally { clearAuth(); }
  };

  const logoutAll = async () => {
    try {
      await api.post('/auth/logout-all');
      clearAuth();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || 'Unable to log out all sessions' };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await api.post('/auth/change-password', { currentPassword, newPassword });
      if (!response.success) return { success: false, error: response.message || 'Unable to change password' };
      applySession(response);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || 'Unable to change password' };
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await api.post('/auth/forgot-password', { email }, { skipAuthRefresh: true });
      return { success: true, message: response.message, devResetToken: response.devResetToken };
    } catch (error) {
      return { success: false, error: error.message || 'Unable to request password reset' };
    }
  };

  const resetPassword = async (resetToken, newPassword) => {
    try {
      const response = await api.post(
        '/auth/reset-password',
        { token: resetToken, newPassword },
        { skipAuthRefresh: true }
      );
      clearAuth();
      return { success: true, message: response.message };
    } catch (error) {
      return { success: false, error: error.message || 'Unable to reset password' };
    }
  };

  const setActiveBranch = (nextBranchId) => {
    const selected = (user?.assignedBranches || []).find((branch) => branchId(branch) === String(nextBranchId));
    if (!selected || selected.status === 'inactive') return false;
    localStorage.setItem(ACTIVE_BRANCH_KEY, branchId(selected));
    setActiveBranchState(selected);
    setBranchEpoch((epoch) => epoch + 1);
    window.dispatchEvent(new CustomEvent('bdmtiles:branch-changed', { detail: selected }));
    return true;
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'owner') return true;
    const permissions = user.permissions || [];
    const module = permission.split('.')[0];
    return permissions.includes('*')
      || permissions.includes(permission)
      || permissions.includes(`${module}.*`)
      || permissions.includes(module);
  };

  const hasAnyPermission = (permissions = []) => permissions.some(hasPermission);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      logoutAll,
      changePassword,
      forgotPassword,
      resetPassword,
      refreshUser,
      hasPermission,
      hasAnyPermission,
      activeBranch,
      activeBranchId: branchId(activeBranch),
      setActiveBranch,
      branchEpoch,
      isAuthenticated: !!user,
      isSuperAdmin: user?.role === 'super_admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
