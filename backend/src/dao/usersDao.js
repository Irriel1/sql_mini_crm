// src/dao/usersDao.js
const { pool } = require('../db');

async function getUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, email, password_hash, name, role
     FROM users
     WHERE email = ?`,
    [email]
  );
  return rows[0] || null;
}

async function createUser(data) {
  const { email, password_hash, name, role } = data || {};

  const [result] = await pool.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES (?, ?, ?, ?)`,
    [email, password_hash, name, role]
  );

  const [rows] = await pool.query(
    `SELECT id, email, name, role
     FROM users
     WHERE id = ?`,
    [result.insertId]
  );

  return rows[0] || null;
}

// SQL Injection demo — intentionally vulnerable
async function rawLogin(email) {
  const sql = `SELECT id, email, password_hash, name, role FROM users WHERE email='${email}'`;
  const [rows] = await pool.query(sql);
  return rows[0] || null;
}

module.exports = {
  getUserByEmail,
  createUser,
  rawLogin,
};