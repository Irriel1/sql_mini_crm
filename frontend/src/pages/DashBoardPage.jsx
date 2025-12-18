import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getDashboard } from "../api/dashboard";
import { Navigate } from "react-router-dom";

export default function DashboardPage() {
  const { token, isLoading: authLoading, isAuthenticated } = useAuth();

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // počkej až doběhne verifyToken v AuthContext
    if (authLoading) return;

    // když není přihlášený, dashboard nenačítejme
    if (!isAuthenticated || !token) {
      setData(null);
      setErrorMessage("");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        // axios client už posílá Authorization header automaticky
        const res = await getDashboard();
        if (!cancelled) setData(res);
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load dashboard"
        );
        setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, token]);

  // pokud už ověření skončilo a nejsi přihlášený, přesměrování na login
  if (!authLoading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (authLoading || isLoading) {
    return <p>Loading dashboard…</p>;
  }

  if (errorMessage && !data) {
    return <p style={{ color: "red" }}>Error: {errorMessage}</p>;
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
          <p className="dashboard-card-value">{low_stock_variants.length}</p>
        </div>

        <div className="dashboard-card">
          <p className="dashboard-card-label">Recent items</p>
          <p className="dashboard-card-value">{recent_items.length}</p>
        </div>

        <div className="dashboard-card">
          <p className="dashboard-card-label">Recent movements</p>
          <p className="dashboard-card-value">{recent_movements.length}</p>
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
                  <span className="dashboard-list-main">{item.name}</span>
                  <span className="dashboard-list-meta">
                    {item.category}{" "}
                    {item.created_at
                      ? "· " + new Date(item.created_at).toLocaleDateString()
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Low stock variants */}
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">
            Low stock variants{" "}
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              (threshold: {low_stock_threshold})
            </span>
          </h2>

          {low_stock_variants.length === 0 ? (
            <p className="dashboard-empty">No variants below threshold 🎉</p>
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
    </div>
  );
}