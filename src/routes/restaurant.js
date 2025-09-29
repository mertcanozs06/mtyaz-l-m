import express from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Şube ekle
router.post('/branches/:restaurant_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const { name, country, city } = req.body;
  const { restaurant_id } = req.params;
  try {
    const packageResult = await pool.request()
      .input('user_id', req.user.user_id)
      .query('SELECT package_type, max_branches FROM Packages WHERE user_id = @user_id');
    const { package_type, max_branches } = packageResult.recordset[0];

    const branchCount = await pool.request()
      .input('restaurant_id', restaurant_id)
      .query('SELECT COUNT(*) AS count FROM Branches WHERE restaurant_id = @restaurant_id');
    const count = branchCount.recordset[0].count;

    if (max_branches && count >= max_branches) {
      return res.status(403).json({ message: `Bu pakette (${package_type}) en fazla ${max_branches} şube eklenebilir` });
    }

    const branchResult = await pool.request()
      .input('restaurant_id', restaurant_id)
      .input('name', name)
      .input('country', country)
      .input('city', city)
      .query(`
        INSERT INTO Branches (restaurant_id, name, country, city)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @name, @country, @city)
      `);
    const branch_id = branchResult.recordset[0].id;

    if (count === 1 && req.user.role === 'admin') {
      await pool.request()
        .input('user_id', req.user.user_id)
        .query('UPDATE Users SET role = \'owner\' WHERE id = @user_id');
    }

    res.status(201).json({ branch_id });
  } catch (err) {
    res.status(500).json({ message: 'Error creating branch', error: err.message });
  }
});

export default router;
