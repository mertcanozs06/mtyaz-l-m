import express from 'express';
import pool, { sql, poolConnect } from '../../src/config/db.js';
import { authMiddleware } from '../../src/middleware/auth.js';


const router = express.Router();


// Sipariş oluşturma (Kimlik doğrulama olmadan, müşteriler için)
router.post('/', async (req, res) => {
  await poolConnect;
  const { restaurant_id, table_id, items } = req.body;
  try {
    const tableCheck = await pool.request()
      .input('table_id', table_id)
      .query('SELECT restaurant_id FROM Tables WHERE id = @table_id');

    if (tableCheck.recordset.length === 0 || tableCheck.recordset[0].restaurant_id !== parseInt(restaurant_id)) {
      return res.status(400).json({ message: 'Invalid table for restaurant' });
    }


    let total_price = 0;
    for (const item of items) {
      const menu = await pool.request()
        .input('menu_id', item.menu_id)
        .input('restaurant_id', restaurant_id)
        .query('SELECT price FROM Menus WHERE id = @menu_id AND restaurant_id = @restaurant_id');


      if (menu.recordset.length === 0) {
        return res.status(400).json({ message: `Invalid menu_id: ${item.menu_id}` });
      }


      const extra = item.extra_id
        ? await pool.request()
          .input('extra_id', item.extra_id)
          .input('restaurant_id', restaurant_id)
          .query('SELECT price FROM Extras WHERE id = @extra_id AND restaurant_id = @restaurant_id')
        : { recordset: [{ price: 0 }] };


      if (item.extra_id && extra.recordset.length === 0) {
        return res.status(400).json({ message: `Invalid extra_id: ${item.extra_id}` });
      }


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
        .input('extra_id', item.extra_id || null)
        .query(`
          INSERT INTO OrderDetails (order_id, menu_id, quantity, extra_id, is_prepared)
          VALUES (@order_id, @menu_id, @quantity, @extra_id, 0)
        `);
    }


    // Sipariş nesnesini oluştur
    const order = {
      id: order_id,
      restaurant_id: parseInt(restaurant_id),
      table_id,
      status: 'pending',
      total_price,
      created_by: 'customer',
      servedBy: null,
      payment_method: null,
      meal_voucher_type: null,
    };


    // Socket ile mutfağa bildir (direkt olarak)
   req.io.to(`kitchen_${restaurant_id}`).emit('new_order', order);
req.io.to(`restaurant_${restaurant_id}`).emit('order-placed');

// ✅ Admin'e bildir (yeni sipariş geldi)
req.io.to(`admin_${restaurant_id}`).emit('new_order', order);

    res.status(201).json({ message: 'Order created', order_id });
  } catch (err) {
    res.status(500).json({ message: 'Error creating order', error: err.message });
  }
});


// Sipariş detaylarını getir
router.get('/:order_id/details', authMiddleware(['admin', 'waiter', 'kitchen']), async (req, res) => {
  await poolConnect;
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
  console.log('Approve order id:', req.params.id);
  await poolConnect;
  try {
    const orderCheck = await pool.request()
      .input('id', req.params.id)
      .query('SELECT restaurant_id, table_id, status, total_price, created_by FROM Orders WHERE id = @id');


    if (!orderCheck.recordset.length) {
      return res.status(404).json({ message: 'Order not found' });
    }


    await pool.request()
      .input('id', req.params.id)
      .query('UPDATE Orders SET status = \'preparing\' WHERE id = @id');


    // Sipariş nesnesini oluştur
    const order = {
      id: parseInt(req.params.id),
      restaurant_id: orderCheck.recordset[0].restaurant_id,
      table_id: orderCheck.recordset[0].table_id,
      status: 'preparing',
      total_price: orderCheck.recordset[0].total_price,
      created_by: orderCheck.recordset[0].created_by,
      servedBy: null,
      payment_method: null,
      meal_voucher_type: null,
    };


   // Socket ile mutfağa bildir (direkt olarak)
req.io.to(`kitchen_${order.restaurant_id}`).emit('new_order', order);
req.io.to(`restaurant_${order.restaurant_id}`).emit('order-placed');

// ✅ Admin'e sipariş güncellemesi bildir
req.io.to(`admin_${order.restaurant_id}`).emit('order_status_updated', order);


    res.json({ message: 'Order approved' });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ message: 'Error approving order', error: err.message });
  }
});


// Menü öğesini hazırla
router.put('/details/:detail_id/prepare', authMiddleware(['kitchen']), async (req, res) => {
  await poolConnect;
  try {
    const orderDetails = await pool.request()
      .input('detail_id', req.params.detail_id)
      .query(`
        SELECT order_id, restaurant_id
        FROM OrderDetails od
        JOIN Orders o ON od.order_id = o.id
        WHERE od.id = @detail_id
      `);


    if (!orderDetails.recordset.length) {
      return res.status(404).json({ message: 'Order detail not found' });
    }


    const { order_id, restaurant_id } = orderDetails.recordset[0];


    await pool.request()
      .input('detail_id', req.params.detail_id)
      .query('UPDATE OrderDetails SET is_prepared = 1 WHERE id = @detail_id');


    const remainingDetails = await pool.request()
      .input('order_id', order_id)
      .query('SELECT * FROM OrderDetails WHERE order_id = @order_id');


    const allPrepared = remainingDetails.recordset.every((detail) => detail.is_prepared === 1);


    if (allPrepared) {
      await pool.request()
        .input('order_id', order_id)
        .query('UPDATE Orders SET status = \'ready\' WHERE id = @order_id');


      // Socket ile tüm siparişin hazırlandığını bildir
      req.io.to(`kitchen_${restaurant_id}`).emit('order_prepared', { restaurant_id, orderId: order_id });
      req.io.to(`restaurant_${restaurant_id}`).emit('order-prepared', { orderId: order_id });
    }


    // Socket ile detayın hazırlandığını bildir
    req.io.to(`kitchen_${restaurant_id}`).emit('order_detail_prepared', { restaurant_id, orderId: order_id, detailId: parseInt(req.params.detail_id) });
      
       req.io.to(`admin_${restaurant_id}`).emit('order_status_updated', {
  id: order_id, // veya parseInt(req.params.id)
  restaurant_id,
  status: 'ready'
});


    res.json({ message: 'Item prepared' });
  } catch (err) {
    res.status(500).json({ message: 'Error preparing item', error: err.message });
  }
});


// Tüm siparişi hazırla
router.put('/:id/prepare', authMiddleware(['kitchen']), async (req, res) => {
  await poolConnect;
  try {
    const orderCheck = await pool.request()
      .input('id', req.params.id)
      .query('SELECT restaurant_id FROM Orders WHERE id = @id');


    if (!orderCheck.recordset.length) {
      return res.status(404).json({ message: 'Order not found' });
    }


    const restaurant_id = orderCheck.recordset[0].restaurant_id;


    await pool.request()
      .input('id', req.params.id)
      .query('UPDATE OrderDetails SET is_prepared = 1 WHERE order_id = @id');
    await pool.request()
      .input('id', req.params.id)
      .query('UPDATE Orders SET status = \'ready\' WHERE id = @id');


    // Socket ile tüm siparişin hazırlandığını bildir
    req.io.to(`kitchen_${restaurant_id}`).emit('order_prepared', { restaurant_id, orderId: parseInt(req.params.id) });
    req.io.to(`restaurant_${restaurant_id}`).emit('order-prepared', { orderId: parseInt(req.params.id) });
    
    req.io.to(`admin_${restaurant_id}`).emit('order_status_updated', {
  id: parseInt(req.params.id),
  restaurant_id,
  status: 'ready'
});


    res.json({ message: 'Order prepared' });
  } catch (err) {
    res.status(500).json({ message: 'Error preparing order', error: err.message });
  }
});


// Siparişi kapat
router.put('/:id/close', authMiddleware(['waiter']), async (req, res) => {
  await poolConnect;
  const { discount_id, payment_method, meal_voucher_type } = req.body;
  try {
    let total_price = 0;
    const order = await pool.request()
      .input('id', req.params.id)
      .query('SELECT total_price, restaurant_id FROM Orders WHERE id = @id');
    if (!order.recordset.length) {
      return res.status(404).json({ message: 'Order not found' });
    }


    total_price = order.recordset[0].total_price;


    if (discount_id) {
      const discount = await pool.request()
        .input('discount_id', discount_id)
        .input('restaurant_id', order.recordset[0].restaurant_id)
        .query('SELECT percentage FROM Discounts WHERE id = @discount_id AND restaurant_id = @restaurant_id');
      if (discount.recordset.length) {
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
router.get('/:restaurantId', authMiddleware(['waiter', 'admin', 'kitchen']), async (req, res) => {
  await poolConnect;
  try {
    const { restaurantId } = req.params;


    const result = await pool
      .request()
      .input('restaurant_id', restaurantId)
      .query(`
        SELECT 
          id, 
          table_id, 
          status, 
          total_price, 
          servedBy, 
          payment_method, 
          meal_voucher_type
        FROM Orders
        WHERE restaurant_id = @restaurant_id
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Siparişler alınamadı:', err);
    res.status(500).json({ message: 'Siparişler alınamadı', error: err.message });
  }
});

// Servis edilen ürünleri kaydet
router.post('/served', authMiddleware(['waiter']), async (req, res) => {
  await poolConnect;
  const { order_id, menu_id, category, price, waiter_email } = req.body;

  console.log('Backend - POST /order/served Body:', req.body);

  if (!order_id || !menu_id || !category || !price || !waiter_email) {
    console.log('Backend - POST /order/served Validation Error: Eksik alanlar');
    return res.status(400).json({ message: 'Tüm alanlar zorunlu: order_id, menu_id, category, price, waiter_email' });
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    console.log('Backend - POST /order/served: Transaction started');

    // 1. Orders kontrolü
    console.log('Backend - POST /order/served: Checking Orders table');
    const orderCheck = await transaction.request()
      .input('order_id', sql.Int, Number(order_id))
      .query('SELECT id, status, servedBy FROM Orders WHERE id = @order_id');

    console.log('Backend - POST /order/served Order Check:', orderCheck.recordset);

    if (!orderCheck.recordset.length) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Geçersiz order_id' });
    }
    if (orderCheck.recordset[0].status !== 'ready') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Sipariş hazır değil, servis edilemez' });
    }
    if (orderCheck.recordset[0].servedBy && orderCheck.recordset[0].servedBy !== waiter_email) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Bu sipariş başka bir garson tarafından alınmış' });
    }

    // 2. OrderDetails, Menus ve Extras kontrolü
    console.log('Backend - POST /order/served: Checking OrderDetails table');
    const detailCheck = await transaction.request()
      .input('order_id', sql.Int, Number(order_id))
      .input('menu_id', sql.Int, Number(menu_id))
      .query(`
        SELECT od.menu_id, m.category, (m.price + COALESCE(e.price, 0)) * od.quantity AS total_price, od.is_prepared
        FROM OrderDetails od
        LEFT JOIN Menus m ON od.menu_id = m.id
        LEFT JOIN Extras e ON od.extra_id = e.id
        WHERE od.order_id = @order_id AND od.menu_id = @menu_id
      `);

    console.log('Backend - POST /order/served Detail Check:', detailCheck.recordset);

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
      return res.status(400).json({
        message: 'Fiyat eşleşmiyor',
        expected: detailCheck.recordset[0].total_price,
        received: price
      });
    }
    if (detailCheck.recordset[0].category !== String(category)) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Kategori eşleşmiyor',
        expected: detailCheck.recordset[0].category,
        received: category
      });
    }

    // 3. Çift kayıt kontrolü
    console.log('Backend - POST /order/served: Checking existing ServedOrders');
    const existing = await transaction.request()
      .input('order_id', sql.Int, Number(order_id))
      .input('menu_id', sql.Int, Number(menu_id))
      .query('SELECT id FROM ServedOrders WHERE order_id = @order_id AND menu_id = @menu_id');

    console.log('Backend - POST /order/served Existing Check:', existing.recordset);

    if (existing.recordset.length) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Bu ürün zaten servis edildi' });
    }

    // 4. Garson kontrolü
    console.log('Backend - POST /order/served: Checking waiter');
    const waiterCheck = await transaction.request()
      .input('waiter_email', sql.NVarChar(100), String(waiter_email))
      .query('SELECT email FROM Users WHERE email = @waiter_email AND role = \'waiter\'');

    console.log('Backend - POST /order/served Waiter Check:', waiterCheck.recordset);

    if (!waiterCheck.recordset.length) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Geçersiz garson email' });
    }

    // 5. Orders tablosunu güncelle (servedBy alanı)
    console.log('Backend - POST /order/served: Updating Orders.servedBy');
    await transaction.request()
      .input('servedBy', sql.NVarChar(100), String(waiter_email))
      .input('order_id', sql.Int, Number(order_id))
      .query('UPDATE Orders SET servedBy = @servedBy WHERE id = @order_id');

    // 6. ServedOrders tablosuna ekle
    console.log('Backend - POST /order/served: Inserting into ServedOrders');
    await transaction.request()
      .input('order_id', sql.Int, Number(order_id))
      .input('menu_id', sql.Int, Number(menu_id))
      .input('category', sql.NVarChar(50), String(category))
      .input('price', sql.Decimal(10, 2), Number(price))
      .input('waiter_email', sql.NVarChar(100), String(waiter_email))
      .query(`
        INSERT INTO ServedOrders (order_id, menu_id, category, price, waiter_email, served_at)
        VALUES (@order_id, @menu_id, @category, @price, @waiter_email, GETDATE())
      `);

    // 7. Tüm öğeler servis edildiyse siparişi tamamla
    console.log('Backend - POST /order/served: Checking remaining items');
    const remainingItems = await transaction.request()
      .input('order_id', sql.Int, Number(order_id))
      .query(`
        SELECT od.menu_id
        FROM OrderDetails od
        LEFT JOIN ServedOrders so ON od.order_id = so.order_id AND od.menu_id = so.menu_id
        WHERE od.order_id = @order_id AND so.menu_id IS NULL
      `);

    console.log('Backend - POST /order/served Remaining Items:', remainingItems.recordset);

    if (remainingItems.recordset.length === 0) {
      console.log('Backend - POST /order/served: Updating Orders.status to completed');
      await transaction.request()
        .input('order_id', sql.Int, Number(order_id))
        .query('UPDATE Orders SET status = \'completed\' WHERE id = @order_id');

      // Burada restaurant_id'yi siparişten çekiyoruz
      const restaurantIdQuery = await transaction.request()
        .input('order_id', sql.Int, Number(order_id))
        .query('SELECT restaurant_id FROM Orders WHERE id = @order_id');

      const restaurant_id = restaurantIdQuery.recordset[0].restaurant_id;

      // emit işlemini commit öncesinde yapıyoruz
      req.io.to(`admin_${restaurant_id}`).emit('order_status_updated', {
        id: Number(order_id),
        restaurant_id,
        status: 'completed'
      });
    }

    await transaction.commit();
    console.log('Backend - POST /order/served Success: Servis kaydedildi');
    return res.status(200).json({ message: 'Servis kaydedildi' });

  } catch (err) {
    await transaction.rollback();
    console.error('Backend - POST /order/served Error:', err.message, err.stack);
    return res.status(500).json({ message: 'Servis kaydedilemedi', error: err.message });
  }
});

// Servis edilen ürünleri getir
router.get('/served/:order_id', authMiddleware(['waiter']), async (req, res) => {
  await poolConnect;
  try {
    const result = await pool.request()
      .input('order_id', sql.Int, req.params.order_id)
      .query('SELECT menu_id FROM ServedOrders WHERE order_id = @order_id');
    res.json(result.recordset);

 
  } catch (err) {
    res.status(500).json({ message: 'Servis edilenler alınamadı', error: err.message });
  }
});


// Siparişi garson tarafından servis almak
router.put('/:id/take', authMiddleware(['waiter']), async (req, res) => {
  await poolConnect;
  const { waiter_email } = req.body;


  if (!waiter_email) {
    return res.status(400).json({ message: 'waiter_email zorunlu' });
  }


  try {
    const orderCheck = await pool.request()
      .input('id', req.params.id)
      .query('SELECT servedBy FROM Orders WHERE id = @id');


    if (!orderCheck.recordset.length) {
      return res.status(404).json({ message: 'Order not found' });
    }


    if (orderCheck.recordset[0].servedBy && orderCheck.recordset[0].servedBy !== waiter_email) {
      return res.status(400).json({ message: 'Bu sipariş başka bir garson tarafından alınmış' });
    }


    await pool.request()
      .input('id', req.params.id)
      .input('servedBy', waiter_email)
      .query('UPDATE Orders SET servedBy = @servedBy WHERE id = @id');


    res.json({ message: 'Servis alındı' });
  } catch (err) {
    res.status(500).json({ message: 'Servis alınamadı', error: err.message });
  }
});


export default router;