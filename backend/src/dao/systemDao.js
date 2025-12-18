const { pool } = require('../db');

async function pingDb() {
  const [[row]] = await pool.query('SELECT 1 AS ok');
  return row.ok === 1;
}

module.exports = {
  pingDb,
};