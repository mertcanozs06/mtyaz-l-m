import express from 'express';
import { poolPromise, sql } from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

/**
 * 🔹 Kullanıcı işlem geçmişi kaydı (UserAuditLog)
 */
const logAuditAction = async (userId, action, targetUserId, restaurantId, branchId, transaction = null) => {
  try {
    const request = transaction ? transaction.request() : (await poolPromise).request();
    await request
      .input('user_id', sql.Int, userId || null)
      .input('action', sql.NVarChar, action)
      .input('target_user_id', sql.Int, targetUserId || null)
      .input('restaurant_id', sql.Int, restaurantId || null)
      .input('branch_id', sql.Int, branchId || null)
      .input('created_at', sql.DateTime, new Date())
      .query(`
        INSERT INTO UserAuditLog (user_id, action, target_user_id, restaurant_id, branch_id, created_at)
        VALUES (@user_id, @action, @target_user_id, @restaurant_id, @branch_id, @created_at)
      `);
  } catch (err) {
    console.error('Audit log kaydı başarısız:', err);
  }
};

/**
 * 🔹 Settings doğrulama
 */
const validateSettings = ({ theme_color, font_style, font_size }) => {
  if (theme_color && !/^#[0-9A-F]{6}$/i.test(theme_color)) {
    return { valid: false, message: 'Geçersiz renk kodu (hex formatında olmalı)', error_code: 'INVALID_COLOR' };
  }
  if (font_style && !['Arial', 'Helvetica', 'Times New Roman', 'Roboto'].includes(font_style)) {
    return { valid: false, message: 'Geçersiz font stili', error_code: 'INVALID_FONT_STYLE' };
  }
  if (font_size && (isNaN(font_size) || font_size < 12 || font_size > 24)) {
    return { valid: false, message: 'Font boyutu 12-24 arasında olmalı', error_code: 'INVALID_FONT_SIZE' };
  }
  return { valid: true };
};

/**
 * 🔹 Çalışma saatleri doğrulama
 */
const validateWorkingHours = ({ day_of_week, open_time, close_time }) => {
  const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  if (!days.includes(day_of_week)) {
    return { valid: false, message: 'Geçersiz gün', error_code: 'INVALID_DAY' };
  }
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(open_time) || !timeRegex.test(close_time)) {
    return { valid: false, message: 'Geçersiz saat formatı (HH:MM)', error_code: 'INVALID_TIME' };
  }
  return { valid: true };
};

/* -------------------------------------------------------------------------- */
/*                          🎨 SETTINGS ENDPOINTLERİ                          */
/* -------------------------------------------------------------------------- */

/**
 * 🔹 Ayarları getir (restaurant_id + branch_id)
 */
router.get('/menu/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const { restaurant_id, branch_id } = req.params;

    const result = await transaction
      .request()
      .input('restaurant_id', sql.Int, restaurant_id)
      .input('branch_id', sql.Int, branch_id)
      .query(`
        SELECT theme_color, logo_url, font_style, font_size
        FROM Settings
        WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id
      `);

    let settings = result.recordset[0];

    // Eğer kayıt yoksa varsayılan ayar oluştur
    if (!settings) {
      await transaction
        .request()
        .input('restaurant_id', sql.Int, restaurant_id)
        .input('branch_id', sql.Int, branch_id)
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

    await logAuditAction(req.user.user_id, 'SETTINGS_FETCHED', null, restaurant_id, branch_id, transaction);
    await transaction.commit();

    res.json(settings);
  } catch (err) {
    await transaction.rollback();
    console.error('Error fetching settings:', err);
    res.status(500).json({ message: 'Ayarlar alınamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/**
 * 🔹 Ayarları güncelle
 */
router.put('/menu/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const { restaurant_id, branch_id } = req.params;
    const { theme_color, logo_url, font_style, font_size } = req.body;

    // Girdi doğrulama
    const validation = validateSettings({ theme_color, font_style, font_size });
    if (!validation.valid) {
      await transaction.rollback();
      return res.status(400).json({ message: validation.message, error_code: validation.error_code });
    }

    // MERGE ile ekle/güncelle
    await transaction
      .request()
      .input('restaurant_id', sql.Int, restaurant_id)
      .input('branch_id', sql.Int, branch_id)
      .input('theme_color', sql.NVarChar, theme_color || '#ffffff')
      .input('logo_url', sql.NVarChar, logo_url || '')
      .input('font_style', sql.NVarChar, font_style || 'Arial')
      .input('font_size', sql.Int, font_size || 16)
      .query(`
        MERGE INTO Settings AS target
        USING (SELECT @restaurant_id AS restaurant_id, @branch_id AS branch_id) AS source
        ON target.restaurant_id = source.restaurant_id AND target.branch_id = source.branch_id
        WHEN MATCHED THEN
          UPDATE SET theme_color = @theme_color, logo_url = @logo_url, font_style = @font_style, font_size = @font_size
        WHEN NOT MATCHED THEN
          INSERT (restaurant_id, branch_id, theme_color, logo_url, font_style, font_size)
          VALUES (@restaurant_id, @branch_id, @theme_color, @logo_url, @font_style, @font_size);
      `);

    await logAuditAction(req.user.user_id, 'SETTINGS_UPDATED', null, restaurant_id, branch_id, transaction);
    req.io?.to(`admin_${restaurant_id}_${branch_id}`).emit('menu-updated', { restaurant_id, branch_id });

    await transaction.commit();
    res.json({ message: 'Ayarlar güncellendi' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating settings:', err);
    res.status(500).json({ message: 'Ayarlar güncellenemedi', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                      🕐 ÇALIŞMA SAATLERİ ENDPOINTLERİ                     */
/* -------------------------------------------------------------------------- */

/**
 * 🔹 Çalışma saatlerini getir
 */
router.get('/working-hours/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const { restaurant_id, branch_id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('restaurant_id', sql.Int, restaurant_id)
      .input('branch_id', sql.Int, branch_id)
      .query(`
        SELECT id, day_of_week, open_time, close_time
        FROM WorkingHours
        WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id
      `);

    await logAuditAction(req.user.user_id, 'WORKING_HOURS_FETCHED', null, restaurant_id, branch_id);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching working hours:', err);
    res.status(500).json({ message: 'Çalışma saatleri alınamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/**
 * 🔹 Çalışma saati ekle
 */
router.post('/working-hours/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const { restaurant_id, branch_id } = req.params;
    const { day_of_week, open_time, close_time } = req.body;

    const validation = validateWorkingHours({ day_of_week, open_time, close_time });
    if (!validation.valid) {
      await transaction.rollback();
      return res.status(400).json({ message: validation.message, error_code: validation.error_code });
    }

    // Aynı güne kayıt var mı kontrol et
    const conflict = await transaction
      .request()
      .input('restaurant_id', sql.Int, restaurant_id)
      .input('branch_id', sql.Int, branch_id)
      .input('day_of_week', sql.NVarChar, day_of_week)
      .query(`
        SELECT id FROM WorkingHours
        WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id AND day_of_week = @day_of_week
      `);

    if (conflict.recordset.length > 0) {
      await transaction.rollback();
      return res.status(409).json({ message: 'Bu gün için zaten bir çalışma saati tanımlı', error_code: 'TIME_CONFLICT' });
    }

    await transaction
      .request()
      .input('restaurant_id', sql.Int, restaurant_id)
      .input('branch_id', sql.Int, branch_id)
      .input('day_of_week', sql.NVarChar, day_of_week)
      .input('open_time', sql.NVarChar, open_time)
      .input('close_time', sql.NVarChar, close_time)
      .query(`
        INSERT INTO WorkingHours (restaurant_id, branch_id, day_of_week, open_time, close_time)
        VALUES (@restaurant_id, @branch_id, @day_of_week, @open_time, @close_time)
      `);

    await logAuditAction(req.user.user_id, 'WORKING_HOURS_ADDED', null, restaurant_id, branch_id, transaction);
    req.io?.to(`admin_${restaurant_id}_${branch_id}`).emit('working-hours-updated', { restaurant_id, branch_id });

    await transaction.commit();
    res.status(201).json({ message: 'Çalışma saati eklendi' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error adding working hours:', err);
    res.status(500).json({ message: 'Çalışma saati eklenemedi', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/**
 * 🔹 Çalışma saati güncelle
 */
router.put('/working-hours/:id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const { id } = req.params;
    const { day_of_week, open_time, close_time } = req.body;

    const validation = validateWorkingHours({ day_of_week, open_time, close_time });
    if (!validation.valid) {
      await transaction.rollback();
      return res.status(400).json({ message: validation.message, error_code: validation.error_code });
    }

    const check = await transaction.request().input('id', sql.Int, id).query(`
      SELECT restaurant_id, branch_id, day_of_week FROM WorkingHours WHERE id = @id
    `);

    if (check.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Çalışma saati bulunamadı', error_code: 'NOT_FOUND' });
    }

    const { restaurant_id, branch_id, day_of_week: existingDay } = check.recordset[0];

    // Gün değişmişse çakışma kontrolü
    if (existingDay !== day_of_week) {
      const conflict = await transaction
        .request()
        .input('restaurant_id', sql.Int, restaurant_id)
        .input('branch_id', sql.Int, branch_id)
        .input('day_of_week', sql.NVarChar, day_of_week)
        .query(`
          SELECT id FROM WorkingHours 
          WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id AND day_of_week = @day_of_week
        `);
      if (conflict.recordset.length > 0) {
        await transaction.rollback();
        return res.status(409).json({ message: 'Bu gün için zaten bir çalışma saati tanımlı', error_code: 'TIME_CONFLICT' });
      }
    }

    await transaction
      .request()
      .input('id', sql.Int, id)
      .input('day_of_week', sql.NVarChar, day_of_week)
      .input('open_time', sql.NVarChar, open_time)
      .input('close_time', sql.NVarChar, close_time)
      .query(`
        UPDATE WorkingHours
        SET day_of_week = @day_of_week, open_time = @open_time, close_time = @close_time
        WHERE id = @id
      `);

    await logAuditAction(req.user.user_id, 'WORKING_HOURS_UPDATED', null, restaurant_id, branch_id, transaction);
    req.io?.to(`admin_${restaurant_id}_${branch_id}`).emit('working-hours-updated', { restaurant_id, branch_id });

    await transaction.commit();
    res.json({ message: 'Çalışma saati güncellendi' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating working hours:', err);
    res.status(500).json({ message: 'Çalışma saati güncellenemedi', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/**
 * 🔹 Çalışma saati sil
 */
router.delete('/working-hours/:id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const { id } = req.params;

    const check = await transaction.request().input('id', sql.Int, id).query(`
      SELECT restaurant_id, branch_id FROM WorkingHours WHERE id = @id
    `);
    if (check.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Çalışma saati bulunamadı', error_code: 'NOT_FOUND' });
    }

    const { restaurant_id, branch_id } = check.recordset[0];

    await transaction.request().input('id', sql.Int, id).query('DELETE FROM WorkingHours WHERE id = @id');

    await logAuditAction(req.user.user_id, 'WORKING_HOURS_DELETED', null, restaurant_id, branch_id, transaction);
    req.io?.to(`admin_${restaurant_id}_${branch_id}`).emit('working-hours-updated', { restaurant_id, branch_id });

    await transaction.commit();
    res.json({ message: 'Çalışma saati silindi' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error deleting working hours:', err);
    res.status(500).json({ message: 'Çalışma saati silinemedi', error_code: 'SERVER_ERROR', error: err.message });
  }
});

export default router;
