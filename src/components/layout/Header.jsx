import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import notificationService from '../../services/notificationService.js';
import { Select } from 'antd';
import { Menu, Bell, Building2, Briefcase } from 'lucide-react';

const Header = ({ onMenuToggle }) => {
  const {
    user, activeBranchId, setActiveBranch, hasPermission, canViewAllBranches,
    companies, activeCompanyIds, setActiveCompanies, companyBranches,
  } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  // Company selection already filters the branch list; when no company is picked
  // this is every branch the user is assigned to.
  const branches = companyBranches || [];
  const isAllBranches = activeBranchId === 'all';

  /** How many of the user's branches this company can use — 0 disables the option. */
  const branchCountFor = (companyId) => (user?.assignedBranches || [])
    .filter((branch) => branch?.status !== 'inactive'
      && (branch.companies || []).map(String).includes(String(companyId)))
    .length;

  // The GST number is always shown: the same legal entity can hold several
  // registrations, and the name alone does not identify which one is selected.
  const companyLabel = (company) => `${company.legalName} — ${company.gstin}`;

  useEffect(() => {
    if (!activeBranchId || !hasPermission('notification.inbox')) return;
    notificationService.getUnreadCount()
      .then((response) => setUnreadCount(response.data?.count || 0))
      .catch(() => setUnreadCount(0));
  }, [activeBranchId]);

  const getInitial = (name) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  return (
    <header className="flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 shadow-sm lg:px-6">
      {/* Left: Hamburger + Logo */}
      <div className="flex items-center space-x-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuToggle}
          className="p-2 text-gray-600 rounded-lg lg:hidden hover:bg-gray-100 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>

        {/* Company Logo */}
        <div className="flex items-center space-x-2">
          <img
            src="/logo.jpeg"
            alt="BDMTILES"
            className="h-8 w-8 rounded object-contain"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <span className="text-lg font-bold text-gray-800 hidden sm:block">
            BDM<span className="text-[#FF5F03]">TILES</span>
          </span>
        </div>
      </div>

      {/* Active company + branch: company narrows the branches, branch narrows the data */}
      <div className="flex-1 flex justify-center items-center gap-2 px-3 flex-wrap">
        {companies.length > 0 && (
          <div className="flex items-center gap-2" title="Scope the whole app to one or more companies">
            <Briefcase size={17} className="shrink-0 text-[#FF5F03]" />
            {/* Multi-select: one branch can serve several companies, and antd
                renders the dropdown options with checkboxes. */}
            <Select
              mode="multiple"
              allowClear
              aria-label="Active companies"
              value={activeCompanyIds}
              onChange={setActiveCompanies}
              placeholder="All Companies"
              maxTagCount={2}
              maxTagPlaceholder={(omitted) => `+${omitted.length} more`}
              optionFilterProp="label"
              popupMatchSelectWidth={430}
              style={{ minWidth: 260, maxWidth: 380 }}
              options={companies.map((company) => {
                // A company with no linked branch would scope every screen to
                // nothing, so it is disabled — and says why instead of just dimming.
                const branchCount = branchCountFor(company._id);
                return {
                  value: company._id,
                  label: branchCount === 0
                    ? `${companyLabel(company)} — no branches linked`
                    : companyLabel(company),
                  disabled: branchCount === 0,
                };
              })}
            />
          </div>
        )}

        {branches.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-gray-600 max-w-xs" title={isAllBranches ? 'Showing data from every branch. New records are saved to your default branch.' : 'Active branch'}>
            <Building2 size={17} className="shrink-0 text-[#FF5F03]" />
            <select
              aria-label="Active branch"
              value={activeBranchId || ''}
              onChange={(event) => setActiveBranch(event.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm font-medium outline-none focus:border-[#FF5F03] ${
                isAllBranches
                  ? 'border-[#FF5F03] bg-orange-50 text-[#B84300]'
                  : 'border-gray-200 bg-gray-50 text-gray-800'
              }`}
            >
              {canViewAllBranches && (
                <option value="all">All Branches</option>
              )}
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.branchCode ? `${branch.branchCode} — ` : ''}{branch.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="text-xs text-amber-700">
            {activeCompanyIds.length === 0
              ? 'Create or assign a business branch'
              : 'No branches linked to the selected companies'}
          </span>
        )}
      </div>

      {/* Right: Notifications + User Info */}
      <div className="flex items-center space-x-4">
        {/* Notification bell */}
        {hasPermission('notification.inbox') && <button
          className="relative p-2 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors border-0 outline-none"
          aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
          onClick={() => navigate('/notifications')}
        >
          <Bell size={20} />
          {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>}

        {/* User Info */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-gray-800 leading-tight">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-gray-500 capitalize leading-tight">
              {user?.role?.replace(/_/g, ' ') || 'Staff'}
            </p>
          </div>

          {/* Avatar */}
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#FF5F03] text-white font-semibold text-sm">
            {getInitial(user?.name)}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
