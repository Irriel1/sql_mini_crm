import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createItemVariant } from "../api/variants";

export default function VariantFormPage({ mode = "create" }) {
  const { itemId } = useParams();
  const nav = useNavigate();

  const parsedItemId = Number(itemId);

  const [form, setForm] = useState({
    sku: "",
    variant_name: "",
    price: "",
    stock_count: 0,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function onChange(e) {
    const { name, value } = e.target;

    // stock_count držíme jako number
    if (name === "stock_count") {
      setForm((prev) => ({ ...prev, [name]: value === "" ? "" : Number(value) }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();

    if (!Number.isFinite(parsedItemId)) {
      setError("Invalid itemId in URL");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // normalize payload
      const payload = {
        sku: form.sku.trim(),
        variant_name: form.variant_name.trim(),
        price: String(form.price).trim(), // backend často bere "19990.00"
        stock_count: Number(form.stock_count) || 0,
      };

      // základní validace
      if (!payload.sku) throw new Error("SKU is required");
      if (!payload.variant_name) throw new Error("Variant name is required");

      await createItemVariant(parsedItemId, payload);

      // zpět na list variant
      nav(`/items/${parsedItemId}/variants`);
    } catch (err) {
      setError(err.message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="item-form-page">
      <div className="item-form-header">
        <h1 className="item-form-title">
          {mode === "create" ? "New Variant" : "Edit Variant"}
        </h1>
        <p className="item-form-subtitle">Item ID: {parsedItemId}</p>
      </div>

      <div className="item-form-card">
        <div className="item-form-card-header">
          <span className="item-form-card-title">Variant details</span>
          <div className="item-form-top-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => nav(`/items/${parsedItemId}/variants`
              )}
              disabled={saving}
            >
              ← Back
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <div className="item-form-body">
            <div className="form-group">
              <label className="input-label" htmlFor="sku">SKU</label>
              <input
                id="sku"
                className="input"
                name="sku"
                value={form.sku}
                onChange={onChange}
                required
                placeholder="e.g., IPH15-BLK-128"
              />
              <div className="form-hint">Required, must be unique.</div>
            </div>

            <div className="form-group">
              <label className="input-label" htmlFor="variant_name">Variant name</label>
              <input
                id="variant_name"
                className="input"
                name="variant_name"
                value={form.variant_name}
                onChange={onChange}
                required
                placeholder="e.g., iPhone 15 – Black 128GB"
              />
              <div className="form-hint">Required, displayed to users.</div>
            </div>

            <div className="form-group">
              <label className="input-label" htmlFor="price">Price</label>
              <input
                id="price"
                className="input"
                name="price"
                value={form.price}
                onChange={onChange}
                inputMode="decimal"
                placeholder="e.g., 19990.00"
              />
              <div className="form-hint">Optional (string/decimal).</div>
            </div>

            <div className="form-group">
              <label className="input-label" htmlFor="stock_count">Stock count</label>
              <input
                id="stock_count"
                className="input"
                name="stock_count"
                type="number"
                min="0"
                step="1"
                value={form.stock_count}
                onChange={onChange}
              />
              <div className="form-hint">Initial stock (temporary). Later we’ll do movements.</div>
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
              onClick={() => nav(`/items/${parsedItemId}/variants`)}
              disabled={saving}
            >
              Cancel
            </button>
            <button className="button" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Create variant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
