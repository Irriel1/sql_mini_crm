# Manual scenario: Error-based SQL Injection v SQLi Labu

Datum ověření: 2026-11-06

Účel scénáře: připravit podklady pro ruční demonstraci Error-based SQL Injection v modelové aplikaci Simple Inventory CRM.

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
  "pattern": "error",
  "target": "variants",
  "limit": 20
}
```

Target `variants` byl zvolen kvůli návaznosti na předchozí boolean/union scénáře a kvůli seedovaným hodnotám `SQLI-LOWSTOCK` a `SQLI-UNION-1`, které umožňují jasný pozitivní kontrolní test.

V odpovědi sledujeme zejména:

- `requestedMode` - režim požadovaný klientem,
- `mode` - skutečně použitý režim po validaci a kontrole `DEMO_VULN`,
- `pattern` - použitá strategie SQLi Labu,
- `target` - testovaná datová oblast,
- `rowCount` - počet vrácených řádků,
- `dataPreview` - ukázku vrácených dat,
- `error` - databázovou nebo aplikačně zabalenou chybu,
- `durationMs` - dobu zpracování requestu na backendu,
- `note` - vysvětlující poznámku strategie.

Při ověření se v API odpovědi neobjevila samostatná pole typu `errorCode`, `sqlState` nebo `sqlMessage`. Detail databázové chyby je u error strategie vrácen v poli `error`.

## Implementační místo

Relevantní soubory:

```text
backend/src/modules/sqliLab/sqliLab.router.js
backend/src/modules/sqliLab/validators.js
backend/src/modules/sqliLab/queryFactory.js
backend/src/modules/sqliLab/strategies/error.strategy.js
backend/src/modules/sqliLab/SqliLabService.js
```

Router potvrzuje admin-only přístup a zapnutí modulu přes `DEMO_SQLI_LAB`:

```js
router.post('/run',
  authMiddleware,
  requireRole('admin'),
  (req, res, next) => {
    if (!DEMO_SQLI_LAB) return res.status(404).json({ error: 'Not found' });
    return next();
  },
  async (req, res) => {
    const result = await run({ user: req.user, input: req.body });
    res.json(result);
  }
);
```

Validátor potvrzuje povolené patterny, targety, režimy a mapování pole `payload` na interní hodnotu `q`:

```js
const PATTERNS = new Set(['boolean', 'union', 'error', 'time']);
const TARGETS = new Set(['items', 'variants', 'users']);
const MODES = new Set(['safe', 'vuln']);

const mode =
  requestedMode === 'vuln' && DEMO_VULN
    ? 'vuln'
    : 'safe';

const qRaw =
  typeof input.payload === 'string'
    ? input.payload
    : typeof input.q === 'string'
      ? input.q
      : '';
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

Interpretace rozdílu:

- `safe` větev používá placeholder `?` a payload předává jako datovou hodnotu v `params`,
- `vuln` větev vkládá payload přímo do textu SQL dotazu,
- u error-based scénáře proto může payload ve vuln režimu narušit syntaxi nebo sémantiku SQL dotazu.

Strategie `error` povoluje ve zranitelném režimu vrácení detailu databázové chyby do odpovědi:

```js
function buildPlan(norm) {
  return {
    factoryInput: {
      pattern: norm.pattern,
      target: norm.target,
      mode: norm.mode,
      q: norm.q ?? '',
      limit: norm.limit,
    },
    allowDbErrorInResponse: norm.mode === 'vuln',
    note:
      "Error-based: v DEMO vuln režimu zkus payloady, které vyvolají SQL error (např. špatný počet sloupců v UNION nebo neexistující sloupec).",
  };
}
```

`SqliLabService` databázovou chybu zachytí a vrátí ji jako součást JSON odpovědi. Chybové requesty proto v aktuální implementaci nekončí HTTP 500, ale HTTP 200 s vyplněným polem `error`:

```js
try {
  const query = create(plan.factoryInput);
  const rowsRaw = await runQueryWithHardTimeout(query.sql, query.params, 12000);
  rows = Array.isArray(rowsRaw) ? rowsRaw.slice(0, 20) : [];
} catch (err) {
  const msg = err?.message ? String(err.message) : 'Query failed';
  const allowDetail = Boolean(plan.allowDbErrorInResponse);

  errOut = allowDetail ? msg.slice(0, 300) : 'Query failed';
}
```

## Testovací requesty

### A. Kontrolní pozitivní vstup ve zranitelném režimu

Význam: ověřuje běžné neútočné vyhledávání nad existujícími seedovanými daty.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "error",
  "target": "variants",
  "payload": "SQLI",
  "limit": 20
}
```

### B. Rušivý vstup se samostatnou uvozovkou ve zranitelném režimu

Význam: ověřuje, zda samostatná uvozovka naruší SQL syntaxi ve zranitelné větvi. Tento krok je indikace problému, ale hlavním důkazem scénáře je až kontrolovaná databázová chyba v dalších krocích.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "error",
  "target": "variants",
  "payload": "'",
  "limit": 20
}
```

### C. Kontrolovaná error-based injekce přes neexistující sloupec

Význam: payload se ve zranitelném režimu stane součástí SQL výrazu a vyvolá sémantickou chybu databáze kvůli odkazu na neexistující sloupec.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "error",
  "target": "variants",
  "payload": "NONMATCH%' AND not_a_column = 1 -- ",
  "limit": 20
}
```

### D. Alternativní error payload přes neexistující funkci

Význam: druhý čtecí payload vyvolá kontrolovanou databázovou chybu bez destruktivní operace a bez změny dat.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "error",
  "target": "variants",
  "payload": "NONMATCH%' AND definitely_not_existing_function(1)=1 -- ",
  "limit": 20
}
```

### E. Stejný hlavní error payload v bezpečném režimu

Význam: ověřuje, že safe režim stejný payload neinterpretuje jako SQL syntaxi, ale jako hledaný text.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "safe",
  "pattern": "error",
  "target": "variants",
  "payload": "NONMATCH%' AND not_a_column = 1 -- ",
  "limit": 20
}
```

### F. Běžný neexistující text ve zranitelném režimu

Význam: odlišuje běžný prázdný výsledek od skutečné databázové chyby.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "error",
  "target": "variants",
  "payload": "NONMATCH",
  "limit": 20
}
```

## Naměřené výsledky

Test byl spuštěn proti lokálnímu backendu:

```text
http://127.0.0.1:4000
```

Poznámka: testovací requesty nemění seedovaná aplikační data. Standardní přihlášení admina pro získání tokenu může vytvořit audit log, stejně jako běžné používání aplikace. Token ani lokální secrets nejsou v dokumentu uvedené.

| Testovací krok | Režim | Payload | HTTP status | rowCount | Chyba | Pozorovaný výsledek |
| --- | --- | --- | ---: | ---: | --- | --- |
| A - kontrolní pozitivní vstup | vuln | `SQLI` | 200 | 2 | `null` | `durationMs=2`; běžné vyhledávání vrátilo seedované varianty `SQLI-LOWSTOCK` a `SQLI-UNION-1`. |
| B - samostatná uvozovka | vuln | `'` | 200 | 0 | `You have an error in your SQL syntax...` | `durationMs=2`; uvozovka narušila SQL syntaxi ve zranitelné větvi. |
| C - neexistující sloupec | vuln | `NONMATCH%' AND not_a_column = 1 -- ` | 200 | 0 | `Unknown column 'not_a_column' in 'where clause'` | `durationMs=1`; hlavní error payload byl interpretován jako SQL a vyvolal sémantickou databázovou chybu. |
| D - neexistující funkce | vuln | `NONMATCH%' AND definitely_not_existing_function(1)=1 -- ` | 200 | 0 | `FUNCTION sql_crm.definitely_not_existing_function does not exist` | `durationMs=40`; alternativní čtecí payload vyvolal databázovou chybu přes neexistující funkci. |
| E - hlavní payload v safe režimu | safe | `NONMATCH%' AND not_a_column = 1 -- ` | 200 | 0 | `null` | `durationMs=1`; stejný payload se choval jako hledaný text a nevyvolal databázovou chybu. |
| F - běžný neexistující text | vuln | `NONMATCH` | 200 | 0 | `null` | `durationMs=0`; běžné neúspěšné vyhledávání vrací prázdný výsledek bez chyby. |

## Ukázky odpovědí

### A. Kontrolní pozitivní vstup

```json
{
  "requestedMode": "vuln",
  "mode": "vuln",
  "pattern": "error",
  "target": "variants",
  "durationMs": 2,
  "rowCount": 2,
  "dataPreview": [
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
  ],
  "error": null
}
```

### C. Hlavní error payload ve zranitelném režimu

```json
{
  "requestedMode": "vuln",
  "mode": "vuln",
  "pattern": "error",
  "target": "variants",
  "durationMs": 1,
  "rowCount": 0,
  "dataPreview": [],
  "error": "Unknown column 'not_a_column' in 'where clause'"
}
```

### E. Stejný payload v bezpečném režimu

```json
{
  "requestedMode": "safe",
  "mode": "safe",
  "pattern": "error",
  "target": "variants",
  "durationMs": 1,
  "rowCount": 0,
  "dataPreview": [],
  "error": null
}
```

### F. Běžný prázdný výsledek bez SQL chyby

```json
{
  "requestedMode": "vuln",
  "mode": "vuln",
  "pattern": "error",
  "target": "variants",
  "durationMs": 0,
  "rowCount": 0,
  "dataPreview": [],
  "error": null
}
```

## Závěr pro scénář

Kontrolní pozitivní vstup `SQLI` potvrdil, že endpoint v režimu `pattern: "error"` pracuje nad targetem `variants` standardně a vrací očekávaná seedovaná data.

Rušivý vstup se samostatnou uvozovkou ukázal, že zranitelná větev vkládá payload přímo do SQL řetězce a tím lze narušit syntaxi dotazu. Tento krok je indikací problému.

Hlavní payload `NONMATCH%' AND not_a_column = 1 -- ` potvrzuje error-based SQL Injection: databáze payload interpretuje jako SQL podmínku a vrací chybu `Unknown column 'not_a_column' in 'where clause'`. Důkazem tedy není počet vrácených řádků ani připojení cizího `SELECT`, ale kontrolovaně vyvolaná databázová chyba.

Safe režim se stejným payloadem databázovou chybu nevyvolal. Payload byl zpracován jako běžná textová hodnota přes parametrizovaný dotaz, výsledkem byl `rowCount: 0`, prázdné `dataPreview` a `error: null`.

Volitelný krok s payloadem `NONMATCH` ukázal rozdíl mezi běžným prázdným výsledkem a databázovou chybou. Prázdný výsledek bez chyby sám o sobě neznamená SQL Injection; pro error-based scénář je rozhodující právě řízené vyvolání databázové chyby ve zranitelné větvi a její absence v bezpečné větvi.
