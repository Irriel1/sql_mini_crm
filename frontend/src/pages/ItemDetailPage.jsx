import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getItem, deleteItem } from "../api/items";

const LOW_STOCK_THRESHOLD = 5; // později natáhneme ze /api/settings

export default function ItemDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [item, setItem] = useState(null);
  const [variants, setVariants] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        setError(null);

        const data = await getItem(id);
        console.log("getItem data =", data);
        console.log("variants candidates:", {
          data_variants: data?.variants,
          item_variants: data?.item?.variants,
          data_data_variants: data?.data?.variants,
        });

        // Normalizace tvaru odpovědi:
        // 1) data = { id, name, ... , variants: [...] }
        // 2) data = { item: {...}, variants: [...] }
        // 3) data = { item: {...}, variants: { rows: [...] } } (kdyby)
        const normalizedItem = data?.item ?? data;
        const normalizedVariants =
          data?.variants?.rows ??
          data?.variants ??
          normalizedItem?.variants ??
          [];

        setItem(normalizedItem);
        setVariants(Array.isArray(normalizedVariants) ? normalizedVariants : []);
      } catch (err) {
        setError(err?.message || "Failed to load item");
      }
    })();
  }, [id]);

  async function onDelete() {
    if (!confirm("Delete item? This will remove all variants.")) return;
    try {
      setIsDeleting(true);
      await deleteItem(id);
      nav("/items");
    } catch (err) {
      alert(err?.message || "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  const filteredVariants = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return variants;

    return variants.filter((v) => {
      const sku = String(v.sku ?? "").toLowerCase();
      const name = String(v.variant_name ?? "").toLowerCase();
      return sku.includes(term) || name.includes(term);
    });
  }, [variants, q]);

  const stats = useMemo(() => {
    const totalStock = variants.reduce(
      (sum, v) => sum + Number(v.stock_count ?? 0),
      0
    );
    const variantsCount = variants.length;
    const lowStockCount = variants.filter(
      (v) => Number(v.stock_count ?? 0) <= LOW_STOCK_THRESHOLD
    ).length;

    return { totalStock, variantsCount, lowStockCount };
  }, [variants]);

  if (!id) {
    return (
      <div className="card">
        <b>Invalid route</b>
        <div style={{ marginTop: 8, color: "#6b7280" }}>
          Missing item id in URL.
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="button" onClick={() => nav("/items")}>
            Back to Items
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <b style={{ color: "crimson" }}>Error</b>
        <div style={{ marginTop: 8 }}>{error}</div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button className="button" onClick={() => nav("/items")}>
            Back
          </button>
          <button
            className="button"
            onClick={() => window.location.reload()}
            style={{ background: "#333" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Loading item…</div>
        <div style={{ color: "#6b7280", fontSize: 14 }}>
          Fetching details from API.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header */}
      <div className="dashboard-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>
              {item.name}
            </div>

            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                }}
              >
                {item.category || "Uncategorized"}
              </span>

              <span
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  color: "#6b7280",
                }}
              >
                ID: {item.id ?? id}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 140 }}>
            <button className="button" onClick={() => nav(`/items/${id}/edit`)}>
              Edit item
            </button>

            <button
              className="button"
              onClick={() => nav(`/items/${id}/variants/new`)}
              style={{ background: "#333" }}
            >
              + Add variant
            </button>

            <button
              className="button"
              onClick={onDelete}
              disabled={isDeleting}
              style={{ background: "crimson" }}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 6 }}>
            Description
          </div>
          <div style={{ whiteSpace: "pre-wrap" }}>
            {item.description?.trim() ? item.description : "—"}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="dashboard-card-label">Total stock</div>
          <div className="dashboard-card-value">{stats.totalStock}</div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-card-label">Variants</div>
          <div className="dashboard-card-value">{stats.variantsCount}</div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-card-label">Low stock</div>
          <div className="dashboard-card-value">{stats.lowStockCount}</div>
        </div>
      </div>

      {/* Variants */}
      <div className="dashboard-section">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div className="dashboard-section-title" style={{ marginBottom: 0 }}>
            Variants
          </div>

          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search SKU or name…"
            style={{ maxWidth: 260 }}
          />
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {filteredVariants.length === 0 ? (
            <div className="dashboard-empty">
              No variants found.
            </div>
          ) : (
            filteredVariants.map((v) => {
              const stock = Number(v.stock_count ?? 0);
              const isLow = stock <= LOW_STOCK_THRESHOLD;

              return (
                <div
                  key={v.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                    background: "white",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {v.variant_name || "Unnamed variant"}
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      SKU: {v.sku || "—"}
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                      Price: {v.price ?? "—"}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    <span
                      style={{
                        fontSize: 12,
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        background: isLow ? "#fff1f2" : "#f9fafb",
                        color: isLow ? "crimson" : "#111",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                      title={isLow ? "Low stock" : "Stock"}
                    >
                      Stock: {stock}
                    </span>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="button"
                        style={{ width: "auto", padding: "8px 10px" }}
                        onClick={() => nav(`/variants/${v.id}/edit`)}
                      >
                        Edit
                      </button>

                      <button
                        className="button"
                        style={{ width: "auto", padding: "8px 10px", background: "#333" }}
                        onClick={() => nav(`/inventory-movements/new?variant_id=${v.id}`)}
                      >
                        Movement
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}