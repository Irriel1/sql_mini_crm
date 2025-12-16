// src/dao/inventoryMovementsDao.js
const { pool } = require('../db');

function appError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

// POST /api/inventory-movements (SAFE)
async function createMovement(data) {
  const conn = await pool.getConnection();
  const { variant_id, user_id, type, quantity, note } = data || {};

  try {
    await conn.beginTransaction();

    // 1) Zamknout variantu
    const [[variant]] = await conn.query(
      `SELECT stock_count FROM item_variants WHERE id = ? FOR UPDATE`,
      [variant_id]
    );
    if (!variant) throw appError('VARIANT_NOT_FOUND');

    // 2) Spočítat nový stock
    const stock = variant.stock_count;
    let newStock;

    switch (type) {
      case 'IN':     newStock = stock + quantity; break;
      case 'OUT':    newStock = stock - quantity; break;
      case 'ADJUST': newStock = quantity; break;
      default:       throw appError('INVALID_TYPE');
    }

    if (newStock < 0) throw appError('NEGATIVE_STOCK');

    // 3) Aktualizovat sklad
    await conn.query(
      `UPDATE item_variants SET stock_count = ? WHERE id = ?`,
      [newStock, variant_id]
    );

    // 4) Zapsat movement
    const [result] = await conn.query(
      `INSERT INTO inventory_movements (variant_id, user_id, type, quantity, note)
       VALUES (?, ?, ?, ?, ?)`,
      [variant_id, user_id, type, quantity, note || null]
    );

    // 5) Vrátit movement
    const [[movement]] = await conn.query(
      `SELECT id, variant_id, user_id, type, quantity, note, created_at
       FROM inventory_movements WHERE id = ?`,
      [result.insertId]
    );

    await conn.commit();
    return movement;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// GET /api/inventory-movements (SAFE list)  ✅ note added
async function getMovements({ variantId, type, note, limit, offset }) {
  const sql = `
    SELECT
      m.id, m.variant_id, m.user_id, m.type, m.quantity, m.note, m.created_at,
      u.name AS user_name,
      v.sku, v.variant_name
    FROM inventory_movements m
    JOIN users u ON u.id = m.user_id
    JOIN item_variants v ON v.id = m.variant_id
    WHERE (? IS NULL OR m.variant_id = ?)
      AND (? IS NULL OR m.type = ?)
      AND (? IS NULL OR m.note LIKE ?)
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?;
  `;

  const likeNote = note ? `%${note}%` : null;

  const params = [
    variantId ?? null, variantId ?? null,
    type ?? null, type ?? null,
    note ?? null, likeNote,
    limit, offset,
  ];

  const [rows] = await pool.query(sql, params);
  return rows;
}

// GET /api/inventory-movements/:id (SAFE detail)
async function getMovementById(id) {
  const sql = `
    SELECT
      m.id, m.variant_id, m.user_id, m.type, m.quantity, m.note, m.created_at,
      u.name AS user_name,
      v.sku, v.variant_name
    FROM inventory_movements m
    JOIN users u ON u.id = m.user_id
    JOIN item_variants v ON v.id = m.variant_id
    WHERE m.id = ?;
  `;
  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
}

// GET /api/demo/inventory-movements (VULN list) ✅ note added
async function getMovementsVuln({ variantId, type, note, limit, offset, sort, dir, dateFrom, dateTo, userId }) {
  const where = `
    WHERE 1=1
      ${variantId ? `AND m.variant_id = ${variantId}` : ''}
      ${type ? `AND m.type = '${type}'` : ''}
      ${userId ? `AND m.user_id = ${userId}` : ''}
      ${dateFrom ? `AND m.created_at >= '${dateFrom}'` : ''}
      ${dateTo ? `AND m.created_at <= '${dateTo}'` : ''}
      ${note ? `AND m.note LIKE '%${note}%'` : ''}
  `;

  const order = `ORDER BY ${sort || 'created_at'} ${dir || 'DESC'}`;
  const page = `LIMIT ${limit || 50} OFFSET ${offset || 0}`;

  const sql = `
    SELECT
      m.id, m.variant_id, m.user_id, m.type, m.quantity, m.note, m.created_at,
      u.name AS user_name,
      v.sku, v.variant_name
    FROM inventory_movements m
    JOIN users u ON u.id = m.user_id
    JOIN item_variants v ON v.id = m.variant_id
    ${where}
    ${order}
    ${page};
  `;

  const [rows] = await pool.query(sql); // ⚠️ no binds
  return rows;
}

module.exports = {
  createMovement,
  getMovements,
  getMovementById,
  getMovementsVuln,
};