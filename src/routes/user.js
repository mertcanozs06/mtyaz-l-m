import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Kullanıcıları getir
router.get('/:restaurant_id', authMiddleware(['admin']), async (req, res) => {
  try {
    const result = await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .query('SELECT id, email, role FROM Users WHERE restaurant_id = @restaurant_id');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
});

// Kullanıcı ekle
router.post('/:restaurant_id', authMiddleware(['admin']), async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .input('email', email)
      .input('password', hashedPassword)
      .input('role', role)
      .query(`
        INSERT INTO Users (restaurant_id, email, password, role)
        VALUES (@restaurant_id, @email, @password, @role)
      `);
    res.status(201).json({ message: 'User added' });
  } catch (err) {
    res.status(500).json({ message: 'Error adding user', error: err.message });
  }
});

// Kullanıcı sil
router.delete('/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    await pool.request()
      .input('id', req.params.id)
      .query('DELETE FROM Users WHERE id = @id');
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
});

export default router;
