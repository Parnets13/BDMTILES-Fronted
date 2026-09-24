import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getRoleMenuSections } from '../../config/menuConfig.js';
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  Search,
  UserCheck,
  X,
} from 'lucide-react';

const Sidebar = ({ onClose }) => {
  const { user, logout, hasPermission } = useAuth();
  // Accordion: only one top-level module stays open at a time, so the sidebar
  // never turns into a long scroll of every expanded section. Nested submenus
  // (e.g. Profit Analysis inside Reports) toggle independently of that rule.
  const [expandedSection, setExpandedSection] = useState(null);
  const [expandedSubs, setExpandedSubs] = useState({});
  const [activeItem, setActiveItem] = useState('dashboard');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const query = search.trim().toLowerCase();

  // Update active item based on current route, and open the module that contains
  // it so a deep link or refresh doesn't land the user on a fully collapsed menu.
  useEffect(() => {
    const path = location.pathname;
    const sections = getFilteredSections();

    // Returns { itemId, sectionId } for the entry matching the current path.
    const findActive = (items, sectionId = null) => {
      for (const item of items) {
        const ownSection = sectionId || item.id;
        if (item.path === path) return { itemId: item.id, sectionId };
        if (item.hasSubmenu && item.items) {
          const hit = findActive(item.items, ownSection);
          if (hit) return hit;
        }
      }
      return null;
    };

    const found = findActive(sections);
    if (found) {
      setActiveItem(found.itemId);
      if (found.sectionId) setExpandedSection(found.sectionId);
    } else if (path === '/dashboard') {
      setActiveItem('dashboard');
    }
  }, [location.pathname, user?.role]);

  // Check module access
  const hasModuleAccess = (modulePermissions) => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    return modulePermissions.some((p) => hasPermission(p));
  };

  // Recursively filter menu items by permission
  const filterMenuItems = (items) => {
    if (!user) return [];

    return items
      .map((item) => {
        if (item.hasSubmenu && item.items) {
          return { ...item, items: filterMenuItems(item.items) };
        }
        return item;
      })
      .filter((item) => {
        if (item.roles?.length && !item.roles.includes(user.role)) return false;
        if (item.hasSubmenu) return item.items.length > 0;
        if (item.permission) return hasPermission(item.permission);
        if (item.permissions) return item.permissions.some((permission) => hasPermission(permission));
        if (item.modulePermissions) return hasModuleAccess(item.modulePermissions);
        return true;
      });
  };

  // Build submenu trees from authorized leaves first. A parent remains visible whenever
  // at least one permitted child remains, regardless of role labels or parent hints.
  const getFilteredSections = () => filterMenuItems(getRoleMenuSections(user?.role));

  // Top-level modules behave as an accordion; nested submenus toggle on their own.
  const toggleSection = (sectionId, level) => {
    if (level === 0) {
      setExpandedSection((prev) => (prev === sectionId ? null : sectionId));
      return;
    }
    setExpandedSubs((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // Keeps any branch that matches the query itself or contains a matching child,
  // so a search for "ledger" surfaces Finance & Accounts → Dealer Ledger.
  const searchMenuItems = (items) => items.reduce((kept, item) => {
    const selfMatch = String(item.title || '').toLowerCase().includes(query);
    if (item.hasSubmenu && item.items) {
      const children = searchMenuItems(item.items);
      if (children.length) kept.push({ ...item, items: children });
      else if (selfMatch) kept.push(item);
    } else if (selfMatch) {
      kept.push(item);
    }
    return kept;
  }, []);

  const handleItemClick = (itemId, path) => {
    setActiveItem(itemId);
    setSearch(''); // jumping to a result returns the menu to its normal tree
    navigate(path);
    if (onClose) onClose(); // Close mobile sidebar
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const MenuItem = ({ item, level = 0 }) => {
    const isActive = activeItem === item.id;
    // While searching, every surviving branch is shown open so matches are visible
    // without the user having to expand anything.
    const isExpanded = query
      ? true
      : level === 0
        ? expandedSection === item.id
        : Boolean(expandedSubs[item.id]);
    const Icon = item.icon;

    return (
      <div>
        <div
          className={`
            flex items-center justify-between px-3 py-2 mx-2 rounded-lg cursor-pointer transition-all duration-200
            ${
              isActive
                ? 'bg-[#FF5F03]/10 text-[#FF5F03] border-r-2 border-[#FF5F03]'
                : 'text-gray-700 hover:bg-gray-100'
            }
            ${level > 0 ? 'ml-4' : ''}
          `}
          onClick={() => {
            if (item.hasSubmenu) {
              toggleSection(item.id, level);
            } else if (item.path) {
              handleItemClick(item.id, item.path);
            }
          }}
        >
          <div className="flex items-center space-x-3">
            {Icon && (
              <Icon
                size={18}
                className={isActive ? 'text-[#FF5F03]' : 'text-gray-500'}
              />
            )}
            <span className="text-sm font-medium">{item.title}</span>
          </div>
          {item.hasSubmenu && (
            <div className="transition-transform duration-200">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-400" />
              ) : (
                <ChevronRight size={16} className="text-gray-400" />
              )}
            </div>
          )}
        </div>

        {item.hasSubmenu && isExpanded && (
          <div className="mt-1 mb-2">
            {item.items &&
              item.items.map((subItem) => (
                <MenuItem key={subItem.id} item={subItem} level={level + 1} />
              ))}
          </div>
        )}
      </div>
    );
  };

  const permittedSections = getFilteredSections();
  const visibleSections = query ? searchMenuItems(permittedSections) : permittedSections;

  return (
    <div className="flex flex-col w-64 h-screen bg-white border-r border-gray-200">
      {/* User Info */}
      <div className="p-3 border-b border-gray-200 bg-[#FF5F03]/10">
        <div className="flex items-center space-x-3">
          <div className="bg-[#FF5F03]/10 p-2 rounded-full">
            <UserCheck size={16} className="text-[#FF5F03]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-[#FF5F03] capitalize">
              {user?.role?.replace(/_/g, ' ') || 'Staff'}
            </p>
          </div>
        </div>

        {/* Sub Admin Territory Info */}
        {user?.role === 'sub_admin' && user?.assignedRegions?.length > 0 && (
          <div className="mt-2 text-xs text-gray-600">
            <span className="font-medium">Regions:</span>{' '}
            {user.assignedRegions.join(', ')}
          </div>
        )}
      </div>

      {/* Module search */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus-within:border-[#FF5F03]">
          <Search size={15} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search modules…"
            aria-label="Search modules and pages"
            className="w-full text-sm bg-transparent border-0 outline-none text-gray-700 placeholder:text-gray-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="text-gray-400 hover:text-gray-600 border-0 bg-transparent p-0 cursor-pointer shrink-0"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 py-4 overflow-y-auto">
        <nav className="space-y-1">
          {visibleSections.length === 0 ? (
            <p className="px-5 text-sm text-gray-400">No modules match “{search.trim()}”.</p>
          ) : (
            visibleSections.map((section) => (
              <MenuItem key={section.id} item={section} />
            ))
          )}
        </nav>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="flex items-center w-full p-2 space-x-2 text-sm text-red-600 transition-colors rounded-lg hover:text-red-700 hover:bg-red-50 border-0 outline-none"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
