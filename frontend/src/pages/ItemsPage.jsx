import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listItems, deleteItem } from "../api/items";

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const nav = useNavigate();

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const rows = await listItems();
      setItems(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onDelete(id) {
    if (!confirm("Delete item? This will remove all variants.")) return;
    try {
      await deleteItem(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="items-page">
      {/* HEADER */}
      <div className="items-header">
        <h1 className="items-title">Items</h1>
        <p className="items-subtitle">Manage items and related variants</p>
      </div>

      {/* TOOLBAR */}
      <div className="items-toolbar">
        <div />
        <div className="items-actions">
          <button className="button" onClick={() => nav("/items/new")}>
            + New item
          </button>
        </div>
      </div>

      {/* LIST CARD */}
      <div className="items-card">
        <div className="items-card-header">
          <span className="items-count">{items.length} items</span>
        </div>

        {/* MOBILE LIST */}
        <div className="items-list">
          {items.map((i) => (
            <div key={i.id} className="items-row">
              <div className="items-row-top">
                <span
                  className="items-row-name items-link"
                  onClick={() => nav(`/items/${i.id}`)}
                >
                  {i.name}
                </span>

                <div className="items-row-actions">
                  <button
                    className="button button-sm button-secondary"
                    onClick={() => nav(`/items/${i.id}/variants`)}
                  >
                    Variants
                  </button>

                  <button
                    className="button button-sm button-secondary"
                    onClick={() => nav(`/items/${i.id}/edit`)}
                  >
                    Edit
                  </button>

                  <button className="button button-sm" onClick={() => onDelete(i.id)}>
                    Delete
                  </button>
                </div>
              </div>

              <div className="items-row-meta">
                <span>{i.category || "-"}</span>
                <span>{i.description || "-"}</span>
              </div>
            </div>
          ))}
        </div>

        {/* DESKTOP TABLE */}
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Description</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td
                    className="items-link"
                    onClick={() => nav(`/items/${i.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    {i.name}
                  </td>
                  <td className="items-cell-muted">{i.category || "-"}</td>
                  <td className="items-cell-muted">{i.description || "-"}</td>
                  <td>
                    <div className="items-row-actions">
                      <button
                        className="button button-sm button-secondary"
                        onClick={() => nav(`/items/${i.id}/variants`)}
                      >
                        Variants
                      </button>

                      <button
                        className="button button-sm button-secondary"
                        onClick={() => nav(`/items/${i.id}/edit`)}
                      >
                        Edit
                      </button>

                      <button className="button button-sm" onClick={() => onDelete(i.id)}>
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
        {items.length === 0 && (
          <div style={{ padding: 16, color: "#6b7280", fontSize: 14 }}>
            No items yet. Create your first one with <b>+ New item</b>.
          </div>
        )}
      </div>
    </div>
  );
}
