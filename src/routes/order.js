import express from 'express';
import { poolPromise, sql } from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Sipariş oluşturma
router.post('/:restaurant_id/:branch_id', async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { restaurant_id, branch_id } = req.params;
    const { table_id, items } = req.body;

    const tableCheck = await request
      .input('table_id', sql.Int, parseInt(table_id))
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .query('SELECT restaurant_id, branch_id FROM Tables WHERE id = @table_id AND restaurant_id = @restaurant_id AND branch_id = @branch_id');
    if (tableCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Invalid table for restaurant/branch' });
    }

    let total_price = 0;
    for (const item of items) {
      const menu = await request
        .input('menu_id', sql.Int, parseInt(item.menu_id))
        .input('restaurant_id', sql.Int, parseInt(restaurant_id))
        .input('branch_id', sql.Int, parseInt(branch_id))
        .query('SELECT price FROM Menus WHERE id = @menu_id AND restaurant_id = @restaurant_id AND branch_id = @branch_id');
      if (menu.recordset.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ message: `Invalid menu_id: ${item.menu_id}` });
      }

      const extra = item.extra_id
        ? await request
            .input('extra_id', sql.Int, parseInt(item.extra_id))
            .input('restaurant_id', sql.Int, parseInt(restaurant_id))
            .input('branch_id', sql.Int, parseInt(branch_id))
            .query('SELECT price FROM Extras WHERE id = @extra_id AND restaurant_id = @restaurant_id AND branch_id = @branch_id')
        : { recordset: [{ price: 0 }] };
      if (item.extra_id && extra.recordset.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ message: `Invalid extra_id: ${item.extra_id}` });
      }

      total_price += (menu.recordset[0].price + extra.recordset[0].price) * item.quantity;
    }

    const orderResult = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('table_id', sql.Int, parseInt(table_id))
      .input('total_price', sql.Decimal(10, 2), total_price)
      .input('created_by', sql.NVarChar, 'customer')
      .query(`
        INSERT INTO Orders (restaurant_id, branch_id, table_id, status, total_price, created_by)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @branch_id, @table_id, 'pending', @total_price, @created_by)
      `);
    const order_id = orderResult.recordset[0].id;

    for (const item of items) {
      await request
        .input('order_id', sql.Int, order_id)
        .input('menu_id', sql.Int, parseInt(item.menu_id))
        .input('quantity', sql.Int, parseInt(item.quantity))
        .input('extra_id', sql.Int, item.extra_id ? parseInt(item.extra_id) : null)
        .query(`
          INSERT INTO OrderDetails (order_id, menu_id, quantity, extra_id, is_prepared)
          VALUES (@order_id, @menu_id, @quantity, @extra_id, 0)
        `);
    }

    const order = {
      id: order_id,
      restaurant_id: parseInt(restaurant_id),
      branch_id: parseInt(branch_id),
      table_id: parseInt(table_id),
      status: 'pending',
      total_price,
      created_by: 'customer',
      servedBy: null,
      payment_method: null,
      payment_status: null,
    };

    req.io.to(`kitchen_${restaurant_id}_${branch_id}`).emit('new_order', order);
    req.io.to(`restaurant_${restaurant_id}_${branch_id}`).emit('order-placed', order);
    req.io.to(`admin_${restaurant_id}_${branch_id}`).emit('new_order', order);

    await transaction.commit();
    res.status(201).json({ message: 'Order created', order_id });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error creating order', error: err.message });
  }
});

// Sipariş detaylarını getir
router.get('/:order_id/details', authMiddleware(['admin', 'owner', 'waiter', 'kitchen']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const result = await request
      .input('order_id', sql.Int, parseInt(req.params.order_id))
      .query(`
        SELECT od.*, m.name AS menu_name, m.price AS menu_price, e.name AS extra_name, e.price AS extra_price
        FROM OrderDetails od
        LEFT JOIN Menus m ON od.menu_id = m.id
        LEFT JOIN Extras e ON od.extra_id = e.id
        WHERE od.order_id = @order_id
      `);
    await transaction.commit();
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error fetching order details', error: err.message });
  }
});

// Siparişi onayla
router.put('/:id/approve', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const orderCheck = await request
      .input('id', sql.Int, parseInt(req.params.id))
      .query('SELECT restaurant_id, branch_id, table_id, status, total_price, created_by FROM Orders WHERE id = @id');
    if (!orderCheck.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Order not found' });
    }

    await request
      .input('id', sql.Int, parseInt(req.params.id))
      .query("UPDATE Orders SET status = 'preparing' WHERE id = @id");

    const order = {
      id: parseInt(req.params.id),
      restaurant_id: orderCheck.recordset[0].restaurant_id,
      branch_id: orderCheck.recordset[0].branch_id,
      table_id: orderCheck.recordset[0].table_id,
      status: 'preparing',
      total_price: orderCheck.recordset[0].total_price,
      created_by: orderCheck.recordset[0].created_by,
      servedBy: null,
      payment_method: null,
      payment_status: null,
    };

    req.io.to(`kitchen_${order.restaurant_id}_${order.branch_id}`).emit('new_order', order);
    req.io.to(`restaurant_${order.restaurant_id}_${order.branch_id}`).emit('order-placed', order);
    req.io.to(`admin_${order.restaurant_id}_${order.branch_id}`).emit('order_status_updated', order);

    await transaction.commit();
    res.json({ message: 'Order approved' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error approving order', error: err.message });
  }
});

// Menü öğesini hazırla
router.put('/details/:detail_id/prepare', authMiddleware(['kitchen']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const orderDetails = await request
      .input('detail_id', sql.Int, parseInt(req.params.detail_id))
      .query(`
        SELECT od.order_id, od.is_prepared, o.restaurant_id, o.branch_id
        FROM OrderDetails od
        JOIN Orders o ON od.order_id = o.id
        WHERE od.id = @detail_id
      `);
    if (!orderDetails.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Order detail not found' });
    }
    if (orderDetails.recordset[0].is_prepared) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Ürün zaten hazırlanmış' });
    }

    const { order_id, restaurant_id, branch_id } = orderDetails.recordset[0];

    await request
      .input('detail_id', sql.Int, parseInt(req.params.detail_id))
      .query('UPDATE OrderDetails SET is_prepared = 1 WHERE id = @detail_id');

    const remainingDetails = await request
      .input('order_id', sql.Int, order_id)
      .query('SELECT is_prepared FROM OrderDetails WHERE order_id = @order_id');

    const allPrepared = remainingDetails.recordset.every((detail) => detail.is_prepared === 1);
    if (allPrepared) {
      await request
        .input('order_id', sql.Int, order_id)
        .query("UPDATE Orders SET status = 'ready' WHERE id = @order_id");

      req.io.to(`kitchen_${restaurant_id}_${branch_id}`).emit('order_prepared', { restaurant_id, branch_id, orderId: order_id });
      req.io.to(`restaurant_${restaurant_id}_${branch_id}`).emit('order-prepared', { orderId: order_id });
      req.io.to(`admin_${restaurant_id}_${branch_id}`).emit('order_status_updated', { id: order_id, restaurant_id, branch_id, status: 'ready' });
    }

    req.io.to(`kitchen_${restaurant_id}_${branch_id}`).emit('order_detail_prepared', { restaurant_id, branch_id, orderId: order_id, detailId: parseInt(req.params.detail_id) });
    req.io.to(`admin_${restaurant_id}_${branch_id}`).emit('order_status_updated', { id: order_id, restaurant_id, branch_id, status: allPrepared ? 'ready' : 'preparing' });

    await transaction.commit();
    res.json({ message: 'Item prepared' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error preparing item', error: err.message });
  }
});

// Tüm siparişi hazırla
router.put('/:id/prepare', authMiddleware(['kitchen']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const orderCheck = await request
      .input('id', sql.Int, parseInt(req.params.id))
      .query('SELECT restaurant_id, branch_id, status FROM Orders WHERE id = @id');
    if (!orderCheck.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Order not found' });
    }
    if (orderCheck.recordset[0].status === 'ready') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Sipariş zaten hazır' });
    }

    const { restaurant_id, branch_id } = orderCheck.recordset[0];

    await request
      .input('id', sql.Int, parseInt(req.params.id))
      .query('UPDATE OrderDetails SET is_prepared = 1 WHERE order_id = @id');
    await request
      .input('id', sql.Int, parseInt(req.params.id))
      .query("UPDATE Orders SET status = 'ready' WHERE id = @id");

    req.io.to(`kitchen_${restaurant_id}_${branch_id}`).emit('order_prepared', { restaurant_id, branch_id, orderId: parseInt(req.params.id) });
    req.io.to(`restaurant_${restaurant_id}_${branch_id}`).emit('order-prepared', { orderId: parseInt(req.params.id) });
    req.io.to(`admin_${restaurant_id}_${branch_id}`).emit('order_status_updated', { id: parseInt(req.params.id), restaurant_id, branch_id, status: 'ready' });

    await transaction.commit();
    res.json({ message: 'Order prepared' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error preparing order', error: err.message });
  }
});

// Siparişi kapat
router.put('/:id/close', authMiddleware(['waiter', 'admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { payment_method, payment_status } = req.body;
    const order = await request
      .input('id', sql.Int, parseInt(req.params.id))
      .query('SELECT total_price, restaurant_id, branch_id, status FROM Orders WHERE id = @id');
    if (!order.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.recordset[0].status !== 'ready') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Sipariş hazır değil, kapatılamaz' });
    }

    const { total_price, restaurant_id, branch_id } = order.recordset[0];

    await request
      .input('id', sql.Int, parseInt(req.params.id))
      .input('total_price', sql.Decimal(10, 2), total_price)
      .input('payment_method', sql.NVarChar, payment_method)
      .input('payment_status', sql.NVarChar, payment_status)
      .query(`
        UPDATE Orders
        SET status = 'completed', total_price = @total_price, payment_method = @payment_method, payment_status = @payment_status
        WHERE id = @id
      `);

    req.io.to(`admin_${restaurant_id}_${branch_id}`).emit('order_status_updated', {
      id: parseInt(req.params.id),
      restaurant_id,
      branch_id,
      status: 'completed',
      payment_status
    });

    await transaction.commit();
    res.json({ message: 'Order closed', total_price });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error closing order', error: err.message });
  }
});

// Siparişleri getir
router.get('/:restaurant_id/:branch_id', authMiddleware(['waiter', 'admin', 'owner', 'kitchen']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const result = await request
      .input('restaurant_id', sql.Int, parseInt(req.params.restaurant_id))
      .input('branch_id', sql.Int, parseInt(req.params.branch_id))
      .query(`
        SELECT id, table_id, status, total_price, servedBy, payment_method, payment_status
        FROM Orders
        WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id
      `);
    await transaction.commit();
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Siparişler alınamadı', error: err.message });
  }
});

// Servis edilen ürünleri kaydet
router.post('/served/:restaurant_id/:branch_id', authMiddleware(['waiter']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { order_id, menu_id, category, price, waiter_email } = req.body;
    const { restaurant_id, branch_id } = req.params;

    const orderCheck = await request
      .input('order_id', sql.Int, parseInt(order_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .query('SELECT id, status, servedBy, branch_id FROM Orders WHERE id = @order_id AND branch_id = @branch_id AND restaurant_id = @restaurant_id');
    if (!orderCheck.recordset.length) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Geçersiz order_id veya branch_id' });
    }
    if (orderCheck.recordset[0].status !== 'ready') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Sipariş hazır değil, servis edilemez' });
    }
    if (orderCheck.recordset[0].servedBy && orderCheck.recordset[0].servedBy !== waiter_email) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Bu sipariş başka bir garson tarafından alınmış' });
    }

    const detailCheck = await request
      .input('menu_id', sql.Int, parseInt(menu_id))
      .input('order_id', sql.Int, parseInt(order_id))
      .query(`
        SELECT od.menu_id, m.category, (m.price + COALESCE(e.price, 0)) * od.quantity AS total_price, od.is_prepared
        FROM OrderDetails od
        LEFT JOIN Menus m ON od.menu_id = m.id
        LEFT JOIN Extras e ON od.extra_id = e.id
        WHERE od.order_id = @order_id AND od.menu_id = @menu_id
      `);
    if (!detailCheck.recordset.length) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Geçersiz menu_id' });
    }
    if (!detailCheck.recordset[0].is_prepared) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Ürün henüz hazırlanmadı' });
    }
    if (Math.abs(detailCheck.recordset[0].total_price - Number(price)) > 0.01) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Fiyat eşleşmiyor' });
    }
    if (detailCheck.recordset[0].category !== String(category)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Kategori eşleşmiyor' });
    }

    const existing = await request
      .input('order_id', sql.Int, parseInt(order_id))
      .input('menu_id', sql.Int, parseInt(menu_id))
      .query('SELECT id FROM ServedOrders WHERE order_id = @order_id AND menu_id = @menu_id');
    if (existing.recordset.length) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Bu ürün zaten servis edildi' });
    }

    const waiterCheck = await request
      .input('waiter_email', sql.NVarChar, waiter_email)
      .input('branch_id', sql.Int, orderCheck.recordset[0].branch_id)
      .query("SELECT email FROM Users WHERE email = @waiter_email AND role = 'waiter' AND branch_id = @branch_id");
    if (!waiterCheck.recordset.length) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Geçersiz garson email' });
    }

    await request
      .input('servedBy', sql.NVarChar, waiter_email)
      .input('order_id', sql.Int, parseInt(order_id))
      .query('UPDATE Orders SET servedBy = @servedBy WHERE id = @order_id');

    await request
      .input('order_id', sql.Int, parseInt(order_id))
      .input('menu_id', sql.Int, parseInt(menu_id))
      .input('category', sql.NVarChar, category)
      .input('price', sql.Decimal(10, 2), Number(price))
      .input('waiter_email', sql.NVarChar, waiter_email)
      .query(`
        INSERT INTO ServedOrders (order_id, menu_id, category, price, waiter_email, served_at)
        VALUES (@order_id, @menu_id, @category, @price, @waiter_email, GETDATE())
      `);

    const remainingItems = await request
      .input('order_id', sql.Int, parseInt(order_id))
      .query(`
        SELECT od.menu_id
        FROM OrderDetails od
        LEFT JOIN ServedOrders so ON od.order_id = so.order_id AND od.menu_id = so.menu_id
        WHERE od.order_id = @order_id AND so.menu_id IS NULL
      `);

    if (remainingItems.recordset.length === 0) {
      await request
        .input('order_id', sql.Int, parseInt(order_id))
        .query("UPDATE Orders SET status = 'completed' WHERE id = @order_id");
      req.io.to(`admin_${restaurant_id}_${branch_id}`).emit('order_status_updated', {
        id: parseInt(order_id),
        restaurant_id,
        branch_id,
        status: 'completed'
      });
    }

    await transaction.commit();
    res.status(200).json({ message: 'Servis kaydedildi' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Servis kaydedilemedi', error: err.message });
  }
});

// Servis edilen ürünleri getir
router.get('/served/:order_id', authMiddleware(['waiter']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const result = await request
      .input('order_id', sql.Int, parseInt(req.params.order_id))
      .query('SELECT menu_id, category, price, waiter_email, served_at FROM ServedOrders WHERE order_id = @order_id');
    await transaction.commit();
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Servis edilenler alınamadı', error: err.message });
  }
});

// Siparişi garson tarafından servis almak
router.put('/:id/take', authMiddleware(['waiter']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { waiter_email } = req.body;
    const orderCheck = await request
      .input('id', sql.Int, parseInt(req.params.id))
      .query('SELECT restaurant_id, branch_id, servedBy, status FROM Orders WHERE id = @id');
    if (!orderCheck.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Order not found' });
    }
    if (orderCheck.recordset[0].status !== 'ready') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Sipariş hazır değil, alınamaz' });
    }
    if (orderCheck.recordset[0].servedBy && orderCheck.recordset[0].servedBy !== waiter_email) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Bu sipariş başka bir garson tarafından alınmış' });
    }

    await request
      .input('id', sql.Int, parseInt(req.params.id))
      .input('servedBy', sql.NVarChar, waiter_email)
      .query('UPDATE Orders SET servedBy = @servedBy WHERE id = @id');

    req.io.to(`restaurant_${orderCheck.recordset[0].restaurant_id}_${orderCheck.recordset[0].branch_id}`).emit('order_taken', { orderId: parseInt(req.params.id), waiter_email });
    await transaction.commit();
    res.json({ message: 'Servis alındı' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Servis alınamadı', error: err.message });
  }
});

export default router;
