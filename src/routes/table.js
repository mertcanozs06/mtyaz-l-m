import express from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Masaları getir
router.get('/:restaurant_id', authMiddleware(['admin', 'waiter']), async (req, res) => {
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

export default router;
