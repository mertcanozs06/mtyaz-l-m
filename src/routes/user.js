import express from 'express';
import bcrypt from 'bcryptjs';
import { poolPromise, sql } from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Helper: Audit Log Ekleme
const logAuditAction = async (userId, action, targetUserId, restaurantId, branchId, transaction = null) => {
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

// 👤 Kullanıcıları getir
router.get('/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();

    const { restaurant_id, branch_id } = req.params;
    const result = await transaction
      .request()
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .query(`
        SELECT id, email, role, branch_id, name, phone, is_active, is_initial_admin
        FROM Users 
        WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id AND is_active = 1
      `);

    await logAuditAction(req.user.id, 'USERS_FETCHED', null, restaurant_id, branch_id, transaction);

    await transaction.commit();
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Kullanıcılar alınamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

// ➕ Kullanıcı ekle
router.post('/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();

    const { email, password, role, name, phone } = req.body;
    const { restaurant_id, branch_id } = req.params;

    if (!email || !password || !role) {
      await transaction.rollback();
      return res.status(400).json({ message: 'E-posta, şifre ve rol zorunlu', error_code: 'MISSING_FIELDS' });
    }
    if (!['admin', 'waiter', 'kitchen'].includes(role)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Geçersiz rol', error_code: 'INVALID_ROLE' });
    }
    if (password.length < 8) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Şifre en az 8 karakter olmalı', error_code: 'INVALID_PASSWORD' });
    }

    // E-posta kontrolü
    const emailCheck = await transaction
      .request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM Users WHERE email = @email');
    if (emailCheck.recordset.length > 0) {
      await transaction.rollback();
      return res.status(409).json({ message: 'Bu e-posta zaten kullanımda', error_code: 'DUPLICATE_EMAIL' });
    }

    // Rol kısıtlaması
    if (req.user.role === 'admin' && role === 'admin') {
      await logAuditAction(req.user.id, 'UNAUTHORIZED_ADMIN_ADD', null, restaurant_id, branch_id, transaction);
      await transaction.rollback();
      return res.status(403).json({ message: 'Admin sadece waiter ve kitchen ekleyebilir', error_code: 'FORBIDDEN_ROLE' });
    }

    // Paket kontrolü
    const packageResult = await transaction
      .request()
      .input('user_id', sql.Int, req.user.id)
      .query('SELECT package_type, max_branches FROM UserPackages WHERE user_id = @user_id');
    if (packageResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(403).json({ message: 'Geçerli paket bulunamadı', error_code: 'INVALID_PACKAGE' });
    }
    const { package_type } = packageResult.recordset[0];
    if (package_type === 'basic' && role === 'admin') {
      await logAuditAction(req.user.id, 'UNAUTHORIZED_ADMIN_ADD_PACKAGE', null, restaurant_id, branch_id, transaction);
      await transaction.rollback();
      return res.status(403).json({ message: 'Basic paket admin eklemeyi desteklemez', error_code: 'FORBIDDEN_PACKAGE' });
    }

    // Şifre hashleme
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await transaction
      .request()
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('role', sql.NVarChar, role)
      .input('name', sql.NVarChar, name || null)
      .input('phone', sql.NVarChar, phone || null)
      .input('created_by', sql.NVarChar, req.user.email)
      .query(`
        INSERT INTO Users (restaurant_id, branch_id, email, password, role, name, phone, created_by, is_active)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @branch_id, @email, @password, @role, @name, @phone, @created_by, 1)
      `);
    const newUserId = userResult.recordset[0].id;

    await logAuditAction(req.user.id, 'USER_ADDED', newUserId, restaurant_id, branch_id, transaction);

    req.io?.to(`admin_${restaurant_id}_${branch_id}`).emit('user-action-logged', {
      action: 'USER_ADDED',
      target_user_id: newUserId,
    });

    await transaction.commit();
    res.status(201).json({ message: 'Kullanıcı eklendi', user_id: newUserId });
  } catch (err) {
    await transaction.rollback();
    console.error('Error adding user:', err);
    res.status(500).json({ message: 'Kullanıcı eklenemedi', error_code: 'SERVER_ERROR', error: err.message });
  }
});

// ❌ Kullanıcı sil
router.delete('/:id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();

    const { id } = req.params;
    const { restaurant_id, branch_id } = req.user;

    const userResult = await transaction
      .request()
      .input('id', sql.Int, parseInt(id))
      .input('restaurant_id', sql.Int, restaurant_id)
      .input('branch_id', sql.Int, branch_id)
      .query(`
        SELECT id, role, is_initial_admin 
        FROM Users 
        WHERE id = @id AND restaurant_id = @restaurant_id AND branch_id = @branch_id
      `);
    if (userResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Kullanıcı bulunamadı', error_code: 'USER_NOT_FOUND' });
    }

    const targetUser = userResult.recordset[0];
    if (req.user.role === 'admin' && (targetUser.role === 'admin' || targetUser.is_initial_admin)) {
      await logAuditAction(req.user.id, 'UNAUTHORIZED_ADMIN_DELETE', id, restaurant_id, branch_id, transaction);
      await transaction.rollback();
      return res.status(403).json({ message: 'Admin başka admin silemez', error_code: 'FORBIDDEN_DELETE' });
    }
    if (req.user.id === parseInt(id)) {
      await logAuditAction(req.user.id, 'SELF_DELETE_ATTEMPT', id, restaurant_id, branch_id, transaction);
      await transaction.rollback();
      return res.status(403).json({ message: 'Kendi hesabınızı silemezsiniz', error_code: 'SELF_DELETE' });
    }

    await transaction
      .request()
      .input('id', sql.Int, parseInt(id))
      .query('UPDATE Users SET is_active = 0 WHERE id = @id');

    await logAuditAction(req.user.id, 'USER_DELETED', id, restaurant_id, branch_id, transaction);

    req.io?.to(`admin_${restaurant_id}_${branch_id}`).emit('user-action-logged', {
      action: 'USER_DELETED',
      target_user_id: id,
    });

    await transaction.commit();
    res.json({ message: 'Kullanıcı silindi' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Kullanıcı silinemedi', error_code: 'SERVER_ERROR', error: err.message });
  }
});

export default router;
