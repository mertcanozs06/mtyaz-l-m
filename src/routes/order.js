import express from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Sipariş oluşturma (Kimlik doğrulama olmadan, müşteriler için)
router.post('/', async (req, res) => {
  const { restaurant_id, table_id, items } = req.body;
  try {
    const tableCheck = await pool.request()
      .input('table_id', table_id)
      .query('SELECT restaurant_id FROM Tables WHERE id = @table_id');
    if (tableCheck.recordset[0].restaurant_id !== parseInt(restaurant_id)) {
      return res.status(400).json({ message: 'Invalid table for restaurant' });
    }

    let total_price = 0;
    for (const item of items) {
      const menu = await pool.request()
        .input('menu_id', item.menu_id)
        .input('restaurant_id', restaurant_id)
        .query('SELECT price FROM Menus WHERE id = @menu_id AND restaurant_id = @restaurant_id');
      const extra = item.extra_id
        ? await pool.request()
            .input('extra_id', item.extra_id)
            .input('restaurant_id', restaurant_id)
            .query('SELECT price FROM Extras WHERE id = @extra_id AND restaurant_id = @restaurant_id')
        : { recordset: [{ price: 0 }] };
      total_price += (menu.recordset[0].price + extra.recordset[0].price) * item.quantity;
    }

    const orderResult = await pool.request()
      .input('restaurant_id', restaurant_id)
      .input('table_id', table_id)
      .input('total_price', total_price)
      .input('created_by', 'customer')
      .query(`
        INSERT INTO Orders (restaurant_id, table_id, status, total_price, created_by)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @table_id, 'pending', @total_price, @created_by)
      `);
    const order_id = orderResult.recordset[0].id;

    for (const item of items) {
      await pool.request()
        .input('order_id', order_id)
        .input('menu_id', item.menu_id)
        .input('quantity', item.quantity)
        .input('extra_id', item.extra_id)
        .query(`
          INSERT INTO OrderDetails (order_id, menu_id, quantity, extra_id, is_prepared)
          VALUES (@order_id, @menu_id, @quantity, @extra_id, 0)
        `);
    }

    res.status(201).json({ message: 'Order created', order_id });
  } catch (err) {
    res.status(500).json({ message: 'Error creating order', error: err.message });
  }
});

// Sipariş detaylarını getir
router.get('/:order_id/details', authMiddleware(['admin', 'waiter', 'kitchen']), async (req, res) => {
  try {
    const result = await pool.request()
      .input('order_id', req.params.order_id)
      .query(`
        SELECT od.*, m.name AS menu_name, m.price AS menu_price, e.name AS extra_name, e.price AS extra_price
        FROM OrderDetails od
        LEFT JOIN Menus m ON od.menu_id = m.id
        LEFT JOIN Extras e ON od.extra_id = e.id
        WHERE od.order_id = @order_id
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching order details', error: err.message });
  }
});

// Siparişi onayla
router.put('/:id/approve', authMiddleware(['admin']), async (req, res) => {
  try {
    await pool.request()
      .input('id', req.params.id)
      .query('UPDATE Orders SET status = \'preparing\' WHERE id = @id');
    res.json({ message: 'Order approved' });
  } catch (err) {
    res.status(500).json({ message: 'Error approving order', error: err.message });
  }
});

// Menü öğesini hazırla
router.put('/details/:detail_id/prepare', authMiddleware(['kitchen']), async (req, res) => {
  try {
    await pool.request()
      .input('detail_id', req.params.detail_id)
      .query('UPDATE OrderDetails SET is_prepared = 1 WHERE id = @detail_id');
    const orderDetails = await pool.request()
      .input('detail_id', req.params.detail_id)
      .query(`
        SELECT * FROM OrderDetails WHERE order_id = (SELECT order_id FROM OrderDetails WHERE id = @detail_id)
      `);
    const allPrepared = orderDetails.recordset.every((detail) => detail.is_prepared === 1);
    if (allPrepared) {
      await pool.request()
        .input('detail_id', req.params.detail_id)
        .query(`
          UPDATE Orders SET status = 'ready'
          WHERE id = (SELECT order_id FROM OrderDetails WHERE id = @detail_id)
        `);
    }
    res.json({ message: 'Item prepared' });
  } catch (err) {
    res.status(500).json({ message: 'Error preparing item', error: err.message });
  }
});

// Tüm siparişi hazırla
router.put('/:id/prepare', authMiddleware(['kitchen']), async (req, res) => {
  try {
    await pool.request()
      .input('id', req.params.id)
      .query('UPDATE OrderDetails SET is_prepared = 1 WHERE order_id = @id');
    await pool.request()
      .input('id', req.params.id)
      .query('UPDATE Orders SET status = \'ready\' WHERE id = @id');
    res.json({ message: 'Order prepared' });
  } catch (err) {
    res.status(500).json({ message: 'Error preparing order', error: err.message });
  }
});

// Siparişi kapat
router.put('/:id/close', authMiddleware(['waiter']), async (req, res) => {
  const { discount_id, payment_method, meal_voucher_type } = req.body;
  try {
    let total_price = 0;
    const order = await pool.request()
      .input('id', req.params.id)
      .query('SELECT total_price, restaurant_id FROM Orders WHERE id = @id');
    total_price = order.recordset[0].total_price;
    if (discount_id) {
      const discount = await pool.request()
        .input('discount_id', discount_id)
        .input('restaurant_id', order.recordset[0].restaurant_id)
        .query('SELECT percentage FROM Discounts WHERE id = @discount_id AND restaurant_id = @restaurant_id');
      if (discount.recordset[0]) {
        total_price *= (1 - discount.recordset[0].percentage / 100);
      }
    }
    await pool.request()
      .input('id', req.params.id)
      .input('total_price', total_price)
      .input('payment_method', payment_method)
      .input('meal_voucher_type', meal_voucher_type)
      .query(`
        UPDATE Orders
        SET status = 'completed', total_price = @total_price, payment_method = @payment_method, meal_voucher_type = @meal_voucher_type
        WHERE id = @id
      `);
    res.json({ message: 'Order closed', total_price });
  } catch (err) {
    res.status(500).json({ message: 'Error closing order', error: err.message });
  }
});

// Siparişleri getir
router.get('/:restaurant_id', authMiddleware(['admin', 'waiter', 'kitchen']), async (req, res) => {
  try {
    const result = await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .query('SELECT * FROM Orders WHERE restaurant_id = @restaurant_id');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching orders', error: err.message });
  }
});

export default router;
