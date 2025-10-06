import express from 'express';
import bcrypt from 'bcryptjs';
import { poolPromise, sql } from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Kullanıcıları getir
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

    await transaction.commit();
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
});

// Kullanıcı ekle
router.post('/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();

    const { email, password, role, name, phone } = req.body;
    const { restaurant_id, branch_id } = req.params;

    if (!email || !password || !role) {
      await transaction.rollback();
      return res.status(400).json({ message: 'E-posta, şifre ve rol zorunlu' });
    }
    if (!['admin', 'waiter', 'kitchen'].includes(role)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Geçersiz rol' });
    }
    if (req.user.role === 'admin' && role === 'admin') {
      await transaction.rollback();
      return res.status(403).json({ message: 'Admin sadece waiter ve kitchen rolleri ekleyebilir' });
    }

    const packageResult = await transaction
      .request()
      .input('user_id', sql.Int, req.user.user_id)
      .query('SELECT package_type FROM UserPackages WHERE user_id = @user_id');
    if (packageResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(403).json({ message: 'Geçerli paket bulunamadı' });
    }
    const { package_type } = packageResult.recordset[0];
    if (package_type === 'basic' && role === 'admin') {
      await transaction.rollback();
      return res.status(403).json({ message: 'Basic paket admin eklemeyi desteklemez' });
    }

    const emailCheck = await transaction
      .request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM Users WHERE email = @email');
    if (emailCheck.recordset.length > 0) {
      await transaction.rollback();
      return res.status(409).json({ message: 'Bu e-posta zaten kullanımda' });
    }

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

    await transaction.commit();
    res.status(201).json({ message: 'User added', user_id: newUserId });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error adding user', error: err.message });
  }
});

// Kullanıcı sil
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
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    const targetUser = userResult.recordset[0];
    if (req.user.role === 'admin' && (targetUser.role === 'admin' || targetUser.is_initial_admin)) {
      await transaction.rollback();
      return res.status(403).json({ message: 'Admin, başka admin veya initial admin silemez' });
    }
    if (req.user.user_id === parseInt(id)) {
      await transaction.rollback();
      return res.status(403).json({ message: 'Kendi hesabınızı silemezsiniz' });
    }

    await transaction
      .request()
      .input('id', sql.Int, parseInt(id))
      .query('UPDATE Users SET is_active = 0 WHERE id = @id');

    await transaction.commit();
    res.json({ message: 'User deleted' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
});

export default router;

