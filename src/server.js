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

const app = express();
const server = http.createServer(app);
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

// Middleware
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/table', tableRoutes);
app.use('/api/discount', discountRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/restaurant', restaurantRoutes);

// Socket.IO bağlantısı
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
