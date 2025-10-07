import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { poolPromise, sql } from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

/* -------------------------------------------------------------
   🔧 Multer — Görsel yükleme ayarları
------------------------------------------------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(path.resolve(), 'Uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const valid = filetypes.test(path.extname(file.originalname).toLowerCase()) && filetypes.test(file.mimetype);
    if (valid) cb(null, true);
    else cb(new Error('Sadece JPEG veya PNG dosyaları yüklenebilir'));
  },
});

/* -------------------------------------------------------------
   🧠 Helper — Audit Log
------------------------------------------------------------- */
const logAuditAction = async (userId, action, targetUserId, restaurantId, branchId, transaction = null) => {
  try {
    const req = transaction ? transaction.request() : (await poolPromise).request();
    await req
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

/* -------------------------------------------------------------
   ✅ Yardımcı Doğrulama Fonksiyonları
------------------------------------------------------------- */
const validateMenuInput = ({ name, price, description, category }) => {
  if (!name || typeof name !== 'string' || name.trim().length === 0)
    return { valid: false, message: 'Menü adı gerekli', error_code: 'INVALID_MENU_NAME' };
  if (isNaN(price) || Number(price) <= 0)
    return { valid: false, message: 'Geçerli bir fiyat girin', error_code: 'INVALID_PRICE' };
  if (description && description.length > 500)
    return { valid: false, message: 'Açıklama 500 karakteri geçemez', error_code: 'INVALID_DESCRIPTION' };
  return { valid: true };
};

const validateExtraInput = ({ name, price, menu_id }) => {
  if (!name || name.trim().length === 0)
    return { valid: false, message: 'Ekstra adı gerekli', error_code: 'INVALID_EXTRA_NAME' };
  if (isNaN(price) || Number(price) < 0)
    return { valid: false, message: 'Geçerli bir fiyat girin', error_code: 'INVALID_PRICE' };
  if (!menu_id || isNaN(menu_id))
    return { valid: false, message: 'Geçerli bir menü ID gerekli', error_code: 'INVALID_MENU_ID' };
  return { valid: true };
};

/* -------------------------------------------------------------
   📦 MENÜLER
------------------------------------------------------------- */

// ✅ Menüleri listele
router.get('/:restaurant_id/:branch_id', async (req, res) => {
  try {
    const { restaurant_id, branch_id } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('restaurant_id', sql.Int, restaurant_id)
      .input('branch_id', sql.Int, branch_id)
      .query(`
        SELECT id, name, price, description, category, image_url 
        FROM Menus
        WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id AND (is_deleted IS NULL OR is_deleted = 0)
        ORDER BY name
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching menus:', err);
    res.status(500).json({ message: 'Menüler alınamadı', error: err.message });
  }
});

// ✅ Menü oluştur
router.post('/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), upload.single('image'), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const { restaurant_id, branch_id } = req.params;
    const { name, price, description, category } = req.body;
    const image = req.file;

    const validation = validateMenuInput({ name, price, description, category });
    if (!validation.valid) throw new Error(validation.message);

    const request = transaction.request();

    const menuExists = await request
      .input('restaurant_id', sql.Int, restaurant_id)
      .input('branch_id', sql.Int, branch_id)
      .input('name', sql.NVarChar, name.trim())
      .query(`SELECT id FROM Menus WHERE restaurant_id=@restaurant_id AND branch_id=@branch_id AND name=@name AND (is_deleted=0 OR is_deleted IS NULL)`);

    if (menuExists.recordset.length > 0) {
      throw new Error('Bu isimde menü zaten mevcut');
    }

    const image_url = image ? `/Uploads/${image.filename}` : null;

    const result = await request
      .input('restaurant_id', sql.Int, restaurant_id)
      .input('branch_id', sql.Int, branch_id)
      .input('name', sql.NVarChar, name)
      .input('price', sql.Decimal(9, 2), Number(price))
      .input('description', sql.NVarChar, description || null)
      .input('category', sql.NVarChar, category || null)
      .input('image_url', sql.NVarChar, image_url)
      .query(`
        INSERT INTO Menus (restaurant_id, branch_id, name, price, description, category, image_url, is_deleted)
        OUTPUT INSERTED.*
        VALUES (@restaurant_id, @branch_id, @name, @price, @description, @category, @image_url, 0)
      `);

    await logAuditAction(req.user.user_id, 'MENU_ADDED', null, restaurant_id, branch_id, transaction);
    req.io.to(`restaurant_${restaurant_id}_${branch_id}`).emit('menu-added', result.recordset[0]);
    await transaction.commit();
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    await transaction.rollback();
    console.error('Error creating menu:', err);
    res.status(500).json({ message: 'Menü eklenemedi', error: err.message });
  }
});

// ✅ Menü güncelle
router.put('/:menu_id', authMiddleware(['admin', 'owner']), upload.single('image'), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const { menu_id } = req.params;
    const { name, price, description, category } = req.body;
    const image = req.file;

    const validation = validateMenuInput({ name, price, description, category });
    if (!validation.valid) throw new Error(validation.message);

    const request = transaction.request();
    const existing = await request.input('menu_id', sql.Int, menu_id).query('SELECT * FROM Menus WHERE id=@menu_id');
    if (existing.recordset.length === 0) throw new Error('Menü bulunamadı');

    const oldMenu = existing.recordset[0];
    let image_url = oldMenu.image_url;
    if (image) {
      if (image_url && fs.existsSync(path.join(path.resolve(), image_url))) fs.unlinkSync(path.join(path.resolve(), image_url));
      image_url = `/Uploads/${image.filename}`;
    }

    const result = await request
      .input('name', sql.NVarChar, name)
      .input('price', sql.Decimal(9, 2), Number(price))
      .input('description', sql.NVarChar, description || null)
      .input('category', sql.NVarChar, category || null)
      .input('image_url', sql.NVarChar, image_url)
      .input('menu_id', sql.Int, menu_id)
      .query(`
        UPDATE Menus 
        SET name=@name, price=@price, description=@description, category=@category, image_url=@image_url
        OUTPUT INSERTED.*
        WHERE id=@menu_id
      `);

    await logAuditAction(req.user.user_id, 'MENU_UPDATED', null, oldMenu.restaurant_id, oldMenu.branch_id, transaction);
    req.io.to(`restaurant_${oldMenu.restaurant_id}_${oldMenu.branch_id}`).emit('menu-updated', result.recordset[0]);
    await transaction.commit();
    res.json(result.recordset[0]);
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating menu:', err);
    res.status(500).json({ message: 'Menü güncellenemedi', error: err.message });
  }
});

// ✅ Menü sil (soft delete)
router.delete('/:menu_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  try {
    const { menu_id } = req.params;
    const pool = await poolPromise;
    await pool.request().input('menu_id', sql.Int, menu_id).query('UPDATE Menus SET is_deleted = 1 WHERE id=@menu_id');
    res.json({ message: 'Menü silindi' });
  } catch (err) {
    console.error('Error deleting menu:', err);
    res.status(500).json({ message: 'Menü silinemedi', error: err.message });
  }
});

/* -------------------------------------------------------------
   🍟 EXTRAS — Menü Ekstraları
------------------------------------------------------------- */

// ✅ Ekstra listele
router.get('/extras/:restaurant_id/:branch_id', async (req, res) => {
  try {
    const { restaurant_id, branch_id } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('restaurant_id', sql.Int, restaurant_id)
      .input('branch_id', sql.Int, branch_id)
      .query(`
        SELECT id, menu_id, name, price 
        FROM Extras
        WHERE restaurant_id=@restaurant_id AND branch_id=@branch_id
        ORDER BY name
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching extras:', err);
    res.status(500).json({ message: 'Ekstralar alınamadı', error: err.message });
  }
});

// ✅ Ekstra oluştur
router.post('/extras/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const { restaurant_id, branch_id } = req.params;
    const { menu_id, name, price } = req.body;
    const validation = validateExtraInput({ name, price, menu_id });
    if (!validation.valid) throw new Error(validation.message);

    const request = transaction.request();

    const result = await request
      .input('restaurant_id', sql.Int, restaurant_id)
      .input('branch_id', sql.Int, branch_id)
      .input('menu_id', sql.Int, menu_id)
      .input('name', sql.NVarChar, name.trim())
      .input('price', sql.Decimal(9, 2), Number(price))
      .query(`
        INSERT INTO Extras (restaurant_id, branch_id, menu_id, name, price)
        OUTPUT INSERTED.*
        VALUES (@restaurant_id, @branch_id, @menu_id, @name, @price)
      `);

    await logAuditAction(req.user.user_id, 'EXTRA_ADDED', null, restaurant_id, branch_id, transaction);
    req.io.to(`restaurant_${restaurant_id}_${branch_id}`).emit('extra-added', result.recordset[0]);
    await transaction.commit();
    res.status(201).json({ message: 'Ekstra eklendi', data: result.recordset[0] });
  } catch (err) {
    await transaction.rollback();
    console.error('Error creating extra:', err);
    res.status(500).json({ message: 'Ekstra eklenemedi', error: err.message });
  }
});

// ✅ Ekstra güncelle
router.put('/extras/:id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const { id } = req.params;
    const { name, price } = req.body;

    if (!name || isNaN(price)) throw new Error('Eksik veya geçersiz veri');

    const request = transaction.request();
    const existing = await request.input('id', sql.Int, id).query('SELECT * FROM Extras WHERE id=@id');
    if (existing.recordset.length === 0) throw new Error('Ekstra bulunamadı');

    const extra = existing.recordset[0];

    const result = await request
      .input('name', sql.NVarChar, name.trim())
      .input('price', sql.Decimal(9, 2), Number(price))
      .input('id', sql.Int, id)
      .query(`
        UPDATE Extras SET name=@name, price=@price OUTPUT INSERTED.* WHERE id=@id
      `);

    await logAuditAction(req.user.user_id, 'EXTRA_UPDATED', null, extra.restaurant_id, extra.branch_id, transaction);
    req.io.to(`restaurant_${extra.restaurant_id}_${extra.branch_id}`).emit('extra-updated', result.recordset[0]);
    await transaction.commit();
    res.json({ message: 'Ekstra güncellendi', data: result.recordset[0] });
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating extra:', err);
    res.status(500).json({ message: 'Ekstra güncellenemedi', error: err.message });
  }
});

// ✅ Ekstra sil
router.delete('/extras/:id', authMiddleware(['admin', 'owner']), async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    await pool.request().input('id', sql.Int, id).query('DELETE FROM Extras WHERE id=@id');
    res.json({ message: 'Ekstra silindi' });
  } catch (err) {
    console.error('Error deleting extra:', err);
    res.status(500).json({ message: 'Ekstra silinemedi', error: err.message });
  }
});

export default router;
