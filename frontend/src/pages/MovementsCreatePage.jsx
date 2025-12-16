import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createMovement, createMovementDemo } from "../api/inventoryMovements";

export default function MovementCreatePage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const demo = sp.get("demo") === "1";

  const [form, setForm] = useState({
    variant_id: "",
    type: "IN",
    quantity: 1,
    note: "",
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function update(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const payload = {
        variant_id: Number(form.variant_id),
        type: form.type,
        quantity: Number(form.quantity),
        note: form.note,
      };

      const resp = demo
        ? await createMovementDemo(payload)
        : await createMovement(payload);

      const id = resp.data?.movement?.id;
      nav(id ? `/movements/${id}` : "/movements");
    } catch (e2) {
      setErr(e2?.response?.data?.error || e2.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 12 }}>New movement</div>

      {/* MODE TOGGLE */}
      <div className="form-group">
        <label className="input-label">Mode</label>
        <select
          className="input"
          value={demo ? "demo" : "safe"}
          onChange={(e) => {
            const isDemo = e.target.value === "demo";
            setSp((prev) => {
              const next = new URLSearchParams(prev);
              if (isDemo) next.set("demo", "1");
              else next.delete("demo");
              return next;
            });
          }}
        >
          <option value="safe">SAFE</option>
          <option value="demo">DEMO (vuln)</option>
        </select>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
          DEMO funguje jen když máš backend DEMO route + admin přístup.
        </div>
      </div>

      {err ? (
        <div style={{ color: "#991b1b", marginBottom: 12 }}>{err}</div>
      ) : null}

      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label className="input-label">Variant ID</label>
          <input
            className="input"
            value={form.variant_id}
            onChange={(e) => update("variant_id", e.target.value)}
            placeholder="e.g. 3"
            inputMode="numeric"
            required
          />
        </div>

        <div className="form-group">
          <label className="input-label">Type</label>
          <select
            className="input"
            value={form.type}
            onChange={(e) => update("type", e.target.value)}
          >
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
            <option value="ADJUST">ADJUST</option>
          </select>
        </div>

        <div className="form-group">
          <label className="input-label">Quantity</label>
          <input
            className="input"
            type="number"
            min={1}
            value={form.quantity}
            onChange={(e) => update("quantity", e.target.value)}
            required
          />
          {form.type === "ADJUST" ? (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
              ADJUST nastaví stock na zadanou hodnotu (není to +/−).
            </div>
          ) : null}
        </div>

        <div className="form-group">
          <label className="input-label">Note</label>
          <input
            className="input"
            value={form.note}
            onChange={(e) => update("note", e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Saving…" : "Create"}
          </button>

          <button
            className="button"
            type="button"
            onClick={() => nav("/movements")}
            disabled={loading}
            style={{ width: "auto", background: "#333" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}