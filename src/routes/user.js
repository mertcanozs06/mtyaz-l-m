import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Kullanıcıları getir
router.get('/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  try {
    const result = await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .input('branch_id', req.params.branch_id)
      .query('SELECT id, email, role, branch_id FROM Users WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
});

// Kullanıcı ekle
router.post('/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const { email, password, role } = req.body;
  const { restaurant_id, branch_id } = req.params;
  try {
    if (req.user.role === 'admin' && role === 'admin') {
      return res.status(403).json({ message: 'Admin sadece waiter ve kitchen rolleri ekleyebilir' });
    }

    const packageResult = await pool.request()
      .input('user_id', req.user.user_id)
      .query('SELECT package_type FROM Packages WHERE user_id = @user_id');
    const { package_type } = packageResult.recordset[0];
    if (package_type === 'base' && role === 'admin') {
      return res.status(403).json({ message: 'Base paket admin eklemeyi desteklemez' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.request()
      .input('restaurant_id', restaurant_id)
      .input('branch_id', branch_id)
      .input('email', email)
      .input('password', hashedPassword)
      .input('role', role)
      .input('created_by', req.user.email)
      .query(`
        INSERT INTO Users (restaurant_id, branch_id, email, password, role, created_by)
        VALUES (@restaurant_id, @branch_id, @email, @password, @role, @created_by)
      `);
    res.status(201).json({ message: 'User added' });
  } catch (err) {
    res.status(500).json({ message: 'Error adding user', error: err.message });
  }
});

// Kullanıcı sil
router.delete('/:id', authMiddleware(['admin', 'owner']), async (req, res) => {
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

