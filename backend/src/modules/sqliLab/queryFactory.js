// queryFactory.js

function clampLimit(limit, fallback = 20) {
  const n = Number(limit ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(50, n));
}

/**
 * Options derived from pattern.
 * - time => deterministic single-row query
 * - union/error => ORDER BY 1 DESC (demo-friendly)
 * - boolean => default order
 */
function optionsFromPattern(pattern) {
  const p = String(pattern || "boolean");

  const deterministic = p === "time";
  const limitMode = deterministic ? "one" : "normal";
  const orderBy =
    p === "union" || p === "error"
      ? "1 DESC"
      : null; // null => use spec.defaultOrderBy

  return { deterministic, limitMode, orderBy };
}

/**
 * Target specs: the only place that knows table shapes.
 * Keep select column counts stable for UNION demo.
 */
const TARGET_SPECS = {
  items: {
    name: "items",
    selectColumns: ["id", "name", "category", "created_at"],
    fromClause: "FROM items",
    baseWhere: ["deleted_at IS NULL"],
    defaultOrderBy: "id DESC",
    deterministicWhere: "id = (SELECT MIN(id) FROM items)",
    search: {
      safe: (q) => ({ sql: "name LIKE ?", params: [`%${q}%`] }),
      vuln: (q) => `name LIKE '%${q}%'`,
    },
  },

  variants: {
    name: "variants",
    selectColumns: [
      "v.id",
      "v.sku",
      "v.variant_name",
      "v.price",
      "v.stock_count",
      "i.name AS item_name",
    ],
    fromClause: "FROM item_variants v JOIN items i ON i.id = v.item_id",
    baseWhere: [], // keep empty unless you need extra constraints
    defaultOrderBy: "v.id DESC",
    deterministicWhere: "v.id = (SELECT MIN(id) FROM item_variants)",
    search: {
      safe: (q) => ({ sql: "v.sku LIKE ?", params: [`%${q}%`] }),
      vuln: (q) => `v.sku LIKE '%${q}%'`,
    },
  },
};

function buildWhereParts({ spec, opts, mode, q }) {
  const parts = [];

  // base constraints (deleted_at etc.)
  for (const w of spec.baseWhere) parts.push(w);

  // deterministic: pin to MIN(id) to keep output stable for time-based demo
  if (opts.deterministic) parts.push(spec.deterministicWhere);

  // search / injection surface
  if (mode === "safe") {
    const s = spec.search.safe(q);
    parts.push(s.sql);
    return { whereSql: parts.join("\n  AND "), params: s.params };
  } else {
    const s = spec.search.vuln(q);
    parts.push(s);
    return { whereSql: parts.join("\n  AND "), params: [] };
  }
}

function buildQuery({ spec, mode, q, limit, opts }) {
  const safeLimit = clampLimit(limit);
  const effectiveLimit = opts.limitMode === "one" ? 1 : safeLimit;

  const orderBy = opts.orderBy || spec.defaultOrderBy;

  const { whereSql, params } = buildWhereParts({ spec, opts, mode, q });

  // In deterministic one-row mode, ORDER BY is not needed (but harmless).
  // Keep it off to reduce noise in logs.
  const orderBySql = opts.limitMode === "one" ? "" : `\nORDER BY ${orderBy}`;

  if (mode === "safe") {
    // safe => parameterized LIMIT
    const limitSql = opts.limitMode === "one" ? "\nLIMIT 1" : "\nLIMIT ?";

    return {
      sql: `
SELECT ${spec.selectColumns.join(", ")}
${spec.fromClause}
WHERE ${whereSql}${orderBySql}${limitSql}
      `.trim(),
      params: opts.limitMode === "one" ? params : [...params, effectiveLimit],
      meta: {
        target: spec.name,
        columns: spec.selectColumns.length,
      },
    };
  }

  // vuln => LIMIT interpolated (still clamped)
  const limitSql =
    opts.limitMode === "one" ? "\nLIMIT 1" : `\nLIMIT ${effectiveLimit}`;

  return {
    sql: `
SELECT ${spec.selectColumns.join(", ")}
${spec.fromClause}
WHERE ${whereSql}${orderBySql}${limitSql}
    `.trim(),
    params: [],
    meta: {
      target: spec.name,
      columns: spec.selectColumns.length,
    },
  };
}

function create({ pattern, target, mode, q, limit }) {
  const t = String(target || "");
  const m = String(mode || "safe");

  const spec = TARGET_SPECS[t];
  if (!spec) throw new Error("Unsupported pattern/target");

  const opts = optionsFromPattern(pattern);

  // q is already validated/normalized upstream
  const qStr = typeof q === "string" ? q : "";

  return buildQuery({
    spec,
    mode: m,
    q: qStr,
    limit,
    opts,
  });
}

module.exports = { create };