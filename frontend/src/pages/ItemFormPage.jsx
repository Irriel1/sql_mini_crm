import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createItem, updateItem, getItem } from "../api/items";

export default function ItemFormPage({ mode }) {
  const { id } = useParams();
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (mode !== "edit") return;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const item = await getItem(id);
        setForm({
          name: item.name || "",
          category: item.category || "",
          description: item.description || "",
        });
      } catch (err) {
        setError(err.message || "Failed to load item");
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, id]);

  function onChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      if (mode === "create") {
        const item = await createItem(form);
        nav(`/items/${item.id}`);
      } else {
        const item = await updateItem(id, form);
        nav(`/items/${item.id}`);
      }
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div className="item-form-page">
      {/* Header */}
      <div className="item-form-header">
        <h1 className="item-form-title">{mode === "create" ? "New Item" : "Edit Item"}</h1>
        <p className="item-form-subtitle">
          {mode === "create" ? "Create a new item in your inventory." : `Editing item ID: ${id}`}
        </p>
      </div>

      {/* Card */}
      <div className="item-form-card">
        <div className="item-form-card-header">
          <span className="item-form-card-title">Item details</span>
          <div className="item-form-top-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => nav(-1)}
              disabled={saving}
            >
              ← Back
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <div className="item-form-body">
            <div className="form-group">
              <label className="input-label" htmlFor="name">Name</label>
              <input
                id="name"
                className="input"
                name="name"
                value={form.name}
                onChange={onChange}
                required
                placeholder="e.g., iPhone 15"
              />
              <div className="form-hint">Required.</div>
            </div>

            <div className="form-group">
              <label className="input-label" htmlFor="category">Category</label>
              <input
                id="category"
                className="input"
                name="category"
                value={form.category}
                onChange={onChange}
                placeholder="e.g., phones"
              />
              <div className="form-hint">Optional.</div>
            </div>

            <div className="form-group item-form-span-2">
              <label className="input-label" htmlFor="description">Description</label>
              <textarea
                id="description"
                className="textarea"
                name="description"
                value={form.description}
                onChange={onChange}
                placeholder="Short description…"
              />
              <div className="form-hint">Optional, shown in lists.</div>
            </div>

            {error && (
              <div className="item-form-span-2 form-error">
                {error}
              </div>
            )}
          </div>

          <div className="item-form-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => nav(-1)}
              disabled={saving}
            >
              Cancel
            </button>
            <button className="button" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
