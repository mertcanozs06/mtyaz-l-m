import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import sql from 'mssql';

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
  try {
    const result = await pool.request()
      .input('restaurant_id', sql.Int, req.params.restaurant_id)
      .input('branch_id', sql.Int, req.params.branch_id)
      .query(`
        SELECT * FROM Menus 
        WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id AND (is_deleted IS NULL OR is_deleted = 0)
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching menus', error: err.message });
  }
});

// Menü ekle
router.post('/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), upload.single('image'), async (req, res) => {
  try {
    const { name, price, description, category } = req.body;
    const { restaurant_id, branch_id } = req.params;
    const image = req.file;

    if (!name || !price) {
      return res.status(400).json({ message: 'Menü adı ve fiyat zorunludur' });
    }

    let image_url = null;
    if (image && image.filename) {
      image_url = `/uploads/${image.filename}`;
    }

    const result = await pool.request()
      .input('restaurant_id', sql.Int, restaurant_id)
      .input('branch_id', sql.Int, branch_id)
      .input('name', sql.NVarChar, name)
      .input('price', sql.Decimal(9, 2), price)
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

    res.status(201).json({
      id: newId,
      name,
      price: parseFloat(price),
      description,
      category,
      image_url,
      restaurant_id,
      branch_id,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating menu', error: err.message });
  }
});

// Menü sil
router.delete('/:menu_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  try {
    const { menu_id } = req.params;
    const menu = await pool.request()
      .input('menu_id', sql.Int, menu_id)
      .query('SELECT restaurant_id, branch_id FROM Menus WHERE id = @menu_id');
    if (!menu.recordset.length) {
      return res.status(404).json({ message: 'Menu not found' });
    }

    await pool.request()
      .input('menu_id', sql.Int, menu_id)
      .query(`UPDATE Menus SET is_deleted = 1 WHERE id = @menu_id`);

    req.io.to(`restaurant_${menu.recordset[0].restaurant_id}_${menu.recordset[0].branch_id}`).emit('menu-updated');
    res.json({ message: 'Menü silindi (soft delete)' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting menu', error: err.message });
  }
});

// Ekstra malzemeleri getir
router.get('/extras/:restaurant_id/:branch_id', async (req, res) => {
  try {
    const { menu_id } = req.query;
    const request = pool.request()
      .input('restaurant_id', sql.Int, req.params.restaurant_id)
      .input('branch_id', sql.Int, req.params.branch_id);

    let query = 'SELECT * FROM Extras WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id';
    if (menu_id) {
      request.input('menu_id', sql.Int, menu_id);
      query += ' AND menu_id = @menu_id';
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching extras', error: err.message });
  }
});

// Ekstra ekle
router.post('/extras/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  try {
    const { menu_id, name, price } = req.body;
    const result = await pool.request()
      .input('restaurant_id', sql.Int, req.params.restaurant_id)
      .input('branch_id', sql.Int, req.params.branch_id)
      .input('menu_id', sql.Int, menu_id)
      .input('name', sql.NVarChar, name)
      .input('price', sql.Decimal(9, 2), price)
      .query(`
        INSERT INTO Extras (restaurant_id, branch_id, menu_id, name, price)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @branch_id, @menu_id, @name, @price)
      `);

    const newId = result.recordset[0].id;
    req.io.to(`restaurant_${req.params.restaurant_id}_${req.params.branch_id}`).emit('menu-updated');
    res.status(201).json({ message: 'Ekstra malzeme eklendi', id: newId });
  } catch (err) {
    res.status(500).json({ message: 'Error creating extra', error: err.message });
  }
});

// Ekstra sil
router.delete('/extras/:id', authMiddleware(['admin', 'owner']), async (req, res) => {
  try {
    const extra = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT restaurant_id, branch_id FROM Extras WHERE id = @id');
    if (!extra.recordset.length) {
      return res.status(404).json({ message: 'Extra not found' });
    }

    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM Extras WHERE id = @id');

    req.io.to(`restaurant_${extra.recordset[0].restaurant_id}_${extra.recordset[0].branch_id}`).emit('menu-updated');
    res.json({ message: 'Ekstra silindi' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting extra', error: err.message });
  }
});

// Menü güncelle
router.put('/:menu_id', authMiddleware(['admin', 'owner']), upload.single('image'), async (req, res) => {
  try {
    const { name, price, description, category } = req.body;
    const { menu_id } = req.params;
    const image = req.file;

    let image_url = null;
    if (image && image.filename) {
      image_url = `/uploads/${image.filename}`;
    } else {
      const result = await pool.request()
        .input('id', sql.Int, menu_id)
        .query('SELECT image_url FROM Menus WHERE id = @id');
      image_url = result.recordset[0]?.image_url || null;
    }

    const menu = await pool.request()
      .input('menu_id', sql.Int, menu_id)
      .query('SELECT restaurant_id, branch_id FROM Menus WHERE id = @menu_id');
    if (!menu.recordset.length) {
      return res.status(404).json({ message: 'Menu not found' });
    }

    await pool.request()
      .input('menu_id', sql.Int, menu_id)
      .input('name', sql.NVarChar, name)
      .input('price', sql.Decimal(9, 2), price)
      .input('description', sql.NVarChar, description || null)
      .input('category', sql.NVarChar, category || null)
      .input('image_url', sql.NVarChar, image_url)
      .query(`
        UPDATE Menus
        SET name = @name, price = @price, description = @description, category = @category, image_url = @image_url
        WHERE id = @menu_id
      `);

    req.io.to(`restaurant_${menu.recordset[0].restaurant_id}_${menu.recordset[0].branch_id}`).emit('menu-updated');
    res.json({ message: 'Menü güncellendi', image_url });
  } catch (err) {
    res.status(500).json({ message: 'Error updating menu', error: err.message });
  }
});

export default router;

