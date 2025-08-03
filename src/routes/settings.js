import express from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Ayarları getir
router.get('/menu/:restaurant_id', authMiddleware(['admin']), async (req, res) => {
  try {
    const result = await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .query(`
        SELECT theme_color, logo_url
        FROM Settings
        WHERE restaurant_id = @restaurant_id
      `);
    res.json(result.recordset[0] || { theme_color: '#ffffff', logo_url: '' });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching settings', error: err.message });
  }
});

// Ayarları güncelle
router.put('/menu/:restaurant_id', authMiddleware(['admin']), async (req, res) => {
  const { theme_color, logo_url } = req.body;
  try {
    await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .input('theme_color', theme_color)
      .input('logo_url', logo_url)
      .query(`
        MERGE INTO Settings AS target
        USING (SELECT @restaurant_id AS restaurant_id, @theme_color AS theme_color, @logo_url AS logo_url) AS source
        ON target.restaurant_id = source.restaurant_id
        WHEN MATCHED THEN
          UPDATE SET theme_color = source.theme_color, logo_url = source.logo_url
        WHEN NOT MATCHED THEN
          INSERT (restaurant_id, theme_color, logo_url)
          VALUES (source.restaurant_id, source.theme_color, source.logo_url);
      `);
    res.json({ message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating settings', error: err.message });
  }
});

export default router;
