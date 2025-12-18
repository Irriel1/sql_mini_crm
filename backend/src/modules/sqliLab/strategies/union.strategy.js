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
        "UNION-based: v DEMO vuln režimu zkus zavřít string a přidat UNION SELECT se stejným počtem sloupců.",
    };
  }
  
  module.exports = { buildPlan };  