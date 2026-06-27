# Secure Endpoint SQLi Negative Test Log

Datum: 2026-06-24  
Faze testovani: Phase A / krok 6 - secure endpoint SQLi negative tests  
Base URL: `http://localhost:4000`  
DB baseline: `npm run db:reset` pred testem

## Cil

Overit, ze bezpecne endpointy aplikace nereaguji na SQL Injection payloady zmenou SQL semantiky. V teto fazi se netestuji demo/vuln endpointy ani SQLi Lab. Cilem je potvrdit, ze secure vrstva:

- pouziva parametrizovane dotazy pro textove vstupy,
- odmita nepovolene hodnoty pres validaci,
- nerozsiruje row set pri boolean payloadu,
- nezpozduje odpoved pri time-based payloadu,
- nevraci raw SQL chyby nebo stack trace,
- odmita malformed numeric ID vstupy.

## Spusteny postup

Z adresare backendu:

```bash
cd /Users/vlada/Desktop/sql_crm/backend
npm run db:reset
node scripts/secureSqliNegative.js > /tmp/sql_crm_secure_sqli_negative.json
```

Runner je ulozeny zde:

```txt
/Users/vlada/Desktop/sql_crm/backend/scripts/secureSqliNegative.js
```

Poznamka k metodice: runner nekontroluje jen samotne SQLi. Zamerne kontroluje i strict validaci path parametru, protoze vstupy jako `1 OR 1=1` nesmi byt potichu precteny jako `1`.

## Payload skupina

```text
'
"
%' OR 1=1 -- 
%' AND 1=2 -- 
%' UNION SELECT 1,2,3,4 -- 
ZZZ%' OR IF(1=1,SLEEP(2),0)=0 -- 
1 OR 1=1
1 AND 1=2
created_at DESC, (SELECT SLEEP(2))
```

## Souhrn vysledku

Prvni beh pred opravou strict path validace:

Celkem probehlo 37 testu.

| Vysledek | Pocet |
| --- | ---: |
| PASS | 29 |
| FAIL | 8 |
| SKIP | 0 |

Vysledky podle oblasti:

| Oblast | PASS | FAIL | Celkem |
| --- | ---: | ---: | ---: |
| Setup | 2 | 0 | 2 |
| Auth negative | 4 | 0 | 4 |
| Items negative | 7 | 0 | 7 |
| Variants negative | 3 | 2 | 5 |
| Movements negative | 7 | 1 | 8 |
| Path validation negative | 0 | 5 | 5 |
| Settings negative | 3 | 0 | 3 |
| Logs negative | 3 | 0 | 3 |

Finalni beh po oprave strict path validace:

| Vysledek | Pocet |
| --- | ---: |
| PASS | 37 |
| FAIL | 0 |
| SKIP | 0 |

## Co proslo

Auth:

- SQLi payload v emailu loginu/registrace je odmítnut email validací.
- SQLi payload v hesle nezpusobi prihlaseni a vraci `401`.
- SQLi payload v `name` pri registraci je ulozen jako obycejny text.
- Verejna registrace stale vytvari pouze `role=user`.

Items:

- `GET /api/items?search=<payload>` vraci kontrolovany vysledek, boolean payload nerozsiri row set.
- Time-based payload v `search` nezpusobil delay; namerene odpovedi byly v jednotkach ms.
- `sort` a `dir` payloady jsou odmitnuty allowlist validaci.
- `GET /api/items/:id` strictne odmita `1 OR 1=1`.
- Textove payloady v create/update itemu jsou ulozeny jako data.

Variants:

- `limit` payload v listu variant je odmítnut numeric validací.
- Textove payloady v create/update varianty jsou ulozeny jako data.

Movements:

- `variant_id` payload v query/body je odmítnut numeric validací.
- `type` payload v query/body je odmítnut enum validací.
- `note` boolean payload nerozsiril row set.
- `note` time-based payload nezpusobil delay.
- `note` v create movement je ulozen jako obycejny text.

Settings:

- `warehouse_name` payload je ulozen jako obycejny text.
- `currency` payload je odmítnut length validací.
- `low_stock_threshold` payload je odmítnut numeric validací.

Logs:

- `action` payload nerozsiril row set.
- `user_id` payload je odmítnut numeric validací.
- `GET /api/logs/:id` strictne odmita malformed ID.

## Hlavni interpretace

Testy neukazaly SQL Injection v secure SQL dotazech. Parametrizovana textova pole se chovala podle ocekavani: payload byl bud ulozen/vracen jako obycejny text, nebo byl odmitnut validaci.

Nalezene faily jsou validacni problem path parametru, ne dukaz SQL Injection. Problem je, ze nektere controllery pouzivaji `parseInt`, ktere akceptuje zacatek retezce a zbytek ignoruje:

```js
parseInt('1 OR 1=1', 10) === 1
```

Tim se malformed vstup nechova jako neplatne ID, ale jako legitimni ID `1`.

## Nalezy

### VAL-ID-001: `parseInt` propousti malformed path ID jako platne ID

Zavaznost: stredni  
Typ: validace vstupu / authorization-adjacent risk  
Vysledek testu: FAIL
Stav opravy: opraveno po revizi validace path parametru

Payload:

```text
1 OR 1=1
```

Ocekavani:

```txt
400 Invalid id
```

Aktualni chovani:

| Endpoint | Aktualni vysledek |
| --- | --- |
| `GET /api/items/:itemId/variants` | `200`, `itemId` je interpretovane jako `1` |
| `POST /api/items/:itemId/variants` | `201`, varianta je vytvorena pod itemem `1` |
| `GET /api/variants/:id` | `200`, vraci variantu `1` |
| `PUT /api/variants/:id` | `200`, aktualizuje variantu `1` |
| `DELETE /api/variants/:id` | `409`, dostane se az k business pravidlu pro variantu `1` |
| `GET /api/inventory-movements/:id` | `200`, vraci movement `1` |
| `PUT /api/items/:id` | `200`, aktualizuje item `1` |
| `DELETE /api/items/:id` | `204`, smaze item `1` soft-deletem |

Relevantni kod:

- `/Users/vlada/Desktop/sql_crm/backend/src/controllers/itemsController.js`
- `/Users/vlada/Desktop/sql_crm/backend/src/controllers/variantsController.js`
- `/Users/vlada/Desktop/sql_crm/backend/src/controllers/inventoryMovementsController.js`

Konkretni problemova mista:

```txt
itemsController.updateItem      parseInt(req.params.id, 10)
itemsController.deleteItem      parseInt(req.params.id, 10)
variantsController.listVariantsForItem  parseInt(req.params.itemId, 10)
variantsController.createVariantForItem parseInt(req.params.itemId, 10)
variantsController.getVariant   parseInt(req.params.id, 10)
variantsController.updateVariant parseInt(req.params.id, 10)
variantsController.deleteVariant parseInt(req.params.id, 10)
inventoryMovementsController.getMovement parseInt(req.params.id, 10)
```

Proc to neni SQLi:

- DAO dotazy stale pouzivaji placeholdery.
- Payload nezmeni SQL dotaz na `OR 1=1`.
- Problem je v tom, ze controller z payloadu tise vyrobi cislo `1`.

Proc to presto opravit:

- Malformed vstup muze cist nebo menit nespravny zdroj.
- U `PUT /api/items/:id` a `DELETE /api/items/:id` jde o realnou state-changing chybu.
- Pri obhajobe by to pusobilo jako nekonzistentni validace, protoze `GET /api/items/:id` a `GET /api/logs/:id` uz strict validaci maji.

Doporuceni:

- Zavezt sdileny helper pro strict positive integer path params.
- Nepouzivat `parseInt` primo na path parametry.
- Akceptovat jen retezce odpovidajici regexu `^[1-9][0-9]*$`.
- Alternativne pouzit `Number(value)` + `Number.isInteger(...)`, ale regex je citelnejsi pro path params.

Navrh helperu:

```js
function parsePositiveIntParam(value) {
  if (!/^[1-9][0-9]*$/.test(String(value))) return null;
  return Number(value);
}
```

Implementovana oprava:

- Pridan sdileny helper `/Users/vlada/Desktop/sql_crm/backend/src/utils/params.js`.
- Helper akceptuje pouze cely retezec ve tvaru kladneho celeho cisla.
- Helper navic kontroluje `Number.isSafeInteger`, aby nevznikaly nepresne hodnoty u prilis velkych cisel.
- Laxni `parseInt(req.params...)` validace byla nahrazena ve secure controllerech:
  - `itemsController`
  - `variantsController`
  - `inventoryMovementsController`
  - `logsController`
- Historicky demo controller `demoItemsController` nebyl zamerne menen, protoze patri k neaktivni/legacy demo vrstve.

Overeni po oprave:

| Test runner | Vysledek |
| --- | ---: |
| `node scripts/secureSqliNegative.js` | `37 PASS / 0 FAIL` |
| `node scripts/authSecureBaseline.js` | `58 PASS / 0 FAIL` |

Vysledek podle oblasti po oprave secure SQLi negative testu:

| Oblast | PASS | FAIL |
| --- | ---: | ---: |
| Setup | 2 | 0 |
| Auth negative | 4 | 0 |
| Items negative | 7 | 0 |
| Variants negative | 5 | 0 |
| Movements negative | 8 | 0 |
| Path validation negative | 5 | 0 |
| Settings negative | 3 | 0 |
| Logs negative | 3 | 0 |

## Studijni poznamka pro bakalarskou praci

Tento nalez je dobry priklad toho, proc je pri testovani bezpecnosti nutne rozlisovat mezi samotnou SQL Injection a jinou chybou vstupni validace.

### Jak jsme chybu nasli

Po uspesnem baseline testovani jsme spustili negativni SQLi testy proti secure endpointum. Jeden z testovacich payloadu byl:

```text
1 OR 1=1
```

Payload jsme neposilali do zranitelne demo vetve, ale do bezneho zabezpeceneho endpointu:

```txt
GET /api/items/1%20OR%201=1/variants
```

Request byl overen i manualne v Postmanu s hlavickou:

```txt
Authorization: Bearer <token>
```

Ocekavane chovani zabezpeceneho endpointu bylo:

```txt
400 Invalid itemId
```

Skutecne chovani bylo:

```txt
200 OK
```

Backend vratil varianty pro item `1`, jako kdyby uzivatel poslal:

```txt
GET /api/items/1/variants
```

### Proc k tomu dochazi

Problem vznikl v controlleru, ne v DAO vrstve. Konkretne ve funkci `listVariantsForItem`:

```js
const itemId = parseInt(req.params.itemId, 10);
if (Number.isNaN(itemId)) {
  return res.status(400).json({ error: 'Invalid itemId' });
}
```

Funkce `parseInt` se nechova jako strict validace celeho retezce. Precte cislo od zacatku a u prvniho necislicoveho znaku skonci:

```js
parseInt('1 OR 1=1', 10) === 1
```

Nasledna kontrola:

```js
Number.isNaN(1)
```

vrati:

```js
false
```

Controller tedy nepovazuje vstup za neplatny a pokracuje s hodnotou `1`.

### Proc to neni SQL Injection

Tento request nezpusobil, ze by se SQL dotaz zmenil na:

```sql
WHERE item_id = 1 OR 1=1
```

DAO vrstva stale pouziva parametrizovany dotaz:

```sql
WHERE item_id = ?
```

Do dotazu se neposle payload `1 OR 1=1`, ale uz predem zpracovana hodnota `1`. Proto se nejedna o uspesnou SQL Injection.

### Proc je to presto chyba

Chyba je v tom, ze aplikace prijme malformed vstup a tise ho prevede na platne ID. U read endpointu to znamena, ze uzivatel dostane data pro resource `1`, ackoliv neposlal validni ID.

U write endpointu je dopad vaznejsi. Napriklad:

```txt
PUT /api/items/1%20OR%201=1
```

se muze chovat jako:

```txt
PUT /api/items/1
```

To neni SQLi, ale stale jde o chybnou validaci, ktera muze vest k uprave nebo smazani nespravneho zaznamu.

### Spravny fix

Spravna oprava neni escapovat retezec pro SQL, protoze SQL cast uz je parametrizovana. Spravna oprava je validovat path parametr pred prevodem na cislo.

Navrhovany postup:

1. Vytvorit sdileny helper pro strict positive integer ID.
2. Helper musi overit cely vstup, ne jen jeho zacatek.
3. Pokud vstup neodpovida cistemu kladnemu celymu cislu, endpoint vrati `400`.

Priklad:

```js
function parsePositiveIntParam(value) {
  const raw = String(value);
  if (!/^[1-9][0-9]*$/.test(raw)) {
    return null;
  }
  return Number(raw);
}
```

Pouziti v controlleru:

```js
const itemId = parsePositiveIntParam(req.params.itemId);
if (itemId === null) {
  return res.status(400).json({ error: 'Invalid itemId' });
}
```

Po oprave by se endpoint mel chovat takto:

| Request | Ocekavany vysledek |
| --- | --- |
| `/api/items/1/variants` | `200 OK` |
| `/api/items/abc/variants` | `400 Invalid itemId` |
| `/api/items/1abc/variants` | `400 Invalid itemId` |
| `/api/items/1%20OR%201=1/variants` | `400 Invalid itemId` |
| `/api/items/0/variants` | `400 Invalid itemId` |

### Jak to pouzit v textu prace

Tento nalez lze v bakalarske praci popsat jako doplnkovy vysledek testovani secure vrstvy:

- SQL Injection se na zabezpecenem endpointu neprokazala.
- Parametrizovany SQL dotaz zabranil zmene SQL semantiky.
- Testovani ale odhalilo jinou vstupni chybu: nepresnou validaci path parametru pres `parseInt`.
- Oprava patri do validacni vrstvy controlleru, ne do SQL vrstvy.

Tento priklad dobre ukazuje, ze bezpecnostni testovani nema koncit jen otazkou "funguje SQLi/nefunguje SQLi". I kdyz hlavni exploit selze, test muze odhalit slabsi validaci, ktera ma samostatny bezpecnostni nebo funkcni dopad.

## Stav DB po testu

Testy zamerne vytvareji docasne radky a nektere fail scenare meni data, napriklad update/delete itemu pres malformed ID. Po testu je proto nutne DB vratit do baseline:

```bash
npm run db:reset
```

## Dalsi krok

Opravit strict validaci path ID a spustit `npm run test:security:sqli-negative` znovu. Po oprave by tento runner mel projit bez failu.
