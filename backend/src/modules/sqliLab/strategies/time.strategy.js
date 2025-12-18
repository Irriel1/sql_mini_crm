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
      allowDbErrorInResponse: norm.mode === 'vuln',
      note:
        "Time-based: v DEMO vuln režimu zkus payload, který vyvolá SLEEP (např. %' OR IF(1=1,SLEEP(2),0) -- ). Sleduj durationMs.",
    };
  }
  
  module.exports = { buildPlan };
  