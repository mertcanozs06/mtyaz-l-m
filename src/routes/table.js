import express from 'express';
import sql from 'mssql';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Masaları getir
router.get('/:restaurant_id', authMiddleware(['admin', 'waiter', 'kitchen']), async (req, res) => {
  try {
    const result = await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .query('SELECT * FROM Tables WHERE restaurant_id = @restaurant_id');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tables', error: err.message });
  }
});

// Masa ekle
router.post('/:restaurant_id', authMiddleware(['admin']), async (req, res) => {
  const { table_number } = req.body;
  try {
    const result = await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .input('table_number', table_number)
      .query(`
        INSERT INTO Tables (restaurant_id, table_number)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @table_number)
      `);
    res.status(201).json({ message: 'Table added', id: result.recordset[0].id });
  } catch (err) {
    res.status(500).json({ message: 'Error adding table', error: err.message });
  }
});

// Masa sil (Transaction ile)
router.delete('/:table_id', authMiddleware(['admin']), async (req, res) => {
  const { table_id } = req.params;

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const request = new sql.Request(transaction);
    await request.input('table_id', sql.Int, table_id);

    // 1. ServedOrders
    await request.query(`
      DELETE FROM ServedOrders
      WHERE order_id IN (
        SELECT id FROM Orders WHERE table_id = @table_id
      )
    `);

    // 2. OrderDetails
    await request.query(`
      DELETE FROM OrderDetails
      WHERE order_id IN (
        SELECT id FROM Orders WHERE table_id = @table_id
      )
    `);

    // 3. Orders
    await request.query(`
      DELETE FROM Orders
      WHERE table_id = @table_id
    `);

    // 4. Table
    const result = await request.query(`
      DELETE FROM Tables
      WHERE id = @table_id
    `);

    if (result.rowsAffected[0] === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Masa bulunamadı' });
    }

    await transaction.commit();
    res.json({ message: 'Masa silindi' });

  } catch (err) {
    console.error('DELETE /api/table/:table_id error:', err);
    await transaction.rollback();
    res.status(500).json({ message: 'Masa silinemedi', error: err.message });
  }
});

export default router;
