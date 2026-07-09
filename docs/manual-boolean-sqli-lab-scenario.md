# Manual scenario: Boolean-based SQL Injection v SQLi Labu

Datum ověření: 2026-06-06

Účel scénáře: připravit podklady pro ruční demonstraci Boolean-based SQL Injection v modelové aplikaci Simple Inventory CRM.

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
  "pattern": "boolean",
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

- `safe` větev používá placeholder `?` a hodnotu předává odděleně v `params`,
- `vuln` větev vkládá payload přímo do textu SQL dotazu.

## Testovací requesty

### A. Kontrolní pozitivní vstup

Význam: ověřuje běžný neútočný vstup bez SQL syntaxe, který v seedovaných datech skutečně vrací existující varianty.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "boolean",
  "target": "variants",
  "payload": "SQLI",
  "limit": 20
}
```

Poznámka: substring `SQLI` odpovídá seedovaným variantám `SQLI-LOWSTOCK` a `SQLI-UNION-1`.

### B. Rušivý vstup

Význam: jednoduchá uvozovka naruší SQL syntaxi ve zranitelné větvi. Tento krok je indikátor problému, ale sám o sobě ještě nepotvrzuje SQL Injection.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "boolean",
  "target": "variants",
  "payload": "'",
  "limit": 20
}
```

### C. FALSE payload ve zranitelném režimu

Význam: payload uzavře `LIKE` výraz a přidá podmínku, která je vždy nepravdivá.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "boolean",
  "target": "variants",
  "payload": "%' AND 1=2 -- ",
  "limit": 20
}
```

### D. TRUE payload ve zranitelném režimu

Význam: payload uzavře `LIKE` výraz a přidá podmínku, která je vždy pravdivá. Očekává se rozšíření množiny výsledků.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "vuln",
  "pattern": "boolean",
  "target": "variants",
  "payload": "%' OR 1=1 -- ",
  "limit": 20
}
```

### E. TRUE payload v bezpečném režimu

Význam: stejný payload se v `safe` režimu chová jako obyčejná hledaná hodnota. Nemá změnit logiku SQL dotazu.

```http
POST /api/sqli-demo/run
Content-Type: application/json
Authorization: Bearer <admin_token>
```

```json
{
  "mode": "safe",
  "pattern": "boolean",
  "target": "variants",
  "payload": "%' OR 1=1 -- ",
  "limit": 20
}
```

## Naměřené výsledky

Test byl spuštěn proti lokálnímu backendu:

```text
http://127.0.0.1:4000
```

| Krok | mode | payload | HTTP status | rowCount | error | Interpretace |
| --- | --- | --- | ---: | ---: | --- | --- |
| A | vuln | `SQLI` | 200 | 2 | `null` | Neútočný pozitivní vstup vrátil dvě existující varianty ze seedu. |
| B | vuln | `'` | 200 | 0 | `Query failed` | Samostatná uvozovka rozbila SQL syntaxi ve zranitelné větvi. Jde o indikátor, nikoli plné potvrzení exploitace. |
| C | vuln | `%' AND 1=2 -- ` | 200 | 0 | `null` | FALSE podmínka vrátila prázdnou množinu. |
| D | vuln | `%' OR 1=1 -- ` | 200 | 7 | `null` | TRUE podmínka změnila logiku dotazu a vrátila všechny seedované varianty. |
| E | safe | `%' OR 1=1 -- ` | 200 | 0 | `null` | Stejný payload v bezpečném režimu nezměnil SQL logiku a choval se jako obyčejný text. |

Ukázka `dataPreview` pro krok A:

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

Ukázka `dataPreview` pro krok D:

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
  },
  {
    "id": 5,
    "sku": "USB-C-1M",
    "variant_name": "1m Braided Cable",
    "price": "249.00",
    "stock_count": 83,
    "item_name": "USB-C Cable"
  }
]
```

## Závěr pro scénář

Scénář potvrzuje rozdíl mezi indikací a potvrzením SQL Injection:

- legitimní vstup `SQLI` vrací existující seedovaná data bez SQL manipulace,
- samotná uvozovka vyvolá chybu, ale pouze naznačuje problém,
- dvojice payloadů `AND 1=2` a `OR 1=1` potvrzuje, že vstup ve zranitelném režimu mění logiku SQL dotazu,
- stejný TRUE payload v bezpečném režimu nevede k rozšíření výsledků, protože je zpracován jako datová hodnota přes parametrizovaný dotaz.
