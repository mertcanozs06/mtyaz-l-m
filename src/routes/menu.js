import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import sql from 'mssql';

const router = express.Router();

// Multer ayarları: 'uploads' klasörüne kayıt yapacak
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

// ✅ MENÜLERİ GETİR
router.get('/:restaurant_id', async (req, res) => {
  try {
    const result = await pool.request()
      .input('restaurant_id', sql.Int, req.params.restaurant_id)
      .query('SELECT * FROM Menus WHERE restaurant_id = @restaurant_id');
    res.json(result.recordset);
  } catch (err) {
    console.error('Menüleri getirirken hata:', err.message);
    res.status(500).json({ message: 'Error fetching menus', error: err.message });
  }
});

// ✅ MENÜ EKLE (Resim ve form verisi destekli)
router.post(
  '/:restaurant_id',
  authMiddleware(['admin']),
  upload.single('image'),
  async (req, res) => {
    try {
      const { name, price, description, category } = req.body;
      const { restaurant_id } = req.params;
      const image = req.file;

      console.log('Gelen veri:', { name, price, description, category, restaurant_id, image });

      if (!name || !price) {
        return res.status(400).json({ message: 'Menü adı ve fiyat zorunludur' });
      }

      let image_url = null;
      if (image && image.filename) {
        image_url = `/uploads/${image.filename}`;
      } else {
        console.log('Fotoğraf yüklenmedi veya filename eksik:', image);
      }

      const result = await pool.request()
        .input('restaurant_id', sql.Int, restaurant_id)
        .input('name', sql.NVarChar, name)
        .input('price', sql.Decimal(9, 2), price)
        .input('description', sql.NVarChar, description || null)
        .input('category', sql.NVarChar, category || null)
        .input('image_url', sql.NVarChar, image_url)
        .query(`
          INSERT INTO Menus (restaurant_id, name, price, description, category, image_url)
          OUTPUT INSERTED.id
          VALUES (@restaurant_id, @name, @price, @description, @category, @image_url)
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
      console.error('Menü eklenirken hata:', err.message, err.stack);
      res.status(500).json({ message: 'Error creating menu', error: err.message });
    }
  }
);

// ✅ MENÜ SİL
router.delete('/:menu_id', authMiddleware(['admin']), async (req, res) => {
  try {
    const { menu_id } = req.params;
    const menu = await pool.request()
      .input('menu_id', sql.Int, menu_id)
      .query('SELECT image_url FROM Menus WHERE id = @menu_id');
    if (menu.recordset.length === 0) {
      return res.status(404).json({ message: 'Menü bulunamadı' });
    }
    const imageUrl = menu.recordset[0].image_url;
    if (imageUrl) {
      const filePath = path.join(path.resolve(), 'uploads', imageUrl.replace('/uploads/', ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath); // Fotoğrafı sil
      }
    }
    await pool.request()
      .input('menu_id', sql.Int, menu_id)
      .query('DELETE FROM Menus WHERE id = @menu_id');
    await pool.request()
      .input('menu_id', sql.Int, menu_id)
      .query('DELETE FROM Extras WHERE menu_id = @menu_id'); // İlgili ekstraları sil
    res.json({ message: 'Menü silindi' });
  } catch (err) {
    console.error('Menü silinirken hata:', err.message);
    res.status(500).json({ message: 'Error deleting menu', error: err.message });
  }
});

// ✅ EKSTRA MALZEMELERİ GETİR
router.get('/extras/:restaurant_id', async (req, res) => {
  const { menu_id } = req.query;
  try {
    let query = 'SELECT * FROM Extras WHERE restaurant_id = @restaurant_id';
    const request = pool.request().input('restaurant_id', sql.Int, req.params.restaurant_id);
    if (menu_id) {
      query += ' AND menu_id = @menu_id';
      request.input('menu_id', sql.Int, menu_id);
    }
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Ekstra malzemeler alınamadı:', err.message);
    res.status(500).json({ message: 'Error fetching extras', error: err.message });
  }
});

// ✅ EKSTRA MALZEME EKLE
router.post('/extras/:restaurant_id', authMiddleware(['admin']), async (req, res) => {
  const { menu_id, name, price } = req.body;
  try {
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

// ✅ EKSTRA MALZEME SİL
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

export default router;