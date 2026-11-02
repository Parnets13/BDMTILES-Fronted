import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { message } from 'antd';
import api, { readActiveCompanyIds } from '../config/api.js';
import { stopRealtime } from '../lib/realtime.js';

const AuthContext = createContext();
const ACTIVE_BRANCH_KEY = 'bdmtiles_active_branch';
const ACTIVE_COMPANY_KEY = 'bdmtiles_active_company';

/**
 * Sentinel id for the header's "All Branches" option.
 *
 * It is persisted and sent as `X-Branch-Id` exactly like a real branch id, so no
 * transport code needs a special case. The API answers it with data from every
 * branch the user may read, and refuses writes until a real branch is picked.
 */
export const ALL_BRANCHES_ID = 'all';

/** Sentinel for the header's "All Companies" option — means "do not filter". */
export const ALL_COMPANIES_ID = 'all';

const ALL_BRANCHES_OPTION = Object.freeze({
  _id: ALL_BRANCHES_ID,
  name: 'All Branches',
  branchCode: '',
  status: 'active',
  allBranches: true,
});

const branchId = (branch) => String(branch?._id || branch || '');

/** Company ids linked to a branch (Branch.companies is many-to-many). */
const branchCompanyIds = (branch) => (branch?.companies || [])
  .map((company) => branchId(company))
  .filter(Boolean);

/**
 * A branch is in scope when it is linked to at least one of the selected
 * companies. An empty list means "All Companies" — no filter.
 */
const branchInCompanies = (branch, companyIds) => {
  if (!companyIds?.length) return true;
  const linked = branchCompanyIds(branch);
  return companyIds.some((id) => linked.includes(String(id)));
};

const readStoredCompanies = () => readActiveCompanyIds();

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
const resolveActiveBranch = (nextUser, companyIds = readStoredCompanies()) => {
  const branches = (nextUser?.assignedBranches || [])
    .filter((branch) => branch?.status !== 'inactive')
    // Company scope first: a branch outside the selected companies would be
    // rejected by the API, so it must never be chosen here.
    .filter((branch) => branchInCompanies(branch, companyIds));
  const savedId = localStorage.getItem(ACTIVE_BRANCH_KEY);
  if (savedId === ALL_BRANCHES_ID && canViewAllBranches(nextUser) && branches.length) return { ...ALL_BRANCHES_OPTION };
  const defaultId = branchId(nextUser?.defaultBranch);
  return branches.find((branch) => branchId(branch) === savedId)
    || branches.find((branch) => branchId(branch) === defaultId)
    || branches[0]
    || null;
};

/**
 * Only companies the user still has a linked branch in are kept; a stale
 * selection would otherwise scope every request to nothing.
 */
const validStoredCompanies = (nextUser) => {
  const stored = readStoredCompanies();
  if (!stored.length) return [];
  const linked = new Set((nextUser?.assignedBranches || []).flatMap(branchCompanyIds));
  return stored.filter((id) => linked.has(String(id)));
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
  const [activeBranch, setActiveBranchState] = useState(() => {
    if (!localStorage.getItem('bdmtiles_token')) return null;
    const storedUser = readStoredUser();
    return resolveActiveBranch(storedUser, validStoredCompanies(storedUser));
  });
  // Which companies the header is scoped to. Empty = All Companies.
  const [activeCompanyIds, setActiveCompanyIds] = useState(() => (
    localStorage.getItem('bdmtiles_token') ? validStoredCompanies(readStoredUser()) : []
  ));
  const [companies, setCompanies] = useState([]);
  const [branchEpoch, setBranchEpoch] = useState(0);

  const applyUser = useCallback((nextUser) => {
    const companyIds = validStoredCompanies(nextUser);
    const selected = resolveActiveBranch(nextUser, companyIds);

    setUser(nextUser);
    setActiveCompanyIds(companyIds);
    if (companyIds.length) localStorage.setItem(ACTIVE_COMPANY_KEY, JSON.stringify(companyIds));
    else localStorage.removeItem(ACTIVE_COMPANY_KEY);
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
    setActiveCompanyIds([]);
    setCompanies([]);
    localStorage.removeItem('bdmtiles_token');
    localStorage.removeItem('bdmtiles_user');
    localStorage.removeItem(ACTIVE_BRANCH_KEY);
    localStorage.removeItem(ACTIVE_COMPANY_KEY);
  }, []);

  /**
   * Company list for the header switcher. It is scope control, not master data,
   * so it is fetched once per session from a lookup endpoint that every signed-in
   * user may read. Failures are silent — without companies the header simply
   * shows "All Companies" and behaves exactly as before.
   */
  useEffect(() => {
    if (!user) { setCompanies([]); return undefined; }
    let cancelled = false;
    api.get('/masters/companies/lookup')
      .then((response) => { if (!cancelled) setCompanies(response?.data || []); })
      .catch(() => { if (!cancelled) setCompanies([]); });
    return () => { cancelled = true; };
  }, [user?._id]);

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

  /**
   * Switch company scope. Accepts an array of ids (empty = All Companies); a bare
   * id is still accepted. The branch is re-resolved inside the new branch set in
   * the same tick, because the API rejects a branch outside the selected companies
   * and `branchEpoch` remounts the layout to refetch everything.
   */
  const setActiveCompanies = (nextCompanyIds) => {
    const ids = [...new Set((Array.isArray(nextCompanyIds) ? nextCompanyIds : [nextCompanyIds])
      .map((id) => String(id || ''))
      .filter((id) => id && id !== ALL_COMPANIES_ID))];
    if (ids.length) localStorage.setItem(ACTIVE_COMPANY_KEY, JSON.stringify(ids));
    else localStorage.removeItem(ACTIVE_COMPANY_KEY);
    setActiveCompanyIds(ids);

    const branches = (user?.assignedBranches || [])
      .filter((branch) => branch?.status !== 'inactive' && branchInCompanies(branch, ids));
    const nextBranch = canViewAllBranches(user) && branches.length
      ? { ...ALL_BRANCHES_OPTION }
      : branches[0] || null;

    setActiveBranchState(nextBranch);
    if (nextBranch) localStorage.setItem(ACTIVE_BRANCH_KEY, branchId(nextBranch));
    else localStorage.removeItem(ACTIVE_BRANCH_KEY);
    setBranchEpoch((epoch) => epoch + 1);
    window.dispatchEvent(new CustomEvent('bdmtiles:branch-changed', { detail: nextBranch }));
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
      // Company scope (header switcher). An empty list means All Companies.
      companies,
      activeCompanyIds,
      activeCompanies: companies.filter((company) => activeCompanyIds.includes(String(company._id))),
      companyBranches: (user?.assignedBranches || [])
        .filter((branch) => branch?.status !== 'inactive' && branchInCompanies(branch, activeCompanyIds)),
      isAllCompanies: activeCompanyIds.length === 0,
      setActiveCompanies,
      branchEpoch,
      isAuthenticated: !!user,
      isSuperAdmin: user?.role === 'super_admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
