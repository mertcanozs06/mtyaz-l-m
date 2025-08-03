import express from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Menüleri getir
router.get('/:restaurant_id', async (req, res) => {
  try {
    const result = await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .query('SELECT * FROM Menus WHERE restaurant_id = @restaurant_id');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching menus', error: err.message });
  }
});

// Menü ekle
router.post('/:restaurant_id', authMiddleware(['admin']), async (req, res) => {
  const { name, price, description, category } = req.body;
  try {
    const result = await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .input('name', name)
      .input('price', price)
      .input('description', description)
      .input('category', category || null)
      .query(`
        INSERT INTO Menus (restaurant_id, name, price, description, category)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @name, @price, @description, @category)
      `);
    res.status(201).json({ message: 'Menu created', id: result.recordset[0].id });
  } catch (err) {
    res.status(500).json({ message: 'Error creating menu', error: err.message });
  }
});

// Ekstra malzemeleri getir
router.get('/extras/:restaurant_id', async (req, res) => {
  const { menu_id } = req.query;
  try {
    let query = 'SELECT * FROM Extras WHERE restaurant_id = @restaurant_id';
    if (menu_id) {
      query += ' AND menu_id = @menu_id';
    }
    const result = await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .input('menu_id', menu_id || null)
      .query(query);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching extras', error: err.message });
  }
});

// Ekstra malzeme ekle
router.post('/extras/:restaurant_id', authMiddleware(['admin']), async (req, res) => {
  const { menu_id, name, price } = req.body;
  try {
    const result = await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .input('menu_id', menu_id || null)
      .input('name', name)
      .input('price', price)
      .query(`
        INSERT INTO Extras (restaurant_id, menu_id, name, price)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @menu_id, @name, @price)
      `);
    res.status(201).json({ message: 'Extra created', id: result.recordset[0].id });
  } catch (err) {
    res.status(500).json({ message: 'Error creating extra', error: err.message });
  }
});

// Ekstra malzeme sil
router.delete('/extras/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    await pool.request()
      .input('id', req.params.id)
      .query('DELETE FROM Extras WHERE id = @id');
    res.json({ message: 'Extra deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting extra', error: err.message });
  }
});

export default router;
