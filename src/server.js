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
import { authMiddleware } from '../src/middleware/auth.js';


// ESM module için __dirname tanımı
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


// Express ve HTTP server kurulumu
const app = express();
const server = http.createServer(app);





// Socket.IO kurulumu
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});


app.use((req, res, next) => {
  req.io = io;
  next();
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
app.use('/api/order', authMiddleware(['waiter', 'admin', 'kitchen']), orderRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/table', tableRoutes);
app.use('/api/discount', discountRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/restaurant', restaurantRoutes);


// Statik dosya servisi için uploads klasörünü ekle
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));


// Socket.IO olayları
io.on('connection', (socket) => {
  console.log('Bir istemci bağlandı:', socket.id);


  // Restoran odasına katılma
  socket.on('join-restaurant', (restaurantId) => {
    socket.join(`restaurant_${restaurantId}`);
    console.log(`İstemci ${socket.id}, restoran ${restaurantId}'e katıldı`);
  });


  // Mutfak odasına katılma
  socket.on('join_kitchen', (restaurantId) => {
    socket.join(`kitchen_${restaurantId}`);
    console.log(`İstemci ${socket.id}, mutfak ${restaurantId}'e katıldı`);
  });


  // Menü güncellendiğinde
  socket.on('menu-updated', ({ restaurant_id }) => {
    io.to(`restaurant_${restaurant_id}`).emit('menu-updated');
  });

  // API rotalarından gelen olaylar için dinleyiciye gerek yok
  // Çünkü `req.io.to(...).emit(...)` doğrudan hedef istemciye mesaj gönderiyor.

  socket.on('disconnect', () => {
    console.log('İstemci ayrıldı:', socket.id);
  });

  // Admin odasına katılma
socket.on('join_admin', (restaurantId) => {
  socket.join(`admin_${restaurantId}`);
  console.log(`İstemci ${socket.id}, admin_${restaurantId} odasına katıldı`);
});
});


// Sunucuyu başlat
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});

