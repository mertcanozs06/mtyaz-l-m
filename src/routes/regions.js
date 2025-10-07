import express from 'express';
import { poolPromise, sql } from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

// Helper function: Log to UserAuditLog
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

// Helper function: Validate inputs
const validateRegionInput = ({ name }) => {
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
    return { valid: false, message: 'Geçerli bir bölge adı gerekli (1-100 karakter)', error_code: 'INVALID_REGION_NAME' };
  }
  return { valid: true };
};

// Bölge listesini getir
router.get('/', authMiddleware(['admin', 'owner', 'waiter', 'kitchen']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { restaurant_id, branch_id } = req.params;
    const user = req.user;

    // Yetki kontrolü
    if (user.restaurant_id !== parseInt(restaurant_id)) {
      await logAuditAction(user.user_id, 'UNAUTHORIZED_ACCESS', null, restaurant_id, branch_id, transaction);
      await transaction.rollback();
      return res.status(403).json({ message: 'Bu restorana erişim yetkiniz yok', error_code: 'UNAUTHORIZED' });
    }

    // Şube kontrolü
    const branchCheck = await request
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .query('SELECT id FROM Branches WHERE id = @branch_id AND restaurant_id = @restaurant_id');
    if (branchCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Şube bulunamadı', error_code: 'BRANCH_NOT_FOUND' });
    }

    // Bölgeleri getir (sort_order desteği ile)
    const result = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .query(`
        SELECT id, name, sort_order
        FROM Regions 
        WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id 
        ORDER BY sort_order ASC, name ASC
      `);

    await logAuditAction(user.user_id, 'REGIONS_FETCHED', null, restaurant_id, branch_id, transaction);

    await transaction.commit();
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    console.error('Error fetching regions:', err);
    res.status(500).json({ message: 'Bölgeler alınamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

// Yeni bölge ekle
router.post('/', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { restaurant_id, branch_id } = req.params;
    const { name, sort_order } = req.body;
    const user = req.user;

    // Girdi doğrulama
    const validation = validateRegionInput({ name });
    if (!validation.valid) {
      await transaction.rollback();
      return res.status(400).json({ message: validation.message, error_code: validation.error_code });
    }

    // Yetki kontrolü
    if (user.restaurant_id !== parseInt(restaurant_id)) {
      await logAuditAction(user.user_id, 'UNAUTHORIZED_ACCESS', null, restaurant_id, branch_id, transaction);
      await transaction.rollback();
      return res.status(403).json({ message: 'Bu restorana erişim yetkiniz yok', error_code: 'UNAUTHORIZED' });
    }

    // Şube kontrolü
    const branchCheck = await request
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .query('SELECT id FROM Branches WHERE id = @branch_id AND restaurant_id = @restaurant_id');
    if (branchCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Şube bulunamadı', error_code: 'BRANCH_NOT_FOUND' });
    }

    // Çakışma kontrolü
    const regionCheck = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('name', sql.NVarChar, name.trim())
      .query(`
        SELECT id FROM Regions 
        WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id AND name = @name
      `);
    if (regionCheck.recordset.length > 0) {
      await transaction.rollback();
      return res.status(409).json({ message: 'Bu şubede aynı isimde bir bölge zaten var', error_code: 'DUPLICATE_REGION' });
    }

    // Bölge ekle
    const result = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('name', sql.NVarChar, name.trim())
      .input('sort_order', sql.Int, sort_order || 0)
      .query(`
        INSERT INTO Regions (restaurant_id, branch_id, name, sort_order)
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.sort_order
        VALUES (@restaurant_id, @branch_id, @name, @sort_order)
      `);

    await logAuditAction(user.user_id, 'REGION_ADDED', null, restaurant_id, branch_id, transaction);

    req.io.to(`admin_${restaurant_id}_${branch_id}`).emit('region-updated', {
      restaurant_id,
      branch_id,
      region_id: result.recordset[0].id,
      name: result.recordset[0].name,
    });

    await transaction.commit();
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    await transaction.rollback();
    console.error('Error adding region:', err);
    res.status(500).json({ message: 'Bölge eklenemedi', error_code: 'SERVER_ERROR', error: err.message });
  }
});

// ✅ Bölge Güncelle (PUT)
router.put('/:region_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { restaurant_id, branch_id, region_id } = req.params;
    const { name, sort_order } = req.body;
    const user = req.user;

    // Yetki kontrolü
    if (user.restaurant_id !== parseInt(restaurant_id)) {
      await logAuditAction(user.user_id, 'UNAUTHORIZED_ACCESS', null, restaurant_id, branch_id, transaction);
      await transaction.rollback();
      return res.status(403).json({ message: 'Bu restorana erişim yetkiniz yok', error_code: 'UNAUTHORIZED' });
    }

    // Bölge mevcut mu?
    const regionCheck = await request
      .input('region_id', sql.Int, parseInt(region_id))
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .query(`
        SELECT id FROM Regions 
        WHERE id = @region_id AND restaurant_id = @restaurant_id AND branch_id = @branch_id
      `);
    if (regionCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Bölge bulunamadı', error_code: 'REGION_NOT_FOUND' });
    }

    // Güncelleme işlemi
    await request
      .input('region_id', sql.Int, parseInt(region_id))
      .input('name', sql.NVarChar, name ? name.trim() : null)
      .input('sort_order', sql.Int, sort_order ?? null)
      .query(`
        UPDATE Regions
        SET 
          name = COALESCE(@name, name),
          sort_order = COALESCE(@sort_order, sort_order)
        WHERE id = @region_id
      `);

    await logAuditAction(user.user_id, 'REGION_UPDATED', null, restaurant_id, branch_id, transaction);

    req.io.to(`admin_${restaurant_id}_${branch_id}`).emit('region-updated', {
      restaurant_id,
      branch_id,
      region_id,
      updated_fields: { name, sort_order },
    });

    await transaction.commit();
    res.status(200).json({ message: 'Bölge güncellendi', region_id });
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating region:', err);
    res.status(500).json({ message: 'Bölge güncellenemedi', error_code: 'SERVER_ERROR', error: err.message });
  }
});

// Bölge sil
router.delete('/:region_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { restaurant_id, branch_id, region_id } = req.params;
    const user = req.user;

    // Yetki kontrolü
    if (user.restaurant_id !== parseInt(restaurant_id)) {
      await logAuditAction(user.user_id, 'UNAUTHORIZED_ACCESS', null, restaurant_id, branch_id, transaction);
      await transaction.rollback();
      return res.status(403).json({ message: 'Bu restorana erişim yetkiniz yok', error_code: 'UNAUTHORIZED' });
    }

    // Bölge var mı?
    const regionCheck = await request
      .input('region_id', sql.Int, parseInt(region_id))
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .query(`
        SELECT id, name FROM Regions 
        WHERE id = @region_id AND restaurant_id = @restaurant_id AND branch_id = @branch_id
      `);
    if (regionCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Bölge bulunamadı', error_code: 'REGION_NOT_FOUND' });
    }

    // Masalarda kullanılıyor mu?
    const tableCheck = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('region', sql.NVarChar, regionCheck.recordset[0].name)
      .query(`
        SELECT id FROM Tables 
        WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id AND region = @region
      `);
    if (tableCheck.recordset.length > 0) {
      await logAuditAction(user.user_id, 'REGION_DELETE_FAILED', null, restaurant_id, branch_id, transaction);
      await transaction.rollback();
      return res.status(400).json({ message: 'Bu bölge masalarda kullanıldığı için silinemez', error_code: 'REGION_IN_USE' });
    }

    // Bölgeyi sil
    await request
      .input('region_id', sql.Int, parseInt(region_id))
      .query('DELETE FROM Regions WHERE id = @region_id');

    await logAuditAction(user.user_id, 'REGION_DELETED', null, restaurant_id, branch_id, transaction);

    req.io.to(`admin_${restaurant_id}_${branch_id}`).emit('region-updated', {
      restaurant_id,
      branch_id,
      region_id,
    });

    await transaction.commit();
    res.status(204).send();
  } catch (err) {
    await transaction.rollback();
    console.error('Error deleting region:', err);
    res.status(500).json({ message: 'Bölge silinemedi', error_code: 'SERVER_ERROR', error: err.message });
  }
});

export default router;
