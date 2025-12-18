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
      // řekne service, že v error/vuln chceme vracet DB error detail
      allowDbErrorInResponse: norm.mode === 'vuln',
      note:
        "Error-based: v DEMO vuln režimu zkus payloady, které vyvolají SQL error (např. špatný počet sloupců v UNION nebo neexistující sloupec).",
    };
  }
  
  module.exports = { buildPlan };