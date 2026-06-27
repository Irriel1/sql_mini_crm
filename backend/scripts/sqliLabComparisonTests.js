const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

const TARGETS = {
  items: {
    booleanTrue: "%' OR 1=1 -- ",
    booleanFalse: "%' AND 1=2 -- ",
    unionPayload: "%' UNION SELECT 999001,'UNION_ITEM','Union Category',NOW() -- ",
    errorPayload: "%' UNION SELECT 1,2 -- ",
    timePayload: "ZZZ%' OR IF(1=1,SLEEP(1),0)=0 -- ",
    hasUnionMarker: (rows) => rows.some((row) => row.name === 'UNION_ITEM'),
  },
  variants: {
    booleanTrue: "%' OR 1=1 -- ",
    booleanFalse: "%' AND 1=2 -- ",
    unionPayload: "%' UNION SELECT 999002,'UNION-SKU','Union Variant',1,1,'Union Item' -- ",
    errorPayload: "%' UNION SELECT 1,2,3 -- ",
    timePayload: "ZZZ%' OR IF(1=1,SLEEP(1),0)=0 -- ",
    hasUnionMarker: (rows) => rows.some((row) => row.sku === 'UNION-SKU'),
  },
  users: {
    booleanTrue: "%' OR 1=1 -- ",
    booleanFalse: "%' AND 1=2 -- ",
    unionPayload: "%' UNION SELECT 999003,'union-user@example.com','Union User','admin',NOW() -- ",
    errorPayload: "%' UNION SELECT 1,2 -- ",
    timePayload: "ZZZ%' OR IF(1=1,SLEEP(1),0)=0 -- ",
    hasUnionMarker: (rows) => rows.some((row) => row.email === 'union-user@example.com'),
  },
};

const state = {
  adminToken: null,
  userToken: null,
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

function summarizeBody(body) {
  if (body == null) return null;
  const json = JSON.stringify(body);
  return json.length > 700 ? `${json.slice(0, 700)}...` : json;
}

function previewRows(body) {
  return Array.isArray(body?.dataPreview) ? body.dataPreview : [];
}

function assertNoHashColumn(rows) {
  for (const row of rows) {
    expect(!Object.prototype.hasOwnProperty.call(row, 'password_hash'), 'SQLi Lab preview must not expose password_hash column by default');
  }
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

async function runLab({ token, mode, pattern, target, payload, limit = 50 }) {
  return request('POST', '/api/sqli-demo/run', {
    token,
    body: { mode, pattern, target, payload, limit },
  });
}

function assertLabOk(response, expected) {
  expectStatus(response, 200);
  expect(response.body?.mode === expected.mode, `Expected effective mode=${expected.mode}, got ${response.body?.mode}`);
  expect(response.body?.pattern === expected.pattern, `Expected pattern=${expected.pattern}`);
  expect(response.body?.target === expected.target, `Expected target=${expected.target}`);
  expect(typeof response.body?.durationMs === 'number', 'Expected durationMs number');
}

async function main() {
  // Tento runner je zaverecny krok faze A: porovnava stejne SQLi payloady
  // v safe a vuln rezimu SQLi Labu. V safe rezimu ma byt payload pouze data,
  // ve vuln rezimu ma ukazat konkretni mechaniku SQL Injection.
  await test('setup', 'GET /health returns 200', async () => {
    const res = await request('GET', '/health');
    expectStatus(res, 200);
    expect(res.body?.ok === true, 'Expected ok=true');
    return `${res.status} in ${res.durationMs}ms`;
  });

  await test('setup', 'admin login for SQLi Lab context', async () => {
    state.adminToken = await login('admin@example.com');
    return 'admin token ready';
  });

  await test('setup', 'user login for SQLi Lab context', async () => {
    state.userToken = await login('user@example.com');
    return 'user token ready';
  });

  await test('access-control', 'SQLi Lab without token returns 401', async () => {
    const res = await runLab({
      mode: 'safe',
      pattern: 'boolean',
      target: 'items',
      payload: 'Audit',
    });
    expectStatus(res, 401);
    return summarizeBody(res.body);
  });

  await test('access-control', 'SQLi Lab with ordinary user returns 403', async () => {
    const res = await runLab({
      token: state.userToken,
      mode: 'safe',
      pattern: 'boolean',
      target: 'items',
      payload: 'Audit',
    });
    expectStatus(res, 403);
    return summarizeBody(res.body);
  });

  await test('access-control', 'SQLi Lab with admin token accepts safe request', async () => {
    const res = await runLab({
      token: state.adminToken,
      mode: 'safe',
      pattern: 'boolean',
      target: 'items',
      payload: 'Audit',
    });
    assertLabOk(res, { mode: 'safe', pattern: 'boolean', target: 'items' });
    expect(res.body.rowCount > 0, 'Expected seeded Audit item');
    return `rowCount=${res.body.rowCount}`;
  });

  await test('validation', 'invalid pattern returns 400', async () => {
    const res = await runLab({
      token: state.adminToken,
      mode: 'safe',
      pattern: 'stacked',
      target: 'items',
      payload: 'Audit',
    });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('validation', 'invalid target returns 400', async () => {
    const res = await runLab({
      token: state.adminToken,
      mode: 'safe',
      pattern: 'boolean',
      target: 'orders',
      payload: 'Audit',
    });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('validation', 'invalid mode returns 400', async () => {
    const res = await runLab({
      token: state.adminToken,
      mode: 'unsafe',
      pattern: 'boolean',
      target: 'items',
      payload: 'Audit',
    });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  await test('validation', 'too long payload returns 400', async () => {
    const res = await runLab({
      token: state.adminToken,
      mode: 'safe',
      pattern: 'boolean',
      target: 'items',
      payload: 'A'.repeat(201),
    });
    expectStatus(res, 400);
    return summarizeBody(res.body);
  });

  for (const [target, cfg] of Object.entries(TARGETS)) {
    await test(`${target}:boolean`, 'safe boolean payload stays ordinary text', async () => {
      const res = await runLab({
        token: state.adminToken,
        mode: 'safe',
        pattern: 'boolean',
        target,
        payload: cfg.booleanTrue,
      });
      assertLabOk(res, { mode: 'safe', pattern: 'boolean', target });
      expect(res.body.error == null, `Expected no error, got ${res.body.error}`);
      expect(res.body.rowCount === 0, `Expected no literal payload matches, got ${res.body.rowCount}`);
      assertNoHashColumn(previewRows(res.body));
      return `rowCount=${res.body.rowCount}, durationMs=${res.body.durationMs}`;
    });

    await test(`${target}:boolean`, 'vuln boolean false returns zero rows', async () => {
      const res = await runLab({
        token: state.adminToken,
        mode: 'vuln',
        pattern: 'boolean',
        target,
        payload: cfg.booleanFalse,
      });
      assertLabOk(res, { mode: 'vuln', pattern: 'boolean', target });
      expect(res.body.error == null, `Expected no error, got ${res.body.error}`);
      expect(res.body.rowCount === 0, `Expected zero rows, got ${res.body.rowCount}`);
      assertNoHashColumn(previewRows(res.body));
      return `rowCount=${res.body.rowCount}`;
    });

    await test(`${target}:boolean`, 'vuln boolean true expands row set', async () => {
      const res = await runLab({
        token: state.adminToken,
        mode: 'vuln',
        pattern: 'boolean',
        target,
        payload: cfg.booleanTrue,
      });
      assertLabOk(res, { mode: 'vuln', pattern: 'boolean', target });
      expect(res.body.error == null, `Expected no error, got ${res.body.error}`);
      expect(res.body.rowCount > 0, `Expected expanded row set, got ${res.body.rowCount}`);
      assertNoHashColumn(previewRows(res.body));
      return `rowCount=${res.body.rowCount}`;
    });

    await test(`${target}:union`, 'safe UNION payload stays ordinary text', async () => {
      const res = await runLab({
        token: state.adminToken,
        mode: 'safe',
        pattern: 'union',
        target,
        payload: cfg.unionPayload,
      });
      assertLabOk(res, { mode: 'safe', pattern: 'union', target });
      expect(res.body.error == null, `Expected no error, got ${res.body.error}`);
      expect(!cfg.hasUnionMarker(previewRows(res.body)), 'Safe mode must not contain synthetic UNION marker');
      assertNoHashColumn(previewRows(res.body));
      return `rowCount=${res.body.rowCount}`;
    });

    await test(`${target}:union`, 'vuln UNION payload injects synthetic row', async () => {
      const res = await runLab({
        token: state.adminToken,
        mode: 'vuln',
        pattern: 'union',
        target,
        payload: cfg.unionPayload,
      });
      assertLabOk(res, { mode: 'vuln', pattern: 'union', target });
      expect(res.body.error == null, `Expected no error, got ${res.body.error}`);
      expect(cfg.hasUnionMarker(previewRows(res.body)), `Expected synthetic UNION marker. Body=${summarizeBody(res.body)}`);
      assertNoHashColumn(previewRows(res.body));
      return `rowCount=${res.body.rowCount}, marker=true`;
    });

    await test(`${target}:error`, 'safe error payload does not leak DB detail', async () => {
      const res = await runLab({
        token: state.adminToken,
        mode: 'safe',
        pattern: 'error',
        target,
        payload: cfg.errorPayload,
      });
      assertLabOk(res, { mode: 'safe', pattern: 'error', target });
      expect(res.body.error == null, `Expected no DB error in safe mode, got ${res.body.error}`);
      assertNoHashColumn(previewRows(res.body));
      return `rowCount=${res.body.rowCount}`;
    });

    await test(`${target}:error`, 'vuln error payload returns DB error detail', async () => {
      const res = await runLab({
        token: state.adminToken,
        mode: 'vuln',
        pattern: 'error',
        target,
        payload: cfg.errorPayload,
      });
      assertLabOk(res, { mode: 'vuln', pattern: 'error', target });
      expect(res.body.error && res.body.error !== 'Query failed', `Expected DB error detail, got ${res.body.error}`);
      return `error=${res.body.error}`;
    });

    await test(`${target}:time`, 'safe time payload stays fast', async () => {
      const res = await runLab({
        token: state.adminToken,
        mode: 'safe',
        pattern: 'time',
        target,
        payload: cfg.timePayload,
      });
      assertLabOk(res, { mode: 'safe', pattern: 'time', target });
      expect(res.body.error == null, `Expected no error, got ${res.body.error}`);
      expect(res.body.durationMs < 800, `Expected safe mode without SQL delay, got ${res.body.durationMs}ms`);
      assertNoHashColumn(previewRows(res.body));
      return `durationMs=${res.body.durationMs}`;
    });

    await test(`${target}:time`, 'vuln time payload causes measurable delay', async () => {
      const res = await runLab({
        token: state.adminToken,
        mode: 'vuln',
        pattern: 'time',
        target,
        payload: cfg.timePayload,
      });
      assertLabOk(res, { mode: 'vuln', pattern: 'time', target });
      expect(res.body.error == null, `Expected no error, got ${res.body.error}`);
      expect(res.body.durationMs >= 800, `Expected measurable SQL delay, got ${res.body.durationMs}ms`);
      assertNoHashColumn(previewRows(res.body));
      return `durationMs=${res.body.durationMs}`;
    });
  }

  const counts = results.reduce((acc, row) => {
    acc[row.result] = (acc[row.result] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    baseUrl: BASE_URL,
    targets: Object.keys(TARGETS),
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
