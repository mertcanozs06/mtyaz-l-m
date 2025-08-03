import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.request()
      .input('name', name)
      .query(`
        INSERT INTO Restaurants (name)
        OUTPUT INSERTED.id
        VALUES (@name)
      `);
    res.status(201).json({ restaurant_id: result.recordset[0].id });
  } catch (err) {
    res.status(500).json({ message: 'Error creating restaurant', error: err.message });
  }
});

export default router;