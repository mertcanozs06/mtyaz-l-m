import express from 'express';
import { poolPromise, sql } from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Helper: basic validation
const validateBranchInput = ({ name, country, city }) => {
  if (!name || typeof name !== 'string' || name.length > 100) return { valid: false, message: 'Geçersiz şube adı' };
  if (!country || typeof country !== 'string' || country.length > 50) return { valid: false, message: 'Geçersiz ülke' };
  if (!city || typeof city !== 'string' || city.length > 50) return { valid: false, message: 'Geçersiz şehir' };
  return { valid: true };
};

// Şube ekle
router.post('/branches/:restaurant_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { name, country, city, address = null, phone = null } = req.body;
    const { restaurant_id } = req.params;

    const validation = validateBranchInput({ name, country, city });
    if (!validation.valid) {
      await transaction.rollback();
      return res.status(400).json({ message: validation.message });
    }

    // Paket kontrolü (UserPackages)
    const packageResult = await request
      .input('user_id', sql.Int, req.user.user_id)
      .query('SELECT package_type, max_branches FROM UserPackages WHERE user_id = @user_id');
    if (packageResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(403).json({ message: 'Geçerli paket bulunamadı' });
    }
    const { package_type, max_branches } = packageResult.recordset[0];

    const branchCount = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .query('SELECT COUNT(*) AS count FROM Branches WHERE restaurant_id = @restaurant_id');
    const count = branchCount.recordset[0].count;

    if (max_branches && count >= max_branches) {
      await transaction.rollback();
      return res.status(403).json({ message: `Bu pakette (${package_type}) en fazla ${max_branches} şube eklenebilir` });
    }

    const branchResult = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('name', sql.NVarChar, name)
      .input('country', sql.NVarChar, country)
      .input('city', sql.NVarChar, city)
      .input('address', sql.NVarChar, address)
      .input('phone', sql.NVarChar, phone)
      .query(`
        INSERT INTO Branches (restaurant_id, name, country, city, address, phone)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @name, @country, @city, @address, @phone)
      `);
    const branch_id = branchResult.recordset[0].id;

    // İlk admin ikinci şubeyi ekleyince owner yap
    if (count === 1 && req.user.role === 'admin') {
      await request
        .input('user_id', sql.Int, req.user.user_id)
        .query("UPDATE Users SET role = 'owner' WHERE id = @user_id");
    }

    await transaction.commit();
    res.status(201).json({ branch_id });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Şube eklenemedi', error: err.message });
  }
});

export default router;
