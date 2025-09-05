import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/order.js';
import menuRoutes from './routes/menu.js';
import tableRoutes from './routes/table.js';
import discountRoutes from './routes/discount.js';
import settingsRoutes from './routes/settings.js';
import userRoutes from './routes/user.js';
import restaurantRoutes from './routes/restaurant.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM module için __dirname tanımı
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Express ve HTTP server kurulumu
const app = express();
const server = http.createServer(app);

// Static uploads klasörü
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.IO kurulumu
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// CORS Middleware
app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);

// Body parser middleware
app.use(express.json());

// API route'ları
app.use('/api/auth', authRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/table', tableRoutes);
app.use('/api/discount', discountRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/restaurant', restaurantRoutes);


// Statik dosya servisi için uploads klasörünü ekle (bir üst dizin)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Socket.IO olayları
io.on('connection', (socket) => {
  console.log('Bir istemci bağlandı:', socket.id);

  socket.on('join-restaurant', (restaurantId) => {
    socket.join(restaurantId);
    console.log(`İstemci ${socket.id}, restoran ${restaurantId}'e katıldı`);
  });

  socket.on('menu-updated', ({ restaurant_id }) => {
    io.to(restaurant_id).emit('menu-updated');
  });

  socket.on('order-placed', ({ restaurant_id }) => {
    io.to(restaurant_id).emit('order-placed');
  });

  socket.on('disconnect', () => {
    console.log('İstemci ayrıldı:', socket.id);
  });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
