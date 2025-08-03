import express from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// İndirimleri getir
router.get('/:restaurant_id', authMiddleware(['admin', 'waiter']), async (req, res) => {
  try {
    const result = await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .query('SELECT * FROM Discounts WHERE restaurant_id = @restaurant_id');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching discounts', error: err.message });
  }
});

// İndirim ekle
router.post('/:restaurant_id', authMiddleware(['admin']), async (req, res) => {
  const { name, percentage } = req.body;
  try {
    await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .input('name', name)
      .input('percentage', percentage)
      .query(`
        INSERT INTO Discounts (restaurant_id, name, percentage)
        VALUES (@restaurant_id, @name, @percentage)
      `);
    res.status(201).json({ message: 'Discount added' });
  } catch (err) {
    res.status(500).json({ message: 'Error adding discount', error: err.message });
  }
});

export default router;
