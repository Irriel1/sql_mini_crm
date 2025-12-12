import { useAuth } from '../auth/AuthContext';

export default function Topbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    window.location.href = '/login';
  }

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button className="hamburger" onClick={onToggleSidebar}>
          ☰
        </button>
        <span style={{ fontWeight: 600 }}>Dashboard</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 14, color: '#555' }}>{user?.email}</span>
        <button
          onClick={handleLogout}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            background: 'black',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
