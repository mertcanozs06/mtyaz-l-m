import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import sql from 'mssql';

const router = express.Router();

// Multer konfigürasyonu
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

// — MENÜLERİ GETİR (Soft delete filtreli)
router.get('/:restaurant_id', async (req, res) => {
  try {
    const result = await pool.request()
      .input('restaurant_id', sql.Int, req.params.restaurant_id)
      .query(`
        SELECT * FROM Menus 
        WHERE restaurant_id = @restaurant_id AND (is_deleted IS NULL OR is_deleted = 0)
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Menüleri getirirken hata:', err.message);
    res.status(500).json({ message: 'Error fetching menus', error: err.message });
  }
});

// — MENÜ EKLE
router.post('/:restaurant_id', authMiddleware(['admin']), upload.single('image'), async (req, res) => {
  try {
    const { name, price, description, category } = req.body;
    const { restaurant_id } = req.params;
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
      .input('name', sql.NVarChar, name)
      .input('price', sql.Decimal(9, 2), price)
      .input('description', sql.NVarChar, description || null)
      .input('category', sql.NVarChar, category || null)
      .input('image_url', sql.NVarChar, image_url)
      .query(`
        INSERT INTO Menus (restaurant_id, name, price, description, category, image_url, is_deleted)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @name, @price, @description, @category, @image_url, 0)
      `);

    const newId = result.recordset[0].id;

    res.status(201).json({
      id: newId,
      name,
      price: parseFloat(price),
      description,
      category,
      image_url,
      restaurantId: restaurant_id,
    });
  } catch (err) {
    console.error('Menü eklenirken hata:', err.message);
    res.status(500).json({ message: 'Error creating menu', error: err.message });
  }
});

// — MENÜ SİL (Soft Delete)
router.delete('/:menu_id', authMiddleware(['admin']), async (req, res) => {
  try {
    const { menu_id } = req.params;
    await pool.request()
      .input('menu_id', sql.Int, menu_id)
      .query(`UPDATE Menus SET is_deleted = 1 WHERE id = @menu_id`);
    res.json({ message: 'Menü silindi (soft delete)' });
  } catch (err) {
    console.error('Menü silinirken hata:', err.message);
    res.status(500).json({ message: 'Error deleting menu', error: err.message });
  }
});

// — EKSTRA MALZEMELERİ GETİR
router.get('/extras/:restaurant_id', async (req, res) => {
  try {
    const { menu_id } = req.query;
    const request = pool.request()
      .input('restaurant_id', sql.Int, req.params.restaurant_id);

    let query = 'SELECT * FROM Extras WHERE restaurant_id = @restaurant_id';
    if (menu_id) {
      request.input('menu_id', sql.Int, menu_id);
      query += ' AND menu_id = @menu_id';
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Ekstra malzemeler alınamadı:', err.message);
    res.status(500).json({ message: 'Error fetching extras', error: err.message });
  }
});

// — EKSTRA EKLE
router.post('/extras/:restaurant_id', authMiddleware(['admin']), async (req, res) => {
  try {
    const { menu_id, name, price } = req.body;
    const result = await pool.request()
      .input('restaurant_id', sql.Int, req.params.restaurant_id)
      .input('menu_id', sql.Int, menu_id)
      .input('name', sql.NVarChar, name)
      .input('price', sql.Decimal(9, 2), price)
      .query(`
        INSERT INTO Extras (restaurant_id, menu_id, name, price)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @menu_id, @name, @price)
      `);

    const newId = result.recordset[0].id;
    res.status(201).json({ message: 'Ekstra malzeme eklendi', id: newId });
  } catch (err) {
    console.error('Ekstra eklenirken hata:', err.message);
    res.status(500).json({ message: 'Error creating extra', error: err.message });
  }
});

// — EKSTRA SİL
router.delete('/extras/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM Extras WHERE id = @id');
    res.json({ message: 'Ekstra silindi' });
  } catch (err) {
    console.error('Ekstra silinirken hata:', err.message);
    res.status(500).json({ message: 'Error deleting extra', error: err.message });
  }
});

// — MENÜ GÜNCELLE
router.put('/:menu_id', authMiddleware(['admin']), upload.single('image'), async (req, res) => {
  try {
    const { name, price, description, category } = req.body;
    const { menu_id } = req.params;
    const image = req.file;

    let image_url = null;
    if (image && image.filename) {
      image_url = `/uploads/${image.filename}`;
    } else {
      // Eğer yeni resim yüklenmediyse, mevcut image_url’yi koru
      const result = await pool.request()
        .input('id', sql.Int, menu_id)
        .query('SELECT image_url FROM Menus WHERE id = @id');
      image_url = result.recordset[0]?.image_url || null;
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
        SET name = @name,
            price = @price,
            description = @description,
            category = @category,
            image_url = @image_url
        WHERE id = @menu_id
      `);

    res.json({ message: 'Menü güncellendi', image_url });
  } catch (err) {
    console.error('Menü güncellenirken hata:', err.message);
    res.status(500).json({ message: 'Error updating menu', error: err.message });
  }
});

export default router;
