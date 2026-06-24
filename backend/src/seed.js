const bcrypt = require('bcryptjs');
const { pool } = require('./db');

const RESET = process.argv.includes('--reset');
const SEED_VERSION = '2026-06-24-security-baseline-v1';
const DEFAULT_PASSWORD = 'heslo123';

const USERS = [
  {
    email: 'admin@example.com',
    password: DEFAULT_PASSWORD,
    name: 'Admin',
    role: 'admin',
    locale: 'cs',
    created_at: '2026-06-24 09:00:00',
  },
  {
    email: 'user@example.com',
    password: DEFAULT_PASSWORD,
    name: 'Test User',
    role: 'user',
    locale: 'cs',
    created_at: '2026-06-24 09:05:00',
  },
  {
    email: 'viewer@example.com',
    password: DEFAULT_PASSWORD,
    name: 'Read Only Tester',
    role: 'user',
    locale: 'cs',
    created_at: '2026-06-24 09:10:00',
  },
];

const ITEMS = [
  {
    key: 'audit-laptop',
    name: 'Audit Laptop',
    category: 'Electronics',
    description: 'Notebook pro bezne funkcni API testy.',
    created_at: '2026-06-24 10:00:00',
  },
  {
    key: 'warehouse-scanner',
    name: 'Warehouse Scanner',
    category: 'Tools',
    description: 'Ctecka pro testovani nizkych skladovych zasob.',
    created_at: '2026-06-24 10:05:00',
  },
  {
    key: 'office-chair',
    name: 'Office Chair',
    category: 'Furniture',
    description: 'Polozka pro bezne vyhledavani a trideni.',
    created_at: '2026-06-24 10:10:00',
  },
  {
    key: 'usb-c-cable',
    name: 'USB-C Cable',
    category: 'Accessories',
    description: 'Polozka s vyssim skladem pro dashboard.',
    created_at: '2026-06-24 10:15:00',
  },
  {
    key: 'sqli-lab-marker',
    name: 'SQLi Lab Marker',
    category: 'Security Lab',
    description: 'Kontrolni polozka pro porovnani safe a vuln SQLi dotazu.',
    created_at: '2026-06-24 10:20:00',
  },
  {
    key: 'soft-deleted-item',
    name: 'Deleted Demo Item',
    category: 'Archive',
    description: 'Seedovany soft-delete zaznam; API ho nema vracet v beznem listu.',
    created_at: '2026-06-24 10:25:00',
    deleted_at: '2026-06-24 11:00:00',
  },
];

const VARIANTS = [
  {
    itemKey: 'audit-laptop',
    sku: 'AUD-LAP-13',
    variant_name: '13 inch / 16GB RAM',
    attributes: { size: '13', ram: '16GB' },
    price: 32990,
    stock_count: 22,
    created_at: '2026-06-24 10:30:00',
  },
  {
    itemKey: 'audit-laptop',
    sku: 'AUD-LAP-15',
    variant_name: '15 inch / 32GB RAM',
    attributes: { size: '15', ram: '32GB' },
    price: 42990,
    stock_count: 12,
    created_at: '2026-06-24 10:35:00',
  },
  {
    itemKey: 'warehouse-scanner',
    sku: 'WH-SCN-01',
    variant_name: 'Scanner Standard',
    attributes: { model: 'standard' },
    price: 4990,
    stock_count: 4,
    created_at: '2026-06-24 10:40:00',
  },
  {
    itemKey: 'office-chair',
    sku: 'CHAIR-BLK',
    variant_name: 'Black Ergonomic',
    attributes: { color: 'black' },
    price: 2990,
    stock_count: 6,
    created_at: '2026-06-24 10:45:00',
  },
  {
    itemKey: 'usb-c-cable',
    sku: 'USB-C-1M',
    variant_name: '1m Braided Cable',
    attributes: { length: '1m' },
    price: 249,
    stock_count: 83,
    created_at: '2026-06-24 10:50:00',
  },
  {
    itemKey: 'sqli-lab-marker',
    sku: 'SQLI-UNION-1',
    variant_name: 'Union Baseline Row',
    attributes: { lab: 'union' },
    price: 1,
    stock_count: 7,
    created_at: '2026-06-24 10:55:00',
  },
  {
    itemKey: 'sqli-lab-marker',
    sku: 'SQLI-LOWSTOCK',
    variant_name: 'Low Stock Lab Row',
    attributes: { lab: 'low-stock' },
    price: 2,
    stock_count: 2,
    created_at: '2026-06-24 11:00:00',
  },
];

const MOVEMENTS = [
  {
    sku: 'AUD-LAP-13',
    userEmail: 'admin@example.com',
    type: 'IN',
    quantity: 25,
    note: '[SEED] Initial stock for Audit Laptop 13.',
    created_at: '2026-06-24 11:30:00',
  },
  {
    sku: 'AUD-LAP-13',
    userEmail: 'user@example.com',
    type: 'OUT',
    quantity: 3,
    note: "[SEED] Safe endpoint note with apostrophe: O'Reilly.",
    created_at: '2026-06-24 11:35:00',
  },
  {
    sku: 'AUD-LAP-15',
    userEmail: 'admin@example.com',
    type: 'IN',
    quantity: 12,
    note: '[SEED] Initial stock for Audit Laptop 15.',
    created_at: '2026-06-24 11:40:00',
  },
  {
    sku: 'WH-SCN-01',
    userEmail: 'admin@example.com',
    type: 'ADJUST',
    quantity: 4,
    note: '[SEED] Low stock threshold control row.',
    created_at: '2026-06-24 11:45:00',
  },
  {
    sku: 'CHAIR-BLK',
    userEmail: 'user@example.com',
    type: 'IN',
    quantity: 8,
    note: '[SEED] Chair inbound movement.',
    created_at: '2026-06-24 11:50:00',
  },
  {
    sku: 'CHAIR-BLK',
    userEmail: 'user@example.com',
    type: 'OUT',
    quantity: 2,
    note: '[SEED] Chair outbound movement.',
    created_at: '2026-06-24 11:55:00',
  },
  {
    sku: 'USB-C-1M',
    userEmail: 'viewer@example.com',
    type: 'IN',
    quantity: 100,
    note: '[SEED] Bulk cable inbound movement.',
    created_at: '2026-06-24 12:00:00',
  },
  {
    sku: 'USB-C-1M',
    userEmail: 'viewer@example.com',
    type: 'OUT',
    quantity: 17,
    note: '[SEED] Bulk cable outbound movement.',
    created_at: '2026-06-24 12:05:00',
  },
  {
    sku: 'SQLI-UNION-1',
    userEmail: 'admin@example.com',
    type: 'IN',
    quantity: 7,
    note: '[SEED] SQLi lab baseline row; payloady testovat jen v demo vrstve.',
    created_at: '2026-06-24 12:10:00',
  },
  {
    sku: 'SQLI-LOWSTOCK',
    userEmail: 'admin@example.com',
    type: 'IN',
    quantity: 2,
    note: '[SEED] SQLi lab low-stock row.',
    created_at: '2026-06-24 12:15:00',
  },
];

const LOGS = [
  {
    userEmail: 'admin@example.com',
    action: 'SEED_DATABASE_READY',
    meta: { seedVersion: SEED_VERSION, note: 'Deterministicky testovaci stav DB.' },
    created_at: '2026-06-24 12:20:00',
  },
  {
    userEmail: 'admin@example.com',
    action: 'SEED_SQLI_LAB_READY',
    meta: { targets: ['items', 'variants'], mode: ['safe', 'vuln'] },
    created_at: '2026-06-24 12:25:00',
  },
  {
    userEmail: 'user@example.com',
    action: 'SEED_ROLE_TEST_READY',
    meta: { role: 'user', purpose: 'Kontrola 401/403/200 scenaru.' },
    created_at: '2026-06-24 12:30:00',
  },
];

const DELETE_ORDER = [
  'logs',
  'inventory_movements',
  'item_variants',
  'items',
  'users',
  'settings',
];

const AUTO_INCREMENT_TABLES = [
  'logs',
  'inventory_movements',
  'item_variants',
  'items',
  'users',
];

async function tableHasColumn(conn, table, column) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  return rows.length > 0;
}

async function resetTables(conn) {
  console.log('Resetting database tables before seed...');

  // Reset je zamerne oddeleny od bezneho seedovani. Pouzivej ho jen po snapshotu,
  // protoze smaze data aplikace a vytvori cisty stav pro opakovatelne testy.
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of DELETE_ORDER) {
      await conn.query(`DELETE FROM ${table}`);
    }

    for (const table of AUTO_INCREMENT_TABLES) {
      await conn.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
    }
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

async function upsertUser(conn, user) {
  const passwordHash = await bcrypt.hash(user.password, 10);

  // Heslo je u vsech testovacich uctu stejne zamerne: pri obhajobe a regresnich
  // testech chceme testovat roli a endpointy, ne resit zapomenute credentials.
  await conn.query(
    `INSERT INTO users (email, password_hash, name, role, locale, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       name = VALUES(name),
       role = VALUES(role),
       locale = VALUES(locale)`,
    [user.email, passwordHash, user.name, user.role, user.locale, user.created_at]
  );

  const [[row]] = await conn.query(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [user.email]
  );
  return row.id;
}

async function upsertItem(conn, item) {
  const [existing] = await conn.query(
    `SELECT id
     FROM items
     WHERE name = ? AND category = ?
     ORDER BY id ASC
     LIMIT 1`,
    [item.name, item.category]
  );

  if (existing.length > 0) {
    const id = existing[0].id;
    await conn.query(
      `UPDATE items
       SET description = ?, deleted_at = ?
       WHERE id = ?`,
      [item.description, item.deleted_at || null, id]
    );
    return id;
  }

  const [result] = await conn.query(
    `INSERT INTO items (name, category, description, created_at, deleted_at)
     VALUES (?, ?, ?, ?, ?)`,
    [item.name, item.category, item.description, item.created_at, item.deleted_at || null]
  );
  return result.insertId;
}

async function upsertVariant(conn, variant, itemId, hasAttributesColumn) {
  const attributesSql = hasAttributesColumn ? ', attributes' : '';
  const attributesPlaceholder = hasAttributesColumn ? ', ?' : '';
  const attributesUpdate = hasAttributesColumn ? ', attributes = VALUES(attributes)' : '';
  const attributesValue = JSON.stringify(variant.attributes || {});

  const values = [
    itemId,
    variant.sku,
    variant.variant_name,
  ];
  if (hasAttributesColumn) values.push(attributesValue);
  values.push(variant.price, variant.stock_count, variant.created_at);

  await conn.query(
    `INSERT INTO item_variants
       (item_id, sku, variant_name${attributesSql}, price, stock_count, created_at)
     VALUES (?, ?, ?${attributesPlaceholder}, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       item_id = VALUES(item_id),
       variant_name = VALUES(variant_name)
       ${attributesUpdate},
       price = VALUES(price),
       stock_count = VALUES(stock_count)`,
    values
  );

  const [[row]] = await conn.query(
    'SELECT id FROM item_variants WHERE sku = ? LIMIT 1',
    [variant.sku]
  );
  return row.id;
}

async function clearSeededOperationalRows(conn) {
  // Bezny `db:seed` nemaze celou DB. Odstrani jen predchozi seedovane pohyby/logy,
  // aby po opakovani prikazu nevznikaly duplicitni radky se stejnym vyznamem.
  await conn.query("DELETE FROM inventory_movements WHERE note LIKE '[SEED]%'");
  await conn.query("DELETE FROM logs WHERE action LIKE 'SEED_%'");
}

async function insertMovements(conn, userIds, variantIds) {
  for (const movement of MOVEMENTS) {
    await conn.query(
      `INSERT INTO inventory_movements
         (variant_id, user_id, type, quantity, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        variantIds[movement.sku],
        userIds[movement.userEmail],
        movement.type,
        movement.quantity,
        movement.note,
        movement.created_at,
      ]
    );
  }
}

async function insertLogs(conn, userIds) {
  for (const log of LOGS) {
    await conn.query(
      `INSERT INTO logs (user_id, action, meta, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        userIds[log.userEmail],
        log.action,
        JSON.stringify(log.meta),
        log.created_at,
      ]
    );
  }
}

async function upsertSettings(conn) {
  await conn.query(
    `INSERT INTO settings (id, warehouse_name, currency, low_stock_threshold)
     VALUES (1, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       warehouse_name = VALUES(warehouse_name),
       currency = VALUES(currency),
       low_stock_threshold = VALUES(low_stock_threshold)`,
    ['SQL CRM Test Warehouse', 'CZK', 5]
  );
}

async function printSummary(conn) {
  const [counts] = await conn.query(`
    SELECT 'users' AS table_name, COUNT(*) AS count FROM users
    UNION ALL SELECT 'items', COUNT(*) FROM items
    UNION ALL SELECT 'variants', COUNT(*) FROM item_variants
    UNION ALL SELECT 'movements', COUNT(*) FROM inventory_movements
    UNION ALL SELECT 'logs', COUNT(*) FROM logs
    UNION ALL SELECT 'settings', COUNT(*) FROM settings
  `);

  console.table(counts);
  console.log('Seed version:', SEED_VERSION);
  console.log('Test logins: admin@example.com, user@example.com, viewer@example.com');
  console.log('Shared test password:', DEFAULT_PASSWORD);
}

async function seed() {
  const conn = await pool.getConnection();
  let transactionStarted = false;

  try {
    console.log(RESET ? 'Starting DB reset + seed...' : 'Starting non-destructive seed...');

    if (RESET) {
      await resetTables(conn);
    }

    await conn.beginTransaction();
    transactionStarted = true;

    const hasAttributesColumn = await tableHasColumn(conn, 'item_variants', 'attributes');
    const userIds = {};
    const itemIds = {};
    const variantIds = {};

    for (const user of USERS) {
      userIds[user.email] = await upsertUser(conn, user);
    }

    for (const item of ITEMS) {
      itemIds[item.key] = await upsertItem(conn, item);
    }

    for (const variant of VARIANTS) {
      variantIds[variant.sku] = await upsertVariant(
        conn,
        variant,
        itemIds[variant.itemKey],
        hasAttributesColumn
      );
    }

    await clearSeededOperationalRows(conn);
    await insertMovements(conn, userIds, variantIds);
    await insertLogs(conn, userIds);
    await upsertSettings(conn);

    await conn.commit();
    transactionStarted = false;

    console.log('Seed completed.');
    await printSummary(conn);
  } catch (err) {
    if (transactionStarted) {
      await conn.rollback();
    }
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

seed();
