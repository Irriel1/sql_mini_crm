const { pool } = require('../db');

async function getVariantsByItemId(itemId, { limit, offset }) {
  const [rows] = await pool.query(
    `SELECT id, item_id, sku, variant_name, price, stock_count, created_at
     FROM item_variants
     WHERE item_id = ?
     ORDER BY id ASC
     LIMIT ? OFFSET ?`,
    [itemId, limit, offset]
  );
  return rows;
}

async function getVariantById(id) {
  const [rows] = await pool.query(
    `SELECT id, item_id, sku, variant_name, price, stock_count, created_at
     FROM item_variants
     WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function createVariant(itemId, data) {
  const {
    sku,
    variant_name,
    attributes,
    price,
    stock_count,
  } = data || {};

  const attrsValue =
    attributes && typeof attributes === 'object'
      ? JSON.stringify(attributes)
      : attributes || null;

  const [result] = await pool.query(
    `INSERT INTO item_variants (item_id, sku, variant_name, price, stock_count)
     VALUES (?, ?, ?, ?, ?)`,
    [
      itemId,
      sku || null,
      variant_name,
      attrsValue,
      price != null ? price : 0,
      stock_count != null ? stock_count : 0,
    ]
  );

  const [rows] = await pool.query(
    `SELECT id, item_id, sku, variant_name, price, stock_count, created_at
     FROM item_variants
     WHERE id = ?`,
    [result.insertId]
  );

  return rows[0] || null;
}

async function updateVariant(id, data) {
  const {
    sku,
    variant_name,
    attributes,
    price,
    stock_count,
  } = data || {};

  const attrsValue =
    attributes && typeof attributes === 'object'
      ? JSON.stringify(attributes)
      : attributes || null;

  const [result] = await pool.query(
    `UPDATE item_variants
     SET sku = ?, variant_name = ?, price = ?, stock_count = ?
     WHERE id = ?`,
    [
      sku || null,
      variant_name,
      attrsValue,
      price != null ? price : 0,
      stock_count != null ? stock_count : 0,
      id,
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT id, item_id, sku, variant_name, price, stock_count, created_at
     FROM item_variants
     WHERE id = ?`,
    [id]
  );

  return rows[0] || null;
}
async function countMovementsForVariant(variantId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM inventory_movements
     WHERE variant_id = ?`,
    [variantId]
  );
  return rows[0]?.cnt ?? 0;
}

async function deleteVariant(id) {
  const [result] = await pool.query(
    `DELETE FROM item_variants
     WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = {
  getVariantsByItemId,
  getVariantById,
  createVariant,
  updateVariant,
  countMovementsForVariant,
  deleteVariant,
};
