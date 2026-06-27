const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

const PAYLOADS = {
  quote: "'",
  doubleQuote: '"',
  booleanTrue: "%' OR 1=1 -- ",
  booleanFalse: "%' AND 1=2 -- ",
  unionProbe: "%' UNION SELECT 1,2,3,4 -- ",
  timeProbe: "ZZZ%' OR IF(1=1,SLEEP(2),0)=0 -- ",
  numericTrue: '1 OR 1=1',
  numericFalse: '1 AND 1=2',
  orderByTime: 'created_at DESC, (SELECT SLEEP(2))',
};

const state = {
  adminToken: null,
  userToken: null,
  createdItemId: null,
  createdVariantId: null,
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

function encode(value) {
  return encodeURIComponent(value);
}

function summarizeBody(body) {
  if (body == null) return null;
  const json = JSON.stringify(body);
  return json.length > 500 ? `${json.slice(0, 500)}...` : json;
}

function assertNoSqlLeak(response) {
  const body = JSON.stringify(response.body || '');
  const forbidden = [
    'ER_PARSE_ERROR',
    'SQL syntax',
    'You have an error in your SQL syntax',
    'ER_BAD_FIELD_ERROR',
    'ER_NO_SUCH_TABLE',
    'ER_WRONG_FIELD_WITH_GROUP',
    'ER_OPERAND_COLUMNS',
    'ER_DUP_ENTRY',
    'mysql2',
    'node_modules/mysql',
    'stack',
  ];

  for (const needle of forbidden) {
    expect(
      !body.toLowerCase().includes(needle.toLowerCase()),
      `Response appears to leak SQL/debug detail (${needle}): ${summarizeBody(response.body)}`
    );
  }
}

function assertFast(response, maxMs = 1500) {
  expect(
    response.durationMs < maxMs,
    `Expected no SQL time delay. Took ${response.durationMs}ms, threshold ${maxMs}ms`
  );
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

async function login(email) {
  const res = await request('POST', '/api/auth/login', {
    body: { email, password: 'heslo123' },
  });
  expectStatus(res, 200);
  expect(res.body?.token, `Expected token for ${email}`);
  return res.body.token;
}

async function main() {
  // Tento runner testuje jen secure endpointy. Demo/vuln endpointy a SQLi Lab
  // patri az do dalsich fazi, kde naopak ocekavame rozdil mezi safe/vuln chovanim.
  await test('setup', 'admin login for test context', async () => {
    state.adminToken = await login('admin@example.com');
    return 'admin token ready';
  });

  await test('setup', 'user login for test context', async () => {
    state.userToken = await login('user@example.com');
    return 'user token ready';
  });

  await test('auth-negative', 'login email SQLi payload rejected by email validation', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: { email: `admin@example.com${PAYLOADS.booleanTrue}`, password: 'heslo123' },
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('auth-negative', 'login password SQLi payload does not authenticate', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: { email: 'admin@example.com', password: PAYLOADS.booleanTrue },
    });
    expectStatus(res, 401);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('auth-negative', 'register email SQLi payload rejected by email validation', async () => {
    const res = await request('POST', '/api/auth/register', {
      body: {
        email: `secure-negative${PAYLOADS.booleanTrue}@example.com`,
        password: 'heslo123',
        name: 'Secure Negative Register',
      },
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('auth-negative', 'register name SQLi payload stored as ordinary text', async () => {
    const payload = `Secure Register Name ${PAYLOADS.unionProbe}`;
    const res = await request('POST', '/api/auth/register', {
      body: {
        email: 'secure-negative-register-name@example.com',
        password: 'heslo123',
        name: payload,
      },
    });
    expectStatus(res, 201);
    expect(res.body?.user?.name === payload, 'Expected name payload to be returned unchanged');
    expect(res.body?.user?.role === 'user', 'Expected public register role=user');
    assertNoSqlLeak(res);
    return `created user id=${res.body.user.id}`;
  });

  await test('items-negative', 'items search boolean payload returns controlled row set', async () => {
    const res = await request('GET', `/api/items?search=${encode(PAYLOADS.booleanTrue)}&limit=100&offset=0`, {
      token: state.userToken,
    });
    expectStatus(res, 200);
    expect(Array.isArray(res.body?.items), 'Expected items array');
    expect(res.body.items.length === 0, `Expected no expanded rows, got ${res.body.items.length}`);
    assertNoSqlLeak(res);
    return `rowCount=${res.body.items.length}`;
  });

  await test('items-negative', 'items search time payload does not delay response', async () => {
    const res = await request('GET', `/api/items?search=${encode(PAYLOADS.timeProbe)}&limit=100&offset=0`, {
      token: state.userToken,
    });
    expectStatus(res, 200);
    expect(Array.isArray(res.body?.items), 'Expected items array');
    expect(res.body.items.length === 0, `Expected no expanded rows, got ${res.body.items.length}`);
    assertFast(res);
    assertNoSqlLeak(res);
    return `rowCount=${res.body.items.length}, durationMs=${res.durationMs}`;
  });

  await test('items-negative', 'items sort SQLi payload rejected by allowlist', async () => {
    const res = await request('GET', `/api/items?sort=${encode(PAYLOADS.orderByTime)}`, {
      token: state.userToken,
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('items-negative', 'items dir SQLi payload rejected by allowlist', async () => {
    const res = await request('GET', `/api/items?dir=${encode(PAYLOADS.booleanTrue)}`, {
      token: state.userToken,
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('items-negative', 'item detail rejects malformed numeric SQLi id', async () => {
    const res = await request('GET', `/api/items/${encode(PAYLOADS.numericTrue)}`, {
      token: state.userToken,
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('items-negative', 'item create stores SQLi-looking name as ordinary text', async () => {
    const payload = `Secure Item ${PAYLOADS.booleanTrue}`;
    const res = await request('POST', '/api/items', {
      token: state.userToken,
      body: {
        name: payload,
        category: 'Secure Negative',
        description: `Description ${PAYLOADS.unionProbe}`,
      },
    });
    expectStatus(res, 201);
    expect(res.body?.item?.name === payload, 'Expected item name payload unchanged');
    state.createdItemId = res.body.item.id;
    assertNoSqlLeak(res);
    return `created item id=${state.createdItemId}`;
  });

  await test('items-negative', 'item update stores SQLi-looking text as ordinary text', async () => {
    skipIf(!state.createdItemId, 'created item missing');
    const payload = `Updated Item ${PAYLOADS.timeProbe}`;
    const res = await request('PUT', `/api/items/${state.createdItemId}`, {
      token: state.adminToken,
      body: {
        name: payload,
        category: 'Secure Negative',
        description: `Updated description ${PAYLOADS.quote}`,
      },
    });
    expectStatus(res, 200);
    expect(res.body?.item?.name === payload, 'Expected updated item name payload unchanged');
    assertNoSqlLeak(res);
    return `updated item id=${state.createdItemId}`;
  });

  await test('variants-negative', 'item variants limit SQLi payload rejected by numeric validation', async () => {
    const res = await request('GET', `/api/items/1/variants?limit=${encode(PAYLOADS.numericTrue)}`, {
      token: state.userToken,
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('variants-negative', 'item variants malformed itemId rejected', async () => {
    const res = await request('GET', `/api/items/${encode(PAYLOADS.numericTrue)}/variants`, {
      token: state.userToken,
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('variants-negative', 'variant detail malformed id rejected', async () => {
    const res = await request('GET', `/api/variants/${encode(PAYLOADS.numericTrue)}`, {
      token: state.userToken,
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('variants-negative', 'variant create stores SQLi-looking text as ordinary text', async () => {
    const payload = `Secure Variant ${PAYLOADS.unionProbe}`;
    const expectedPayload = payload.trim();
    const res = await request('POST', '/api/items/1/variants', {
      token: state.userToken,
      body: {
        sku: 'SEC-NEG-VAR-1',
        variant_name: payload,
        price: 321,
        stock_count: 5,
      },
    });
    expectStatus(res, 201);
    expect(res.body?.variant?.variant_name === expectedPayload, 'Expected variant_name payload unchanged except Joi trim');
    state.createdVariantId = res.body.variant.id;
    assertNoSqlLeak(res);
    return `created variant id=${state.createdVariantId}`;
  });

  await test('variants-negative', 'variant update stores SQLi-looking text as ordinary text', async () => {
    skipIf(!state.createdVariantId, 'created variant missing');
    const payload = `Secure Variant Updated ${PAYLOADS.booleanFalse}`;
    const expectedPayload = payload.trim();
    const res = await request('PUT', `/api/variants/${state.createdVariantId}`, {
      token: state.userToken,
      body: {
        sku: 'SEC-NEG-VAR-1-UPD',
        variant_name: payload,
        price: 654,
        stock_count: 6,
      },
    });
    expectStatus(res, 200);
    expect(res.body?.variant?.variant_name === expectedPayload, 'Expected updated variant_name payload unchanged except Joi trim');
    assertNoSqlLeak(res);
    return `updated variant id=${state.createdVariantId}`;
  });

  await test('movements-negative', 'movement list variant_id SQLi payload rejected by numeric validation', async () => {
    const res = await request('GET', `/api/inventory-movements?variant_id=${encode(PAYLOADS.numericTrue)}`, {
      token: state.userToken,
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('movements-negative', 'movement list type SQLi payload rejected by enum validation', async () => {
    const res = await request('GET', `/api/inventory-movements?type=${encode(PAYLOADS.booleanTrue)}`, {
      token: state.userToken,
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('movements-negative', 'movement list note boolean payload returns controlled row set', async () => {
    const res = await request('GET', `/api/inventory-movements?note=${encode(PAYLOADS.booleanTrue)}&limit=100&offset=0`, {
      token: state.userToken,
    });
    expectStatus(res, 200);
    expect(Array.isArray(res.body?.movements), 'Expected movements array');
    expect(res.body.movements.length === 0, `Expected no expanded rows, got ${res.body.movements.length}`);
    assertNoSqlLeak(res);
    return `rowCount=${res.body.movements.length}`;
  });

  await test('movements-negative', 'movement list note time payload does not delay response', async () => {
    const res = await request('GET', `/api/inventory-movements?note=${encode(PAYLOADS.timeProbe)}&limit=100&offset=0`, {
      token: state.userToken,
    });
    expectStatus(res, 200);
    expect(Array.isArray(res.body?.movements), 'Expected movements array');
    expect(res.body.movements.length === 0, `Expected no expanded rows, got ${res.body.movements.length}`);
    assertFast(res);
    assertNoSqlLeak(res);
    return `rowCount=${res.body.movements.length}, durationMs=${res.durationMs}`;
  });

  await test('movements-negative', 'movement detail malformed id rejected', async () => {
    const res = await request('GET', `/api/inventory-movements/${encode(PAYLOADS.numericTrue)}`, {
      token: state.userToken,
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('movements-negative', 'movement create variant_id SQLi payload rejected', async () => {
    const res = await request('POST', '/api/inventory-movements', {
      token: state.userToken,
      body: {
        variant_id: PAYLOADS.numericTrue,
        type: 'IN',
        quantity: 1,
        note: 'Should not create',
      },
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('movements-negative', 'movement create type SQLi payload rejected', async () => {
    const res = await request('POST', '/api/inventory-movements', {
      token: state.userToken,
      body: {
        variant_id: 3,
        type: PAYLOADS.booleanTrue,
        quantity: 1,
        note: 'Should not create',
      },
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('movements-negative', 'movement create note SQLi payload stored as ordinary text', async () => {
    const payload = `Secure movement note ${PAYLOADS.unionProbe}`;
    const res = await request('POST', '/api/inventory-movements', {
      token: state.userToken,
      body: {
        variant_id: 3,
        type: 'IN',
        quantity: 1,
        note: payload,
      },
    });
    expectStatus(res, 201);
    expect(res.body?.movement?.note === payload, 'Expected movement note payload unchanged');
    assertNoSqlLeak(res);
    return `created movement id=${res.body.movement.id}`;
  });

  await test('path-validation-negative', 'item update malformed id rejected', async () => {
    const res = await request('PUT', `/api/items/${encode(PAYLOADS.numericTrue)}`, {
      token: state.adminToken,
      body: {
        name: `Path Update ${PAYLOADS.booleanTrue}`,
        category: 'Secure Negative',
        description: 'Malformed item id should not update item 1.',
      },
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('path-validation-negative', 'variant create malformed itemId rejected', async () => {
    const res = await request('POST', `/api/items/${encode(PAYLOADS.numericTrue)}/variants`, {
      token: state.userToken,
      body: {
        sku: 'SEC-NEG-PATH-VAR',
        variant_name: 'Path Variant',
        price: 1,
        stock_count: 1,
      },
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('path-validation-negative', 'variant update malformed id rejected', async () => {
    const res = await request('PUT', `/api/variants/${encode(PAYLOADS.numericTrue)}`, {
      token: state.userToken,
      body: {
        sku: 'SEC-NEG-PATH-VAR-UPD',
        variant_name: 'Path Variant Updated',
        price: 2,
        stock_count: 2,
      },
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('path-validation-negative', 'variant delete malformed id rejected', async () => {
    const res = await request('DELETE', `/api/variants/${encode(PAYLOADS.numericTrue)}`, {
      token: state.userToken,
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('path-validation-negative', 'item delete malformed id rejected', async () => {
    const res = await request('DELETE', `/api/items/${encode(PAYLOADS.numericTrue)}`, {
      token: state.adminToken,
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('settings-negative', 'settings warehouse_name SQLi payload stored as ordinary text', async () => {
    const payload = `Secure Warehouse ${PAYLOADS.booleanTrue}`;
    const res = await request('PUT', '/api/settings', {
      token: state.adminToken,
      body: { warehouse_name: payload },
    });
    expectStatus(res, 200);
    expect(res.body?.settings?.warehouse_name === payload, 'Expected warehouse_name payload unchanged');
    assertNoSqlLeak(res);
    return `warehouse=${res.body.settings.warehouse_name}`;
  });

  await test('settings-negative', 'settings currency SQLi payload rejected by length validation', async () => {
    const res = await request('PUT', '/api/settings', {
      token: state.adminToken,
      body: { currency: PAYLOADS.booleanTrue },
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('settings-negative', 'settings low_stock_threshold SQLi payload rejected by numeric validation', async () => {
    const res = await request('PUT', '/api/settings', {
      token: state.adminToken,
      body: { low_stock_threshold: PAYLOADS.numericTrue },
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('logs-negative', 'logs action SQLi payload returns controlled row set', async () => {
    const actionPayload = `SECURE_ACTION_${PAYLOADS.booleanTrue}`;
    const res = await request('GET', `/api/logs?action=${encode(actionPayload)}&limit=100&offset=0`, {
      token: state.adminToken,
    });
    expectStatus(res, 200);
    expect(Array.isArray(res.body?.logs), 'Expected logs array');
    expect(res.body.logs.length === 0, `Expected no expanded rows, got ${res.body.logs.length}`);
    assertNoSqlLeak(res);
    return `rowCount=${res.body.logs.length}`;
  });

  await test('logs-negative', 'logs user_id SQLi payload rejected by numeric validation', async () => {
    const res = await request('GET', `/api/logs?user_id=${encode(PAYLOADS.numericTrue)}`, {
      token: state.adminToken,
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  await test('logs-negative', 'log detail malformed id rejected', async () => {
    const res = await request('GET', `/api/logs/${encode(PAYLOADS.numericTrue)}`, {
      token: state.adminToken,
    });
    expectStatus(res, 400);
    assertNoSqlLeak(res);
    return summarizeBody(res.body);
  });

  const counts = results.reduce((acc, row) => {
    acc[row.result] = (acc[row.result] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    baseUrl: BASE_URL,
    payloads: PAYLOADS,
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
