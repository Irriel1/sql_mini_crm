# Auth + Secure Endpoint Baseline Test Log

Datum: 2026-06-24  
Faze testovani: auth + secure endpoint baseline  
Base URL: `http://localhost:4000`  
Frontend URL: `http://localhost:5173`  
DB baseline: `npm run db:reset` pred testem

## Cil

Overit zakladni funkcni a bezpecnostni chovani beznych endpointu pred SQLi testovanim. Tato faze zamerne nepouziva SQL Injection payloady. Cilem je nejdriv potvrdit, ze:

- autentizace funguje,
- chranene endpointy vyzaduji token,
- admin-only endpointy vraci beznemu uzivateli `403`,
- validace vstupu vraci ocekavane `400`,
- zakladni CRUD flow je funkcni,
- verejne nebo placeholder endpointy nejsou omylem vystavene.

## Spusteny postup

Z adresare backendu:

```bash
cd /Users/vlada/Desktop/sql_crm/backend
npm run db:reset
node scripts/authSecureBaseline.js > /tmp/sql_crm_auth_secure_baseline.json
```

Test runner je ulozeny zde:

```txt
/Users/vlada/Desktop/sql_crm/backend/scripts/authSecureBaseline.js
```

Runner pouziva seedovane ucty:

| Ucet | Role | Heslo |
| --- | --- | --- |
| `admin@example.com` | `admin` | `heslo123` |
| `user@example.com` | `user` | `heslo123` |

## Souhrn vysledku

Celkem probehlo 58 testu.

| Vysledek | Pocet |
| --- | ---: |
| PASS | 52 |
| FAIL | 6 |
| SKIP | 0 |

Vysledky podle oblasti:

| Oblast | PASS | FAIL | Celkem |
| --- | ---: | ---: | ---: |
| Health | 2 | 0 | 2 |
| Auth | 10 | 1 | 11 |
| Dashboard | 2 | 0 | 2 |
| Items | 11 | 0 | 11 |
| Variants | 5 | 2 | 7 |
| Inventory movements | 8 | 0 | 8 |
| Settings | 5 | 0 | 5 |
| Logs | 5 | 0 | 5 |
| System | 4 | 0 | 4 |
| Review-only placeholders | 0 | 3 | 3 |

## Co proslo

Auth baseline:

- `POST /api/auth/login` funguje pro admina i bezneho uzivatele.
- Spatne heslo vraci `401`.
- Chybejici nebo malformed email vraci `400`.
- Default registrace bez role vytvori bezneho uzivatele.
- Duplicitni registrace vraci `400`.
- `GET /api/auth/me` bez tokenu a s invalidnim tokenem vraci `401`.
- `GET /api/auth/me` s admin tokenem vraci ocekavany ucet.

Secure endpoint baseline:

- `GET /api/dashboard` bez tokenu vraci `401`, s user tokenem vraci agregovana data.
- `GET /api/items` bez tokenu vraci `401`.
- Items search/detail/create/update/delete flow funguje podle roli:
  - user muze cist a vytvorit item,
  - user nesmi update/delete item (`403`),
  - admin muze update/delete item,
  - smazany item se uz nevraci (`404`).
- Variants list/detail a delete blokovany existujicimi movementy funguje.
- `GET /api/inventory-movements` bez tokenu vraci `401`.
- Movement list/detail/filter/create funguje.
- Pokus o negativni sklad vraci `400`.
- Settings read funguje pro usera, update jen pro admina.
- Settings update zakazuje `id` field.
- Logs jsou admin-only:
  - bez tokenu `401`,
  - user token `403`,
  - admin token `200`.
- System endpointy jsou protected a s tokenem vraci health/version/info.

## Nalezy

### AUTH-SEC-001: Verejna registrace umi vytvorit admin ucet

Zavaznost: vysoka  
Endpoint: `POST /api/auth/register`  
Vysledek testu: FAIL
Stav opravy: opraveno po prvnim baseline behu

Testovaci payload:

```json
{
  "email": "baseline-admin-escalation@example.com",
  "password": "heslo123",
  "name": "Admin Escalation Attempt",
  "role": "admin"
}
```

Aktualni odpoved:

```txt
201 Created, user.role = admin
```

Problem:

Verejny register endpoint prijima `role` z request body a predava ji do vytvoreni uzivatele. To znamena, ze kdokoliv si muze vytvorit admin ucet bez existujiciho admin opravneni.

Relevantni kod:

- `/Users/vlada/Desktop/sql_crm/backend/src/controllers/authController.js`
- `registerSchema` povoluje `role`
- `usersDao.createUser` dostava `role: value.role`

Doporuceni:

- V public registraci uplne ignorovat `role` z body.
- Napevno nastavovat `role: 'user'`.
- Admin ucty vytvaret pouze seedem nebo samostatnym admin-only endpointem.

Implementovana oprava:

- `registerSchema` zakazuje pole `role` pres `Joi.forbidden()`.
- `usersDao.createUser` dostava v public registraci vzdy `role: 'user'`.
- Pokus poslat `role: "admin"` ted vraci `400` s odpovedi `"role" is not allowed`.
- Po oprave se baseline runner zmenil z `52 PASS / 6 FAIL` na `53 PASS / 5 FAIL`.

### VAR-FUNC-001: Create variant vraci `201`, ale ulozi spatne hodnoty

Zavaznost: stredni  
Endpoint: `POST /api/items/:itemId/variants`  
Vysledek testu: FAIL
Stav opravy: opraveno po druhem kroku fixu

Ocekavani:

```json
{
  "sku": "BASE-VAR-1",
  "variant_name": "Baseline Variant",
  "price": 1234.5,
  "stock_count": 9
}
```

Aktualni vysledek:

```txt
201 Created, ale price = null
```

Problem:

DAO sklada SQL pro sloupce:

```sql
item_id, sku, variant_name, price, stock_count
```

ale do hodnot posila navic `attrsValue` pred `price`. Vysledkem je posun hodnot:

- `attrsValue` jde do `price`,
- `price` jde do `stock_count`,
- `stock_count` je navic a nepouzije se.

Relevantni kod:

- `/Users/vlada/Desktop/sql_crm/backend/src/dao/variantsDao.js`

Doporuceni:

- Bud pridat `attributes` do SQL column listu,
- nebo odstranit `attrsValue` z hodnot, pokud `attributes` nema byt podporovane pres API.

Implementovana oprava:

- `variantsDao.createVariant` uz neposila `attrsValue` do SQL hodnot.
- Poradi hodnot ted odpovida sloupcum `item_id, sku, variant_name, price, stock_count`.
- Cileny test potvrdil `price = 1234.50` a `stock_count = 9`.

### VAR-FUNC-002: Update variant vraci `404` kvuli spatnemu poradi parametru

Zavaznost: stredni  
Endpoint: `PUT /api/variants/:id`  
Vysledek testu: FAIL
Stav opravy: opraveno po druhem kroku fixu

Ocekavani:

```txt
200 OK, varianta aktualizovana
```

Aktualni vysledek:

```txt
404 Not found
```

Problem:

Stejny typ chyby jako u create variant. Do SQL update jdou hodnoty v posunutem poradi a `id` se kvuli extra parametru nedostane na spravny placeholder `WHERE id = ?`.

Relevantni kod:

- `/Users/vlada/Desktop/sql_crm/backend/src/dao/variantsDao.js`

Doporuceni:

- Srovnat SQL placeholdery a pole hodnot.
- Po oprave znovu spustit baseline runner.

Implementovana oprava:

- `variantsDao.updateVariant` uz neposila `attrsValue` jako extra hodnotu.
- Posledni parametr v poli hodnot je znovu spravne `id` pro `WHERE id = ?`.
- Cileny test potvrdil `200 OK`, novy `sku`, `price = 1500.00` a `stock_count = 11`.
- Po oprave variant se baseline runner zmenil z `53 PASS / 5 FAIL` na `55 PASS / 3 FAIL`.

### EXP-001: Admin placeholder endpointy jsou verejne pristupne

Zavaznost: stredni az vysoka pred finalnim demem  
Endpointy:

- `GET /api/admin`
- `POST /api/admin/reset-db`
- `GET /api/admin/raw-sql`

Vysledek testu: FAIL
Stav opravy: opraveno po tretim kroku fixu

Aktualni vysledek:

```txt
200 OK bez tokenu
```

Problem:

I kdyz endpointy zatim vraci jen placeholder text, jejich nazvy signalizuji admin/reset funkcionalitu. Pro obhajobu i bezpecnostni architekturu je lepsi, aby nebyly verejne dostupne.

Relevantni kod:

- `/Users/vlada/Desktop/sql_crm/backend/src/routes/admin.js`

Doporuceni:

- Bud je uplne odstranit,
- nebo za ne dat `authMiddleware` + `requireRole('admin')`,
- nebo vratit `404`, pokud nejsou soucasti soucasne demo vrstvy.

Implementovana oprava:

- Cely `admin` router je chraneny pres `authMiddleware` a `requireRole('admin')`.
- Bez tokenu ted admin placeholdery vraci `401`.
- Beznemu uzivateli vraci `403`.
- Admin token stale dostane placeholder odpoved `200`, endpointy ale uz nejsou verejne.
- Ochrana se vztahuje i na `GET /api/admin/raw-sql`.
- Po oprave admin placeholderu se baseline runner zmenil z `55 PASS / 3 FAIL` na `57 PASS / 1 FAIL`.

### EXP-002: Inventory placeholder endpoint je verejne pristupny

Zavaznost: stredni  
Endpoint:

- `GET /api/inventory`
- `GET /api/inventory/:variantId`

Vysledek testu: FAIL
Stav opravy: opraveno po ctvrtem kroku fixu

Aktualni vysledek:

```txt
200 OK bez tokenu
```

Problem:

Endpoint neni soucasti aktualniho hlavniho workflow, ale je verejne pristupny. V aplikaci, ktera jinak chrani inventory/movements pres auth, to pusobi jako nekonzistence.

Relevantni kod:

- `/Users/vlada/Desktop/sql_crm/backend/src/routes/inventory.js`

Doporuceni:

- Bud endpoint odstranit/odmountovat,
- nebo ho chranit `authMiddleware`,
- nebo ho ponechat jen jako zdokumentovany out-of-scope placeholder za `404`.

Implementovana oprava:

- Cely `inventory` placeholder router je chraneny pres `authMiddleware`.
- Bez tokenu `GET /api/inventory` a `GET /api/inventory/:variantId` vraci `401`.
- S validnim user tokenem endpointy stale vraci placeholder `200`, coz odpovida budoucimu read-only inventory prehledu.
- Po oprave inventory placeholderu baseline runner probehl ciste: `58 PASS / 0 FAIL`.

## Finalni baseline po opravach

Po postupnych opravach vsech baseline nalezu probehl runner:

```bash
node scripts/authSecureBaseline.js
```

Finalni vysledek:

| Vysledek | Pocet |
| --- | ---: |
| PASS | 58 |
| FAIL | 0 |
| SKIP | 0 |

Opravene nalezy:

- `AUTH-SEC-001`: verejna registrace uz neumi vytvorit admin ucet.
- `VAR-FUNC-001`: create variant uklada `price` a `stock_count` do spravnych sloupcu.
- `VAR-FUNC-002`: update variant pouziva spravny `WHERE id`.
- `EXP-001`: admin placeholder endpointy jsou admin-only.
- `EXP-002`: inventory placeholder endpointy uz nejsou verejne.

## Interpretace

Bezpecna business vrstva je z velke casti funkcni: autentizace, role checks, items, movements, settings, logs a system endpointy se ve vetsine pripadu chovaji spravne.

Pred dalsi fazi SQLi testu je ale vhodne opravit minimalne:

1. verejne vytvareni admin role pres registraci,
2. create/update variant DAO mapovani,
3. verejne placeholder endpointy.

Tyto chyby nejsou SQLi zranitelnost, ale patri do celkove bezpecnostni a funkcni revize aplikace. Pokud bychom je nechali bez opravy, pri obhajobe by mohly zbytecne zastinit hlavni pointu: riziko SQL Injection a rozdil mezi secure/vuln vetvi.

## Stav DB po testu

Testy vytvari docasna data:

- `baseline-register@example.com`
- `baseline-admin-escalation@example.com`
- docasny item,
- docasny movement,
- audit logy z loginu a CRUD operaci.

Po zapsani vysledku byla DB znovu resetovana prikazem:

```bash
npm run db:reset
```

Overeny finalni baseline po resetu:

| Tabulka | Pocet |
| --- | ---: |
| `users` | 3 |
| `items` | 6 |
| `item_variants` | 7 |
| `inventory_movements` | 10 |
| `logs` | 3 |
| `settings` | 1 |
