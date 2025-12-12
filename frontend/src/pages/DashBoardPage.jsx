import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getDashboard } from '../api/dashboard';
import { Navigate } from 'react-router-dom';

export default function DashboardPage() {
  const { token, isLoading: authLoading } = useAuth();

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // <-- začni jako false
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // pokud se ještě ověřuje auth (verifyToken), tak dashboard neřeš
    if (authLoading) return;

    // pokud po ověření *nemáš* token, tak nenačítej dashboard
    if (!token) {
      setData(null);
      setErrorMessage('You are not logged in.');
      setIsLoading(false);
      return;
    }

    async function loadDashboard() {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const res = await getDashboard(token);
        setData(res);
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to load dashboard'
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, [token, authLoading]);

  if (authLoading || isLoading) {
    return <p>Loading dashboard…</p>;
  }

  if (errorMessage && !data) {
    return <p style={{ color: 'red' }}>Error: {errorMessage}</p>;
  }

  if (!data) {
    return <p>No data available.</p>;
  }

  const {
    items_total,
    variants_total,
    stock_total,
    low_stock_threshold,
    low_stock_variants = [],
    recent_items = [],
    recent_movements = [],
  } = data;

  return (
    <div>
      {/* Nadpis */}
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 20 }}>
        Dashboard
      </h1>

      {/* Karty nahoře – mobile first grid */}
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <p className="dashboard-card-label">Items</p>
          <p className="dashboard-card-value">{items_total ?? 0}</p>
        </div>

        <div className="dashboard-card">
          <p className="dashboard-card-label">Variants</p>
          <p className="dashboard-card-value">{variants_total ?? 0}</p>
        </div>

        <div className="dashboard-card">
          <p className="dashboard-card-label">Total stock</p>
          <p className="dashboard-card-value">{stock_total ?? 0}</p>
        </div>
        <div className="dashboard-card">
          <p className="dashboard-card-label">Low stock variants</p>
          <p className="dashboard-card-value">
            {low_stock_variants.length}
          </p>
        </div>
        <div className="dashboard-card">
            <p className="dashboard-card-label">recent_items</p>
            <p className="dashboard-card-value">
                {recent_items.length}
                </p>
            </div>
        <div className="dashboard-card">
            <p className="dashboard-card-label">recent_movements</p>
            <p className="dashboard-card-value">
            {recent_movements.length}
            </p>
        </div>
      </div>

      {/* Sekce pod kartami – mobile: pod sebou, desktop: 2 sloupce */}
      <div className="dashboard-sections">
        {/* Recent items */}
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">Recent items</h2>

          {recent_items.length === 0 ? (
            <p className="dashboard-empty">No recent items.</p>
          ) : (
            <ul className="dashboard-list">
              {recent_items.map((item) => (
                <li key={item.id} className="dashboard-list-item">
                  <span className="dashboard-list-main">
                    {item.name}
                  </span>
                  <span className="dashboard-list-meta">
                    {item.category}{' '}
                    {item.created_at
                      ? '· ' + new Date(item.created_at).toLocaleDateString()
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Low stock variants */}
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">
            Low stock variants{' '}
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              (threshold: {low_stock_threshold})
            </span>
          </h2>

          {low_stock_variants.length === 0 ? (
            <p className="dashboard-empty">
              No variants below threshold 🎉
            </p>
          ) : (
            <ul className="dashboard-list">
              {low_stock_variants.map((variant) => (
                <li key={variant.id} className="dashboard-list-item">
                  <span className="dashboard-list-main">
                    {variant.variant_name || variant.name}
                  </span>
                  <span className="dashboard-list-meta">
                    stock: {variant.stock_count ?? variant.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Pokud chceš, můžeš později přidat třetí sekci pro recent_movements */}
      {/* recent_movements.length teď bude 0, ale data už na to máme připravená */}
    </div>
  );
}
