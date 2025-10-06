import express from 'express';
import { poolPromise, sql } from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Bölgeleri getir
router.get('/:restaurant_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { restaurant_id } = req.params;
    const result = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .query('SELECT id, name FROM Regions WHERE restaurant_id = @restaurant_id ORDER BY name');

    await transaction.commit();
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Bölgeler alınamadı', error: err.message });
  }
});

// Bölge ekle
router.post('/:restaurant_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { restaurant_id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Geçerli bir bölge adı gerekli' });
    }

    const exists = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('name', sql.NVarChar, name.trim())
      .query('SELECT id FROM Regions WHERE restaurant_id = @restaurant_id AND name = @name');
    if (exists.recordset.length > 0) {
      await transaction.rollback();
      return res.status(409).json({ message: 'Bu isimde bir bölge zaten var' });
    }

    const insert = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('name', sql.NVarChar, name.trim())
      .query("INSERT INTO Regions (restaurant_id, name, created_at, updated_at) OUTPUT INSERTED.id, INSERTED.name VALUES (@restaurant_id, @name, GETDATE(), GETDATE())");

    await transaction.commit();
    res.status(201).json(insert.recordset[0]);
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Bölge eklenemedi', error: err.message });
  }
});

export default router;
