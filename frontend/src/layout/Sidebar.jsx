import { NavLink } from "react-router-dom";

export default function Sidebar({ isMobileOpen, onClose }) {
  const navItems = [
    { to: "/", label: "Dashboard", end: true },
    { to: "/items", label: "Items" },
    { to: "/movements", label: "Movements" },
    { to: "/logs", label: "Logs" },
    { to: "/sqli-demo", label: "SQL Injection Demo" },
  ];

  const linkStyle = ({ isActive }) => ({
    color: "#111",
    textDecoration: "none",
    fontWeight: isActive ? 600 : 400,
    padding: "6px 8px",
    borderRadius: 8,
    background: isActive ? "rgba(0,0,0,0.06)" : "transparent",
  });

  const navList = (
    <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          style={linkStyle}
          onClick={onClose}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="sidebar sidebar-desktop">
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>
          SQL CRM
        </h2>
        {navList}
      </aside>

      {isMobileOpen && (
        <>
          <div className="backdrop" onClick={onClose} />
          <aside className="sidebar sidebar-mobile open">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>SQL CRM</h2>
              <button
                onClick={onClose}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
            {navList}
          </aside>
        </>
      )}
    </>
  );
}
