import express from 'express';
import { poolPromise, sql } from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Ayarları getir
router.get('/menu/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();

    const { restaurant_id, branch_id } = req.params;
    const result = await transaction
      .request()
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .query(`
        SELECT theme_color, logo_url, font_style, font_size
        FROM Settings
        WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id
      `);

    let settings = result.recordset[0];
    if (!settings) {
      await transaction
        .request()
        .input('restaurant_id', sql.Int, parseInt(restaurant_id))
        .input('branch_id', sql.Int, parseInt(branch_id))
        .input('theme_color', sql.NVarChar, '#ffffff')
        .input('logo_url', sql.NVarChar, '')
        .input('font_style', sql.NVarChar, 'Arial')
        .input('font_size', sql.Int, 16)
        .query(`
          INSERT INTO Settings (restaurant_id, branch_id, theme_color, logo_url, font_style, font_size)
          VALUES (@restaurant_id, @branch_id, @theme_color, @logo_url, @font_style, @font_size)
        `);
      settings = { theme_color: '#ffffff', logo_url: '', font_style: 'Arial', font_size: 16 };
    }

    await transaction.commit();
    res.json(settings);
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error fetching settings', error: err.message });
  }
});

// Ayarları güncelle
router.put('/menu/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();

    const { restaurant_id, branch_id } = req.params;
    const { theme_color, logo_url, font_style, font_size } = req.body;

    await transaction
      .request()
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('theme_color', sql.NVarChar, theme_color)
      .input('logo_url', sql.NVarChar, logo_url)
      .input('font_style', sql.NVarChar, font_style)
      .input('font_size', sql.Int, font_size)
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

    await transaction.commit();
    res.json({ message: 'Settings updated' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error updating settings', error: err.message });
  }
});

// Çalışma saatlerini getir
router.get('/working-hours/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const result = await transaction
      .request()
      .input('restaurant_id', sql.Int, parseInt(req.params.restaurant_id))
      .input('branch_id', sql.Int, parseInt(req.params.branch_id))
      .query('SELECT id, day_of_week, open_time, close_time FROM WorkingHours WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id');
    await transaction.commit();
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error fetching working hours', error: err.message });
  }
});

// Çalışma saati ekle
router.post('/working-hours/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const { day_of_week, open_time, close_time } = req.body;
    await transaction
      .request()
      .input('restaurant_id', sql.Int, parseInt(req.params.restaurant_id))
      .input('branch_id', sql.Int, parseInt(req.params.branch_id))
      .input('day_of_week', sql.NVarChar, day_of_week)
      .input('open_time', sql.NVarChar, open_time)
      .input('close_time', sql.NVarChar, close_time)
      .query(`
        INSERT INTO WorkingHours (restaurant_id, branch_id, day_of_week, open_time, close_time)
        VALUES (@restaurant_id, @branch_id, @day_of_week, @open_time, @close_time)
      `);
    await transaction.commit();
    res.status(201).json({ message: 'Working hours added' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error adding working hours', error: err.message });
  }
});

// Çalışma saati güncelle
router.put('/working-hours/:id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const { day_of_week, open_time, close_time } = req.body;
    await transaction
      .request()
      .input('id', sql.Int, parseInt(req.params.id))
      .input('day_of_week', sql.NVarChar, day_of_week)
      .input('open_time', sql.NVarChar, open_time)
      .input('close_time', sql.NVarChar, close_time)
      .query(`
        UPDATE WorkingHours
        SET day_of_week = @day_of_week, open_time = @open_time, close_time = @close_time
        WHERE id = @id
      `);
    await transaction.commit();
    res.json({ message: 'Working hours updated' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error updating working hours', error: err.message });
  }
});

// Çalışma saati sil
router.delete('/working-hours/:id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    await transaction
      .request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query('DELETE FROM WorkingHours WHERE id = @id');
    await transaction.commit();
    res.json({ message: 'Working hours deleted' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error deleting working hours', error: err.message });
  }
});

export default router;
