import express from 'express';
import { poolPromise, sql } from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import QRCode from 'qrcode';

const router = express.Router();

// Masaları getir
router.get('/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner', 'waiter', 'kitchen']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { restaurant_id, branch_id } = req.params;

    const result = await request
      .input('restaurant_id', sql.Int, parseInt(restaurant_id))
      .input('branch_id', sql.Int, parseInt(branch_id))
      .query('SELECT id, table_number FROM Tables WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id');

    await transaction.commit();
    res.json(result.recordset);
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error fetching tables', error: err.message });
  }
});

// Masa ekle
router.post('/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { table_number, table_count, region = null } = req.body;
    const { restaurant_id, branch_id } = req.params;

    const createdTables = [];
    for (let i = 1; i <= (table_count || 1); i++) {
      const num = table_count ? i : table_number;
      const exists = await request
        .input('restaurant_id', sql.Int, parseInt(restaurant_id))
        .input('branch_id', sql.Int, parseInt(branch_id))
        .input('table_number', sql.Int, num)
        .query(`
          SELECT 1 FROM Tables
          WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id AND table_number = @table_number
        `);
      if (exists.recordset.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ message: `Masa ${num} zaten mevcut` });
      }

      const tableResult = await request.query(`
        INSERT INTO Tables (restaurant_id, branch_id, table_number)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @branch_id, @table_number)
      `);
      const table_id = tableResult.recordset[0].id;

      // QR kodu: müşteri rotası /qrmenu/:restaurantId/:branchId/:tableNumber
      const qrCodeUrl = await QRCode.toDataURL(`${process.env.APP_URL || 'http://localhost:5173'}/qrmenu/${restaurant_id}/${branch_id}/${num}`);
      await request
        .input('restaurant_id', sql.Int, parseInt(restaurant_id))
        .input('branch_id', sql.Int, parseInt(branch_id))
        .input('region', sql.NVarChar, region)
        .input('table_number', sql.Int, num)
        .input('qr_code_url', sql.NVarChar, qrCodeUrl)
        .input('table_id', sql.Int, table_id)
        .query(`
          INSERT INTO QRCodes (restaurant_id, branch_id, region, table_number, qr_code_url, table_id)
          VALUES (@restaurant_id, @branch_id, @region, @table_number, @qr_code_url, @table_id)
        `);

      createdTables.push({ table_id, table_number: num, region, qr_code_url: qrCodeUrl });
    }

    await transaction.commit();
    res.status(201).json({ message: 'Masalar ve QR kodları eklendi', tables: createdTables });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error adding table', error: err.message });
  }
});

// Masa sil
router.delete('/:table_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();
    const request = transaction.request();

    const { table_id } = req.params;

    await request.input('table_id', sql.Int, parseInt(table_id)).query(`
      DELETE FROM QRCodes WHERE table_id = @table_id;
      DELETE FROM ServedOrders WHERE order_id IN (SELECT id FROM Orders WHERE table_id = @table_id);
      DELETE FROM OrderDetails WHERE order_id IN (SELECT id FROM Orders WHERE table_id = @table_id);
      DELETE FROM Orders WHERE table_id = @table_id;
      DELETE FROM Tables WHERE id = @table_id;
    `);

    await transaction.commit();
    res.json({ message: 'Masa silindi' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Masa silinemedi', error: err.message });
  }
});

export default router;

