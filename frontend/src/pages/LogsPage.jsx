import { useEffect, useMemo, useState } from "react";
import { getLogs, getLog } from "../api/logs";

export default function LogsPage() {
  const [filters, setFilters] = useState({
    action: "",
    user_id: "",
    date_from: "",
    date_to: "",
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");

  const params = useMemo(() => {
    const p = {};
    if (filters.action.trim()) p.action = filters.action.trim();
    if (filters.user_id.trim()) p.user_id = filters.user_id.trim();
    if (filters.date_from) p.date_from = filters.date_from;
    if (filters.date_to) p.date_to = filters.date_to;
    return p;
  }, [filters]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const data = await getLogs(params);
        const logs = data?.logs ?? [];
        if (alive) {
          setRows(Array.isArray(logs) ? logs : []);
          // při refetchi klidně zavřeme detail
          setSelectedId(null);
          setSelectedLog(null);
        }
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || e.message || "Failed to load logs");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [params]);

  async function openDetail(id) {
    setSelectedId(id);
    setSelectedLog(null);
    setDetailErr("");
    setDetailLoading(true);

    try {
      const data = await getLog(id);
      // očekávám { log: {...} }, ale kdyby BE poslal rovnou objekt, tak ošetříme
      const logObj = data?.log ?? data ?? null;
      setSelectedLog(logObj);
    } catch (e) {
      setDetailErr(e?.response?.data?.error || e.message || "Failed to load log detail");
    } finally {
      setDetailLoading(false);
    }
  }

  function onChange(e) {
    const { name, value } = e.target;
    setFilters((s) => ({ ...s, [name]: value }));
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="dashboard-section">
        <div className="dashboard-section-title">Logs</div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="input-label">Action</label>
              <input
                className="input"
                name="action"
                value={filters.action}
                onChange={onChange}
                placeholder="e.g. ITEM_CREATE"
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="input-label">User ID</label>
              <input
                className="input"
                name="user_id"
                value={filters.user_id}
                onChange={onChange}
                placeholder="e.g. 1"
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="input-label">Date from</label>
              <input
                className="input"
                type="date"
                name="date_from"
                value={filters.date_from}
                onChange={onChange}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="input-label">Date to</label>
              <input
                className="input"
                type="date"
                name="date_to"
                value={filters.date_to}
                onChange={onChange}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr" }}>
        <div className="dashboard-section">
          <div className="dashboard-section-title">Results</div>

          {loading && <div className="dashboard-empty">Loading…</div>}
          {err && <div className="dashboard-empty" style={{ color: "crimson" }}>{err}</div>}

          {!loading && !err && rows.length === 0 && (
            <div className="dashboard-empty">No logs found.</div>
          )}

          {!loading && !err && rows.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: 13, color: "#555" }}>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Time</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Action</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>User ID</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Entity</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Entity ID</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => openDetail(r.id)}
                      style={{
                        fontSize: 14,
                        cursor: "pointer",
                        background: selectedId === r.id ? "#fafafa" : "transparent",
                      }}
                    >
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>
                        {r.action || "-"}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>
                        {r.user_id ?? "-"}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>
                        {r.entity_type || r.entity || "-"}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>
                        {r.entity_id ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                Tip: klikni na řádek pro detail.
              </div>
            </div>
          )}
        </div>

        <div className="dashboard-section">
          <div className="dashboard-section-title">Detail</div>

          {!selectedId && <div className="dashboard-empty">Select a log row.</div>}

          {selectedId && detailLoading && <div className="dashboard-empty">Loading detail…</div>}
          {selectedId && detailErr && (
            <div className="dashboard-empty" style={{ color: "crimson" }}>{detailErr}</div>
          )}

          {selectedId && !detailLoading && !detailErr && selectedLog && (
            <div style={{ display: "grid", gap: 10 }}>
              <div><b>ID:</b> {selectedLog.id ?? selectedId}</div>
              <div><b>Time:</b> {selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString() : "-"}</div>
              <div><b>Action:</b> {selectedLog.action || "-"}</div>
              <div><b>User:</b> {selectedLog.user_id ?? "-"}</div>
              <div><b>Entity:</b> {selectedLog.entity_type || selectedLog.entity || "-"}</div>
              <div><b>Entity ID:</b> {selectedLog.entity_id ?? "-"}</div>

              <div>
                <b>Meta:</b>
                <pre style={{ marginTop: 6, padding: 10, background: "#f7f7f7", borderRadius: 8, overflowX: "auto" }}>
                  {selectedLog.meta ? JSON.stringify(selectedLog.meta, null, 2) : "null"}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
