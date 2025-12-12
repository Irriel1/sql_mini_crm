// src/dao/demoItemsDao.js
const { pool } = require('../db');

/**
 * ZRANITELNÁ funkce – SQL injection přes search parametr.
 * Zde NENÍ použit placeholder (?)
 */
async function searchItemsRaw(search) {
  const sql = `
    SELECT id, name, category, description, created_at
    FROM items
    WHERE deleted_at IS NULL
      AND name LIKE '%${search}%'
    ORDER BY created_at DESC
  `;

  const [rows] = await pool.query(sql);
  return rows;
}

/**
 * Další jednoduchý příklad – zranitelný SELECT podle id.
 */
async function getItemByIdRaw(id) {
  const sql = `
    SELECT id, name, category, description, created_at
    FROM items
    WHERE deleted_at IS NULL
      AND id = ${id}
  `;
  const [rows] = await pool.query(sql);
  return rows[0] || null;
}

module.exports = {
  searchItemsRaw,
  getItemByIdRaw,
};
