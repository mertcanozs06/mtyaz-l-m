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
import paymentRoutes from './routes/payments.js';
import dashboardRoutes from './routes/dashboard.js';
import subscriptionRoutes from "./routes/subscription.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);

// === CORS ===
const corsOptions = {
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
// 🔥 Her isteğe header ekle (Safari için zorunlu)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Private-Network", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// === JSON Body Parser ===
app.use(express.json());
app.use('/uploads', express.static(join(__dirname, '..', 'Uploads')));

// === SOCKET.IO ===
const io = new Server(server, { cors: corsOptions });

// === SOCKET JWT ===
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Yetkilendirme hatası: Token eksik'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch {
    next(new Error('Yetkilendirme hatası: Geçersiz token'));
  }
});

// === Express ile Socket paylaşımı ===
app.use((req, res, next) => {
  req.io = io;
  next();
});

// === TEST ENDPOINT ===
app.get('/', (req, res) => {
  res.send('✅ Server is running...');
});

// ✅ Bu iki rota “authMiddleware” olmadan kullanılmalı
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);

// === Diğer tüm rotalar JWT ile korunur ===
app.use('/api/order', authMiddleware, orderRoutes);
app.use('/api/menu', authMiddleware, menuRoutes);
app.use('/api/table', authMiddleware, tableRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/user', authMiddleware, userRoutes);
app.use('/api/restaurant', authMiddleware, restaurantRoutes);
app.use('/api/regions', authMiddleware, regionRoutes);
app.use('/api/branches', authMiddleware, branchRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use("/api/subscription", subscriptionRoutes); // ✅ Artık authMiddleware burada değil, route içinde


// === SOCKET EVENTS ===
io.on('connection', (socket) => {
  console.log(`Yeni bağlantı: ${socket.id} (${socket.user?.role})`);

  socket.on('join-room', ({ type, restaurantId, branchId }) => {
    let room = '';
    switch (type) {
      case 'restaurant':
        room = `restaurant_${restaurantId}_${branchId}`;
        break;
      case 'kitchen':
        if (socket.user.role === 'kitchen')
          room = `kitchen_${restaurantId}_${branchId}`;
        break;
      case 'waiter':
        if (socket.user.role === 'waiter')
          room = `waiter_${restaurantId}_${branchId}`;
        break;
      case 'admin':
        if (['admin', 'owner'].includes(socket.user.role))
          room = `admin_${restaurantId}_${branchId}`;
        break;
      case 'owner':
        if (socket.user.role === 'owner' || socket.user.is_initial_admin)
          room = `owner_${restaurantId}`;
        break;
    }

    if (room) {
      socket.join(room);
      console.log(`Socket ${socket.id} odasına katıldı: ${room}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket ayrıldı: ${socket.id}`);
  });
});

// === HATA YAKALAYICI ===
app.use((err, req, res, next) => {
  console.error('Global Error:', err);
  res.status(500).json({ message: 'Sunucu hatası', error: err.message });
});

// === SERVER ===
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  try {
    await poolPromise;
    console.log(`✅ Sunucu ${PORT} portunda çalışıyor ve veritabanına bağlı`);
  } catch (err) {
    console.error('❌ Veritabanı bağlantısı başarısız:', err);
  }
});

