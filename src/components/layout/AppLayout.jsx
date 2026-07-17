import { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';

const AppLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Desktop Sidebar — fixed, always visible on lg+ */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar — overlay with backdrop */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={closeSidebar}
          />
          {/* Sidebar drawer */}
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar onClose={closeSidebar} />
          </div>
        </>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <Header onMenuToggle={toggleSidebar} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-100 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
