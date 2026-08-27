import { useAuth } from '../../context/AuthContext.jsx';
import { Menu, Bell, Building2 } from 'lucide-react';

const Header = ({ onMenuToggle }) => {
  const { user, activeBranchId, setActiveBranch } = useAuth();
  const branches = user?.assignedBranches || [];

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

      {/* Active business branch */}
      <div className="flex-1 flex justify-center px-3">
        {branches.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-gray-600 max-w-xs w-full">
            <Building2 size={17} className="shrink-0 text-[#FF5F03]" />
            <select
              aria-label="Active branch"
              value={activeBranchId}
              onChange={(event) => setActiveBranch(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 outline-none focus:border-[#FF5F03]"
              disabled={branches.length === 1}
            >
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.branchCode ? `${branch.branchCode} — ` : ''}{branch.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="text-xs text-amber-700">Create or assign a business branch</span>
        )}
      </div>

      {/* Right: Notifications + User Info */}
      <div className="flex items-center space-x-4">
        {/* Notification bell */}
        <button
          className="relative p-2 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors border-0 outline-none"
          aria-label="Notifications"
        >
          <Bell size={20} />
          {/* Notification dot placeholder */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

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
