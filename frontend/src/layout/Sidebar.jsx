export default function Sidebar({ isMobileOpen, onClose }) {
    const navItems = [
      { href: '/', label: 'Dashboard' },
      { href: '/items', label: 'Items' },
      { href: '/variants', label: 'Variants' },
      { href: '/logs', label: 'Logs' },
      { href: '/sqli-demo', label: 'SQL Injection Demo' },
    ];
  
    const navList = (
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            style={{ color: '#111', textDecoration: 'none' }}
            onClick={onClose}
          >
            {item.label}
          </a>
        ))}
      </nav>
    );
  
    return (
      <>
        {/* Desktop sidebar */}
        <aside className="sidebar sidebar-desktop">
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>
            SQL CRM
          </h2>
          {navList}
        </aside>
  
        {/* Mobile sidebar + backdrop */}
        {isMobileOpen && (
          <>
            <div className="backdrop" onClick={onClose} />
            <aside className="sidebar sidebar-mobile open">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <h2 style={{ fontSize: 18, fontWeight: 600 }}>SQL CRM</h2>
                <button
                  onClick={onClose}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 20,
                    cursor: 'pointer',
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
  