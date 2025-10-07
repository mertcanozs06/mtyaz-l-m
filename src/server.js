import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import jwt from 'jsonwebtoken';
import { poolPromise, sql } from './config/db.js';
import { authMiddleware } from './middleware/auth.js';

// === ROUTES ===
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/order.js';
import menuRoutes from './routes/menu.js';
import tableRoutes from './routes/table.js';
import settingsRoutes from './routes/settings.js';
import userRoutes from './routes/user.js';
import restaurantRoutes from './routes/restaurant.js';
import regionRoutes from './routes/regions.js';
import branchRoutes from './routes/branch.js';

// 💳 Yeni eklenen rotalar
import paymentRoutes from './routes/payments.js';
import dashboardRoutes from './routes/dashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);

// === SOCKET.IO ===
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// === JWT doğrulama ===
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Yetkilendirme hatası: Token eksik'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // { id, email, role, restaurant_id, branch_id, is_initial_admin }
    next();
  } catch (err) {
    next(new Error('Yetkilendirme hatası: Geçersiz token'));
  }
});

// === Express socket middleware ===
app.use((req, res, next) => {
  req.io = io;
  next();
});

// === MIDDLEWARES ===
app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);
app.use(express.json());
app.use('/uploads', express.static(join(__dirname, '..', 'Uploads')));

// === ROUTES ===
app.use('/api/auth', authRoutes);
app.use('/api/order', authMiddleware, orderRoutes);
app.use('/api/menu', authMiddleware, menuRoutes);
app.use('/api/table', authMiddleware, tableRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/user', authMiddleware, userRoutes);
app.use('/api/restaurant', authMiddleware, restaurantRoutes);
app.use('/api/regions', authMiddleware, regionRoutes);
app.use('/api/branches', authMiddleware, branchRoutes);
app.use('/api/payments', authMiddleware, paymentRoutes); // 💳 Ödeme sistemi
app.use('/api/dashboard', authMiddleware, dashboardRoutes); // 📊 Dashboard bilgileri

// === SOCKET.IO EVENTS ===
io.on('connection', (socket) => {
  console.log(`Yeni bağlantı: ${socket.id} (${socket.user?.role})`);

  // ROOM JOIN EVENTS
  socket.on('join-room', ({ type, restaurantId, branchId }) => {
    const user = socket.user;
    let room = '';

    switch (type) {
      case 'restaurant':
        room = `restaurant_${restaurantId}_${branchId}`;
        break;
      case 'kitchen':
        if (user.role !== 'kitchen') return;
        room = `kitchen_${restaurantId}_${branchId}`;
        break;
      case 'waiter':
        if (user.role !== 'waiter') return;
        room = `waiter_${restaurantId}_${branchId}`;
        break;
      case 'admin':
        if (['admin', 'owner'].includes(user.role)) {
          room = `admin_${restaurantId}_${branchId}`;
        }
        break;
      case 'owner':
        if (user.role === 'owner' || user.is_initial_admin) {
          room = `owner_${restaurantId}`;
        }
        break;
      default:
        return;
    }

    if (room) {
      socket.join(room);
      console.log(`Socket ${socket.id} odasına katıldı: ${room}`);
    }
  });

  // ORDER STATUS UPDATE
  socket.on('order-status-updated', ({ restaurant_id, branch_id, order_id, status }) => {
    io.to(`admin_${restaurant_id}_${branch_id}`)
      .to(`owner_${restaurant_id}`)
      .to(`kitchen_${restaurant_id}_${branch_id}`)
      .to(`waiter_${restaurant_id}_${branch_id}`)
      .emit('order-status-updated', { order_id, status });
  });

  // PAYMENT STATUS UPDATE
  socket.on('payment-status-updated', ({ restaurant_id, branch_id, order_id, payment_status }) => {
    io.to(`admin_${restaurant_id}_${branch_id}`)
      .to(`owner_${restaurant_id}`)
      .emit('payment-status-updated', { order_id, payment_status });
  });

  // USER ACTION LOGGING
  socket.on('user-action-logged', async ({ restaurant_id, branch_id, action, target_user_id }) => {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('userId', sql.Int, socket.user.id)
        .input('action', sql.NVarChar, action)
        .input('targetUserId', sql.Int, target_user_id)
        .input('restaurantId', sql.Int, restaurant_id)
        .input('branchId', sql.Int, branch_id)
        .query(`
          INSERT INTO UserAuditLog (user_id, action, target_user_id, restaurant_id, branch_id, created_at)
          VALUES (@userId, @action, @targetUserId, @restaurantId, @branchId, GETDATE())
        `);

      io.to(`admin_${restaurant_id}_${branch_id}`)
        .to(`owner_${restaurant_id}`)
        .emit('user-action-logged', { action, target_user_id });
    } catch (err) {
      console.error('Audit Log hatası:', err);
      socket.emit('error', { message: 'Kullanıcı işlemi loglanamadı' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket ayrıldı: ${socket.id}`);
  });
});

// === ERROR HANDLER ===
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Sunucu hatası', error: err.message });
});

// === SERVER START ===
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  try {
    const pool = await poolPromise;
    console.log(`✅ Sunucu ${PORT} portunda çalışıyor ve veritabanına bağlı`);
  } catch (err) {
    console.error('❌ Veritabanı bağlantısı başarısız:', err);
  }
});
