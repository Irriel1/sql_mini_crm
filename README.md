# Simple Inventory CRM

Modelova webova aplikace pro spravu skladovych polozek, variant a skladovych pohybu. Projekt slouzi take jako demonstracni prostredi pro bakalarskou praci k tematu SQL Injection.

Aplikace je rozdělena na:

- `frontend` - React/Vite klient,
- `backend` - Node.js/Express API,
- MySQL databazi,
- bezpecne business endpointy,
- zamerne zranitelne demo endpointy,
- SQL Injection Lab pro rizene testovani payloadu v lokalnim prostredi.

> Demo zranitelne rezimy (`DEMO_VULN`, `DEMO_SQLI_LAB`) jsou urcene pouze pro lokalni akademicke testovani.

## Pozadavky

- Node.js 20+ a npm
- MySQL 8+
- Git

## Struktura projektu

```text
sql_crm/
  backend/   Node.js + Express + MySQL API
  frontend/  React + Vite aplikace
  docs/      testovaci plany a protokoly pro bakalarskou praci
```

## 1. Priprava databaze

Nejdrive vytvorte lokalni MySQL databazi a uzivatele. Hodnoty hesla si muzete zmenit, ale potom je stejne nastavte i v `backend/.env`.

```sql
CREATE DATABASE IF NOT EXISTS sql_crm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'sql_crm'@'localhost'
  IDENTIFIED BY 'change-me';

CREATE USER IF NOT EXISTS 'sql_crm'@'127.0.0.1'
  IDENTIFIED BY 'change-me';

GRANT ALL PRIVILEGES ON sql_crm.* TO 'sql_crm'@'localhost';
GRANT ALL PRIVILEGES ON sql_crm.* TO 'sql_crm'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Pri pouziti jineho uzivatele nebo hesla upravte odpovidajici hodnoty v `backend/.env`.

## 2. Backend konfigurace

```bash
cd backend
npm install
```

Vytvorte soubor `backend/.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=sql_crm
DB_PASS=change-me
DB_NAME=sql_crm
PORT=4000
JWT_SECRET=replace-with-long-random-secret

# Demo flags for local SQLi testing
DEMO_VULN=true
DEMO_SQLI_LAB=true
```

Poznamky:

- `DEMO_SQLI_LAB=true` zapina SQL Injection Lab endpoint `/api/sqli-demo/run`.
- `DEMO_VULN=true` povoluje zranitelne demo vetve.
- Pokud chcete spustit aplikaci pouze v bezpecnejsim rezimu, nastavte obe hodnoty na `false`.

## 3. Migrace a seed databaze

V adresari `backend` spustte:

```bash
npm run migrate
npm run db:seed
```

Vychozi seed vytvori testovaci ucty, skladove polozky, varianty, skladove pohyby a nastaveni aplikace.

Testovaci prihlaseni:

| Role | Email | Heslo |
| --- | --- | --- |
| admin | `admin@example.com` | `heslo123` |
| user | `user@example.com` | `heslo123` |
| user/viewer | `viewer@example.com` | `heslo123` |

Rozdil mezi seed prikazy:

- `npm run db:seed` doplni nebo aktualizuje deterministicka seed data a nemaze celou databazi.
- `npm run db:reset` smaze data v tabulkach, resetuje auto-increment hodnoty a znovu vlozi cisty seed. Pouzivejte jen pokud chcete zahodit aktualni lokalni data.

## 4. Spusteni backendu

V adresari `backend`:

```bash
npm run dev
```

Backend bezi na:

```text
http://localhost:4000
```

Rychla kontrola:

```bash
curl http://localhost:4000/health
```

Ocekavana odpoved obsahuje `ok: true`.

## 5. Frontend konfigurace

V novem terminalu:

```bash
cd frontend
npm install
```

Vytvorte soubor `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000/api
```

Poznamka: frontend ma ve `vite.config.js` nastavenou proxy pro `/api`, ale explicitni `VITE_API_URL` je pro lokalni spusteni nejcitelnejsi varianta.

## 6. Spusteni frontendu

V adresari `frontend`:

```bash
npm run dev
```

Frontend bude typicky dostupny na:

```text
http://localhost:5173
```

Otevrit aplikaci, prihlasit se jako admin:

```text
admin@example.com / heslo123
```

## 7. SQL Injection Lab

SQLi Lab je dostupny ve frontendu pouze prihlasenemu adminovi, pokud je v backendu nastaveno:

```env
DEMO_SQLI_LAB=true
DEMO_VULN=true
```

Backend endpoint:

```text
POST /api/sqli-demo/run
```

SQLi Lab podporuje rezimy:

- `safe` - parametrizovane dotazy,
- `vuln` - zamerne zranitelna vetev pro demonstraci SQL Injection.

Podporovane vzory testovani:

- `boolean`,
- `union`,
- `error`,
- `time`.

Prakticke scenare a namerene vysledky jsou ulozene v `docs/`, napr:

- `docs/manual-boolean-sqli-lab-scenario.md`,
- `docs/manual-union-sqli-lab-scenario.md`,
- `docs/manual-error-sqli-lab-scenario.md`,
- `docs/manual-time-sqli-lab-scenario.md`.

## 8. Volitelne testovaci skripty

V adresari `backend` jsou pripravene pomocne skripty:

```bash
npm run test:baseline:auth-secure
npm run test:security:sqli-negative
npm run test:demo:vulnerable
npm run test:demo:sqli-lab
```

Tyto skripty predpokladaji bezici backend a spravne nastavenou lokalni databazi. Demo testy pouzivejte pouze v lokalnim prostredi se zapnutymi demo flagy.

## 9. Nejbeznejsi problemy

### Backend hlasi chybu pripojeni k DB

Zkontrolujte:

- zda bezi MySQL server,
- zda existuje databaze `sql_crm`,
- zda sedi hodnoty v `backend/.env`,
- zda ma DB uzivatel prava k databazi.

### Frontend se nepripoji k backendu

Zkontrolujte:

- zda backend bezi na portu `4000`,
- zda `frontend/.env` obsahuje `VITE_API_URL=http://localhost:4000/api`,
- zda jste po zmene `.env` restartovali Vite dev server.

### SQLi Lab vraci 404 nebo safe rezim misto vuln

Zkontrolujte v `backend/.env`:

```env
DEMO_SQLI_LAB=true
DEMO_VULN=true
```

Po zmene `.env` restartujte backend.
