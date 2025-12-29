import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../context/SettingsContext.jsx";

export default function SettingsPanel({ open, onClose }) {
  const { settings, isLoading, error, reload, updateSettings } = useSettings();

  const [isSaving, setIsSaving] = useState(false);
  const [localErr, setLocalErr] = useState("");

  const [form, setForm] = useState({
    warehouse_name: "",
    currency: "CZK",
    low_stock_threshold: 10,
  });

  const overlayStyle = useMemo(
    () => ({
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.35)",
      display: open ? "block" : "none",
      zIndex: 1000,
    }),
    [open]
  );

  const panelStyle = useMemo(
    () => ({
      position: "fixed",
      top: 0,
      right: 0,
      height: "100vh",
      width: "min(380px, 92vw)",
      background: "white",
      borderLeft: "1px solid #e5e7eb",
      transform: open ? "translateX(0)" : "translateX(100%)",
      transition: "transform 160ms ease",
      zIndex: 1001,
      display: "flex",
      flexDirection: "column",
    }),
    [open]
  );

  // Když se panel otevře:
  // - pokud settings nejsou načtené, zkus reload
  // - syncni form z global settings
  useEffect(() => {
    if (!open) return;

    setLocalErr("");

    if (!settings && !isLoading) {
      reload();
    }

    setForm({
      warehouse_name: settings?.warehouse_name ?? "",
      currency: settings?.currency ?? "CZK",
      low_stock_threshold: Number.isFinite(Number(settings?.low_stock_threshold))
        ? Number(settings.low_stock_threshold)
        : 10,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function setField(key, value) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function onSave() {
    setLocalErr("");

    const threshold = Number(form.low_stock_threshold);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100000) {
      setLocalErr("low_stock_threshold must be a number between 0 and 100000");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        warehouse_name: String(form.warehouse_name ?? "").trim(),
        currency: String(form.currency ?? "CZK").trim(),
        low_stock_threshold: threshold,
      };

      await updateSettings(payload); // ✅ update global state
      onClose?.();
    } catch (e) {
      setLocalErr(e?.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  const errToShow = localErr || error;

  if (!open) return null;

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />

      <div style={panelStyle} role="dialog" aria-modal="true">
        <div
          style={{
            padding: 14,
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16 }}>Settings</div>
          <button
            className="button"
            type="button"
            onClick={onClose}
            style={{ width: "auto", padding: "8px 10px" }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: 14, overflowY: "auto" }}>
          {errToShow ? (
            <div
              style={{
                border: "1px solid #ef4444",
                background: "#fef2f2",
                padding: 10,
                borderRadius: 6,
                marginBottom: 12,
                fontSize: 14,
              }}
            >
              {errToShow}
            </div>
          ) : null}

          {isLoading && !settings ? (
            <div style={{ opacity: 0.75 }}>Loading...</div>
          ) : (
            <>
              <div className="form-group">
                <label className="input-label">Warehouse name</label>
                <input
                  className="input"
                  value={form.warehouse_name}
                  onChange={(e) => setField("warehouse_name", e.target.value)}
                  placeholder="Main warehouse"
                />
              </div>

              <div className="form-group">
                <label className="input-label">Currency</label>
                <select
                  className="input"
                  value={form.currency}
                  onChange={(e) => setField("currency", e.target.value)}
                >
                  <option value="CZK">CZK</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                  Použije se pro formátování cen (např. variants.price) napříč UI.
                </div>
              </div>

              <div className="form-group">
                <label className="input-label">Low stock threshold</label>
                <input
                  className="input"
                  type="number"
                  value={form.low_stock_threshold}
                  onChange={(e) => setField("low_stock_threshold", e.target.value)}
                  placeholder="10"
                />
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                  Když je stock_count &lt;= threshold, můžeš v UI zvýraznit “low stock”.
                </div>
              </div>
            </>
          )}
        </div>

        <div
          style={{
            padding: 14,
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            gap: 10,
          }}
        >
          <button
            className="button"
            type="button"
            onClick={onSave}
            disabled={isSaving || (isLoading && !settings)}
            style={{
              opacity: isSaving || (isLoading && !settings) ? 0.6 : 1,
              pointerEvents: isSaving || (isLoading && !settings) ? "none" : "auto",
            }}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>

          <button
            className="button"
            type="button"
            onClick={onClose}
            style={{
              background: "white",
              color: "black",
              border: "1px solid #e5e7eb",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}