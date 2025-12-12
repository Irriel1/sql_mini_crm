// src/dao/inventoryMovementsDao.js
const { pool } = require('../db');

async function createMovement(data) {
  const conn = await pool.getConnection();
  const {
    variant_id,
    user_id,
    type,
    quantity,
    note
  } = data || {};

  try {
    await conn.beginTransaction();

    // 1) Zamknout variantu
    const [[variant]] = await conn.query(
      `SELECT stock_count FROM item_variants WHERE id = ? FOR UPDATE`,
      [variant_id]
    );
    if (!variant) throw new Error('VARIANT_NOT_FOUND');

    // 2) Spočítat nový stock
    const stock = variant.stock_count;
    let newStock;

    switch (type) {
      case 'IN':     newStock = stock + quantity; break;
      case 'OUT':    newStock = stock - quantity; break;
      case 'ADJUST': newStock = quantity; break;
      default:       throw new Error('INVALID_TYPE');
    }

    if (newStock < 0) throw new Error('NEGATIVE_STOCK');

    // 3) Aktualizovat sklad
    await conn.query(
      `UPDATE item_variants SET stock_count = ? WHERE id = ?`,
      [newStock, variant_id]
    );

    // 4) Zapsat movement
    const [result] = await conn.query(
      `INSERT INTO inventory_movements (variant_id, user_id, type, quantity, note)
       VALUES (?, ?, ?, ?, ?)`,
      [variant_id, user_id, type, quantity, note || null]
    );

    // 5) Vrátit movement (select)
    const [[movement]] = await conn.query(
      `SELECT id, variant_id, user_id, type, quantity, note, created_at
       FROM inventory_movements WHERE id = ?`,
      [result.insertId]
    );

    await conn.commit();
    return movement;

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { createMovement };