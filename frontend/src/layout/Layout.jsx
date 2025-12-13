import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout() {
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

      <div className="layout-right">
        <Topbar onToggleSidebar={handleToggleSidebar} />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
