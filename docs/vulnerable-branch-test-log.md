# Vulnerable branch test log

Datum testu: 2026-06-27

Testovaná fáze: Phase A, krok 7 - vulnerable branch tests.

## Cíl

Cílem této fáze bylo ověřit, že záměrně zranitelná větev aplikace opravdu slouží jako demonstrační prostředí pro SQL Injection, ale zároveň zůstává oddělená od běžných zabezpečených endpointů.

V této fázi tedy není `PASS` vždy synonymem „endpoint je bezpečný“. U demo/vuln endpointů znamená `PASS`, že se očekávaná zranitelnost projevila kontrolovaným a dokumentovatelným způsobem.

## Spouštěné příkazy

Test byl spuštěn nad lokálním backendem na `http://localhost:4000`.

```bash
cd /Users/vlada/Desktop/sql_crm/backend
npm run db:reset
npm run test:demo:vulnerable
npm run db:reset
```

První reset připravil čistý deterministický stav DB. Poslední reset vrátil databázi do čistého stavu po testu, protože kontrola demo `POST /api/demo/inventory-movements` záměrně vytvořila jeden skladový pohyb.

Seed stav:

| Tabulka | Počet |
| --- | ---: |
| users | 3 |
| items | 6 |
| variants | 7 |
| inventory_movements | 10 |
| logs | 3 |
| settings | 1 |

Seed verze: `2026-06-24-security-baseline-v1`

## Testovací runner

Nový runner:

```bash
npm run test:demo:vulnerable
```

Implementace:

```text
/Users/vlada/Desktop/sql_crm/backend/scripts/vulnerableBranchTests.js
```

NPM alias:

```text
test:demo:vulnerable
```

Runner pokrývá:

- kontrolu přístupových hranic `/api/demo/inventory-movements`,
- porovnání vybraných payloadů proti secure API,
- zranitelný raw login `/api/auth/demo/raw-login`,
- boolean-based a union-based payloady nad demo listem pohybů,
- jednoduchý error-based signál přes nevalidovaný `sort`,
- potvrzení, že demo create pohybu používá bezpečnou create větev.

## Výsledek

Souhrn:

```text
18 PASS / 0 FAIL
```

Klíčové výsledky:

| Oblast | Očekávání | Výsledek |
| --- | --- | --- |
| Secure login + UNION payload | Validace emailu payload odmítne | PASS, HTTP 400 |
| Secure movements `type` payload | Validace enumu payload odmítne | PASS, HTTP 400 |
| Demo movements bez tokenu | Přístup odmítnut | PASS, HTTP 401 |
| Demo movements s běžným user tokenem | Přístup odmítnut | PASS, HTTP 403 |
| Demo movements s admin tokenem | Přístup povolen | PASS, 6 seedovaných `IN` řádků |
| Demo raw-login s běžným heslem | Selže kvůli záměrně naivnímu porovnání | PASS, HTTP 401 |
| Demo raw-login UNION payload | Vytvoří kontrolovaný admin token | PASS |
| Boolean false payload | Vrátí prázdnou množinu | PASS, 0 řádků |
| Boolean true payload | Rozšíří množinu výsledků | PASS, 10 řádků místo baseline 6 |
| UNION payload | Vloží syntetický řádek do odpovědi | PASS, nalezen `UNION_ROW` |
| Nevalidovaný `sort` | Propustí SQL chybu do odpovědi | PASS, HTTP 500 |
| Demo create jako admin | Použije bezpečný create path | PASS, HTTP 201 |

## Použité payloady

Raw login UNION payload:

```sql
' UNION SELECT 1,'demo-union@example.com','demo-pass','Demo Admin','admin' -- 
```

Smysl payloadu:

- původní dotaz hledá uživatele podle emailu,
- payload uzavře string,
- přes `UNION SELECT` vloží vlastní řádek ve tvaru očekávaného uživatele,
- `password_hash` je zde nastaven na `demo-pass`,
- demo controller následně porovná `password === user.password_hash`,
- protože do requestu posíláme také `password: demo-pass`, vznikne validní JWT s rolí `admin`.

Boolean true payload pro demo list pohybů:

```sql
IN' OR 1=1 -- 
```

Boolean false payload:

```sql
IN' AND 1=2 -- 
```

Union payload pro demo list pohybů:

```sql
IN' UNION SELECT 999001,1,1,'IN',1,'UNION_ROW',NOW(),'Union User','UNION-SKU','Union Variant' -- 
```

Error probe:

```text
sort=missing_demo_column
```

## Interpretace

### Secure větev

Secure endpointy se chovají podle očekávání:

- `/api/auth/login` odmítne SQLi payload už na validaci emailu,
- `/api/inventory-movements` odmítne SQLi payload v `type`, protože `type` musí být pouze `IN`, `OUT` nebo `ADJUST`,
- secure dotazy nepouští testovací payloady do SQL stringu jako spustitelnou syntaxi.

To je důležité pro bakalářskou práci, protože zde máme jasné srovnání: stejný typ vstupu v bezpečné vrstvě selže dříve, než se dostane do databázového dotazu.

### Raw login demo větev

`/api/auth/demo/raw-login` je záměrně špatně navržený endpoint pro demonstrační účely. Chyba je kombinace dvou věcí:

- DAO skládá SQL dotaz stringovou interpolací,
- controller používá naivní porovnání `password !== user.password_hash`.

Díky tomu lze přes `UNION SELECT` vyrobit falešný řádek uživatele, ve kterém útočník kontroluje email, heslo i roli. Test potvrdil, že payload vytvořil JWT s rolí `admin`.

### Demo movements list

`GET /api/demo/inventory-movements` je zranitelný přes více query parametrů, protože DAO skládá části `WHERE`, `ORDER BY`, `LIMIT` a `OFFSET` přímo ze vstupu.

Test potvrdil tři praktické projevy:

- boolean-based SQLi mění počet vrácených řádků,
- union-based SQLi dokáže přidat syntetický řádek do odpovědi,
- nevalidovaný `sort` vyvolá SQL chybu, která se propíše do odpovědi.

To je vhodný materiál pro kapitolu demonstrace exploitace a pro srovnání s parametrizovanými dotazy.

### Demo create movement

`POST /api/demo/inventory-movements` je chráněný stejně jako demo list, ale samotný zápis pohybu používá bezpečnou create logiku. To je záměrně správné: demo větev umožňuje číst a demonstrovat SQLi, ale nepřidává svévolné SQL zápisy.

## Poznámky pro další práci

Další schválený krok v původním plánu je krok 8: `Run SQLi Lab safe/vuln comparisons`.

Tam už budeme testovat vyhrazený SQLi Lab modul, který je podle aktuální implementace omezený na cíle `items` a `variants`. Tento krok by měl dát ještě čistší srovnání safe/vuln režimů na stejném API rozhraní.
