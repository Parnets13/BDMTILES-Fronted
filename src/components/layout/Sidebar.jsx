import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getRoleMenuSections } from '../../config/menuConfig.js';
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  UserCheck,
} from 'lucide-react';

const Sidebar = ({ onClose }) => {
  const { user, logout, hasPermission } = useAuth();
  const [expandedSections, setExpandedSections] = useState({});
  const [activeItem, setActiveItem] = useState('dashboard');
  const navigate = useNavigate();
  const location = useLocation();

  // Update active item based on current route
  useEffect(() => {
    const path = location.pathname;
    const sections = getFilteredSections();

    const findActive = (items) => {
      for (const item of items) {
        if (item.path === path) return item.id;
        if (item.hasSubmenu && item.items) {
          for (const sub of item.items) {
            if (sub.path === path) return sub.id;
            if (sub.hasSubmenu && sub.items) {
              for (const nested of sub.items) {
                if (nested.path === path) return nested.id;
              }
            }
          }
        }
      }
      return null;
    };

    const found = findActive(sections);
    if (found) {
      setActiveItem(found);
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

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleItemClick = (itemId, path) => {
    setActiveItem(itemId);
    navigate(path);
    if (onClose) onClose(); // Close mobile sidebar
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const MenuItem = ({ item, level = 0 }) => {
    const isActive = activeItem === item.id;
    const isExpanded = expandedSections[item.id];
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
              toggleSection(item.id);
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

  const filteredSections = getFilteredSections();

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

      {/* Navigation Menu */}
      <div className="flex-1 py-4 overflow-y-auto">
        <nav className="space-y-1">
          {filteredSections.map((section) => (
            <MenuItem key={section.id} item={section} />
          ))}
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
