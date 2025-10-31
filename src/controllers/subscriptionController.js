// controllers/subscriptionController.js
import { poolPromise, sql } from "../config/db.js";
import { createIyzicoPayment, verifyPayment } from "../services/iyzicoService.js";

export const createSubscription = async (req, res) => {
  const pool = await poolPromise;
  const user = req.user;
  try {
    const { package_type = "basic", branches = 1 } = req.body;
    const pricing = { basic: 360, advance: 720, elevate: 1200 };
    const monthlyPrice = pricing[package_type] || 360;
    const branchCount = Math.max(1, parseInt(branches));
    const totalPrice = monthlyPrice * branchCount * 12;

    const conversationId = `sub_${user.id}_${Date.now()}`;
    const paymentRef = `sub_${user.id}_${Date.now()}`;

    const insertResult = await pool.request()
      .input("customer_order_id", sql.Int, null)
      .input("user_id", sql.Int, user.id)
      .input("amount", sql.Decimal(18, 2), totalPrice)
      .input("payment_method", sql.NVarChar, "iyzico")
      .input("status", sql.NVarChar, "pending")
      .input("package_type", sql.NVarChar, package_type)
      .input("branch_count", sql.Int, branchCount)
      .input("branch_id", sql.Int, user.branch_id)
      .input("transaction_id", sql.NVarChar, `TRX-${user.id}-${Date.now()}`)
      .input("subscription_status", sql.NVarChar, "pending")
      .input("created_at", sql.DateTime, new Date())
      .query(`
        INSERT INTO Payments (customer_order_id, user_id, amount, payment_method, status, package_type, branch_count, branch_id, transaction_id, subscription_status, created_at)
        OUTPUT INSERTED.id
        VALUES (@customer_order_id, @user_id, @amount, @payment_method, @status, @package_type, @branch_count, @branch_id, @transaction_id, @subscription_status, @created_at)
      `);
    const paymentId = insertResult.recordset[0].id;

    // UserAuditLog'a abonelik başlatma logu ekle
    await pool.request()
      .input("user_id", sql.Int, user.id)
      .input("action", sql.NVarChar, "SUBSCRIPTION_INITIATED")
      .input("target_user_id", sql.Int, user.id)
      .input("restaurant_id", sql.Int, user.restaurant_id)
      .input("branch_id", sql.Int, user.branch_id)
      .input("created_at", sql.DateTime, new Date())
      .query(`
        INSERT INTO UserAuditLog (user_id, action, target_user_id, restaurant_id, branch_id, created_at)
        VALUES (@user_id, @action, @target_user_id, @restaurant_id, @branch_id, @created_at)
      `);

    const callbackUrl = `${process.env.BASE_URL || "http://localhost:5000"}/api/subscription/callback`;
    const basketItems = [{
      id: String(paymentId),
      name: `${package_type.toUpperCase()} Paketi (${branchCount} şube)`,
      category1: "Abonelik",
      itemType: "VIRTUAL",
      price: totalPrice.toFixed(2),
    }];

    const iyzicoResponse = await createIyzicoPayment({
      conversationId, price: totalPrice, paidPrice: totalPrice,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
      basketItems, callbackUrl
    });

    if (!iyzicoResponse.success) {
      await pool.request().input("id", sql.Int, paymentId).query("UPDATE Payments SET status = 'failed' WHERE id = @id");
      return res.status(400).json({ message: iyzicoResponse.errorMessage });
    }

    await pool.request()
      .input("id", sql.Int, paymentId)
      .input("iyzico_token", sql.NVarChar, iyzicoResponse.token)
      .input("payment_url", sql.NVarChar, iyzicoResponse.paymentPageUrl)
      .query("UPDATE Payments SET iyzico_token = @iyzico_token, payment_url = @payment_url WHERE id = @id");

    return res.status(200).json({
      message: "Ödeme başlatıldı.",
      payment: { id: paymentId, token: iyzicoResponse.token, paymentUrl: iyzicoResponse.paymentPageUrl, amount: totalPrice }
    });
  } catch (err) {
    console.error("Subscription error:", err);
    return res.status(500).json({ message: "Hata oluştu.", error: err.message });
  }
};

export const handleIyzicoCallback = async (req, res) => {
  const token = req.body.token || req.query.token;
  if (!token) return res.status(400).json({ message: "Token eksik." });

  try {
    const result = await verifyPayment(token);
    const pool = await poolPromise;

    if (result.status === "success") {
      const updateResult = await pool.request()
        .input("token", sql.NVarChar, token)
        .query(`
          UPDATE Payments SET status = 'completed', paid_at = GETDATE(), subscription_status = 'active'
          OUTPUT INSERTED.user_id
          WHERE iyzico_token = @token AND status = 'pending'
        `);
      const userId = updateResult.recordset[0]?.user_id;

      if (userId) {
        await pool.request().input("id", sql.Int, userId).query("UPDATE Users SET is_active = 1 WHERE id = @id");
        await pool.request().input("user_id", sql.Int, userId).query(`
          UPDATE Restaurants SET is_active = 1 WHERE id = (SELECT restaurant_id FROM Users WHERE id = @user_id)
        `);
        await pool.request().input("user_id", sql.Int, userId).query(`
          UPDATE Branches SET is_active = 1 WHERE restaurant_id = (SELECT restaurant_id FROM Users WHERE id = @user_id)
        `);
        await pool.request().input("user_id", sql.Int, userId).query(`
          UPDATE UserPackages SET start_date = DATEADD(DAY, 1, trial_end_date), end_date = DATEADD(YEAR, 1, DATEADD(DAY, 1, trial_end_date)), status = (SELECT is_active FROM Users WHERE id = @user_id), updated_at = GETDATE() WHERE user_id = @user_id
        `);

        // UserAuditLog'a ödeme tamamlanma logu ekle
        await pool.request()
          .input("user_id", sql.Int, userId)
          .input("action", sql.NVarChar, "PAYMENT_COMPLETED")
          .input("target_user_id", sql.Int, userId)
          .input("restaurant_id", sql.Int, null) // callback'da restaurant_id yok, null bırak
          .input("branch_id", sql.Int, null) // callback'da branch_id yok, null bırak
          .input("created_at", sql.DateTime, new Date())
          .query(`
            INSERT INTO UserAuditLog (user_id, action, target_user_id, restaurant_id, branch_id, created_at)
            VALUES (@user_id, @action, @target_user_id, @restaurant_id, @branch_id, @created_at)
          `);
      }
      return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/success`);
    } else {
      await pool.request().input("token", sql.NVarChar, token).query("UPDATE Payments SET status = 'failed' WHERE iyzico_token = @token");
      return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/register`);
    }
  } catch (err) {
    console.error("Callback error:", err);
    return res.status(500).json({ message: "Callback hatası.", error: err.message });
  }
};