import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { message } from 'antd';
import api from '../config/api.js';
import { stopRealtime } from '../lib/realtime.js';

const AuthContext = createContext();
const ACTIVE_BRANCH_KEY = 'bdmtiles_active_branch';

/**
 * Sentinel id for the header's "All Branches" option.
 *
 * It is persisted and sent as `X-Branch-Id` exactly like a real branch id, so no
 * transport code needs a special case. The API answers it with data from every
 * branch the user may read, and refuses writes until a real branch is picked.
 */
export const ALL_BRANCHES_ID = 'all';

const ALL_BRANCHES_OPTION = Object.freeze({
  _id: ALL_BRANCHES_ID,
  name: 'All Branches',
  branchCode: '',
  status: 'active',
  allBranches: true,
});

const branchId = (branch) => String(branch?._id || branch || '');

/** Owners/super admins always qualify; anyone assigned more than one branch does too. */
const canViewAllBranches = (user) => {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'owner') return true;
  return (user.assignedBranches || []).filter((branch) => branch?.status !== 'inactive').length > 1;
};

/**
 * The cached session, as written by `applyUser` and removed by `clearAuth`.
 *
 * Hydrating from it is what stops a slow or unreachable API from looking like a
 * sign-out. The token and the user were still on disk, but with `user` left null
 * the app rendered the login screen — so a 504 on boot read as "it logged me out"
 * even though nothing had been cleared. Guarded because a truncated or
 * hand-edited localStorage value must not crash the provider.
 */
const readStoredUser = () => {
  try {
    const raw = localStorage.getItem('bdmtiles_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Which branch the session should be scoped to.
 *
 * Pulled out of `applyUser` so the cached session can be seeded with the same
 * rule on the very first render — if `activeBranch` stayed null the app would
 * send no X-Branch-Id header and every branch-scoped call would 428.
 */
const resolveActiveBranch = (nextUser) => {
  const branches = (nextUser?.assignedBranches || []).filter((branch) => branch?.status !== 'inactive');
  const savedId = localStorage.getItem(ACTIVE_BRANCH_KEY);
  if (savedId === ALL_BRANCHES_ID && canViewAllBranches(nextUser)) return { ...ALL_BRANCHES_OPTION };
  const defaultId = branchId(nextUser?.defaultBranch);
  return branches.find((branch) => branchId(branch) === savedId)
    || branches.find((branch) => branchId(branch) === defaultId)
    || branches[0]
    || null;
};

const LEGACY_PERMISSION_ALIASES = {
  'lead.management': ['lead.view', 'lead.create', 'lead.update', 'lead.assign', 'lead.app', 'lead.respond', 'lead.followup', 'lead.convert', 'lead.delete'],
  'cheque.management': ['cheque.view', 'cheque.create', 'cheque.deposit', 'cheque.clear', 'cheque.bounce', 'cheque.return'],
  'delivery.management': ['delivery.view', 'delivery.execute', 'delivery.verify', 'delivery.complete', 'delivery.fail'],
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  // Seeded from the cached session so the app is signed in from the first render,
  // before `/auth/me` answers. Previously both started null, so a 504 or a slow
  // cold start left `user` null and App rendered the login routes.
  const [user, setUser] = useState(() => (
    localStorage.getItem('bdmtiles_token') ? readStoredUser() : null
  ));
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('bdmtiles_token'));
  const [activeBranch, setActiveBranchState] = useState(() => (
    localStorage.getItem('bdmtiles_token') ? resolveActiveBranch(readStoredUser()) : null
  ));
  const [branchEpoch, setBranchEpoch] = useState(0);

  const applyUser = useCallback((nextUser) => {
    const selected = resolveActiveBranch(nextUser);

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
    // Close the realtime connection with the session, so a signed-out browser is
    // not still subscribed to the support room.
    stopRealtime();
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
      // Only an AUTHORITATIVE 401 ends the session. A 502/503/504 while the API
      // restarts, or a dropped connection, says nothing about the session — the
      // interceptor flags those as `sessionUnverified`. Signing out here is what
      // turned a gateway timeout into a logout, because it also discarded a
      // still-valid token that was sitting in localStorage.
      if (error.status === 401 && !error.sessionUnverified) {
        clearAuth();
      } else {
        message.warning('We could not reach the server. Some data may be out of date.');
      }
    } finally {
      setLoading(false);
    }
  }, [clearAuth, refreshUser]);

  useEffect(() => {
    const handleUnauthorized = (event) => {
      // Tell the user why the app is sending them back to login, instead of
      // silently clearing the session and leaving blank/failed screens behind.
      //
      // The reason comes from the event rather than from localStorage: the caller
      // clears the stored token BEFORE dispatching, so the old "is there still a
      // token?" check was always false and this message never actually appeared.
      if (event?.detail?.reason === 'session_expired') {
        message.warning('Your session has expired. Please sign in again.');
      }
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
    if (String(nextBranchId) === ALL_BRANCHES_ID) {
      if (!canViewAllBranches(user)) return false;
      localStorage.setItem(ACTIVE_BRANCH_KEY, ALL_BRANCHES_ID);
      setActiveBranchState({ ...ALL_BRANCHES_OPTION });
      setBranchEpoch((epoch) => epoch + 1);
      window.dispatchEvent(new CustomEvent('bdmtiles:branch-changed', { detail: ALL_BRANCHES_OPTION }));
      return true;
    }
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
    const hasLegacyAlias = Object.entries(LEGACY_PERMISSION_ALIASES)
      .some(([legacy, aliases]) => permissions.includes(legacy) && aliases.includes(permission));
    return permissions.includes('*')
      || permissions.includes(permission)
      || permissions.includes(`${module}.*`)
      || hasLegacyAlias;
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
      canViewAllBranches: canViewAllBranches(user),
      isAllBranches: branchId(activeBranch) === ALL_BRANCHES_ID,
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
