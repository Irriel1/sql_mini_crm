# SQLi Lab safe/vuln comparison test log

Datum testu: 2026-06-27

Testovaná fáze: Phase A, krok 8 - SQLi Lab safe/vuln comparisons.

## Cíl

Cílem bylo ověřit, že SQLi Lab umí na jednom endpointu kontrolovaně porovnat bezpečné a zranitelné chování nad totožnými payloady.

Testovaný endpoint:

```text
POST /api/sqli-demo/run
```

Endpoint je dostupný pouze při splnění těchto podmínek:

- uživatel je přihlášený,
- uživatel má roli `admin`,
- `DEMO_SQLI_LAB=true`,
- pro `mode: "vuln"` musí být zároveň `DEMO_VULN=true`.

## Implementační úprava před testem

Před testem jsme opravili nesoulad v SQLi Lab targetech:

- `validators.js` už dříve povoloval `target: "users"`,
- `queryFactory.js` ale reálně podporoval pouze `items` a `variants`.

Rozhodnutí: `users` target ponecháváme, protože má akademickou hodnotu pro demonstraci dopadu SQL Injection na uživatelská data.

Bezpečnostní omezení demonstračního výstupu:

- běžný SELECT pro `users` vrací `id`, `email`, `name`, `role`, `created_at`,
- záměrně nevrací `password_hash` jako standardní sloupec v `dataPreview`,
- lab zůstává admin-only a feature-flagged.

Současně jsme upravili validaci tak, aby chybné hodnoty `pattern`, `target`, `mode` a příliš dlouhý payload vracely HTTP 400 místo obecné serverové chyby.

## Spouštěné příkazy

Test byl spuštěn nad lokálním backendem na `http://localhost:4000`.

```bash
cd /Users/vlada/Desktop/sql_crm/backend
npm run db:reset
npm run test:demo:sqli-lab
npm run db:reset
```

První reset připravil čistý deterministický stav. Poslední reset vrátil DB do čistého stavu po testu, protože testovací login requesty vytváří auditní logy.

Seed stav po finálním resetu:

| Tabulka | Počet |
| --- | ---: |
| users | 3 |
| items | 6 |
| variants | 7 |
| inventory_movements | 10 |
| logs | 3 |
| settings | 1 |

## Testovací runner

Nový runner:

```bash
npm run test:demo:sqli-lab
```

Implementace:

```text
/Users/vlada/Desktop/sql_crm/backend/scripts/sqliLabComparisonTests.js
```

Runner testuje tři cíle:

- `items`,
- `variants`,
- `users`.

Pro každý cíl testuje čtyři SQLi techniky:

- boolean-based,
- union-based,
- error-based,
- time-based.

Každý důležitý payload je porovnán v režimu:

- `safe`,
- `vuln`.

## Výsledek

Souhrn:

```text
37 PASS / 0 FAIL
```

Access-control výsledky:

| Scénář | Očekávání | Výsledek |
| --- | --- | --- |
| Bez tokenu | HTTP 401 | PASS |
| Běžný user token | HTTP 403 | PASS |
| Admin token | Request povolen | PASS |

Validační výsledky:

| Scénář | Očekávání | Výsledek |
| --- | --- | --- |
| Neplatný pattern | HTTP 400 | PASS |
| Neplatný target | HTTP 400 | PASS |
| Neplatný mode | HTTP 400 | PASS |
| Payload delší než 200 znaků | HTTP 400 | PASS |

## Payloady

### Boolean-based

True payload:

```sql
%' OR 1=1 -- 
```

False payload:

```sql
%' AND 1=2 -- 
```

Význam:

- v `safe` režimu je payload pouze hodnota pro parametrizovaný `LIKE ?`,
- ve `vuln` režimu payload uzavře `LIKE` výraz a změní logiku `WHERE`.

Výsledek:

| Target | Safe true rowCount | Vuln false rowCount | Vuln true rowCount |
| --- | ---: | ---: | ---: |
| items | 0 | 0 | 6 |
| variants | 0 | 0 | 7 |
| users | 0 | 0 | 3 |

### Union-based

Items payload:

```sql
%' UNION SELECT 999001,'UNION_ITEM','Union Category',NOW() -- 
```

Variants payload:

```sql
%' UNION SELECT 999002,'UNION-SKU','Union Variant',1,1,'Union Item' -- 
```

Users payload:

```sql
%' UNION SELECT 999003,'union-user@example.com','Union User','admin',NOW() -- 
```

Výsledek:

| Target | Safe režim | Vuln režim |
| --- | --- | --- |
| items | syntetický řádek se neobjevil | nalezen `UNION_ITEM` |
| variants | syntetický řádek se neobjevil | nalezen `UNION-SKU` |
| users | syntetický řádek se neobjevil | nalezen `union-user@example.com` |

### Error-based

Items/users payload:

```sql
%' UNION SELECT 1,2 -- 
```

Variants payload:

```sql
%' UNION SELECT 1,2,3 -- 
```

Význam:

- počet sloupců v `UNION SELECT` záměrně nesedí s původním SELECTem,
- v `safe` režimu se payload bere jako text,
- ve `vuln` režimu databáze vrátí chybu.

Výsledek pro všechny cíle:

```text
The used SELECT statements have a different number of columns
```

### Time-based

Payload:

```sql
ZZZ%' OR IF(1=1,SLEEP(1),0)=0 -- 
```

Výsledek:

| Target | Safe durationMs | Vuln durationMs |
| --- | ---: | ---: |
| items | 2 ms | 1010 ms |
| variants | 1 ms | 1017 ms |
| users | 2 ms | 1004 ms |

## Interpretace

### Safe režim

Safe režim potvrdil očekávané chování:

- payloady se chovají jako obyčejná data,
- nedojde k rozšíření množiny výsledků,
- nedojde k vložení syntetického UNION řádku,
- nedojde k SQL error detailu,
- time payload nezpůsobí databázové zpoždění.

To je praktická ukázka parametrizovaných dotazů a vstupní validace.

### Vuln režim

Vuln režim potvrdil očekávanou zranitelnost:

- boolean-based payload mění logiku `WHERE`,
- union-based payload přidává syntetická data do odpovědi,
- error-based payload vrací databázovou chybu,
- time-based payload způsobuje měřitelné zpoždění.

To je vhodná sada důkazů pro kapitolu demonstrace exploitace SQL Injection.

### Users target

`users` target je nyní plnohodnotnou součástí labu. Je vhodný pro akademickou demonstraci, protože ukazuje, že SQL Injection není jen problém produktových tabulek, ale může ohrozit i identitní vrstvu aplikace.

Pro běžné demo ale záměrně nevracíme `password_hash` jako standardní sloupec. V práci lze uvést, že skutečná SQL Injection by často umožnila cílit i na citlivější data, ale modelová aplikace omezuje výstup labu tak, aby byl demonstrační a kontrolovaný.

## Stav fáze A

Tímto testem je interní aplikační revize Phase A dokončená:

1. DB reset/seed strategie hotová.
2. Auth + secure baseline hotové.
3. Secure SQLi negative testy hotové.
4. Vulnerable branch testy hotové.
5. SQLi Lab safe/vuln comparisons hotové.

Další fáze je Phase B: scénáře s externími nástroji, zejména Burp Suite, OWASP ZAP a sqlmap.
