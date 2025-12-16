// src/dao/itemsDao.js
const { pool } = require('../db');

const ALLOWED_SORT_COLUMNS = ['name', 'category', 'created_at'];
const ALLOWED_SORT_DIR = ['ASC', 'DESC'];

async function getItems({ search, limit, offset, sort, dir }) {
  // fallbacky + whitelist
  let sortColumn = 'name';
  if (sort && ALLOWED_SORT_COLUMNS.includes(sort)) {
    sortColumn = sort;
  }

  let sortDir = 'ASC';
  if (dir && ALLOWED_SORT_DIR.includes(dir)) {
    sortDir = dir;
  }

  const params = [];
  let sql = `
    SELECT id, name, category, description, created_at
    FROM items
    WHERE deleted_at IS NULL
  `;

  if (search) {
    sql += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }

  sql += ` ORDER BY ${sortColumn} ${sortDir} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const [rows] = await pool.query(sql, params);
  return rows;
}

async function getVariantsByItemId(itemId) {
  const [rows] = await pool.query(
    `SELECT id, item_id, sku, variant_name, price, stock_count, created_at
     FROM item_variants
     WHERE item_id = ?
     ORDER BY created_at DESC`,
    [itemId]
  );
  return rows;
}

async function updateItem(id, data) {
  const { name, category, description } = data || {};

  const [result] = await pool.query(
    `UPDATE items
     SET name = ?, category = ?, description = ?
     WHERE id = ?`,
    [name, category, description, id]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT id, name, category, description, created_at
     FROM items
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );

  return rows[0] || null;
}

async function getItemById(id) {
  const [rows] = await pool.query(
    `SELECT id, name, category, description, created_at
     FROM items
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] || null;
}


async function createItem(data) {
    const { name, category, description } = data || {};
  
    const [result] = await pool.query(
      `INSERT INTO items (name, category, description, created_at)
       VALUES (?, ?, ?, NOW())`,
      [name, category, description]
    );
  
    const [rows] = await pool.query(
      `SELECT id, name, category, description, created_at
       FROM items
       WHERE id = ?`,
      [result.insertId]
    );
  
    return rows[0] || null;
  }

async function softDeleteItem(id) {
  const [result] = await pool.query(
    `UPDATE items
     SET deleted_at = NOW()
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = {
  getItems,
  getItemById,
  createItem,
  updateItem,
  softDeleteItem,
  getVariantsByItemId
};
