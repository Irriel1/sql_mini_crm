// src/dao/logsDao.js
const { pool } = require('../db');

// list podle filtrů
async function getLogs({ userId, action, limit, offset }) {
  let sql = `
    SELECT id, user_id, action, meta, created_at
    FROM logs
    WHERE 1 = 1
  `;
  const params = [];

  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }

  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(sql, params);
  return rows;
}

async function getLogById(id) {
  const [rows] = await pool.query(
    `SELECT id, user_id, action, meta, created_at
     FROM logs WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

// Helper pro zapisování logů (budou volat controllery jiných modulů)
async function createLog(data) {
  const {
    user_id,
    action,
    meta
  } = data || {};

  const metaJson =
    meta && typeof meta === 'object'
      ? JSON.stringify(meta)
      : meta || null;

  const [result] = await pool.query(
    `INSERT INTO logs (user_id, action, meta)
     VALUES (?, ?, ?)`,
    [
      user_id || null,
      action,
      metaJson
    ]
  );

  const [[row]] = await pool.query(
    `SELECT id, user_id, action, meta, created_at
     FROM logs WHERE id = ?`,
    [result.insertId]
  );

  return row;
}

module.exports = {
  getLogs,
  getLogById,
  createLog,
};