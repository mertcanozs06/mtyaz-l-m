import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { poolPromise, sql } from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(path.resolve(), 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Menüleri getir
router.get('/:restaurant_id/:branch_id', async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { restaurant_id, branch_id } = req.params;

    const result = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .query(`
        SELECT id, name, price, description, category, image_url 
        FROM Menus 
        WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id AND (is_deleted IS NULL OR is_deleted = 0)
      `);
    await transaction.commit();
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error fetching menus', error: err.message });
  }
});

// Menü ekle
router.post('/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), upload.single('image'), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { name, price, description, category } = req.body;
    const { restaurant_id, branch_id } = req.params;
    const image = req.file;

    if (!name || !price) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Menü adı ve fiyat zorunludur' });
    }

    let image_url = null;
    if (image && image.filename) {
      image_url = `/uploads/${image.filename}`;
    }

    const result = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('name', sql.NVarChar, name)
      .input('price', sql.Decimal(9, 2), Number(price))
      .input('description', sql.NVarChar, description || null)
      .input('category', sql.NVarChar, category || null)
      .input('image_url', sql.NVarChar, image_url)
      .query(`
        INSERT INTO Menus (restaurant_id, branch_id, name, price, description, category, image_url, is_deleted)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @branch_id, @name, @price, @description, @category, @image_url, 0)
      `);

    const newId = result.recordset[0].id;
    req.io.to(`restaurant_${restaurant_id}_${branch_id}`).emit('menu-updated');

    await transaction.commit();
    res.status(201).json({
      id: newId,
      name,
      price: parseFloat(price),
      description,
      category,
      image_url,
      restaurant_id: parseInt(restaurant_id),
      branch_id: parseInt(branch_id),
    });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error creating menu', error: err.message });
  }
});

// Menü sil
router.delete('/:menu_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { menu_id } = req.params;
    const menu = await request
      .input('menu_id', sql.Int, parseInt(menu_id))
      .query('SELECT restaurant_id, branch_id FROM Menus WHERE id = @menu_id');
    if (!menu.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Menu not found' });
    }

    await request
      .input('menu_id', sql.Int, parseInt(menu_id))
      .query(`UPDATE Menus SET is_deleted = 1 WHERE id = @menu_id`);

    req.io.to(`restaurant_${menu.recordset[0].restaurant_id}_${menu.recordset[0].branch_id}`).emit('menu-updated');
    await transaction.commit();
    res.json({ message: 'Menü silindi (soft delete)' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error deleting menu', error: err.message });
  }
});

// Ekstra malzemeleri getir
router.get('/extras/:restaurant_id/:branch_id', async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { menu_id } = req.query;
    const { restaurant_id, branch_id } = req.params;

    let query = 'SELECT id, menu_id, name, price FROM Extras WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id';
    request.input('restaurant_id', sql.Int, parseInt(restaurant_id));
    request.input('branch_id', sql.Int, parseInt(branch_id));
    if (menu_id) {
      request.input('menu_id', sql.Int, parseInt(menu_id));
      query += ' AND menu_id = @menu_id';
    }

    const result = await request.query(query);
    await transaction.commit();
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error fetching extras', error: err.message });
  }
});

// Ekstra ekle
router.post('/extras/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { menu_id, name, price } = req.body;
    const { restaurant_id, branch_id } = req.params;

    const result = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('menu_id', sql.Int, parseInt(menu_id))
      .input('name', sql.NVarChar, name)
      .input('price', sql.Decimal(9, 2), Number(price))
      .query(`
        INSERT INTO Extras (restaurant_id, branch_id, menu_id, name, price)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @branch_id, @menu_id, @name, @price)
      `);

    const newId = result.recordset[0].id;
    req.io.to(`restaurant_${restaurant_id}_${branch_id}`).emit('menu-updated');
    await transaction.commit();
    res.status(201).json({ message: 'Ekstra malzeme eklendi', id: newId });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error creating extra', error: err.message });
  }
});

// Ekstra sil
router.delete('/extras/:id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { id } = req.params;
    const extra = await request
      .input('id', sql.Int, parseInt(id))
      .query('SELECT restaurant_id, branch_id FROM Extras WHERE id = @id');
    if (!extra.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Extra not found' });
    }

    await request
      .input('id', sql.Int, parseInt(id))
      .query('DELETE FROM Extras WHERE id = @id');

    req.io.to(`restaurant_${extra.recordset[0].restaurant_id}_${extra.recordset[0].branch_id}`).emit('menu-updated');
    await transaction.commit();
    res.json({ message: 'Ekstra silindi' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error deleting extra', error: err.message });
  }
});

// Menü güncelle
router.put('/:menu_id', authMiddleware(['admin', 'owner']), upload.single('image'), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { name, price, description, category } = req.body;
    const { menu_id } = req.params;
    const image = req.file;

    let image_url = null;
    if (image && image.filename) {
      image_url = `/uploads/${image.filename}`;
    } else {
      const result = await request
        .input('id', sql.Int, parseInt(menu_id))
        .query('SELECT image_url FROM Menus WHERE id = @id');
      image_url = result.recordset[0]?.image_url || null;
    }

    const menu = await request
      .input('menu_id', sql.Int, parseInt(menu_id))
      .query('SELECT restaurant_id, branch_id FROM Menus WHERE id = @menu_id');
    if (!menu.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Menu not found' });
    }

    await request
      .input('menu_id', sql.Int, parseInt(menu_id))
      .input('name', sql.NVarChar, name)
      .input('price', sql.Decimal(9, 2), Number(price))
      .input('description', sql.NVarChar, description || null)
      .input('category', sql.NVarChar, category || null)
      .input('image_url', sql.NVarChar, image_url)
      .query(`
        UPDATE Menus
        SET name = @name, price = @price, description = @description, category = @category, image_url = @image_url
        WHERE id = @menu_id
      `);

    req.io.to(`restaurant_${menu.recordset[0].restaurant_id}_${menu.recordset[0].branch_id}`).emit('menu-updated');
    await transaction.commit();
    res.json({ message: 'Menü güncellendi', image_url });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error updating menu', error: err.message });
  }
});

export default router;

