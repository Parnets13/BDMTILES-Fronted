import { useAuth } from '../context/AuthContext.jsx';

export const hasPermission = (permission, user) => {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'owner') return true;

  const LEGACY_PERMISSION_ALIASES = {
    'lead.management': ['lead.view', 'lead.create', 'lead.update', 'lead.assign', 'lead.app', 'lead.respond', 'lead.followup', 'lead.convert', 'lead.delete'],
    'cheque.management': ['cheque.view', 'cheque.create', 'cheque.deposit', 'cheque.clear', 'cheque.bounce', 'cheque.return'],
    'delivery.management': ['delivery.view', 'delivery.execute', 'delivery.verify', 'delivery.complete', 'delivery.fail'],
  };

  const permissions = user.permissions || [];
  const module = permission.split('.')[0];
  const hasLegacyAlias = Object.entries(LEGACY_PERMISSION_ALIASES)
    .some(([legacy, aliases]) => permissions.includes(legacy) && aliases.includes(permission));
  return permissions.includes('*')
    || permissions.includes(permission)
    || permissions.includes(`${module}.*`)
    || hasLegacyAlias;
};

export const hasAnyPermission = (permissionList = [], user) =>
  permissionList.some((p) => hasPermission(p, user));

export const usePermissions = () => {
  const { user, hasPermission: checkPerm, hasAnyPermission: checkAny } = useAuth();
  return {
    hasPermission: (p) => checkPerm(p),
    hasAnyPermission: (ps) => checkAny(ps),
    user,
  };
};
