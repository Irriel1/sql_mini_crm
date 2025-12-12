// src/dao/dashboardDao.js
const { pool } = require('../db');

async function getItemCount() {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS count FROM items WHERE deleted_at IS NULL`
  );
  return row.count;
}

async function getVariantCount() {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS count FROM item_variants`
  );
  return row.count;
}

async function getTotalStock() {
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(stock_count), 0) AS total_stock FROM item_variants`
  );
  return row.total_stock;
}

async function getLowStockVariants(threshold) {
  const [rows] = await pool.query(
    `SELECT id, item_id, variant_name, stock_count
     FROM item_variants
     WHERE stock_count <= ?
     ORDER BY stock_count ASC`,
    [threshold]
  );
  return rows;
}

async function getRecentMovements(limit = 5) {
  const [rows] = await pool.query(
    `SELECT id, variant_id, type, quantity, created_at
     FROM inventory_movements
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

async function getRecentItems(limit = 5) {
  const [rows] = await pool.query(
    `SELECT id, name, category, created_at
     FROM items
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

module.exports = {
  getItemCount,
  getVariantCount,
  getTotalStock,
  getLowStockVariants,
  getRecentMovements,
  getRecentItems,
};
