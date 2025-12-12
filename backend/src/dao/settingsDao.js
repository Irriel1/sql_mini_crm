// src/dao/settingsDao.js
const { pool } = require('../db');

async function getSettings() {
  const [rows] = await pool.query(
    `SELECT id, warehouse_name, currency, low_stock_threshold
     FROM settings
     ORDER BY id ASC
     LIMIT 1`
  );
  return rows[0] || null;
}

/**
 * Partial update – updatuje jen pole, která jsou předána v "fields".
 * idSettings – id řádku, typicky 1.
 */
async function updateSettings(idSettings, fields) {
  const { warehouse_name, currency, low_stock_threshold } = fields || {};

  const updates = [];
  const params = [];

  if (warehouse_name !== undefined) {
    updates.push('warehouse_name = ?');
    params.push(warehouse_name);
  }
  if (currency !== undefined) {
    updates.push('currency = ?');
    params.push(currency);
  }
  if (low_stock_threshold !== undefined) {
    updates.push('low_stock_threshold = ?');
    params.push(low_stock_threshold);
  }

  // Pokud není co updatovat, prostě vrať aktuální settings
  if (updates.length === 0) {
    return getSettings();
  }

  const sql = `
    UPDATE settings
    SET ${updates.join(', ')}
    WHERE id = ?
  `;
  params.push(idSettings);

  const [result] = await pool.query(sql, params);
  if (result.affectedRows === 0) {
    return null;
  }

  // Vrátíme aktuální stav po updatu
  const [rows] = await pool.query(
    `SELECT id, warehouse_name, currency, low_stock_threshold
     FROM settings
     WHERE id = ?`,
    [idSettings]
  );

  return rows[0] || null;
}

module.exports = {
  getSettings,
  updateSettings,
};
