import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMovement } from "../api/inventoryMovements";

export default function MovementDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [m, setM] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr("");
      try {
        const resp = await getMovement(id);
        if (cancelled) return;
        setM(resp.data.movement);
      } catch (e) {
        if (cancelled) return;
        setErr(e?.response?.data?.error || e.message || "Request failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontWeight: 700 }}>Movement #{id}</div>
        <button className="button" style={{ width: "auto" }} onClick={() => nav("/movements")}>
          Back
        </button>
      </div>

      {loading ? <div style={{ marginTop: 12 }}>Loading…</div> : null}
      {err ? <div style={{ marginTop: 12, color: "#991b1b" }}>{err}</div> : null}

      {m ? (
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <div><b>Type:</b> {m.type}</div>
          <div><b>Quantity:</b> {m.quantity}</div>
          <div><b>Variant:</b> {m.variant_id} {m.sku ? `(${m.sku})` : ""}</div>
          <div><b>User:</b> {m.user_name || m.user_id}</div>
          <div><b>Note:</b> {m.note || "-"}</div>
          <div><b>Created:</b> {m.created_at ? new Date(m.created_at).toLocaleString() : "-"}</div>
          {m.variant_name ? <div><b>Variant name:</b> {m.variant_name}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
