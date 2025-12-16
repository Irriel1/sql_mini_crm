import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getMovements, getMovementsDemo } from "../api/inventoryMovements";

export default function MovementsPage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  // Filters from URL (nice for sharing + debugging)
  const variant_id = sp.get("variant_id") || "";
  const type = sp.get("type") || "";
  const limit = sp.get("limit") || "50";
  const offset = sp.get("offset") || "0";
  const demo = sp.get("demo") === "1"; // optional

  const params = useMemo(() => {
    const p = {
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    };
    if (variant_id) p.variant_id = variant_id;
    if (type) p.type = type;
    return p;
  }, [variant_id, type, limit, offset]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");
      try {
        const resp = demo ? await getMovementsDemo(params) : await getMovements(params);
        if (cancelled) return;
        // controller vrací { movements, limit, offset }
        setRows(resp.data.movements || resp.data.rows || []);
      } catch (e) {
        if (cancelled) return;
        setErr(e?.response?.data?.error || e.message || "Request failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [params, demo]);

  function setFilter(next) {
    const nextSp = new URLSearchParams(sp);
    Object.entries(next).forEach(([k, v]) => {
      if (v === "" || v == null) nextSp.delete(k);
      else nextSp.set(k, String(v));
    });
    // reset pagination when filters change
    nextSp.set("offset", "0");
    setSp(nextSp);
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Movements</div>
          <button className="button" style={{ width: "auto" }} onClick={() => nav("/movements/new")}>
            + New movement
          </button>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <div className="form-group">
            <label className="input-label">Variant ID</label>
            <input
              className="input"
              value={variant_id}
              onChange={(e) => setFilter({ variant_id: e.target.value })}
              placeholder="e.g. 3"
              inputMode="numeric"
            />
          </div>

          <div className="form-group">
            <label className="input-label">Type</label>
            <select
              className="input"
              value={type}
              onChange={(e) => setFilter({ type: e.target.value })}
            >
              <option value="">All</option>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
              <option value="ADJUST">ADJUST</option>
            </select>
          </div>

          <div className="form-group">
            <label className="input-label">Limit</label>
            <select
              className="input"
              value={limit}
              onChange={(e) => setFilter({ limit: e.target.value })}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>

          {/* Optional DEMO toggle */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Mode</label>
            <select
              className="input"
              value={demo ? "demo" : "safe"}
              onChange={(e) => setFilter({ demo: e.target.value === "demo" ? "1" : "" })}
            >
              <option value="safe">SAFE</option>
              <option value="demo">DEMO (vuln)</option>
            </select>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
              DEMO funguje jen když máš backend DEMO route a admin přístup.
            </div>
          </div>
        </div>
      </div>

      {err ? (
        <div className="card" style={{ borderColor: "#fecaca" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Error</div>
          <div style={{ color: "#991b1b" }}>{err}</div>
        </div>
      ) : null}

      <div className="card">
        {loading ? (
          <div>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No movements found.</div>
        ) : (
          <ul className="dashboard-list">
            {rows.map((m) => (
              <li
                key={m.id}
                className="dashboard-list-item"
                style={{ cursor: "pointer" }}
                onClick={() => nav(`/movements/${m.id}`)}
              >
                <div>
                  <div className="dashboard-list-main">
                    #{m.id} • {m.type} • qty {m.quantity}
                  </div>
                  <div className="dashboard-list-meta">
                    variant {m.variant_id}
                    {m.sku ? ` • ${m.sku}` : ""}
                    {m.user_name ? ` • by ${m.user_name}` : ""}
                    {m.created_at ? ` • ${new Date(m.created_at).toLocaleString()}` : ""}
                  </div>
                </div>
                <div style={{ color: "#6b7280", fontSize: 12 }}>›</div>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            className="button"
            style={{ width: "auto" }}
            disabled={Number(offset) <= 0}
            onClick={() => setFilter({ offset: String(Math.max(0, Number(offset) - Number(limit))) })}
          >
            Prev
          </button>
          <button
            className="button"
            style={{ width: "auto" }}
            disabled={rows.length < Number(limit)}
            onClick={() => setFilter({ offset: String(Number(offset) + Number(limit)) })}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}