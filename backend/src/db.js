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
    // Jednoducha migrace pro studentsky projekt: schema.sql rozdelime podle stredniku
    // na konci radku. Neni to plnohodnotny migracni framework, ale pro nase CREATE/INDEX
    // prikazy je to citelne a dostacujici.
    const statements = sql.split(/;\s*$/m).map(s => s.trim()).filter(Boolean);
    for (const s of statements) {
      try {
        await conn.query(s);
      } catch (err) {
        // Opakovane spusteni migrace muze narazit na existujici index.
        // Tabulky pouzivaji IF NOT EXISTS, duplicitni index tedy jen preskocime.
        if (err.code === 'ER_DUP_KEYNAME') {
          console.warn(`Skipping existing index: ${err.sqlMessage}`);
          continue;
        }
        throw err;
      }
    }
    console.log('Migrations applied.');
  } finally {
    conn.release();
  }
}

module.exports = {
  pool, migrate
};
