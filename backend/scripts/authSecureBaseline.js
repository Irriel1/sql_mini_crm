const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

const state = {
  adminToken: null,
  userToken: null,
  createdItemId: null,
  createdVariantId: null,
  createdMovementId: null,
  firstLogId: null,
};

const results = [];

class SkipTest extends Error {
  constructor(message) {
    super(message);
    this.name = 'SkipTest';
  }
}

function skipIf(condition, message) {
  if (condition) throw new SkipTest(message);
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function expectStatus(response, expected) {
  expect(
    response.status === expected,
    `Expected HTTP ${expected}, got ${response.status}. Body: ${JSON.stringify(response.body)}`
  );
}

function auth(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function summarizeBody(body) {
  if (body == null) return null;
  const json = JSON.stringify(body);
  return json.length > 500 ? `${json.slice(0, 500)}...` : json;
}

async function request(method, path, { token, body } = {}) {
  const startedAt = Date.now();
  const headers = {
    ...auth(token),
  };

  const options = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let parsed = null;

  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      parsed = text;
    }
  }

  return {
    method,
    path,
    status: response.status,
    durationMs: Date.now() - startedAt,
    body: parsed,
  };
}

async function test(category, name, fn) {
  try {
    const detail = await fn();
    results.push({
      category,
      name,
      result: 'PASS',
      detail: detail || '',
    });
  } catch (err) {
    if (err instanceof SkipTest) {
      results.push({
        category,
        name,
        result: 'SKIP',
        detail: err.message,
      });
      return;
    }

    results.push({
      category,
      name,
      result: 'FAIL',
      detail: err.message,
    });
  }
}

async function main() {
  // Tento runner je baseline pro bezpecnou vrstvu. SQLi payloady sem zamerne
  // nepatri; ty budou v dalsi fazi proti demo/vuln a SQLi Lab endpointum.
  await test('health', 'GET /health returns 200', async () => {
    const res = await request('GET', '/health');
    expectStatus(res, 200);
    expect(res.body?.ok === true, 'Expected ok=true');
    return `${res.status} in ${res.durationMs}ms`;
  });

  await test('health', 'GET /api/healthz returns 200', async () => {
    const res = await request('GET', '/api/healthz');
    expectStatus(res, 200);
    expect(res.body?.ok === true, 'Expected ok=true');
    return `${res.status} in ${res.durationMs}ms`;
  });

  await test('auth', 'admin login succeeds', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: { email: 'admin@example.com', password: 'heslo123' },
    });
    expectStatus(res, 200);
    expect(res.body?.token, 'Expected token');
    expect(res.body?.user?.role === 'admin', 'Expected admin role');
    state.adminToken = res.body.token;
    return `admin id=${res.body.user.id}`;
  });

  await test('auth', 'user login succeeds', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: { email: 'user@example.com', password: 'heslo123' },
    });
    expectStatus(res, 200);
    expect(res.body?.token, 'Expected token');
    expect(res.body?.user?.role === 'user', 'Expected user role');
    state.userToken = res.body.token;
    return `user id=${res.body.user.id}`;
  });

  await test('auth', 'bad password returns 401', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: { email: 'admin@example.com', password: 'wrong-password' },
    });
    expectStatus(res, 401);
    return summarizeBody(res.body);
  });

  await test('auth', 'missing email returns 400', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: { password: 'heslo123' },
    });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('auth', 'malformed email returns 400', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: { email: 'not-an-email', password: 'heslo123' },
    });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('auth', 'public register creates ordinary user by default', async () => {
    const res = await request('POST', '/api/auth/register', {
      body: {
        email: 'baseline-register@example.com',
        password: 'heslo123',
        name: 'Baseline Register',
      },
    });
    expectStatus(res, 201);
    expect(res.body?.user?.role === 'user', 'Expected registered role=user');
    return `created user id=${res.body.user.id}`;
  });

  await test('auth', 'duplicate register returns 400', async () => {
    const res = await request('POST', '/api/auth/register', {
      body: {
        email: 'baseline-register@example.com',
        password: 'heslo123',
        name: 'Baseline Register Duplicate',
      },
    });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('auth', 'public register must not grant admin role', async () => {
    const res = await request('POST', '/api/auth/register', {
      body: {
        email: 'baseline-admin-escalation@example.com',
        password: 'heslo123',
        name: 'Admin Escalation Attempt',
        role: 'admin',
      },
    });
    expect(res.status === 400 || res.status === 403 || res.body?.user?.role === 'user',
      `Public register granted unexpected role. Status=${res.status}, body=${summarizeBody(res.body)}`);
    return `status=${res.status}, role=${res.body?.user?.role || 'n/a'}`;
  });

  await test('auth', 'GET /api/auth/me without token returns 401', async () => {
    const res = await request('GET', '/api/auth/me');
    expectStatus(res, 401);
    return summarizeBody(res.body);
  });

  await test('auth', 'GET /api/auth/me with invalid token returns 401', async () => {
    const res = await request('GET', '/api/auth/me', { token: 'invalid.token.value' });
    expectStatus(res, 401);
    return summarizeBody(res.body);
  });

  await test('auth', 'GET /api/auth/me with admin token returns user', async () => {
    const res = await request('GET', '/api/auth/me', { token: state.adminToken });
    expectStatus(res, 200);
    expect(res.body?.email === 'admin@example.com', 'Expected admin@example.com');
    return `role=${res.body.role}`;
  });

  await test('dashboard', 'GET /api/dashboard without token returns 401', async () => {
    const res = await request('GET', '/api/dashboard');
    expectStatus(res, 401);
    return summarizeBody(res.body);
  });

  await test('dashboard', 'GET /api/dashboard with user token returns aggregate data', async () => {
    const res = await request('GET', '/api/dashboard', { token: state.userToken });
    expectStatus(res, 200);
    expect(res.body?.items_total >= 5, 'Expected at least 5 active items');
    expect(res.body?.variants_total >= 7, 'Expected at least 7 variants');
    return `items=${res.body.items_total}, variants=${res.body.variants_total}`;
  });

  await test('items', 'GET /api/items without token returns 401', async () => {
    const res = await request('GET', '/api/items');
    expectStatus(res, 401);
    return summarizeBody(res.body);
  });

  await test('items', 'GET /api/items with search returns seeded data', async () => {
    const res = await request('GET', '/api/items?search=Audit&limit=10&offset=0&sort=name&dir=ASC', {
      token: state.userToken,
    });
    expectStatus(res, 200);
    expect(Array.isArray(res.body?.items), 'Expected items array');
    expect(res.body.items.some((item) => item.name === 'Audit Laptop'), 'Expected Audit Laptop');
    return `count=${res.body.items.length}`;
  });

  await test('items', 'GET /api/items invalid limit returns 400', async () => {
    const res = await request('GET', '/api/items?limit=0', { token: state.userToken });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('items', 'GET /api/items/:id returns detail with variants', async () => {
    const res = await request('GET', '/api/items/1', { token: state.userToken });
    expectStatus(res, 200);
    expect(res.body?.name === 'Audit Laptop', 'Expected Audit Laptop');
    expect(res.body?.variants_count === 2, 'Expected 2 variants');
    return `stock_total=${res.body.stock_total}`;
  });

  await test('items', 'GET /api/items/:id rejects malformed id', async () => {
    const res = await request('GET', '/api/items/12abc', { token: state.userToken });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('items', 'POST /api/items creates item for authenticated user', async () => {
    const res = await request('POST', '/api/items', {
      token: state.userToken,
      body: {
        name: 'Baseline Created Item',
        category: 'Baseline',
        description: 'Created by auth secure baseline test.',
      },
    });
    expectStatus(res, 201);
    expect(res.body?.item?.id, 'Expected created item id');
    state.createdItemId = res.body.item.id;
    return `created item id=${state.createdItemId}`;
  });

  await test('items', 'PUT /api/items/:id as user returns 403', async () => {
    skipIf(!state.createdItemId, 'created item missing');
    const res = await request('PUT', `/api/items/${state.createdItemId}`, {
      token: state.userToken,
      body: {
        name: 'Baseline Created Item User Update',
        category: 'Baseline',
        description: 'User should not update item.',
      },
    });
    expectStatus(res, 403);
    return summarizeBody(res.body);
  });

  await test('items', 'PUT /api/items/:id as admin succeeds', async () => {
    skipIf(!state.createdItemId, 'created item missing');
    const res = await request('PUT', `/api/items/${state.createdItemId}`, {
      token: state.adminToken,
      body: {
        name: 'Baseline Created Item Updated',
        category: 'Baseline',
        description: 'Updated by admin baseline test.',
      },
    });
    expectStatus(res, 200);
    expect(res.body?.item?.name === 'Baseline Created Item Updated', 'Expected updated name');
    return `updated item id=${res.body.item.id}`;
  });

  await test('items', 'DELETE /api/items/:id as user returns 403', async () => {
    skipIf(!state.createdItemId, 'created item missing');
    const res = await request('DELETE', `/api/items/${state.createdItemId}`, { token: state.userToken });
    expectStatus(res, 403);
    return summarizeBody(res.body);
  });

  await test('items', 'DELETE /api/items/:id as admin succeeds', async () => {
    skipIf(!state.createdItemId, 'created item missing');
    const res = await request('DELETE', `/api/items/${state.createdItemId}`, { token: state.adminToken });
    expectStatus(res, 204);
    return `deleted item id=${state.createdItemId}`;
  });

  await test('items', 'GET deleted item returns 404', async () => {
    skipIf(!state.createdItemId, 'created item missing');
    const res = await request('GET', `/api/items/${state.createdItemId}`, { token: state.adminToken });
    expectStatus(res, 404);
    return summarizeBody(res.body);
  });

  await test('variants', 'GET /api/items/:itemId/variants returns seeded variants', async () => {
    const res = await request('GET', '/api/items/1/variants?limit=10&offset=0', { token: state.userToken });
    expectStatus(res, 200);
    expect(Array.isArray(res.body?.variants), 'Expected variants array');
    expect(res.body.variants.length === 2, 'Expected 2 variants for item 1');
    return `count=${res.body.variants.length}`;
  });

  await test('variants', 'GET /api/items/:itemId/variants rejects malformed itemId', async () => {
    const res = await request('GET', '/api/items/abc/variants', { token: state.userToken });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('variants', 'POST /api/items/:itemId/variants creates correct variant', async () => {
    const res = await request('POST', '/api/items/1/variants', {
      token: state.userToken,
      body: {
        sku: 'BASE-VAR-1',
        variant_name: 'Baseline Variant',
        price: 1234.5,
        stock_count: 9,
      },
    });
    if (res.body?.variant?.id) state.createdVariantId = res.body.variant.id;
    expectStatus(res, 201);
    expect(Number(res.body?.variant?.price) === 1234.5, `Expected price 1234.5, got ${res.body?.variant?.price}`);
    expect(Number(res.body?.variant?.stock_count) === 9, `Expected stock_count 9, got ${res.body?.variant?.stock_count}`);
    return `created variant id=${state.createdVariantId}`;
  });

  await test('variants', 'GET /api/variants/:id returns created variant', async () => {
    skipIf(!state.createdVariantId, 'created variant missing');
    const res = await request('GET', `/api/variants/${state.createdVariantId}`, { token: state.userToken });
    expectStatus(res, 200);
    expect(res.body?.variant?.sku === 'BASE-VAR-1', 'Expected BASE-VAR-1');
    return `variant id=${res.body.variant.id}`;
  });

  await test('variants', 'PUT /api/variants/:id updates created variant', async () => {
    skipIf(!state.createdVariantId, 'created variant missing');
    const res = await request('PUT', `/api/variants/${state.createdVariantId}`, {
      token: state.userToken,
      body: {
        sku: 'BASE-VAR-1-UPD',
        variant_name: 'Baseline Variant Updated',
        price: 1500,
        stock_count: 11,
      },
    });
    expectStatus(res, 200);
    expect(res.body?.variant?.sku === 'BASE-VAR-1-UPD', 'Expected updated SKU');
    expect(Number(res.body?.variant?.stock_count) === 11, 'Expected updated stock_count');
    return `updated variant id=${res.body.variant.id}`;
  });

  await test('variants', 'DELETE seeded variant with movements returns 409', async () => {
    const res = await request('DELETE', '/api/variants/1', { token: state.userToken });
    expectStatus(res, 409);
    return summarizeBody(res.body);
  });

  await test('variants', 'DELETE created variant without movements succeeds', async () => {
    skipIf(!state.createdVariantId, 'created variant missing');
    const res = await request('DELETE', `/api/variants/${state.createdVariantId}`, { token: state.userToken });
    expectStatus(res, 204);
    return `deleted variant id=${state.createdVariantId}`;
  });

  await test('movements', 'GET /api/inventory-movements without token returns 401', async () => {
    const res = await request('GET', '/api/inventory-movements');
    expectStatus(res, 401);
    return summarizeBody(res.body);
  });

  await test('movements', 'GET /api/inventory-movements with user token returns movements', async () => {
    const res = await request('GET', '/api/inventory-movements?limit=20&offset=0', { token: state.userToken });
    expectStatus(res, 200);
    expect(Array.isArray(res.body?.movements), 'Expected movements array');
    expect(res.body.movements.length >= 10, 'Expected at least 10 movements');
    return `count=${res.body.movements.length}`;
  });

  await test('movements', 'GET /api/inventory-movements type filter works', async () => {
    const res = await request('GET', '/api/inventory-movements?type=IN&limit=20&offset=0', { token: state.userToken });
    expectStatus(res, 200);
    expect(res.body.movements.every((movement) => movement.type === 'IN'), 'Expected only IN movements');
    return `count=${res.body.movements.length}`;
  });

  await test('movements', 'GET /api/inventory-movements invalid type returns 400', async () => {
    const res = await request('GET', '/api/inventory-movements?type=DROP', { token: state.userToken });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('movements', 'GET /api/inventory-movements/:id returns detail', async () => {
    const res = await request('GET', '/api/inventory-movements/1', { token: state.userToken });
    expectStatus(res, 200);
    expect(res.body?.movement?.id === 1, 'Expected movement id=1');
    return `type=${res.body.movement.type}`;
  });

  await test('movements', 'GET /api/inventory-movements/:id malformed id returns 400', async () => {
    const res = await request('GET', '/api/inventory-movements/abc', { token: state.userToken });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('movements', 'POST /api/inventory-movements creates safe movement', async () => {
    const res = await request('POST', '/api/inventory-movements', {
      token: state.userToken,
      body: {
        variant_id: 3,
        type: 'IN',
        quantity: 1,
        note: 'Baseline safe movement create.',
      },
    });
    expectStatus(res, 201);
    expect(res.body?.movement?.id, 'Expected movement id');
    state.createdMovementId = res.body.movement.id;
    return `movement id=${state.createdMovementId}`;
  });

  await test('movements', 'POST /api/inventory-movements prevents negative stock', async () => {
    const res = await request('POST', '/api/inventory-movements', {
      token: state.userToken,
      body: {
        variant_id: 7,
        type: 'OUT',
        quantity: 99999,
        note: 'Baseline negative stock check.',
      },
    });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('settings', 'GET /api/settings without token returns 401', async () => {
    const res = await request('GET', '/api/settings');
    expectStatus(res, 401);
    return summarizeBody(res.body);
  });

  await test('settings', 'GET /api/settings with user token returns settings', async () => {
    const res = await request('GET', '/api/settings', { token: state.userToken });
    expectStatus(res, 200);
    expect(res.body?.settings?.warehouse_name === 'SQL CRM Test Warehouse', 'Expected seeded warehouse name');
    return `currency=${res.body.settings.currency}`;
  });

  await test('settings', 'PUT /api/settings as user returns 403', async () => {
    const res = await request('PUT', '/api/settings', {
      token: state.userToken,
      body: { warehouse_name: 'User Should Not Update' },
    });
    expectStatus(res, 403);
    return summarizeBody(res.body);
  });

  await test('settings', 'PUT /api/settings as admin succeeds', async () => {
    const res = await request('PUT', '/api/settings', {
      token: state.adminToken,
      body: {
        warehouse_name: 'SQL CRM Baseline Warehouse',
        currency: 'CZK',
        low_stock_threshold: 6,
      },
    });
    expectStatus(res, 200);
    expect(res.body?.settings?.low_stock_threshold === 6, 'Expected threshold 6');
    return `warehouse=${res.body.settings.warehouse_name}`;
  });

  await test('settings', 'PUT /api/settings forbids id field', async () => {
    const res = await request('PUT', '/api/settings', {
      token: state.adminToken,
      body: { id: 2, warehouse_name: 'Invalid ID Update' },
    });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('logs', 'GET /api/logs without token returns 401', async () => {
    const res = await request('GET', '/api/logs');
    expectStatus(res, 401);
    return summarizeBody(res.body);
  });

  await test('logs', 'GET /api/logs as user returns 403', async () => {
    const res = await request('GET', '/api/logs', { token: state.userToken });
    expectStatus(res, 403);
    return summarizeBody(res.body);
  });

  await test('logs', 'GET /api/logs as admin returns logs', async () => {
    const res = await request('GET', '/api/logs?limit=20&offset=0', { token: state.adminToken });
    expectStatus(res, 200);
    expect(Array.isArray(res.body?.logs), 'Expected logs array');
    expect(res.body.logs.length > 0, 'Expected at least one log');
    state.firstLogId = res.body.logs[0].id;
    return `count=${res.body.logs.length}, first=${state.firstLogId}`;
  });

  await test('logs', 'GET /api/logs/:id as admin returns detail', async () => {
    skipIf(!state.firstLogId, 'first log id missing');
    const res = await request('GET', `/api/logs/${state.firstLogId}`, { token: state.adminToken });
    expectStatus(res, 200);
    expect(res.body?.log?.id === state.firstLogId, 'Expected selected log id');
    return `action=${res.body.log.action}`;
  });

  await test('logs', 'GET /api/logs invalid limit returns 400', async () => {
    const res = await request('GET', '/api/logs?limit=0', { token: state.adminToken });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('system', 'GET /api/system/health without token returns 401', async () => {
    const res = await request('GET', '/api/system/health');
    expectStatus(res, 401);
    return summarizeBody(res.body);
  });

  await test('system', 'GET /api/system/health with user token returns db ok', async () => {
    const res = await request('GET', '/api/system/health', { token: state.userToken });
    expectStatus(res, 200);
    expect(res.body?.db?.ok === true, 'Expected db.ok=true');
    return `uptime=${res.body.uptime_seconds}`;
  });

  await test('system', 'GET /api/system/version with user token returns version', async () => {
    const res = await request('GET', '/api/system/version', { token: state.userToken });
    expectStatus(res, 200);
    expect(res.body?.version, 'Expected version');
    return `version=${res.body.version}`;
  });

  await test('system', 'GET /api/system/info with user token returns runtime info', async () => {
    const res = await request('GET', '/api/system/info', { token: state.userToken });
    expectStatus(res, 200);
    expect(res.body?.runtime?.node, 'Expected runtime node');
    expect(res.body?.db?.ok === true, 'Expected db.ok=true');
    return `node=${res.body.runtime.node}`;
  });

  await test('review-only', 'GET /api/admin without token should not be public', async () => {
    const res = await request('GET', '/api/admin');
    expect(res.status === 401 || res.status === 403 || res.status === 404,
      `Expected protected/hidden admin placeholder, got ${res.status}. Body=${summarizeBody(res.body)}`);
    return `status=${res.status}`;
  });

  await test('review-only', 'POST /api/admin/reset-db without token should not be public', async () => {
    const res = await request('POST', '/api/admin/reset-db');
    expect(res.status === 401 || res.status === 403 || res.status === 404,
      `Expected protected/hidden reset placeholder, got ${res.status}. Body=${summarizeBody(res.body)}`);
    return `status=${res.status}`;
  });

  await test('review-only', 'GET /api/inventory without token should not be public', async () => {
    const res = await request('GET', '/api/inventory');
    expect(res.status === 401 || res.status === 403 || res.status === 404,
      `Expected protected/hidden inventory placeholder, got ${res.status}. Body=${summarizeBody(res.body)}`);
    return `status=${res.status}`;
  });

  const counts = results.reduce((acc, row) => {
    acc[row.result] = (acc[row.result] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    baseUrl: BASE_URL,
    summary: counts,
    results,
  }, null, 2));

  if ((counts.FAIL || 0) > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
