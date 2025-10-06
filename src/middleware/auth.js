import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { poolPromise, sql } from '../config/db.js';

dotenv.config();

export const authMiddleware = (roles = []) => async (req, res, next) => {
  // Token kontrolü
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token bulunamadı', error_code: 'NO_TOKEN' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Geçersiz token formatı', error_code: 'INVALID_TOKEN_FORMAT' });
  }

  try {
    // JWT doğrulama
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded;

    // 1. ROL KONTROLÜ
    if (roles.length && !roles.includes(decoded.role)) {
      await logAuditAction(decoded.user_id || null, 'UNAUTHORIZED_ACCESS', null, decoded.restaurant_id, decoded.branch_id);
      return res.status(403).json({ message: 'Bu işlem için yetkiniz yok', error_code: 'FORBIDDEN_ROLE' });
    }

    // 2. ŞUBE ERİŞİM KONTROLÜ
    const { restaurant_id, branch_id } = req.params;
    if (restaurant_id && branch_id) {
      const pool = await poolPromise;
      const branchResult = await pool
        .request()
        .input('restaurant_id', sql.Int, parseInt(restaurant_id))
        .input('branch_id', sql.Int, parseInt(branch_id))
        .query('SELECT id FROM Branches WHERE id = @branch_id AND restaurant_id = @restaurant_id');

      if (branchResult.recordset.length === 0) {
        await logAuditAction(decoded.user_id || null, 'INVALID_BRANCH_ACCESS', null, restaurant_id, branch_id);
        return res.status(403).json({ message: 'Geçersiz şube veya restoran', error_code: 'INVALID_BRANCH' });
      }

      // 3. İLK ADMIN VE OWNER AYRIMI
      if (decoded.role === 'admin') {
        const userResult = await pool
          .request()
          .input('id', sql.Int, decoded.user_id)
          .query('SELECT is_initial_admin, branch_id FROM Users WHERE id = @id');

        if (userResult.recordset.length === 0) {
          await logAuditAction(decoded.user_id || null, 'USER_NOT_FOUND', null, restaurant_id, branch_id);
          return res.status(403).json({ message: 'Kullanıcı bulunamadı', error_code: 'USER_NOT_FOUND' });
        }

        const { is_initial_admin, branch_id: userBranchId } = userResult.recordset[0];
        if (!is_initial_admin && parseInt(branch_id) !== userBranchId) {
          await logAuditAction(decoded.user_id || null, 'UNAUTHORIZED_BRANCH_ACCESS', null, restaurant_id, branch_id);
          return res.status(403).json({
            message: 'Sadece kendi şubenize erişebilirsiniz',
            error_code: 'UNAUTHORIZED_BRANCH',
          });
        }
      } else if (decoded.role !== 'owner' && decoded.branch_id && parseInt(branch_id) !== decoded.branch_id) {
        await logAuditAction(decoded.user_id || null, 'UNAUTHORIZED_BRANCH_ACCESS', null, restaurant_id, branch_id);
        return res.status(403).json({
          message: 'Bu şubeye erişim yetkiniz yok',
          error_code: 'UNAUTHORIZED_BRANCH',
        });
      }
    }

    // 5. KULLANICI AKTİF Mİ KONTROLÜ
    const pool = await poolPromise;
    const userStatus = await pool
      .request()
      .input('id', sql.Int, decoded.user_id)
      .query('SELECT is_active FROM Users WHERE id = @id');

    if (userStatus.recordset.length === 0 || !userStatus.recordset[0].is_active) {
      await logAuditAction(decoded.user_id || null, 'INACTIVE_USER_ACCESS', null, decoded.restaurant_id, decoded.branch_id);
      return res.status(403).json({ message: 'Kullanıcı hesabı aktif değil', error_code: 'INACTIVE_USER' });
    }

    next();
  } catch (err) {
    console.error('Kimlik doğrulama hatası:', err.message);
    if (err.name === 'TokenExpiredError') {
      await logAuditAction(null, 'TOKEN_EXPIRED', null, null, null);
      return res.status(401).json({ message: 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.', error_code: 'TOKEN_EXPIRED' });
    }
    await logAuditAction(null, 'INVALID_TOKEN', null, null, null);
    return res.status(401).json({ message: 'Geçersiz token', error_code: 'INVALID_TOKEN' });
  }
};

// UserAuditLog’a kayıt ekleme yardımcı fonksiyonu
const logAuditAction = async (userId, action, targetUserId, restaurantId, branchId) => {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('action', sql.NVarChar, action)
      .input('targetUserId', sql.Int, targetUserId)
      .input('created_at', sql.DateTime, new Date())
      .query(`
        INSERT INTO UserAuditLog (user_id, action, target_user_id, created_at)
        VALUES (@userId, @action, @targetUserId, @created_at)
      `);
  } catch (err) {
    console.error('Audit log kaydı başarısız:', err);
  }
};
