import express from 'express';
import { poolPromise, sql } from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import QRCode from 'qrcode';

const router = express.Router();

/* ------------------------------------------------------------
   🧠 Helper: Kullanıcı işlem loglama
------------------------------------------------------------ */
const logAuditAction = async (userId, action, targetUserId, restaurantId, branchId, transaction = null) => {
  try {
    const request = transaction ? transaction.request() : (await poolPromise).request();
    await request
      .input('userId', sql.Int, userId || null)
      .input('action', sql.NVarChar, action)
      .input('targetUserId', sql.Int, targetUserId || null)
      .input('restaurantId', sql.Int, restaurantId || null)
      .input('branchId', sql.Int, branchId || null)
      .input('created_at', sql.DateTime, new Date())
      .query(`
        INSERT INTO UserAuditLog (user_id, action, target_user_id, restaurant_id, branch_id, created_at)
        VALUES (@userId, @action, @targetUserId, @restaurantId, @branchId, @created_at)
      `);
  } catch (err) {
    console.error('Audit log kaydı başarısız:', err);
  }
};

/* ------------------------------------------------------------
   ✅ Helper: Girdi doğrulama
------------------------------------------------------------ */
const validateTableInput = ({ table_number, region, table_count }) => {
  if (!region || typeof region !== 'string' || region.length > 50) {
    return { valid: false, message: 'Geçersiz bölge adı', error_code: 'INVALID_REGION' };
  }
  if (table_count) {
    if (isNaN(table_count) || table_count < 1 || table_count > 100) {
      return { valid: false, message: 'Masa sayısı 1-100 arasında olmalı', error_code: 'INVALID_TABLE_COUNT' };
    }
  } else if (isNaN(table_number) || table_number < 1) {
    return { valid: false, message: 'Geçersiz masa numarası', error_code: 'INVALID_TABLE_NUMBER' };
  }
  return { valid: true };
};

/* ------------------------------------------------------------
   📥 GET: Şubedeki tüm masaları getir
------------------------------------------------------------ */
router.get('/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner', 'waiter', 'kitchen']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();
    const { restaurant_id, branch_id } = req.params;

    // Şube doğrulama
    const branchCheck = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .query(`
        SELECT id FROM Branches 
        WHERE restaurant_id = @restaurant_id AND id = @branch_id
      `);

    if (branchCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Geçersiz restoran veya şube', error_code: 'INVALID_BRANCH' });
    }

    // Masaları getir
    const result = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .query(`
        SELECT t.id, t.region, t.table_number, q.qr_code_url
        FROM Tables t
        LEFT JOIN QRCodes q ON t.id = q.table_id
        WHERE t.restaurant_id = @restaurant_id AND t.branch_id = @branch_id
        ORDER BY t.region, t.table_number
      `);

    await logAuditAction(req.user.user_id, 'TABLES_FETCHED', null, restaurant_id, branch_id, transaction);
    await transaction.commit();
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    console.error('Error fetching tables:', err);
    res.status(500).json({ message: 'Masalar alınamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/* ------------------------------------------------------------
   ➕ POST: Yeni masa(lar) ekle
------------------------------------------------------------ */
router.post('/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { table_number, region, table_count } = req.body;
    const { restaurant_id, branch_id } = req.params;

    // Girdi doğrulama
    const validation = validateTableInput({ table_number, region, table_count });
    if (!validation.valid) {
      await transaction.rollback();
      return res.status(400).json({ message: validation.message, error_code: validation.error_code });
    }

    const requestedCount = table_count || 1;
    const addedTables = [];
    for (let i = 1; i <= requestedCount; i++) {
      const num = table_count ? i : table_number;

      // Masa çakışma kontrolü
      const exists = await request
        .input('restaurant_id', sql.Int, parseInt(restaurant_id))
        .input('branch_id', sql.Int, parseInt(branch_id))
        .input('region', sql.NVarChar, region)
        .input('table_number', sql.Int, num)
        .query(`
          SELECT id FROM Tables
          WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id AND region = @region AND table_number = @table_number
        `);
      if (exists.recordset.length > 0) {
        await transaction.rollback();
        return res.status(409).json({ message: `Masa ${num} zaten mevcut`, error_code: 'TABLE_EXISTS' });
      }

      // Yeni masa ekle
      const tableResult = await request
        .query(`
          INSERT INTO Tables (restaurant_id, branch_id, region, table_number)
          OUTPUT INSERTED.id
          VALUES (@restaurant_id, @branch_id, @region, @table_number)
        `);
      const table_id = tableResult.recordset[0].id;

      // QR kod oluştur
      const qrCodeUrl = await QRCode.toDataURL(
        `${process.env.APP_URL || 'https://yourapp.com'}/qrmenu/${restaurant_id}/${branch_id}/${region}/${num}`
      );

      await request
        .input('table_id', sql.Int, table_id)
        .input('qr_code_url', sql.NVarChar, qrCodeUrl)
        .query(`
          INSERT INTO QRCodes (restaurant_id, branch_id, region, table_number, qr_code_url, table_id)
          VALUES (@restaurant_id, @branch_id, @region, @table_number, @qr_code_url, @table_id)
        `);

      addedTables.push({ table_id, table_number: num, region, qr_code_url: qrCodeUrl });
    }

    await logAuditAction(req.user.user_id, 'TABLE_ADDED', null, restaurant_id, branch_id, transaction);
    req.io.to(`admin_${restaurant_id}_${branch_id}`).emit('table-updated', { restaurant_id, branch_id, tables: addedTables });

    await transaction.commit();
    res.status(201).json({ message: 'Masalar ve QR kodları eklendi', tables: addedTables });
  } catch (err) {
    await transaction.rollback();
    console.error('Error adding table:', err);
    res.status(500).json({ message: 'Masa eklenemedi', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/* ------------------------------------------------------------
   ❌ DELETE: Masa sil
------------------------------------------------------------ */
router.delete('/:table_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { table_id } = req.params;

    // Masa var mı?
    const tableCheck = await request
      .input('table_id', sql.Int, parseInt(table_id))
      .query('SELECT restaurant_id, branch_id FROM Tables WHERE id = @table_id');

    if (tableCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Masa bulunamadı', error_code: 'TABLE_NOT_FOUND' });
    }

    const { restaurant_id, branch_id } = tableCheck.recordset[0];

    // İlgili kayıtları sil
    await request
      .input('table_id', sql.Int, parseInt(table_id))
      .query(`
        DELETE FROM QRCodes WHERE table_id = @table_id;
        DELETE FROM ServedOrders WHERE order_id IN (SELECT id FROM Orders WHERE table_id = @table_id);
        DELETE FROM OrdersDetails WHERE order_id IN (SELECT id FROM Orders WHERE table_id = @table_id);
        DELETE FROM Orders WHERE table_id = @table_id;
        DELETE FROM Tables WHERE id = @table_id;
      `);

    await logAuditAction(req.user.user_id, 'TABLE_DELETED', null, restaurant_id, branch_id, transaction);
    req.io.to(`admin_${restaurant_id}_${branch_id}`).emit('table-updated', { restaurant_id, branch_id, table_id });

    await transaction.commit();
    res.json({ message: 'Masa silindi' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error deleting table:', err);
    res.status(500).json({ message: 'Masa silinemedi', error_code: 'SERVER_ERROR', error: err.message });
  }
});

export default router;
