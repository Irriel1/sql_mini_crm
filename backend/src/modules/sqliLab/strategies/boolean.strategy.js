function buildPlan(norm) {
    return {
      factoryInput: {
        pattern: norm.pattern,
        target: norm.target,
        mode: norm.mode,
        q: norm.q,
        limit: norm.limit,
        delayMs: norm.delayMs,
      },
      note:
        "Boolean-based: v DEMO vuln režimu porovnej %' AND 1=1 --  vs  %' AND 1=2 --  (rowCount se musí lišit).",
    };
  }
  
  module.exports = { buildPlan };
  