import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listItemVariants, deleteItemVariant } from "../api/variants";

export default function ItemVariantsPage() {
  const { itemId: itemIdParam } = useParams();
  const itemId = Number(itemIdParam);
  const nav = useNavigate();

  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    if (!Number.isFinite(itemId)) {
      setError("Invalid itemId in URL");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const rows = await listItemVariants(itemId);
      setVariants(rows);
    } catch (err) {
      setError(err.message || "Failed to load variants");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [itemIdParam]);

  async function onDelete(variantId) {
    if (!confirm("Delete variant?")) return;
    try {
      await deleteItemVariant(itemId, variantId);
      load();
    } catch (err) {
      alert(err.message || "Delete failed");
    }
  }

  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="items-page">
      <div className="items-header">
        <h1 className="items-title">Variants</h1>
        <p className="items-subtitle">Item ID: {itemId}</p>
      </div>

      <div className="items-toolbar">
        <div />
        <div className="items-actions">
          <button className="button button-secondary" onClick={() => nav(`/items/${itemId}`)}>
            ← Back to item
          </button>
          <button className="button" onClick={() => nav(`/items/${itemId}/variants/new`)}>
            + New variant
          </button>
        </div>
      </div>

      <div className="items-card">
        <div className="items-card-header">
          <span className="items-count">{variants.length} variants</span>
        </div>

        {/* Mobile list */}
        <div className="items-list">
          {variants.map((v) => (
            <div key={v.id} className="items-row">
              <div className="items-row-top">
                <span
                  className="items-row-name items-link"
                  onClick={() => nav(`/items/${itemId}/variants/${v.id}/edit`)}
                >
                  {v.sku}
                </span>

                <div className="items-row-actions">
                  <button
                    className="button button-sm button-secondary"
                    onClick={() => nav(`/items/${itemId}/variants/${v.id}/edit`)}
                  >
                    Edit
                  </button>
                  <button className="button button-sm" onClick={() => onDelete(v.id)}>
                    Delete
                  </button>
                </div>
              </div>

              <div className="items-row-meta">
                <span>{v.variant_name}</span>
                <span>Price: {v.price}</span>
                <span>Stock: {v.stock_count}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Price</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id}>
                  <td className="items-link" onClick={() => nav(`/items/${itemId}/variants/${v.id}/edit`)}>
                    {v.sku}
                  </td>
                  <td className="items-cell-muted">{v.variant_name}</td>
                  <td className="items-cell-muted">{v.price}</td>
                  <td className="items-cell-muted">{v.stock_count}</td>
                  <td>
                    <div className="items-row-actions">
                      <button
                        className="button button-sm button-secondary"
                        onClick={() => nav(`/items/${itemId}/variants/${v.id}/edit`)}
                      >
                        Edit
                      </button>
                      <button className="button button-sm" onClick={() => onDelete(v.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {variants.length === 0 && (
          <div style={{ padding: 16, color: "#6b7280", fontSize: 14 }}>
            No variants yet. Create one with <b>+ New variant</b>.
          </div>
        )}
      </div>
    </div>
  );
}
