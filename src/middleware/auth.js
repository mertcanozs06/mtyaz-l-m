import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { poolPromise, sql } from '../config/db.js';

dotenv.config();

export const authMiddleware = (roles = []) => async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token bulunamadı', error_code: 'NO_TOKEN' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;

  try {
    // 🔒 Token doğrulama
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    req.user = decoded;

    // 1️⃣ ROL KONTROLÜ
    if (roles.length > 0 && !roles.includes(decoded.role)) {
      await logAuditAction(decoded.id, 'UNAUTHORIZED_ACCESS', null, decoded.restaurant_id, decoded.branch_id);
      return res.status(403).json({ message: 'Bu işlem için yetkiniz yok', error_code: 'FORBIDDEN_ROLE' });
    }

    const { restaurantId, branchId } = req.params;

    // 2️⃣ ŞUBE DOĞRULAMA
    if (restaurantId && branchId) {
      const pool = await poolPromise;
      const branchResult = await pool
        .request()
        .input('restaurant_id', sql.Int, parseInt(restaurantId))
        .input('branch_id', sql.Int, parseInt(branchId))
        .query('SELECT id FROM Branches WHERE id = @branch_id AND restaurant_id = @restaurant_id');

      if (branchResult.recordset.length === 0) {
        await logAuditAction(decoded.id, 'INVALID_BRANCH_ACCESS', null, restaurantId, branchId);
        return res.status(403).json({ message: 'Geçersiz şube veya restoran', error_code: 'INVALID_BRANCH' });
      }

      // 3️⃣ ROLE-BASED ŞUBE ERİŞİMİ
      if (decoded.role === 'admin') {
        const userResult = await pool
          .request()
          .input('id', sql.Int, decoded.id)
          .query('SELECT is_initial_admin, branch_id FROM Users WHERE id = @id');

        if (userResult.recordset.length === 0) {
          await logAuditAction(decoded.id, 'USER_NOT_FOUND', null, restaurantId, branchId);
          return res.status(403).json({ message: 'Kullanıcı bulunamadı', error_code: 'USER_NOT_FOUND' });
        }

        const { is_initial_admin, branch_id } = userResult.recordset[0];
        if (!is_initial_admin && parseInt(branchId) !== branch_id) {
          await logAuditAction(decoded.id, 'UNAUTHORIZED_BRANCH_ACCESS', null, restaurantId, branchId);
          return res.status(403).json({
            message: 'Sadece kendi şubenize erişebilirsiniz',
            error_code: 'UNAUTHORIZED_BRANCH',
          });
        }
      } else if (decoded.role !== 'owner' && decoded.branch_id && parseInt(branchId) !== decoded.branch_id) {
        await logAuditAction(decoded.id, 'UNAUTHORIZED_BRANCH_ACCESS', null, restaurantId, branchId);
        return res.status(403).json({
          message: 'Bu şubeye erişim yetkiniz yok',
          error_code: 'UNAUTHORIZED_BRANCH',
        });
      }
    }

    // 4️⃣ BRANCH_ID YOKSA OTOMATİK ATA (Owner hariç)
    if (!decoded.branch_id && decoded.role !== 'owner' && decoded.restaurant_id) {
      const pool = await poolPromise;
      const branchRes = await pool
        .request()
        .input('restaurant_id', sql.Int, decoded.restaurant_id)
        .query('SELECT TOP 1 id FROM Branches WHERE restaurant_id = @restaurant_id');

      if (branchRes.recordset.length > 0) {
        decoded.branch_id = branchRes.recordset[0].id;
        const newToken = jwt.sign(decoded, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.setHeader('X-New-Token', newToken);
        await logAuditAction(decoded.id, 'BRANCH_ASSIGNED', null, decoded.restaurant_id, decoded.branch_id);
      }
    }

    // 5️⃣ KULLANICI AKTİFLİK KONTROLÜ
    const pool = await poolPromise;
    const statusRes = await pool
      .request()
      .input('id', sql.Int, decoded.id)
      .query('SELECT is_active FROM Users WHERE id = @id');

    if (statusRes.recordset.length === 0 || !statusRes.recordset[0].is_active) {
      await logAuditAction(decoded.id, 'INACTIVE_USER_ACCESS', null, decoded.restaurant_id, decoded.branch_id);
      return res.status(403).json({ message: 'Kullanıcı hesabı aktif değil', error_code: 'INACTIVE_USER' });
    }

    next();
  } catch (err) {
    console.error('🔐 Kimlik doğrulama hatası:', err.message);

    if (err.name === 'TokenExpiredError') {
      await logAuditAction(decoded?.id || null, 'TOKEN_EXPIRED', null, decoded?.restaurant_id, decoded?.branch_id);
      return res.status(401).json({ message: 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.', error_code: 'TOKEN_EXPIRED' });
    }

    await logAuditAction(decoded?.id || null, 'INVALID_TOKEN', null, decoded?.restaurant_id, decoded?.branch_id);
    return res.status(401).json({ message: 'Geçersiz token', error_code: 'INVALID_TOKEN' });
  }
};

// 🧾 Kullanıcı eylemlerini loglama fonksiyonu
const logAuditAction = async (userId, action, targetUserId, restaurantId, branchId) => {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('action', sql.NVarChar, action)
      .input('targetUserId', sql.Int, targetUserId)
      .input('restaurantId', sql.Int, restaurantId)
      .input('branchId', sql.Int, branchId)
      .input('created_at', sql.DateTime, new Date())
      .query(`
        INSERT INTO UserAuditLog (user_id, action, target_user_id, restaurant_id, branch_id, created_at)
        VALUES (@userId, @action, @targetUserId, @restaurantId, @branchId, @created_at)
      `);
  } catch (err) {
    console.error('Audit log kaydı başarısız:', err.message);
  }
};
