import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/order.js';
import menuRoutes from './routes/menu.js';
import tableRoutes from './routes/table.js';
import settingsRoutes from './routes/settings.js';
import userRoutes from './routes/user.js';
import restaurantRoutes from './routes/restaurant.js';
import regionsRoutes from './routes/regions.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { authMiddleware } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
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

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/table', tableRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/regions', regionsRoutes);

app.use('/uploads', express.static(path.join(__dirname, '..', 'Uploads')));

io.on('connection', (socket) => {
  console.log('Bir istemci bağlandı:', socket.id);

  socket.on('join-restaurant', ({ restaurantId, branchId }) => {
    socket.join(`restaurant_${restaurantId}_${branchId}`);
    console.log(`İstemci ${socket.id}, restaurant_${restaurantId}_${branchId}'e katıldı`);
  });

  socket.on('join_kitchen', ({ restaurantId, branchId }) => {
    socket.join(`kitchen_${restaurantId}_${branchId}`);
    console.log(`İstemci ${socket.id}, kitchen_${restaurantId}_${branchId}'e katıldı`);
  });

  socket.on('join_admin', ({ restaurantId, branchId }) => {
    socket.join(`admin_${restaurantId}_${branchId}`);
    console.log(`İstemci ${socket.id}, admin_${restaurantId}_${branchId}'e katıldı`);
  });

  socket.on('join_owner', ({ restaurantId, branchId }) => {
    socket.join(`owner_${restaurantId}_${branchId}`);
    console.log(`İstemci ${socket.id}, owner_${restaurantId}_${branchId}'e katıldı`);
  });

  socket.on('menu-updated', ({ restaurant_id, branch_id }) => {
    io.to(`restaurant_${restaurant_id}_${branch_id}`).emit('menu-updated');
  });

  socket.on('disconnect', () => {
    console.log('İstemci ayrıldı:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
