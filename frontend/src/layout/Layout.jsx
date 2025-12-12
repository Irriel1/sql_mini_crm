import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  function handleToggleSidebar() {
    setIsSidebarOpen((prev) => !prev);
  }

  function handleCloseSidebar() {
    setIsSidebarOpen(false);
  }

  return (
    <div className="layout">
      <Sidebar isMobileOpen={isSidebarOpen} onClose={handleCloseSidebar} />

      <div style={{ flex: 1 }}>
        <Topbar onToggleSidebar={handleToggleSidebar} />

        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
