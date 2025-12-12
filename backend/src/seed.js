// src/seed.js
const { pool } = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  const conn = await pool.getConnection();
  try {
    console.log('Seeding initial data...');

    // 1️⃣ vytvoření admin uživatele
    const hash = bcrypt.hashSync('heslo123', 10);
    await conn.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      ['admin@example.com', hash, 'Admin', 'admin']
    );

    // 2️⃣ ukázkový item
    await conn.query(
      'INSERT INTO items (name, category, description) VALUES (?, ?, ?)',
      ['Testovací produkt', 'Demo', 'Ukázková položka pro testování API']
    );

    console.log('Seed completed ✅');
  } catch (err) {
    console.error('❌ Seed failed:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
