const logsDao = require("../dao/logsDao");

function buildMeta(req, meta) {
  // meta může být object/string/null
  const base = {
    ip: req.ip,
    ua: req.headers["user-agent"] || null,
    route: `${req.method} ${req.originalUrl}`,
  };

  // Když meta je objekt, složíme objekt (DAO ho stringifyne)
  if (meta && typeof meta === "object") {
    const merged = { ...base, ...meta };

    // jednoduchý size limit 
    try {
      const s = JSON.stringify(merged);
      if (s.length > 4000) return { ...base, note: "meta_truncated" };
    } catch {
      return base;
    }
    return merged;
  }

  // Když meta je string, zabalíme do objektu
  if (typeof meta === "string" && meta.trim()) {
    return { ...base, note: meta.trim() };
  }

  return base;
}

module.exports = function auditMiddleware(req, res, next) {
  req.audit = {
    /**
     * Best-effort audit log. Nikdy nesmí shodit request.
     * @param {{action: string, meta?: any}} payload
     */
    async commit({ action, meta } = {}) {
      try {
        if (!action) return;

        await logsDao.createLog({
          user_id: req.user?.id ?? null,
          action,
          meta: buildMeta(req, meta),
        });
      } catch (e) {
        console.warn("audit log failed:", e.message);
      }
    },
  };

  next();
};