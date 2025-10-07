import express from 'express';
import { poolPromise, sql } from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

/* --------------------------
   Helper: Audit log
   -------------------------- */
const logAuditAction = async (
  userId,
  action,
  targetUserId,
  restaurantId,
  branchId,
  transaction = null
) => {
  try {
    const request = transaction ? transaction.request() : (await poolPromise).request();
    await request
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

/* --------------------------
   Input validation helpers
   -------------------------- */
const validateOrderInput = ({ table_id, items, payment_method, payment_status }) => {
  if (!table_id || isNaN(table_id)) {
    return { valid: false, message: 'Geçerli bir masa ID gerekli', error_code: 'INVALID_TABLE_ID' };
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { valid: false, message: 'Geçerli bir ürün listesi gerekli', error_code: 'INVALID_ITEMS' };
  }
  for (const item of items) {
    if (!item.menu_id || isNaN(item.menu_id) || !item.quantity || isNaN(item.quantity) || item.quantity < 1) {
      return { valid: false, message: 'Geçersiz menü ID veya miktar', error_code: 'INVALID_MENU_ITEM' };
    }
    if (item.extra_id && isNaN(item.extra_id)) {
      return { valid: false, message: 'Geçersiz ekstra ID', error_code: 'INVALID_EXTRA_ID' };
    }
  }
  if (payment_method && !['cash', 'credit_card', 'online'].includes(payment_method)) {
    return { valid: false, message: 'Geçersiz ödeme yöntemi', error_code: 'INVALID_PAYMENT_METHOD' };
  }
  if (payment_status && !['pending', 'completed', 'failed'].includes(payment_status)) {
    return { valid: false, message: 'Geçersiz ödeme durumu', error_code: 'INVALID_PAYMENT_STATUS' };
  }
  return { valid: true };
};

/* --------------------------
   Create order (customer)
   POST /:restaurant_id/:branch_id
   -------------------------- */
router.post('/:restaurant_id/:branch_id', async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { restaurant_id, branch_id } = req.params;
    const { table_id, items } = req.body;

    // input validation
    const validation = validateOrderInput({ table_id, items });
    if (!validation.valid) {
      await transaction.rollback();
      return res.status(400).json({ message: validation.message, error_code: validation.error_code });
    }

    // check table exists and belongs to restaurant/branch
    const tableCheck = await request
      .input('table_id', sql.Int, parseInt(table_id))
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .query(`
        SELECT restaurant_id, branch_id, region
        FROM Tables
        WHERE id = @table_id AND restaurant_id = @restaurant_id AND branch_id = @branch_id
      `);
    if (tableCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Geçersiz masa veya restoran/şube', error_code: 'INVALID_TABLE' });
    }

    // calculate total price and validate menu & extras (branch-scoped)
    let total_price = 0;
    for (const item of items) {
      const menuRes = await request
        .input('menu_id', sql.Int, parseInt(item.menu_id))
        .input('restaurant_id', sql.Int, parseInt(restaurant_id))
        .input('branch_id', sql.Int, parseInt(branch_id))
        .query(`
          SELECT price
          FROM Menus
          WHERE id = @menu_id AND restaurant_id = @restaurant_id AND branch_id = @branch_id AND is_deleted = 0
        `);
      if (menuRes.recordset.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ message: `Geçersiz menu_id: ${item.menu_id}`, error_code: 'INVALID_MENU_ID' });
      }
      const menuPrice = Number(menuRes.recordset[0].price);

      let extraPrice = 0;
      if (item.extra_id) {
        const extraRes = await request
          .input('extra_id', sql.Int, parseInt(item.extra_id))
          .input('restaurant_id', sql.Int, parseInt(restaurant_id))
          .input('branch_id', sql.Int, parseInt(branch_id))
          .query(`
            SELECT price
            FROM Extras
            WHERE id = @extra_id AND restaurant_id = @restaurant_id AND branch_id = @branch_id
          `);
        if (extraRes.recordset.length === 0) {
          await transaction.rollback();
          return res.status(400).json({ message: `Geçersiz extra_id: ${item.extra_id}`, error_code: 'INVALID_EXTRA_ID' });
        }
        extraPrice = Number(extraRes.recordset[0].price);
      }

      total_price += (menuPrice + extraPrice) * Number(item.quantity);
    }

    // insert order
    const orderResult = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('table_id', sql.Int, parseInt(table_id))
      .input('total_price', sql.Decimal(10, 2), total_price)
      .input('created_by', sql.NVarChar, 'customer')
      .query(`
        INSERT INTO Orders (restaurant_id, branch_id, table_id, status, total_price, created_by, created_at)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @branch_id, @table_id, 'pending', @total_price, @created_by, GETDATE())
      `);
    const order_id = orderResult.recordset[0].id;

    // insert order details
    for (const item of items) {
      await request
        .input('order_id', sql.Int, order_id)
        .input('menu_id', sql.Int, parseInt(item.menu_id))
        .input('quantity', sql.Int, parseInt(item.quantity))
        .input('extra_id', sql.Int, item.extra_id || null)
        .query(`
          INSERT INTO OrderDetails (order_id, menu_id, quantity, extra_id, is_prepared, restaurant_id, branch_id)
          VALUES (@order_id, @menu_id, @quantity, @extra_id, 0, @restaurant_id, @branch_id)
        `);
    }

    // audit log
    await logAuditAction(null, 'ORDER_CREATED', order_id, restaurant_id, branch_id, transaction);

    // socket notifications
    const order = {
      id: order_id,
      restaurant_id: parseInt(restaurant_id),
      branch_id: parseInt(branch_id),
      table_id: parseInt(table_id),
      region: tableCheck.recordset[0].region,
      status: 'pending',
      total_price,
      created_by: 'customer',
      servedBy: null,
      payment_method: null,
      payment_status: null,
      created_at: new Date(),
    };
    req.io?.to(`kitchen_${restaurant_id}_${branch_id}`).emit('new_order', order);
    req.io?.to(`restaurant_${restaurant_id}_${branch_id}`).emit('order-placed', order);
    req.io?.to(`admin_${restaurant_id}_${branch_id}`).emit('new_order', order);

    await transaction.commit();
    res.status(201).json({ message: 'Sipariş oluşturuldu', order_id });
  } catch (err) {
    await transaction.rollback();
    console.error('Error creating order:', err);
    res.status(500).json({ message: 'Sipariş oluşturulamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/* --------------------------
   Get order details
   GET /:order_id/details
   -------------------------- */
router.get('/:order_id/details', authMiddleware(['admin', 'owner', 'waiter', 'kitchen']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { order_id } = req.params;

    // check order exists and get branch info
    const orderCheck = await request
      .input('order_id', sql.Int, parseInt(order_id))
      .query('SELECT restaurant_id, branch_id FROM Orders WHERE id = @order_id');
    if (orderCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Sipariş bulunamadı', error_code: 'ORDER_NOT_FOUND' });
    }

    // fetch details with menu & extra info
    const result = await request
      .input('order_id', sql.Int, parseInt(order_id))
      .query(`
        SELECT od.id AS detail_id, od.menu_id, od.quantity, od.is_prepared,
               m.name AS menu_name, m.price AS menu_price, m.category,
               e.id AS extra_id, e.name AS extra_name, e.price AS extra_price
        FROM OrderDetails od
        LEFT JOIN Menus m ON od.menu_id = m.id
        LEFT JOIN Extras e ON od.extra_id = e.id
        WHERE od.order_id = @order_id
      `);

    await logAuditAction(req.user.user_id, 'ORDER_DETAILS_FETCHED', order_id, orderCheck.recordset[0].restaurant_id, orderCheck.recordset[0].branch_id, transaction);

    await transaction.commit();
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    console.error('Error fetching order details:', err);
    res.status(500).json({ message: 'Sipariş detayları alınamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/* --------------------------
   Approve order (admin/owner)
   PUT /:id/approve
   -------------------------- */
router.put('/:id/approve', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { id } = req.params;

    const orderCheck = await request
      .input('id', sql.Int, parseInt(id))
      .query(`
        SELECT restaurant_id, branch_id, table_id, status, total_price, created_by
        FROM Orders
        WHERE id = @id
      `);
    if (orderCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Sipariş bulunamadı', error_code: 'ORDER_NOT_FOUND' });
    }

    const currentStatus = orderCheck.recordset[0].status;
    if (currentStatus !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Sipariş zaten onaylanmış veya geçersiz durumda', error_code: 'INVALID_ORDER_STATUS' });
    }

    await request
      .input('id', sql.Int, parseInt(id))
      .query(`UPDATE Orders SET status = 'preparing', approved_at = GETDATE() WHERE id = @id`);

    // audit
    await logAuditAction(req.user.user_id, 'ORDER_APPROVED', id, orderCheck.recordset[0].restaurant_id, orderCheck.recordset[0].branch_id, transaction);

    // socket notifications
    const order = {
      id: parseInt(id),
      restaurant_id: orderCheck.recordset[0].restaurant_id,
      branch_id: orderCheck.recordset[0].branch_id,
      table_id: orderCheck.recordset[0].table_id,
      status: 'preparing',
      total_price: orderCheck.recordset[0].total_price,
      created_by: orderCheck.recordset[0].created_by,
    };
    req.io?.to(`kitchen_${order.restaurant_id}_${order.branch_id}`).emit('new_order', order);
    req.io?.to(`restaurant_${order.restaurant_id}_${order.branch_id}`).emit('order-placed', order);
    req.io?.to(`admin_${order.restaurant_id}_${order.branch_id}`).emit('order_status_updated', order);

    await transaction.commit();
    res.json({ message: 'Sipariş onaylandı' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error approving order:', err);
    res.status(500).json({ message: 'Sipariş onaylanamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/* --------------------------
   Prepare single order detail (kitchen)
   PUT /details/:detail_id/prepare
   -------------------------- */
router.put('/details/:detail_id/prepare', authMiddleware(['kitchen']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { detail_id } = req.params;

    const orderDetails = await request
      .input('detail_id', sql.Int, parseInt(detail_id))
      .query(`
        SELECT od.order_id, od.is_prepared, o.restaurant_id, o.branch_id
        FROM OrderDetails od
        JOIN Orders o ON od.order_id = o.id
        WHERE od.id = @detail_id
      `);
    if (orderDetails.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Sipariş detayı bulunamadı', error_code: 'ORDER_DETAIL_NOT_FOUND' });
    }
    if (orderDetails.recordset[0].is_prepared) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Ürün zaten hazırlanmış', error_code: 'ALREADY_PREPARED' });
    }

    const { order_id, restaurant_id, branch_id } = orderDetails.recordset[0];

    await request
      .input('detail_id', sql.Int, parseInt(detail_id))
      .query(`UPDATE OrderDetails SET is_prepared = 1, prepared_by = @prepared_by, prepared_at = GETDATE() WHERE id = @detail_id`);
    // set prepared_by if you want: here using req.user.email if exists
    // But because middleware may not set email, skipping param. Could add: .input('prepared_by', sql.NVarChar, req.user.email)

    // check if all prepared
    const remainingDetails = await request
      .input('order_id', sql.Int, order_id)
      .query(`SELECT is_prepared FROM OrderDetails WHERE order_id = @order_id`);

    const allPrepared = remainingDetails.recordset.every((detail) => detail.is_prepared === 1);
    if (allPrepared) {
      await request
        .input('order_id', sql.Int, order_id)
        .query(`UPDATE Orders SET status = 'ready', ready_at = GETDATE() WHERE id = @order_id`);

      req.io?.to(`kitchen_${restaurant_id}_${branch_id}`).emit('order_prepared', { restaurant_id, branch_id, orderId: order_id });
      req.io?.to(`restaurant_${restaurant_id}_${branch_id}`).emit('order-prepared', { orderId: order_id });
      req.io?.to(`admin_${restaurant_id}_${branch_id}`).emit('order_status_updated', { id: order_id, restaurant_id, branch_id, status: 'ready' });
    }

    // audit
    await logAuditAction(req.user.user_id, 'ORDER_ITEM_PREPARED', detail_id, restaurant_id, branch_id, transaction);

    // socket: detail prepared
    req.io?.to(`kitchen_${restaurant_id}_${branch_id}`).emit('order_detail_prepared', { restaurant_id, branch_id, orderId: order_id, detailId: parseInt(detail_id) });
    req.io?.to(`admin_${restaurant_id}_${branch_id}`).emit('order_status_updated', { id: order_id, restaurant_id, branch_id, status: allPrepared ? 'ready' : 'preparing' });

    await transaction.commit();
    res.json({ message: 'Ürün hazırlandı' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error preparing item:', err);
    res.status(500).json({ message: 'Ürün hazırlanamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/* --------------------------
   Prepare whole order (kitchen)
   PUT /:id/prepare
   -------------------------- */
router.put('/:id/prepare', authMiddleware(['kitchen']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { id } = req.params;

    const orderCheck = await request
      .input('id', sql.Int, parseInt(id))
      .query(`SELECT restaurant_id, branch_id, status FROM Orders WHERE id = @id`);
    if (orderCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Sipariş bulunamadı', error_code: 'ORDER_NOT_FOUND' });
    }
    if (orderCheck.recordset[0].status === 'ready') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Sipariş zaten hazır', error_code: 'ALREADY_PREPARED' });
    }

    const { restaurant_id, branch_id } = orderCheck.recordset[0];

    await request
      .input('id', sql.Int, parseInt(id))
      .query(`UPDATE OrderDetails SET is_prepared = 1 WHERE order_id = @id`);
    await request
      .input('id', sql.Int, parseInt(id))
      .query(`UPDATE Orders SET status = 'ready', ready_at = GETDATE() WHERE id = @id`);

    // audit
    await logAuditAction(req.user.user_id, 'ORDER_PREPARED', id, restaurant_id, branch_id, transaction);

    // socket notifications
    req.io?.to(`kitchen_${restaurant_id}_${branch_id}`).emit('order_prepared', { restaurant_id, branch_id, orderId: parseInt(id) });
    req.io?.to(`restaurant_${restaurant_id}_${branch_id}`).emit('order-prepared', { orderId: parseInt(id) });
    req.io?.to(`admin_${restaurant_id}_${branch_id}`).emit('order_status_updated', { id: parseInt(id), restaurant_id, branch_id, status: 'ready' });

    await transaction.commit();
    res.json({ message: 'Sipariş hazırlandı' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error preparing order:', err);
    res.status(500).json({ message: 'Sipariş hazırlanamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/* --------------------------
   Close order / record payment
   PUT /:id/close
   -------------------------- */
router.put('/:id/close', authMiddleware(['waiter', 'admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { id } = req.params;
    const { payment_method, payment_status } = req.body;

    // validate payment fields (optional)
    if (!payment_method || !payment_status) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Ödeme yöntemi ve durumu gerekli', error_code: 'MISSING_PAYMENT_INFO' });
    }
    const validation = validateOrderInput({ payment_method, payment_status, table_id: 1, items: [{ menu_id: 1, quantity: 1 }] }); // minimal validation for enums
    if (!validation.valid && validation.error_code !== 'INVALID_ITEMS') {
      // ignore INVALID_ITEMS because we passed dummy items; only check payment enums
      await transaction.rollback();
      return res.status(400).json({ message: validation.message, error_code: validation.error_code });
    }

    const order = await request
      .input('id', sql.Int, parseInt(id))
      .query(`
        SELECT total_price, restaurant_id, branch_id, status
        FROM Orders
        WHERE id = @id
      `);
    if (order.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Sipariş bulunamadı', error_code: 'ORDER_NOT_FOUND' });
    }
    if (order.recordset[0].status !== 'ready') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Sipariş hazır değil, kapatılamaz', error_code: 'INVALID_ORDER_STATUS' });
    }

    const { total_price, restaurant_id, branch_id } = order.recordset[0];

    // update order status
    await request
      .input('id', sql.Int, parseInt(id))
      .input('total_price', sql.Decimal(10, 2), total_price)
      .input('payment_method', sql.NVarChar, payment_method)
      .input('payment_status', sql.NVarChar, payment_status)
      .query(`
        UPDATE Orders
        SET status = 'completed', total_price = @total_price, payment_method = @payment_method, payment_status = @payment_status, closed_at = GETDATE()
        WHERE id = @id
      `);

    // insert into Payments table
    await request
      .input('order_id', sql.Int, parseInt(id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('amount', sql.Decimal(10, 2), total_price)
      .input('payment_status', sql.NVarChar, payment_status)
      .input('payment_method', sql.NVarChar, payment_method)
      .query(`
        INSERT INTO Payments (order_id, branch_id, amount, payment_status, payment_method, paid_at)
        VALUES (@order_id, @branch_id, @amount, @payment_status, @payment_method, GETDATE())
      `);

    // audit
    await logAuditAction(req.user.user_id, 'ORDER_CLOSED', id, restaurant_id, branch_id, transaction);

    // socket
    req.io?.to(`admin_${restaurant_id}_${branch_id}`).emit('order_status_updated', {
      id: parseInt(id),
      restaurant_id,
      branch_id,
      status: 'completed',
      payment_status,
      payment_method,
    });

    await transaction.commit();
    res.json({ message: 'Sipariş kapatıldı', total_price });
  } catch (err) {
    await transaction.rollback();
    console.error('Error closing order:', err);
    res.status(500).json({ message: 'Sipariş kapatılamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/* --------------------------
   Get orders for branch (with optional ?status=)
   GET /:restaurant_id/:branch_id
   -------------------------- */
router.get('/:restaurant_id/:branch_id', authMiddleware(['waiter', 'admin', 'owner', 'kitchen']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { restaurant_id, branch_id } = req.params;
    const { status } = req.query;

    // branch validation
    const branchCheck = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .query('SELECT id FROM Branches WHERE restaurant_id = @restaurant_id AND id = @branch_id');
    if (branchCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Geçersiz restoran veya şube', error_code: 'BRANCH_NOT_FOUND' });
    }

    let query = `
      SELECT o.id, o.table_id, o.status, o.total_price, o.servedBy, o.payment_method, o.payment_status, t.region, o.created_at
      FROM Orders o
      JOIN Tables t ON o.table_id = t.id
      WHERE o.restaurant_id = @restaurant_id AND o.branch_id = @branch_id
    `;
    if (status) {
      query += ' AND o.status = @status';
    }
    query += ' ORDER BY o.id DESC';

    const result = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('status', sql.NVarChar, status || null)
      .query(query);

    await logAuditAction(req.user.user_id, 'ORDERS_FETCHED', null, restaurant_id, branch_id, transaction);

    await transaction.commit();
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Sipariş bulunamadı', error_code: 'NO_ORDERS_FOUND' });
    }
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    console.error('Error fetching orders:', err);
    res.status(500).json({ message: 'Siparişler alınamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/* --------------------------
   Record served item (waiter)
   POST /served/:restaurant_id/:branch_id
   -------------------------- */
router.post('/served/:restaurant_id/:branch_id', authMiddleware(['waiter']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { restaurant_id, branch_id } = req.params;
    const { order_id, menu_id, category, price, waiter_email } = req.body;

    if (!order_id || !menu_id || !category || price === undefined || !waiter_email) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Eksik bilgi', error_code: 'MISSING_FIELDS' });
    }

    const orderCheck = await request
      .input('order_id', sql.Int, parseInt(order_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .query(`
        SELECT id, status, servedBy, branch_id
        FROM Orders
        WHERE id = @order_id AND branch_id = @branch_id AND restaurant_id = @restaurant_id
      `);
    if (orderCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Geçersiz order_id veya branch_id', error_code: 'INVALID_ORDER' });
    }
    if (orderCheck.recordset[0].status !== 'ready') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Sipariş hazır değil, servis edilemez', error_code: 'INVALID_ORDER_STATUS' });
    }
    if (orderCheck.recordset[0].servedBy && orderCheck.recordset[0].servedBy !== waiter_email) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Bu sipariş başka bir garson tarafından alınmış', error_code: 'ORDER_ALREADY_TAKEN' });
    }

    const detailCheck = await request
      .input('menu_id', sql.Int, parseInt(menu_id))
      .input('order_id', sql.Int, parseInt(order_id))
      .query(`
        SELECT od.menu_id, m.category, (m.price + COALESCE(e.price,0)) * od.quantity AS total_price, od.is_prepared
        FROM OrderDetails od
        LEFT JOIN Menus m ON od.menu_id = m.id
        LEFT JOIN Extras e ON od.extra_id = e.id
        WHERE od.order_id = @order_id AND od.menu_id = @menu_id
      `);
    if (detailCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Geçersiz menu_id', error_code: 'INVALID_MENU_ID' });
    }
    if (!detailCheck.recordset[0].is_prepared) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Ürün henüz hazırlanmadı', error_code: 'NOT_PREPARED' });
    }
    if (Math.abs(Number(detailCheck.recordset[0].total_price) - Number(price)) > 0.01) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Fiyat eşleşmiyor', error_code: 'PRICE_MISMATCH' });
    }
    if (detailCheck.recordset[0].category !== String(category)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Kategori eşleşmiyor', error_code: 'CATEGORY_MISMATCH' });
    }

    const existing = await request
      .input('order_id', sql.Int, parseInt(order_id))
      .input('menu_id', sql.Int, parseInt(menu_id))
      .query(`SELECT id FROM ServedOrders WHERE order_id = @order_id AND menu_id = @menu_id`);
    if (existing.recordset.length) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Bu ürün zaten servis edildi', error_code: 'ALREADY_SERVED' });
    }

    // validate waiter
    const waiterCheck = await request
      .input('waiter_email', sql.NVarChar, waiter_email)
      .input('branch_id', sql.Int, parseInt(branch_id))
      .query(`SELECT email FROM Users WHERE email = @waiter_email AND role = 'waiter' AND branch_id = @branch_id`);
    if (waiterCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Geçersiz garson email', error_code: 'INVALID_WAITER' });
    }

    // set servedBy on order (if not already)
    await request
      .input('servedBy', sql.NVarChar, waiter_email)
      .input('order_id', sql.Int, parseInt(order_id))
      .query(`UPDATE Orders SET servedBy = @servedBy WHERE id = @order_id`);

    // insert served record
    await request
      .input('order_id', sql.Int, parseInt(order_id))
      .input('menu_id', sql.Int, parseInt(menu_id))
      .input('category', sql.NVarChar, category)
      .input('price', sql.Decimal(10, 2), Number(price))
      .input('waiter_email', sql.NVarChar, waiter_email)
      .query(`
        INSERT INTO ServedOrders (order_id, menu_id, category, price, waiter_email, served_at, restaurant_id, branch_id)
        VALUES (@order_id, @menu_id, @category, @price, @waiter_email, GETDATE(), @restaurant_id, @branch_id)
      `);

    // check remaining items
    const remainingItems = await request
      .input('order_id', sql.Int, parseInt(order_id))
      .query(`
        SELECT od.menu_id
        FROM OrderDetails od
        LEFT JOIN ServedOrders so ON od.order_id = so.order_id AND od.menu_id = so.menu_id
        WHERE od.order_id = @order_id AND so.menu_id IS NULL
      `);

    if (remainingItems.recordset.length === 0) {
      // all served => mark order completed (moved to closed/paid after payment)
      await request
        .input('order_id', sql.Int, parseInt(order_id))
        .query(`UPDATE Orders SET status = 'completed', completed_at = GETDATE() WHERE id = @order_id`);
      req.io?.to(`admin_${restaurant_id}_${branch_id}`).emit('order_status_updated', {
        id: parseInt(order_id),
        restaurant_id,
        branch_id,
        status: 'completed',
      });
    } else {
      // there are still items left -> still ready
      req.io?.to(`admin_${restaurant_id}_${branch_id}`).emit('order_status_updated', {
        id: parseInt(order_id),
        restaurant_id,
        branch_id,
        status: remainingItems.recordset.length === 0 ? 'completed' : 'ready',
      });
    }

    // audit
    await logAuditAction(req.user.user_id, 'ORDER_SERVED', order_id, restaurant_id, branch_id, transaction);

    // socket
    req.io?.to(`restaurant_${restaurant_id}_${branch_id}`).emit('order_served', { orderId: parseInt(order_id), menu_id, waiter_email });

    await transaction.commit();
    res.status(200).json({ message: 'Servis kaydedildi' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error recording served order:', err);
    res.status(500).json({ message: 'Servis kaydedilemedi', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/* --------------------------
   Get served items for an order
   GET /served/:order_id
   -------------------------- */
router.get('/served/:order_id', authMiddleware(['waiter', 'admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { order_id } = req.params;

    const orderCheck = await request
      .input('order_id', sql.Int, parseInt(order_id))
      .query(`SELECT restaurant_id, branch_id FROM Orders WHERE id = @order_id`);
    if (orderCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Sipariş bulunamadı', error_code: 'ORDER_NOT_FOUND' });
    }

    const result = await request
      .input('order_id', sql.Int, parseInt(order_id))
      .query(`
        SELECT menu_id, category, price, waiter_email, served_at
        FROM ServedOrders
        WHERE order_id = @order_id
      `);

    await logAuditAction(req.user.user_id, 'SERVED_ORDERS_FETCHED', order_id, orderCheck.recordset[0].restaurant_id, orderCheck.recordset[0].branch_id, transaction);

    await transaction.commit();
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    console.error('Error fetching served orders:', err);
    res.status(500).json({ message: 'Servis edilenler alınamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

/* --------------------------
   Waiter takes order (so only that waiter sees detail modal)
   PUT /:id/take
   -------------------------- */
router.put('/:id/take', authMiddleware(['waiter']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { id } = req.params;
    const { waiter_email } = req.body;

    if (!waiter_email) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Garson email gerekli', error_code: 'MISSING_WAITER_EMAIL' });
    }

    const orderCheck = await request
      .input('id', sql.Int, parseInt(id))
      .query(`SELECT restaurant_id, branch_id, servedBy, status FROM Orders WHERE id = @id`);
    if (orderCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Sipariş bulunamadı', error_code: 'ORDER_NOT_FOUND' });
    }
    if (orderCheck.recordset[0].status !== 'ready') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Sipariş hazır değil, alınamaz', error_code: 'INVALID_ORDER_STATUS' });
    }
    if (orderCheck.recordset[0].servedBy && orderCheck.recordset[0].servedBy !== waiter_email) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Bu sipariş başka bir garson tarafından alınmış', error_code: 'ORDER_ALREADY_TAKEN' });
    }

    const waiterCheck = await request
      .input('waiter_email', sql.NVarChar, waiter_email)
      .input('branch_id', sql.Int, orderCheck.recordset[0].branch_id)
      .query(`SELECT email FROM Users WHERE email = @waiter_email AND role = 'waiter' AND branch_id = @branch_id`);
    if (waiterCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Geçersiz garson email', error_code: 'INVALID_WAITER' });
    }

    await request
      .input('id', sql.Int, parseInt(id))
      .input('servedBy', sql.NVarChar, waiter_email)
      .query(`UPDATE Orders SET servedBy = @servedBy WHERE id = @id`);

    await logAuditAction(req.user.user_id, 'ORDER_TAKEN', id, orderCheck.recordset[0].restaurant_id, orderCheck.recordset[0].branch_id, transaction);

    req.io?.to(`restaurant_${orderCheck.recordset[0].restaurant_id}_${orderCheck.recordset[0].branch_id}`).emit('order_taken', { orderId: parseInt(id), waiter_email });
    req.io?.to(`admin_${orderCheck.recordset[0].restaurant_id}_${orderCheck.recordset[0].branch_id}`).emit('order_status_updated', {
      id: parseInt(id),
      restaurant_id: orderCheck.recordset[0].restaurant_id,
      branch_id: orderCheck.recordset[0].branch_id,
      servedBy: waiter_email,
    });

    await transaction.commit();
    res.json({ message: 'Servis alındı' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error taking order:', err);
    res.status(500).json({ message: 'Servis alınamadı', error_code: 'SERVER_ERROR', error: err.message });
  }
});

export default router;
