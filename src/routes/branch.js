import express from 'express';
import { poolPromise, sql } from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

/* -------------------------------------------------------------
   Helper: Audit log
------------------------------------------------------------- */
const logAuditAction = async (userId, action, targetUserId, restaurantId, branchId = null, transaction = null) => {
  try {
    const request = transaction ? transaction.request() : (await poolPromise).request();
    await request
      .input('userId', sql.Int, userId || null)
      .input('action', sql.NVarChar, action)
      .input('targetUserId', sql.Int, targetUserId || null)
      .input('restaurant_id', sql.Int, restaurantId || null)
      .input('branch_id', sql.Int, branchId || null)
      .input('created_at', sql.DateTime, new Date())
      .query(`
        INSERT INTO UserAuditLog (user_id, action, target_user_id, restaurant_id, branch_id, created_at)
        VALUES (@userId, @action, @targetUserId, @restaurant_id, @branch_id, @created_at)
      `);
  } catch (err) {
    console.error('Audit log kaydı başarısız:', err);
  }
};

/* -------------------------------------------------------------
   Helper: Input validation
------------------------------------------------------------- */
const validateBranchInput = ({ country, city, name }) => {
  if (!country || typeof country !== 'string' || country.trim().length === 0 || country.trim().length > 100) {
    return { valid: false, message: 'Geçerli bir ülke adı gerekli (1-100 karakter)', error_code: 'INVALID_COUNTRY' };
  }
  if (!city || typeof city !== 'string' || city.trim().length === 0 || city.trim().length > 100) {
    return { valid: false, message: 'Geçerli bir şehir adı gerekli (1-100 karakter)', error_code: 'INVALID_CITY' };
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
    return { valid: false, message: 'Geçerli bir şube adı gerekli (1-100 karakter)', error_code: 'INVALID_BRANCH_NAME' };
  }
  return { valid: true };
};

/* -------------------------------------------------------------
   GET /:restaurant_id    — Şubeleri listele
   rol: admin|owner
------------------------------------------------------------- */
router.get('/:restaurant_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { restaurant_id } = req.params;

    // Yetkilendirme kontrolü: token'daki restaurant_id ile istek parametresi uyuşmalı
    if (req.user.restaurant_id !== parseInt(restaurant_id, 10)) {
      await logAuditAction(req.user.user_id, 'UNAUTHORIZED_ACCESS', null, restaurant_id, null, transaction);
      await transaction.rollback();
      return res.status(403).json({ message: 'Bu restorana erişim yetkiniz yok', error_code: 'UNAUTHORIZED' });
    }

    const result = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id, 10))
      .query(`
        SELECT id, country, city, name 
        FROM Branches 
        WHERE restaurant_id = @restaurant_id 
        ORDER BY name
      `);

    // Audit log kaydı
    await logAuditAction(req.user.user_id, 'BRANCHES_FETCHED', null, restaurant_id, null, transaction);

    await transaction.commit();

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Bu restorana ait şube bulunamadı', error_code: 'BRANCHES_NOT_FOUND' });
    }

    return res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    console.error('Error fetching branches:', err);
    return res.status(500).json({ message: 'Şubeler alınamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/* -------------------------------------------------------------
   POST /:restaurant_id   — Şube ekle
   rol: admin|owner
   Paket limiti kontrolü -> UserPackages.max_branches
------------------------------------------------------------- */
router.post('/:restaurant_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { restaurant_id } = req.params;
    const { country, city, name } = req.body;
    const user_id = req.user.user_id;

    // Input validation
    const validation = validateBranchInput({ country, city, name });
    if (!validation.valid) {
      await transaction.rollback();
      return res.status(400).json({ message: validation.message, error_code: validation.error_code });
    }

    // Authorization check
    if (req.user.restaurant_id !== parseInt(restaurant_id, 10)) {
      await logAuditAction(req.user.user_id, 'UNAUTHORIZED_ACCESS', null, restaurant_id, null, transaction);
      await transaction.rollback();
      return res.status(403).json({ message: 'Bu restorana erişim yetkiniz yok', error_code: 'UNAUTHORIZED' });
    }

    // Duplicate check (aynı isim + aynı şehir içinde)
    const exists = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id, 10))
      .input('city', sql.NVarChar, city.trim())
      .input('name', sql.NVarChar, name.trim())
      .query(`
        SELECT id FROM Branches
        WHERE restaurant_id = @restaurant_id AND city = @city AND name = @name
      `);
    if (exists.recordset.length > 0) {
      await transaction.rollback();
      return res.status(409).json({ message: `Bu şehirde '${name}' adında bir şube zaten mevcut`, error_code: 'DUPLICATE_BRANCH' });
    }

    // Paket limiti kontrolü (UserPackages.max_branches)
    const packageResult = await request
      .input('user_id', sql.Int, user_id)
      .query('SELECT max_branches FROM UserPackages WHERE user_id = @user_id');

    const branchCountResult = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id, 10))
      .query('SELECT COUNT(*) AS count FROM Branches WHERE restaurant_id = @restaurant_id');
    const currentBranchCount = branchCountResult.recordset[0].count;

    if (packageResult.recordset.length > 0 && packageResult.recordset[0].max_branches != null) {
      const maxBranches = packageResult.recordset[0].max_branches;
      if (maxBranches > 0 && currentBranchCount >= maxBranches) {
        await logAuditAction(user_id, 'BRANCH_ADD_FAILED', null, restaurant_id, null, transaction);
        await transaction.rollback();
        return res.status(403).json({ message: 'Şube limiti aşıldı', error_code: 'BRANCH_LIMIT_EXCEEDED' });
      }
    }

    // Insert new branch
    const insertResult = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id, 10))
      .input('country', sql.NVarChar, country.trim())
      .input('city', sql.NVarChar, city.trim())
      .input('name', sql.NVarChar, name.trim())
      .query(`
        INSERT INTO Branches (restaurant_id, country, city, name)
        OUTPUT INSERTED.id, INSERTED.country, INSERTED.city, INSERTED.name
        VALUES (@restaurant_id, @country, @city, @name)
      `);

    const newBranch = insertResult.recordset[0];

    // Eğer şu anki şube sayısı 1 ise (yeni ekleme ile ikinci oluyor), admin->owner rol değişikliği
    // currentBranchCount değişkeni eklemeden önceki sayıdır
    if (currentBranchCount === 1) {
      // Kullanıcının hâlihazırdaki rolü admin ise owner yap
      await request
        .input('user_id', sql.Int, user_id)
        .input('restaurant_id', sql.Int, parseInt(restaurant_id, 10))
        .query(`
          UPDATE Users
          SET role = 'owner'
          WHERE id = @user_id AND role = 'admin' AND restaurant_id = @restaurant_id
        `);

      await logAuditAction(user_id, 'USER_ROLE_UPDATED_TO_OWNER', user_id, restaurant_id, newBranch.id, transaction);
    }

    // Audit log kaydı
    await logAuditAction(user_id, 'BRANCH_ADDED', null, restaurant_id, newBranch.id, transaction);

    // Socket.IO bildirimi (global restaurant room)
    req.io?.to(`restaurant_${restaurant_id}`).emit('branch-added', {
      id: newBranch.id,
      restaurant_id: parseInt(restaurant_id, 10),
      country: newBranch.country,
      city: newBranch.city,
      name: newBranch.name,
    });

    await transaction.commit();
    return res.status(201).json({ message: 'Şube eklendi', branch: newBranch });
  } catch (err) {
    await transaction.rollback();
    console.error('Error creating branch:', err);
    return res.status(500).json({ message: 'Şube eklenemedi', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/* -------------------------------------------------------------
   DELETE /:branch_id   — Şube sil
   rol: admin|owner
   - Aktif sipariş kontrolü
   - Bağlı verileri temizleme (önceki mantığınla uyumlu)
   - Owner/admin rol düzeltilmesi
------------------------------------------------------------- */
router.delete('/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { branch_id } = req.params;
    const user_id = req.user.user_id;

    // Branch var mı?
    const branchCheck = await request
      .input('branch_id', sql.Int, parseInt(branch_id, 10))
      .query('SELECT id, restaurant_id FROM Branches WHERE id = @branch_id');
    if (branchCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Şube bulunamadı', error_code: 'BRANCH_NOT_FOUND' });
    }

    const restaurant_id = branchCheck.recordset[0].restaurant_id;

    // Yetki kontrolü: token içindeki restaurant ile uyuşmalı
    if (req.user.restaurant_id !== parseInt(restaurant_id, 10)) {
      await logAuditAction(req.user.user_id, 'UNAUTHORIZED_ACCESS', null, restaurant_id, branch_id, transaction);
      await transaction.rollback();
      return res.status(403).json({ message: 'Bu restorana erişim yetkiniz yok', error_code: 'UNAUTHORIZED' });
    }

    // Aktif (hazır/servis/işlemde) sipariş kontrolü: burada kullandığın durum tanımına göre sorguyu güncelleyebilirsin
    const activeOrders = await request
      .input('branch_id', sql.Int, parseInt(branch_id, 10))
      .query(`
        SELECT id FROM Orders 
        WHERE branch_id = @branch_id AND status IN ('pending','preparing','ready')
      `);
    if (activeOrders.recordset.length > 0) {
      await logAuditAction(user_id, 'BRANCH_DELETE_FAILED_ACTIVE_ORDERS', null, restaurant_id, branch_id, transaction);
      await transaction.rollback();
      return res.status(400).json({ message: 'Bu şubede aktif siparişler var, silinemez', error_code: 'BRANCH_IN_USE' });
    }

    // Şubeyle ilişkili verileri temizleme (önceki mantığını koruyan silme)
    // Burada cascade veya soft-delete tercih edebilirsin; senin mantığın tam silme olduğu için aşağıdaki şekilde yaptım.
    await request
      .input('branch_id', sql.Int, parseInt(branch_id, 10))
      .query(`
        DELETE FROM QRCodes WHERE branch_id = @branch_id;
        DELETE FROM ServedOrders WHERE order_id IN (SELECT id FROM Orders WHERE branch_id = @branch_id);
        DELETE FROM OrderDetails WHERE order_id IN (SELECT id FROM Orders WHERE branch_id = @branch_id);
        DELETE FROM Orders WHERE branch_id = @branch_id;
        DELETE FROM Tables WHERE branch_id = @branch_id;
        DELETE FROM Menus WHERE branch_id = @branch_id;
        DELETE FROM Extras WHERE branch_id = @branch_id;
        DELETE FROM Branches WHERE id = @branch_id;
      `);

    // Şube sayısını yeniden say -> eğer sonuç 1 ise (geriye 1 kaldıysa), owner -> admin rolü düzeltmesi
    const branchCountResult = await request
      .input('restaurant_id', sql.Int, restaurant_id)
      .query('SELECT COUNT(*) AS count FROM Branches WHERE restaurant_id = @restaurant_id');
    const remaining = branchCountResult.recordset[0].count;

    if (remaining === 1) {
      // Eğer user şu an owner ise admin'e çevir (sadece örnek senaryoya göre)
      await request
        .input('user_id', sql.Int, user_id)
        .input('restaurant_id', sql.Int, restaurant_id)
        .query(`
          UPDATE Users
          SET role = 'admin'
          WHERE id = @user_id AND role = 'owner' AND restaurant_id = @restaurant_id
        `);
      await logAuditAction(user_id, 'USER_ROLE_UPDATED_TO_ADMIN', user_id, restaurant_id, null, transaction);
    }

    // Audit log kaydı
    await logAuditAction(user_id, 'BRANCH_DELETED', null, restaurant_id, parseInt(branch_id, 10), transaction);

    // Socket.IO bildirimi
    req.io?.to(`restaurant_${restaurant_id}`).emit('branch-deleted', { branch_id: parseInt(branch_id, 10) });

    await transaction.commit();
    return res.json({ message: 'Şube silindi' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error deleting branch:', err);
    return res.status(500).json({ message: 'Şube silinemedi', error_code: 'SERVER_ERROR', error: err.message });
  }
});

export default router;
