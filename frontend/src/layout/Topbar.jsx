// src/components/Topbar.jsx
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useSettings } from "../context/SettingsContext.jsx";

import SettingsButton from "../components/SettingsButton.jsx";
import SettingsPanel from "../components/SettingsPanel.jsx";

export default function Topbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const { settings, isLoading } = useSettings();

  const [settingsOpen, setSettingsOpen] = useState(false);

  function handleLogout() {
    logout();
    window.location.href = "/login";
  }

  const title = settings?.warehouse_name?.trim() || "My CRM";

  return (
    <div className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="hamburger" onClick={onToggleSidebar} title="Menu">
          ☰
        </button>

        <span style={{ fontWeight: 600 }}>{title}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 14, color: "#555" }}>{user?.email}</span>

        <SettingsButton onClick={() => setSettingsOpen(true)} />

        <SettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />

        <button
          onClick={handleLogout}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            background: "black",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
