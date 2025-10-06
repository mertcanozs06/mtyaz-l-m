import express from 'express';
import { poolPromise, sql } from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Helper function: Execute SQL with error handling
const executeQuery = async (query, inputs, transaction = null) => {
  const request = transaction ? transaction.request() : (await poolPromise).request();
  Object.entries(inputs).forEach(([key, value]) => {
    request.input(key, value);
  });
  return request.query(query);
};

// Helper function: Log to UserAuditLog
const logAuditAction = async (userId, action, targetUserId, restaurantId, branchId, transaction = null) => {
  try {
    await executeQuery(
      `INSERT INTO UserAuditLog (user_id, action, target_user_id, created_at)
       VALUES (@userId, @action, @targetUserId, GETDATE())`,
      { userId: userId || null, action, targetUserId: targetUserId || null },
      transaction
    );
  } catch (err) {
    console.error('Audit log kaydı başarısız:', err);
  }
};

// Register
router.post('/register', async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();

    const { restaurantName, email, password, name, phone, address } = req.body;
    const package_type = 'basic'; // Varsayılan paket

    // 1. E-posta kontrolü
    const emailCheck = await executeQuery(
      `SELECT id FROM Users WHERE email = @email`,
      { email },
      transaction
    );
    if (emailCheck.recordset.length > 0) {
      await transaction.rollback();
      return res.status(409).json({ message: 'Bu email adresi zaten kullanımda', error_code: 'DUPLICATE_EMAIL' });
    }

    // 2. Restoran oluştur
    const restaurantResult = await executeQuery(
      `INSERT INTO Restaurants (name, adress) 
       OUTPUT INSERTED.id 
       VALUES (@name, @address)`,
      { name: restaurantName, address },
      transaction
    );
    const restaurant_id = restaurantResult.recordset[0].id;

    // 3. Kullanıcı oluştur (initial admin)
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await executeQuery(
      `INSERT INTO Users (restaurant_id, email, password, role, name, phone, package_type, is_initial_admin, is_active) 
       OUTPUT INSERTED.id
       VALUES (@restaurant_id, @email, @password, 'admin', @name, @phone, @package_type, 1, 1)`,
      {
        restaurant_id,
        email,
        password: hashedPassword,
        name,
        phone,
        package_type,
      },
      transaction
    );
    const user_id = userResult.recordset[0].id;

    // 4. Varsayılan şube oluştur
    const branchResult = await executeQuery(
      `INSERT INTO Branches (restaurant_id, name, country, city, adress, phone) 
       OUTPUT INSERTED.id, INSERTED.name 
       VALUES (@restaurant_id, 'Varsayılan Şube', 'Türkiye', 'Varsayılan Şehir', @address, @phone)`,
      { restaurant_id, address, phone },
      transaction
    );
    const branch = branchResult.recordset[0];

    // 5. Paket oluştur (UserPackages)
    const max_branches = package_type === 'basic' ? 1 : package_type === 'advance' ? 5 : 50;
    await executeQuery(
      `INSERT INTO UserPackages (user_id, package_type, max_branches, created_at) 
       VALUES (@user_id, @package_type, @max_branches, GETDATE())`,
      { user_id, package_type, max_branches },
      transaction
    );

    // 6. Kullanıcıya branch_id ata
    await executeQuery(
      `UPDATE Users SET branch_id = @branch_id WHERE id = @user_id`,
      { branch_id: branch.id, user_id },
      transaction
    );

    // 7. Audit log kaydı
    await logAuditAction(user_id, 'USER_REGISTERED', null, restaurant_id, branch.id, transaction);

    // 8. Token oluştur
    const token = jwt.sign(
      {
        user_id,
        email,
        role: 'admin',
        restaurant_id,
        branch_id: branch.id,
        is_initial_admin: 1,
        package_type,
      },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '8h' }
    );

    // 9. Socket.IO bildirimi
    req.io.to(`admin_${restaurant_id}_${branch.id}`).emit('user-action-logged', {
      action: 'USER_REGISTERED',
      target_user_id: user_id,
    });

    await transaction.commit();

    res.status(201).json({
      token,
      restaurant_id,
      branches: [branch],
      package_type,
      max_branches,
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Registration Error:', err);
    res.status(500).json({ message: 'Kayıt başarısız', error_code: 'SERVER_ERROR', error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();

    const { email, password } = req.body;

    // 1. Kullanıcıyı bul
    const userResult = await executeQuery(
      `SELECT 
        u.id, u.email, u.password, u.role, u.restaurant_id, u.branch_id, 
        u.is_initial_admin, u.package_type, u.is_active,
        up.max_branches
       FROM Users u
       LEFT JOIN UserPackages up ON u.id = up.user_id
       WHERE u.email = @email`,
      { email },
      transaction
    );

    const user = userResult.recordset[0];
    if (!user) {
      await logAuditAction(null, 'LOGIN_FAILED_INVALID_EMAIL', null, null, null, transaction);
      await transaction.commit();
      return res.status(401).json({ message: 'Geçersiz kimlik bilgileri', error_code: 'INVALID_CREDENTIALS' });
    }

    // 2. Kullanıcı aktif mi?
    if (!user.is_active) {
      await logAuditAction(user.id, 'LOGIN_FAILED_INACTIVE', null, user.restaurant_id, user.branch_id, transaction);
      await transaction.commit();
      return res.status(403).json({ message: 'Kullanıcı hesabı aktif değil', error_code: 'INACTIVE_USER' });
    }

    // 3. Şifre kontrolü
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await logAuditAction(user.id, 'LOGIN_FAILED_WRONG_PASSWORD', null, user.restaurant_id, user.branch_id, transaction);
      await transaction.commit();
      return res.status(401).json({ message: 'Geçersiz şifre', error_code: 'INVALID_PASSWORD' });
    }

    // 4. Paket süresi kontrolü
    if (user.package_type === 'basic') {
      const packageResult = await executeQuery(
        `SELECT created_at FROM UserPackages 
         WHERE user_id = @user_id`,
        { user_id: user.id },
        transaction
      );

      const packageData = packageResult.recordset[0];
      if (packageData) {
        const createdAt = new Date(packageData.created_at);
        const now = new Date();
        const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

        if (diffDays > 30) {
          await logAuditAction(user.id, 'LOGIN_FAILED_PACKAGE_EXPIRED', null, user.restaurant_id, user.branch_id, transaction);
          await transaction.commit();
          return res.status(403).json({
            message: 'Ücretsiz deneme süreniz sona erdi',
            error_code: 'PACKAGE_EXPIRED',
          });
        }
      }
    }

    // 5. Şubeleri getir
    const branchesResult = await executeQuery(
      `SELECT id, name, country, city 
       FROM Branches WHERE restaurant_id = @restaurant_id`,
      { restaurant_id: user.restaurant_id },
      transaction
    );

    // 6. Audit log kaydı
    await logAuditAction(user.id, 'LOGIN_SUCCESS', null, user.restaurant_id, user.branch_id, transaction);

    // 7. Token oluştur
    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        role: user.role,
        restaurant_id: user.restaurant_id,
        branch_id: user.branch_id,
        is_initial_admin: user.is_initial_admin,
        package_type: user.package_type,
      },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '8h' }
    );

    // 8. Socket.IO bildirimi
    req.io.to(`admin_${user.restaurant_id}_${user.branch_id}`).emit('user-action-logged', {
      action: 'LOGIN_SUCCESS',
      target_user_id: user.id,
    });

    await transaction.commit();

    res.json({
      token,
      restaurant_id: user.restaurant_id,
      branches: branchesResult.recordset,
      package_type: user.package_type,
      max_branches: user.max_branches,
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Giriş başarısız', error_code: 'SERVER_ERROR', error: err.message });
  }
});

// Get user info
router.get('/user', authMiddleware(['admin', 'owner', 'waiter', 'kitchen']), async (req, res) => {
  try {
    const result = await executeQuery(
      `SELECT 
        u.email, u.role, u.restaurant_id, u.package_type, 
        u.is_initial_admin, u.branch_id, u.is_active,
        up.max_branches
       FROM Users u
       LEFT JOIN UserPackages up ON u.id = up.user_id
       WHERE u.email = @email`,
      { email: req.user.email }
    );

    if (result.recordset.length === 0) {
      await logAuditAction(req.user.user_id, 'USER_INFO_NOT_FOUND', null, req.user.restaurant_id, req.user.branch_id);
      return res.status(404).json({ message: 'Kullanıcı bulunamadı', error_code: 'USER_NOT_FOUND' });
    }

    // Audit log kaydı
    await logAuditAction(req.user.user_id, 'USER_INFO_FETCHED', null, req.user.restaurant_id, req.user.branch_id);

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('User Info Error:', err);
    res.status(500).json({ message: 'Bilgiler alınamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

export default router;

