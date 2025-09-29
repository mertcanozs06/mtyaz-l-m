import express from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import QRCode from 'qrcode';
import sql from 'mssql';

const router = express.Router();

// Masaları getir
router.get('/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner', 'waiter', 'kitchen']), async (req, res) => {
  try {
    const result = await pool.request()
      .input('restaurant_id', req.params.restaurant_id)
      .input('branch_id', req.params.branch_id)
      .query('SELECT id, region, table_number FROM Tables WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tables', error: err.message });
  }
});

// Masa ekle
router.post('/:restaurant_id/:branch_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const { table_number, region, table_count } = req.body;
  const { restaurant_id, branch_id } = req.params;
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const request = new sql.Request(transaction);

    for (let i = 1; i <= (table_count || 1); i++) {
      const num = table_count ? i : table_number;
      const exists = await request
        .input('restaurant_id', restaurant_id)
        .input('branch_id', branch_id)
        .input('region', region)
        .input('table_number', num)
        .query(`
          SELECT 1 FROM Tables
          WHERE restaurant_id = @restaurant_id AND branch_id = @branch_id AND region = @region AND table_number = @table_number
        `);
      if (exists.recordset.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ message: `Masa ${num} zaten mevcut` });
      }

      const tableResult = await request.query(`
        INSERT INTO Tables (restaurant_id, branch_id, region, table_number)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @branch_id, @region, @table_number)
      `);
      const table_id = tableResult.recordset[0].id;

      const qrCodeUrl = await QRCode.toDataURL(`https://yourapp.com/qrmenu/${restaurant_id}/${branch_id}/${region}/${num}`);
      await request
        .input('table_id', table_id)
        .input('qr_code_url', qrCodeUrl)
        .query(`
          INSERT INTO QRCodes (restaurant_id, branch_id, region, table_number, qr_code_url, table_id)
          VALUES (@restaurant_id, @branch_id, @region, @table_number, @qr_code_url, @table_id)
        `);
    }

    await transaction.commit();
    res.status(201).json({ message: 'Masalar ve QR kodları eklendi' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error adding table', error: err.message });
  }
});

// Masa sil
router.delete('/:table_id', authMiddleware(['admin', 'owner']), async (req, res) => {
  const { table_id } = req.params;
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const request = new sql.Request(transaction);

    await request.input('table_id', table_id).query(`
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

