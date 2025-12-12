// src/db.js
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT } = require('./config');

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  port: DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function migrate() {
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const conn = await pool.getConnection();
  try {
    // split by ; and run statements (simple)
    const statements = sql.split(/;\s*$/m).map(s => s.trim()).filter(Boolean); // rozdělí obsah souboru schema.sql na jednotlivé příkazy podle středníku na konci řádku.
    for (const s of statements) {
      await conn.query(s);
    }
    console.log('Migrations applied.');
  } finally {
    conn.release();
  }
}

module.exports = {
  pool, migrate
};