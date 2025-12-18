import { useMemo, useState } from "react";
import { runSqliDemo } from "../api/sqliDemo";
import {
  SQLI_PRESETS,
  MODE_OPTIONS,
  PATTERN_OPTIONS,
  TARGET_OPTIONS,
} from "../constants/sqliPresets";

function prettyJson(v) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function msToHuman(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function parseApiErrorStatus(error) {
  // client.js hází: "API error 403: ..."
  const msg = error?.message || "";
  const m = msg.match(/API error\s+(\d{3})/i);
  return m ? Number(m[1]) : null;
}

function makeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function SqliDemoPage() {
  const defaultPreset = SQLI_PRESETS.find((p) => p.id === "time-sleep-2") || SQLI_PRESETS[0];

  const [activePresetId, setActivePresetId] = useState(defaultPreset.id);
  const [form, setForm] = useState({
    mode: defaultPreset.mode,
    pattern: defaultPreset.pattern,
    target: defaultPreset.target,
    payload: defaultPreset.payload,
    durationMs: defaultPreset.durationMs ?? "",
  });

  const [isRunning, setIsRunning] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [lastRun, setLastRun] = useState(null);
  const [history, setHistory] = useState([]);

  const canRun =
    String(form.payload || "").trim().length > 0 &&
    MODE_OPTIONS.includes(form.mode) &&
    PATTERN_OPTIONS.includes(form.pattern) &&
    TARGET_OPTIONS.includes(form.target);

  const chips = useMemo(() => {
    return SQLI_PRESETS.map((p) => {
      const active = p.id === activePresetId;
      return (
        <button
          key={p.id}
          type="button"
          className="button"
          onClick={() => {
            setActivePresetId(p.id);
            setForm({
              mode: p.mode,
              pattern: p.pattern,
              target: p.target,
              payload: p.payload,
              durationMs: p.durationMs ?? "",
            });
            setInlineError("");
          }}
          style={{
            padding: "8px 10px",
            borderRadius: 999,
            background: active ? "black" : "white",
            color: active ? "white" : "black",
            border: "1px solid #e5e7eb",
            width: "auto",
          }}
          title={p.note}
        >
          <span style={{ fontWeight: 700 }}>{p.label}</span>
          <span style={{ marginLeft: 8, fontSize: 12, opacity: active ? 0.9 : 0.7 }}>
            {p.pattern} · {p.target}
          </span>
        </button>
      );
    });
  }, [activePresetId]);

  async function onRun() {
    setInlineError("");
    setIsRunning(true);

    const requestBody = {
      mode: form.mode,
      pattern: form.pattern,
      target: form.target,
      payload: form.payload,
      ...(String(form.durationMs).trim() !== "" ? { durationMs: Number(form.durationMs) } : {}),
    };

    const t0 = performance.now();

    try {
      const response = await runSqliDemo(requestBody);
      const t1 = performance.now();

      const run = {
        id: makeId(),
        ts: Date.now(),
        request: requestBody,
        response,
        clientDurationMs: Math.round(t1 - t0),
      };

      setLastRun(run);
      setHistory((prev) => [run, ...prev].slice(0, 20));

      // mobil UX: scroll na výsledek
      setTimeout(() => {
        const el = document.getElementById("sqli-result");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e) {
      const status = parseApiErrorStatus(e);
      const msg = e?.message || "Request failed";

      if (status === 401 || status === 403) {
        setInlineError(`Admin only (${status}). ${msg}`);
      } else {
        setInlineError(msg);
      }
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card">
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
          SQL Injection Demo
        </div>
        <div style={{ fontSize: 14, opacity: 0.75 }}>
          Preset payloady + měření (server/client) + zobrazení odpovědi z <code>/api/sqli-demo/run</code>.
        </div>
      </div>

      {/* Presets */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Presets</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{chips}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
          Preset pouze vyplní formulář — payload můžeš kdykoli upravit ručně.
        </div>
      </div>

      {/* Form + Result */}
      <div className="dashboard-grid" style={{ alignItems: "start" }}>
        {/* FORM */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Run</div>

          {inlineError ? (
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
              {inlineError}
            </div>
          ) : null}

          <div className="form-group">
            <label className="input-label">Mode</label>
            <select
              className="input"
              value={form.mode}
              onChange={(e) => setForm((p) => ({ ...p, mode: e.target.value }))}
            >
              {MODE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="input-label">Pattern</label>
            <select
              className="input"
              value={form.pattern}
              onChange={(e) => setForm((p) => ({ ...p, pattern: e.target.value }))}
            >
              {PATTERN_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="input-label">Target</label>
            <select
              className="input"
              value={form.target}
              onChange={(e) => setForm((p) => ({ ...p, target: e.target.value }))}
            >
              {TARGET_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="input-label">Payload</label>
            <input
              className="input"
              value={form.payload}
              onChange={(e) => setForm((p) => ({ ...p, payload: e.target.value }))}
              placeholder="např. %' OR IF(1=1,SLEEP(2),0) -- "
            />
          </div>

          <div className="form-group">
            <label className="input-label">durationMs (optional)</label>
            <input
              className="input"
              type="number"
              value={form.durationMs}
              onChange={(e) => setForm((p) => ({ ...p, durationMs: e.target.value }))}
              placeholder="např. 2000"
            />
          </div>

          <button
            className="button"
            type="button"
            onClick={onRun}
            disabled={!canRun || isRunning}
            style={{
              opacity: !canRun || isRunning ? 0.6 : 1,
              pointerEvents: !canRun || isRunning ? "none" : "auto",
              marginTop: 6,
            }}
          >
            {isRunning ? "Running..." : "Run"}
          </button>
        </div>

        {/* RESULT */}
        <div className="card" id="sqli-result">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Result</div>

          {!lastRun ? (
            <div style={{ fontSize: 14, opacity: 0.75 }}>
              Zatím nic neběželo. Vyber preset a klikni Run.
            </div>
          ) : (
            <>
              <div className="dashboard-grid" style={{ marginBottom: 12 }}>
                <div className="dashboard-card">
                  <div className="dashboard-card-label">Server duration</div>
                  <div className="dashboard-card-value">
                    {msToHuman(lastRun.response?.durationMs)}
                  </div>
                </div>
                <div className="dashboard-card">
                  <div className="dashboard-card-label">Client duration</div>
                  <div className="dashboard-card-value">
                    {msToHuman(lastRun.clientDurationMs)}
                  </div>
                </div>
                <div className="dashboard-card">
                  <div className="dashboard-card-label">Row count</div>
                  <div className="dashboard-card-value">
                    {lastRun.response?.rowCount ?? "—"}
                  </div>
                </div>
              </div>

              {lastRun.response?.error ? (
                <div
                  style={{
                    border: "1px solid #ef4444",
                    background: "#fef2f2",
                    padding: 10,
                    borderRadius: 6,
                    marginBottom: 12,
                    fontSize: 14,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  <strong>Error:</strong> {String(lastRun.response.error)}
                </div>
              ) : null}

              {Array.isArray(lastRun.response?.dataPreview) &&
              lastRun.response.dataPreview.length > 0 ? (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>dataPreview</div>
                  <div className="dashboard-list">
                    {lastRun.response.dataPreview.slice(0, 5).map((row, idx) => (
                      <div key={idx} className="dashboard-list-item">
                        <div className="dashboard-list-main">
                          <div style={{ fontWeight: 700 }}>Row #{idx + 1}</div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            {Object.keys(row || {}).join(", ")}
                          </div>
                        </div>
                        <div className="dashboard-list-meta" style={{ fontSize: 12 }}>
                          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                            {prettyJson(row)}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div style={{ fontWeight: 700, marginBottom: 8 }}>Raw response</div>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  overflowX: "auto",
                  fontSize: 12,
                }}
              >
                {prettyJson(lastRun.response)}
              </pre>
            </>
          )}
        </div>
      </div>

      {/* HISTORY */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>History</div>
        {!history.length ? (
          <div style={{ fontSize: 14, opacity: 0.75 }}>Prázdné.</div>
        ) : (
          <div className="dashboard-list">
            {history.map((h) => (
              <div
                key={h.id}
                className="dashboard-list-item"
                style={{ cursor: "pointer" }}
                onClick={() => setLastRun(h)}
                title="Klikni pro otevření jako poslední výsledek"
              >
                <div className="dashboard-list-main">
                  <div style={{ fontWeight: 800 }}>
                    {h.request.pattern} · {h.request.target} · {h.request.mode}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {new Date(h.ts).toLocaleString()}
                  </div>
                </div>
                <div className="dashboard-list-meta" style={{ fontSize: 12 }}>
                  <div>server: {msToHuman(h.response?.durationMs)}</div>
                  <div>client: {msToHuman(h.clientDurationMs)}</div>
                  <div>rows: {h.response?.rowCount ?? "—"}</div>
                  {h.response?.error ? <div style={{ color: "#b91c1c" }}>error</div> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
