import express from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Ayarları getir
router.get('/menu/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  try {
    const result = await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .input('branch_id', req.params.branch_id)
      .query(`
        SELECT theme_color, logo_url, font_style, font_size
        FROM Settings
        WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id
      `);
    res.json(result.recordset[0] || { theme_color: '#ffffff', logo_url: '', font_style: 'Arial', font_size: 16 });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching settings', error: err.message });
  }
});

// Ayarları güncelle
router.put('/menu/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const { theme_color, logo_url, font_style, font_size } = req.body;
  try {
    await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .input('branch_id', req.params.branch_id)
      .input('theme_color', theme_color)
      .input('logo_url', logo_url)
      .input('font_style', font_style)
      .input('font_size', font_size)
      .query(`
        MERGE INTO Settings AS target
        USING (SELECT @restaurant_id AS restaurant_id, @branch_id AS branch_id, @theme_color AS theme_color, 
               @logo_url AS logo_url, @font_style AS font_style, @font_size AS font_size) AS source
        ON target.restaurant_id = source.restaurant_id AND target.branch_id = source.branch_id
        WHEN MATCHED THEN
          UPDATE SET theme_color = source.theme_color, logo_url = source.logo_url, 
                     font_style = source.font_style, font_size = source.font_size
        WHEN NOT MATCHED THEN
          INSERT (restaurant_id, branch_id, theme_color, logo_url, font_style, font_size)
          VALUES (source.restaurant_id, source.branch_id, source.theme_color, source.logo_url, 
                  source.font_style, source.font_size);
      `);
    res.json({ message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating settings', error: err.message });
  }
});

// Çalışma saatlerini getir
router.get('/working-hours/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  try {
    const result = await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .input('branch_id', req.params.branch_id)
      .query('SELECT id, day_of_week, open_time, close_time FROM WorkingHours WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching working hours', error: err.message });
  }
});

// Çalışma saati ekle
router.post('/working-hours/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const { day_of_week, open_time, close_time } = req.body;
  try {
    await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .input('branch_id', req.params.branch_id)
      .input('day_of_week', day_of_week)
      .input('open_time', open_time)
      .input('close_time', close_time)
      .query(`
        INSERT INTO WorkingHours (restaurant_id, branch_id, day_of_week, open_time, close_time)
        VALUES (@restaurant_id, @branch_id, @day_of_week, @open_time, @close_time)
      `);
    res.status(201).json({ message: 'Working hours added' });
  } catch (err) {
    res.status(500).json({ message: 'Error adding working hours', error: err.message });
  }
});

// Çalışma saati güncelle
router.put('/working-hours/:id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const { day_of_week, open_time, close_time } = req.body;
  try {
    await pool.request()
      .input('id', req.params.id)
      .input('day_of_week', day_of_week)
      .input('open_time', open_time)
      .input('close_time', close_time)
      .query(`
        UPDATE WorkingHours
        SET day_of_week = @day_of_week, open_time = @open_time, close_time = @close_time
        WHERE id = @id
      `);
    res.json({ message: 'Working hours updated' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating working hours', error: err.message });
  }
});

// Çalışma saati sil
router.delete('/working-hours/:id', authMiddleware(['admin', 'owner']), async (req, res) => {
  try {
    await pool.request()
      .input('id', req.params.id)
      .query('DELETE FROM WorkingHours WHERE id = @id');
    res.json({ message: 'Working hours deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting working hours', error: err.message });
  }
});

export default router;
