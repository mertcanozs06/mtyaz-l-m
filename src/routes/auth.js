import express from 'express';
import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/register', async (req, res) => {
  const { restaurantName, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const restaurantResult = await pool.request()
      .input('name', restaurantName)
      .query('INSERT INTO Restaurants (name) OUTPUT INSERTED.id VALUES (@name)');
    const restaurant_id = restaurantResult.recordset[0].id;

    const userResult = await pool.request()
      .input('restaurant_id', restaurant_id)
      .input('email', email)
      .input('password', hashedPassword)
      .input('role', 'admin')
      .query(`
        INSERT INTO Users (restaurant_id, email, password, role)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @email, @password, @role)
      `);

    const token = jwt.sign(
      { email, role: 'admin', restaurant_id },
      process.env.JWT_SECRET || 'your_jwt_secret', // .env'den alınıyor
      { expiresIn: '1h' }
    );

    res.status(201).json({ token, restaurant_id });

    
  } catch (err) {
    res.status(500).json({ message: 'Error registering', error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.request()
      .input('email', email)
      .query('SELECT * FROM Users WHERE email = @email');
    const user = result.recordset[0];
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign(
  { email: user.email, role: user.role, restaurant_id: user.restaurant_id },
  process.env.JWT_SECRET || 'your_jwt_secret',
  { expiresIn: '1h' }
);
// 30 günlük ücretsiz kontrol
const createdAt = new Date(user.createdAt);
  const now = new Date();
  const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

  if (diffDays > 30) {
    return res.status(403).send('Ücretsiz deneme süreniz sona erdi');
  }
  
    res.json({ token, restaurant_id: user.restaurant_id });
  } catch (err) {
    res.status(500).json({ message: 'Error logging in', error: err.message });
  }
});

export default router;
