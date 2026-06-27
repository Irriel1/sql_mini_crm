# DB Test Preparation Log

Datum: 2026-06-24  
Projekt: SQL CRM, bakalarska prace - SQL Injection demo a bezpecnostni revize

## Cil

Pripravit databazi tak, aby slo opakovane spoustet funkcni a bezpecnostni testy nad stejnym stavem dat. Dosavadni lokalni DB obsahovala rucne vznikle radky z vyvoje a predchozich experimentu, proto neni vhodne stavet finalni testovani jen na aktualnim obsahu databaze.

Zvolena strategie:

1. Pred destruktivnim testem vytvorit snapshot aktualni DB.
2. Pro samotne testovani pouzivat deterministicky seed.
3. Testy psat proti stabilnim identifikatorum jako emaily a SKU, ne proti nahodnym rucnim radkum.
4. Puvodni rucni stav nebrat jako zdroj pravdy, ale jako vyvojovou historii.

## Vychozi stav pred pripravou

Lokalni DB byla dostupna pres konfiguraci backendu. Pri kontrole mela tabulky:

- `users`
- `items`
- `item_variants`
- `inventory_movements`
- `logs`
- `settings`

Pozorovany pocet radku pred pripravou:

| Tabulka | Pocet |
| --- | ---: |
| `users` | 4 |
| `items` | 8 |
| `item_variants` | 8 |
| `inventory_movements` | 9 |
| `logs` | 69 |
| `settings` | 1 |

Tento stav byl uzitecny pro debugging, ale pro finalni testovani neni dostatecne reprodukovatelny.

## Pridane prikazy

Prikazy se spousti z adresare:

```bash
cd /Users/vlada/Desktop/sql_crm/backend
```

Snapshot aktualni DB:

```bash
npm run db:snapshot
```

Poznamka: lokalni DB uzivatel aplikace nema administracni prava pro `FLUSH TABLES`. Snapshot skript proto pouziva dump bez zamykani tabulek. Pro nasi lokalni pripravu pred resetem je to dostatecne; pri produkcnim backupu by bylo vhodne pouzit uzivatele s pravy pro konzistentni hot backup.

Bezny seed bez smazani cele databaze:

```bash
npm run db:seed
```

`db:seed` nemaze bezne audit logy ani rucne vytvorena data. Odstrani jen predchozi seedovane pohyby s poznamkou `[SEED]` a logy s akci `SEED_%`. Pokud aplikace mezitim vytvorila nove audit logy, zustanou v DB.

Destruktivni reset a nasledny seed:

```bash
npm run db:reset
```

`db:reset` smaze obsah aplikacnich tabulek a vytvori cisty testovaci stav. Pred jeho pouzitim je vhodne spustit `db:snapshot`.

## Proc snapshot + seed

Samotny snapshot je dobry pro navrat k aktualnimu stavu, ale neni idealni jako primarni testovaci strategie. Obsahuje totiz nahodne rucni experimenty, ruzne casy vytvoreni a testovaci payloady z predchozich pokusu.

Deterministicky seed je pro bakalarskou praci vhodnejsi, protoze:

- testy lze opakovat se stejnymi vstupy,
- screenshoty a vysledky jsou konzistentni,
- pri chybe v API vime, ze ji nezpusobil nahodny obsah DB,
- lze jednoduse popsat vychozi stav v textu prace.

Snapshot ale ponechavame jako pojistku, kdyby bylo potreba vratit rucni stav z vyvoje.

## Seedovane testovaci ucty

Vsechny testovaci ucty maji zamerne stejne heslo `heslo123`. V testech tim resime role a endpointy, ne spravu hesel.

| Email | Role | Ucel |
| --- | --- | --- |
| `admin@example.com` | `admin` | admin flow, SQLi Lab, demo vuln endpointy |
| `user@example.com` | `user` | bezny uzivatel, role/authorization testy |
| `viewer@example.com` | `user` | druhy bezny uzivatel pro audit a pohyby |

## Seedovana data

Seed vytvari polozky:

- `Audit Laptop`
- `Warehouse Scanner`
- `Office Chair`
- `USB-C Cable`
- `SQLi Lab Marker`
- `Deleted Demo Item` jako soft-delete kontrolni radek

Seed vytvari varianty se stabilnimi SKU:

- `AUD-LAP-13`
- `AUD-LAP-15`
- `WH-SCN-01`
- `CHAIR-BLK`
- `USB-C-1M`
- `SQLI-UNION-1`
- `SQLI-LOWSTOCK`

Seed vytvari skladove pohyby s poznamkou zacinajici `[SEED]`. To je zamerne, aby je slo pri opakovanem `db:seed` bezpecne smazat a vlozit znovu bez mazani rucnich dat.

Seed vytvari audit logy s akcemi:

- `SEED_DATABASE_READY`
- `SEED_SQLI_LAB_READY`
- `SEED_ROLE_TEST_READY`

## Dulezite poznamky k testovani

SQLi payloady se maji testovat pouze v urcenych demo vrstvach:

- `POST /api/sqli-demo/run`
- `GET /api/demo/inventory-movements`
- `POST /api/auth/demo/raw-login`

Secure endpointy se testuji negativne tak, ze payload nesmi zmenit SQL semantiku. U secure endpointu tedy cekame bud normalni bezpecne vyhledavani, prazdny vysledek, nebo validacni chybu, ne unik dat.

Pro testy se nema spolehat na konkretni `id` po rucnich experimentech. Po `db:reset` budou ID stabilni, ale v dokumentaci a testovacich scenarich je lepsi pouzivat emaily a SKU a ID si pred testem nacist.

## Zjistene technicke body pro dalsi revizi

Tyto body nevznikly jako soucast DB seedu, ale objevily se pri priprave:

| Oblast | Poznamka |
| --- | --- |
| `demo.js` | Historicke raw item endpointy byly odstraneny jako superseded cleanup; aktualni demo plocha je `demoMovementsRoutes`, raw login a SQLi Lab. |
| `/api/demo` | Duplicitni mount `demoMovementsRoutes` v `backend/src/index.js` byl odstranen; router je pripojen pouze jednou. |
| `item_variants.attributes` | Realna lokalni DB sloupec `attributes` ma, ale puvodni `schema.sql` s nim nebyl plne sladene. |
| `variantsDao` | Create/update varianta byla overena v auth + secure baseline testech; mapovani hodnot bylo opraveno. |
| `schema.sql` | Pri priprave byl srovnan s realnou DB v oblasti `item_variants.attributes` a opraveny carky/indexy u `inventory_movements`. |

## Doporučeny postup pred dalsim testovanim

1. Spustit snapshot:

```bash
npm run db:snapshot
```

2. Spustit reset:

```bash
npm run db:reset
```

3. Spustit backend a frontend.

4. Overit prihlaseni:

```txt
admin@example.com / heslo123
user@example.com / heslo123
viewer@example.com / heslo123
```

5. Teprve potom spoustet endpoint testy podle `docs/security-test-plan.md`.

## Stav procesu

- Pripraven deterministicky seed: hotovo.
- Pripraven DB snapshot skript: hotovo.
- Pridane npm prikazy: hotovo.
- `schema.sql` srovnan pro fresh-migration test: hotovo.
- Snapshot puvodni DB vytvoren: `/Users/vlada/Desktop/sql_crm/backend/db/snapshots/sql_crm-2026-06-24T18-09-08-733Z.sql`.
- Destruktivni reset DB spusten po snapshotu: hotovo.
- `npm run migrate` overen po uprave skriptu: hotovo.
- `npm run db:seed` overen jako opakovatelny pro seedovane radky; bezne audit logy z aplikace zamerne nemaze.
- Nasledny krok: spustit endpoint testy podle `docs/security-test-plan.md`.

## Overeni po resetu

Po `npm run db:reset` a naslednem `npm run db:seed` ma DB tento baseline:

| Tabulka | Pocet |
| --- | ---: |
| `users` | 3 |
| `items` | 6 |
| `item_variants` | 7 |
| `inventory_movements` | 10 |
| `logs` | 3 |
| `settings` | 1 |

API smoke testy po seedu:

| Kontrola | Vysledek |
| --- | --- |
| `GET /health` | `200` |
| `POST /api/auth/login` jako `admin@example.com` | `200`, role `admin`, token vydan |
| `GET /api/items` s admin tokenem | `200`, vraci seedovana data |
| `POST /api/sqli-demo/run` v `safe` rezimu | `200`, target `items`, rowCount `1` pro payload `SQLi` |
| `POST /api/auth/login` jako `user@example.com` | `200`, role `user`, token vydan |
| `GET /api/logs` s user tokenem | `403` |
| `GET /api/demo/inventory-movements` s user tokenem | `403` |
