# Automatizované ověření SQL Injection pomocí sqlmap

Datum ověření: 2026-07-06

## Účel testování

Cílem testování bylo automatizovaně ověřit ručně prokázané SQL Injection scénáře v lokální modelové aplikaci Simple Inventory CRM. Testování bylo zaměřeno pouze na detekci zranitelnosti, identifikaci injektovatelného parametru a rozpoznané techniky.

Nebyly použity destruktivní ani dumpovací volby nástroje `sqlmap`. Nebyl proveden výpis databázových tabulek ani dat.

## Metodika

Testování navazovalo na ruční scénáře:

- Raw login SQL Injection,
- Inventory movements SQL Injection.

HTTP požadavky byly připraveny ve stylu exportu z Burp Suite Repeateru a uloženy do `docs/sqlmap/`. Requesty obsahující JWT token jsou v dokumentaci redigované hodnotou `<jwt_token>`.

Pro lokální spuštění byl token získán běžným přihlášením administrátorského uživatele přes:

```text
POST /api/auth/login
```

Použitý backend:

```text
http://127.0.0.1:4000
```

Režim aplikace:

```text
DEMO_VULN=true
```

Použitý nástroj:

```text
sqlmap 1.10.6#stable
```

Poznámka k provedení: redigované request soubory jsou uložené v `docs/sqlmap/`. Při lokálním běhu byla kvůli chování použité instalace `sqlmap` pro samotné testování použita ekvivalentní forma příkazů přes `-u`, `--data` a `--headers`. Request soubory zůstávají reprodukovatelným podkladem pro Burp Suite i ruční spuštění.

## Příprava HTTP požadavků v Burp Suite

Připravené request soubory:

```text
docs/sqlmap/inventory-vuln-request.txt
docs/sqlmap/inventory-safe-request.txt
docs/sqlmap/raw-login-vuln-request.txt
docs/sqlmap/raw-login-vuln-marker-request.txt
docs/sqlmap/raw-login-safe-request.txt
```

U endpointů pro inventory movements je nutná hlavička:

```http
Authorization: Bearer <jwt_token>
```

Skutečný token byl použit pouze pro lokální běh a není uložený v dokumentaci.

## Testované endpointy

| Test | Endpoint | Parametr | Účel |
| --- | --- | --- | --- |
| Inventory movements - vuln | `GET /api/demo/inventory-movements` | `type` | Ověřit zranitelnou demo větev. |
| Inventory movements - safe | `GET /api/inventory-movements` | `type` | Kontrolní bezpečná větev. |
| Raw login - vuln | `POST /api/auth/demo/raw-login` | JSON `email` | Ověřit zranitelnou autentizační demo větev. |
| Raw login - safe | `POST /api/auth/login` | JSON `email` | Kontrolní bezpečný login endpoint. |

## Test 1: Inventory movements - zranitelný endpoint

Použitý endpoint:

```text
GET /api/demo/inventory-movements?type=IN&limit=100&offset=0
```

Testovaný parametr:

```text
type
```

Spuštěný příkaz:

```bash
sqlmap -u 'http://127.0.0.1:4000/api/demo/inventory-movements?type=IN&limit=100&offset=0' \
  --headers='Authorization: Bearer <jwt_token>' \
  -p type --batch --dbms=mysql --risk=1 --level=2 --time-sec=1 --flush-session
```

Výsledek:

```text
GET parameter 'type' is vulnerable
back-end DBMS: MySQL >= 5.1
```

Rozpoznané techniky:

- boolean-based blind,
- error-based,
- time-based blind,
- UNION query.

Relevantní úryvek:

```text
Parameter: type (GET)
    Type: boolean-based blind
    Title: AND boolean-based blind - WHERE or HAVING clause

    Type: error-based
    Title: MySQL >= 5.1 AND error-based - WHERE, HAVING, ORDER BY or GROUP BY clause (EXTRACTVALUE)

    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)

    Type: UNION query
    Title: Generic UNION query (NULL) - 10 columns
```

Výstup je uložený v:

```text
docs/sqlmap/results-inventory-vuln.txt
```

## Test 2: Inventory movements - bezpečný endpoint

Použitý endpoint:

```text
GET /api/inventory-movements?type=IN&limit=100&offset=0
```

Testovaný parametr:

```text
type
```

Spuštěný příkaz:

```bash
sqlmap -u 'http://127.0.0.1:4000/api/inventory-movements?type=IN&limit=100&offset=0' \
  --headers='Authorization: Bearer <jwt_token>' \
  -p type --batch --dbms=mysql --risk=1 --level=2 --time-sec=1 --flush-session
```

Výsledek:

```text
GET parameter 'type' does not seem to be injectable
all tested parameters do not appear to be injectable
```

Pozorované HTTP kódy:

```text
400 (Bad Request)
```

Interpretace: bezpečný endpoint odmítal injekční payloady validací parametru `type`, protože povolené hodnoty jsou pouze `IN`, `OUT` a `ADJUST`.

Výstup je uložený v:

```text
docs/sqlmap/results-inventory-safe.txt
```

## Test 3: Raw login - zranitelný endpoint

Použitý endpoint:

```text
POST /api/auth/demo/raw-login
```

Testovaný parametr:

```text
JSON email
```

Spuštěný příkaz:

```bash
sqlmap -u 'http://127.0.0.1:4000/api/auth/demo/raw-login' \
  --method=POST \
  --headers='Content-Type: application/json' \
  --data='{"email":"admin@example.com","password":"wrong-password"}' \
  -p email --batch --dbms=mysql --risk=1 --level=2 --time-sec=1 \
  --ignore-code=401 --flush-session
```

Poznámka: `--ignore-code=401` bylo použito proto, že testovaný login endpoint při běžném neúspěšném přihlášení očekávaně vrací `401 Unauthorized`. Bez této volby `sqlmap` test ukončil jako problém s autorizací.

Výsledek:

```text
(custom) POST parameter 'JSON email' is vulnerable
back-end DBMS: MySQL >= 5.1
```

Rozpoznané techniky:

- boolean-based blind,
- error-based,
- time-based blind.

Relevantní úryvek:

```text
Parameter: JSON email ((custom) POST)
    Type: boolean-based blind
    Title: AND boolean-based blind - WHERE or HAVING clause (subquery - comment)

    Type: error-based
    Title: MySQL >= 5.1 AND error-based - WHERE, HAVING, ORDER BY or GROUP BY clause (EXTRACTVALUE)

    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
```

Automatizovaný běh u raw login endpointu nepotvrdil UNION techniku jako finální exploatovatelný výstup, přestože během testu rozpoznal, že dotaz má 5 sloupců. To odpovídá charakteru login endpointu: ruční UNION exploit je možný, ale nástroj vyhodnocuje především rozdíly v odpovědích a neprováděl ručně připravený kontrolovaný login bypass.

Výstup je uložený v:

```text
docs/sqlmap/results-raw-login-vuln.txt
```

## Test 4: Raw login - bezpečný endpoint

Použitý endpoint:

```text
POST /api/auth/login
```

Testovaný parametr:

```text
JSON email
```

Spuštěný příkaz:

```bash
sqlmap -u 'http://127.0.0.1:4000/api/auth/login' \
  --method=POST \
  --headers='Content-Type: application/json' \
  --data='{"email":"admin@example.com","password":"wrong-password"}' \
  -p email --batch --dbms=mysql --risk=1 --level=2 --time-sec=1 \
  --ignore-code=400,401 --flush-session
```

Poznámka: `--ignore-code=400,401` bylo použito kvůli očekávanému chování bezpečného loginu. SQLi payloady jsou odmítány validací e-mailu nebo běžnou autentizační kontrolou.

Výsledek:

```text
(custom) POST parameter 'JSON email' does not seem to be injectable
all tested parameters do not appear to be injectable
```

Pozorované HTTP kódy:

```text
401 (Unauthorized)
400 (Bad Request)
```

Interpretace: bezpečný endpoint neumožnil potvrdit SQL Injection. Vstup je validován jako e-mail a následné načtení uživatele používá parametrizovaný dotaz.

Výstup je uložený v:

```text
docs/sqlmap/results-raw-login-safe.txt
```

## Souhrn naměřených výsledků

| Test | Endpoint | Parametr | Výsledek sqlmap | Rozpoznané techniky | Poznámka |
| --- | --- | --- | --- | --- | --- |
| Inventory movements - vuln | `GET /api/demo/inventory-movements` | `type` | injektovatelný | boolean, error, time, UNION | sqlmap potvrdil i 10 sloupců pro UNION. |
| Inventory movements - safe | `GET /api/inventory-movements` | `type` | neinjektovatelný | žádné | Payloady končily validací `400 Bad Request`. |
| Raw login - vuln | `POST /api/auth/demo/raw-login` | JSON `email` | injektovatelný | boolean, error, time | Bylo nutné ignorovat očekávané `401`. |
| Raw login - safe | `POST /api/auth/login` | JSON `email` | neinjektovatelný | žádné | Validace e-mailu a parametrizovaný dotaz zabránily potvrzení SQLi. |

## Limity automatizovaného testování

`sqlmap` nenahrazuje ruční analýzu. U obou zranitelných endpointů byl nástroj úspěšný v detekci injektovatelného parametru, ale interpretace výsledku stále vyžaduje znalost aplikace.

U endpointů s JWT tokenem je zásadní správně připravit HTTP request včetně hlavičky `Authorization`. Bez tokenu by demo inventory endpoint vracel `401` a test by neměřil SQL Injection, ale pouze chybějící autentizaci.

U JSON POST endpointů může být nutné explicitně určit testovaný parametr pomocí `-p email`. Pro dokumentaci byla připravena i marker varianta requestu `raw-login-vuln-marker-request.txt`, ale v tomto běhu ji nebylo nutné použít, protože `sqlmap` JSON parametr rozpoznal.

U raw login endpointu je důležitý kontext: ruční exploit je založený na UNION payloadu s kontrolovaným `password_hash`, zatímco automatizovaný běh rozpoznal hlavně boolean, error a time-based techniky. Automatizovaný nástroj tedy potvrdil injektovatelnost parametru `email`, ale samotný login bypass zůstává lépe demonstrovatelný ručním requestem.

U bezpečných endpointů se opakovaně objevovaly HTTP kódy `400` nebo `401`, což odpovídá validaci vstupu a běžnému autentizačnímu chování. Tyto kódy nejsou důkazem zranitelnosti; v daném kontextu potvrzují, že payload nebyl interpretován jako SQL syntaxe.

## Závěr

Automatizované testování pomocí `sqlmap` potvrdilo rozdíl mezi zranitelnými a bezpečnými větvemi aplikace.

U `GET /api/demo/inventory-movements` byl parametr `type` potvrzen jako injektovatelný a nástroj rozpoznal boolean-based, error-based, time-based i UNION techniku. To odpovídá ručnímu zjištění, že demo endpoint skládá SQL řetězec přímou interpolací vstupu.

U `POST /api/auth/demo/raw-login` byl JSON parametr `email` potvrzen jako injektovatelný. Nástroj rozpoznal boolean-based, error-based a time-based techniky. Výsledek potvrzuje ruční analýzu zranitelného SQL dotazu v autentizační logice.

Bezpečné endpointy `GET /api/inventory-movements` a `POST /api/auth/login` nebyly nástrojem potvrzeny jako injektovatelné. Chování odpovídá validaci vstupů a použití parametrizovaných dotazů.

Testování bylo provedeno bez destruktivních voleb, bez dumpování databáze a bez zveřejnění skutečných JWT tokenů.
