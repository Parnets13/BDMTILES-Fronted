import { useAuth } from '../context/AuthContext.jsx';

const branchId = (branch) => String(branch?._id || branch || '');

const useBranches = () => {
  const { user, activeBranch, setActiveBranch } = useAuth();

  const assignedBranches = (user?.assignedBranches || []).filter(
    (branch) => branch?.status !== 'inactive'
  );

  const canCrossBranch = (() => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'owner') return true;
    return assignedBranches.length > 1;
  })();

  const isCurrentBranch = (branchRef) => {
    if (!activeBranch || !branchRef) return false;
    return branchId(activeBranch) === branchId(branchRef);
  };

  return {
    currentBranch: activeBranch,
    currentBranchId: branchId(activeBranch),
    assignedBranches,
    setActiveBranch,
    canCrossBranch,
    isCurrentBranch,
    userRole: user?.role,
  };
};

export default useBranches;
