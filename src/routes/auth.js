import express from 'express';
import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  const { restaurantName, email, password, package_type } = req.body;
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
      .input('package_type', package_type)
      .query(`
        INSERT INTO Users (restaurant_id, email, password, role, package_type)
        VALUES (@restaurant_id, @email, @password, @role, @package_type);
        SELECT SCOPE_IDENTITY() AS id;
      `);
    const user_id = userResult.recordset[0].id;

    const branchResult = await pool.request()
      .input('restaurant_id', restaurant_id)
      .input('name', 'Varsayılan Şube')
      .input('country', 'Türkiye')
      .input('city', 'Varsayılan Şehir')
      .query(`
        INSERT INTO Branches (restaurant_id, name, country, city)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @name, @country, @city)
      `);
    const branch_id = branchResult.recordset[0].id;

    const max_branches = package_type === 'base' ? 1 : package_type === 'package2' ? 25 : null;
    await pool.request()
      .input('user_id', user_id)
      .input('package_type', package_type)
      .input('max_branches', max_branches)
      .query(`
        INSERT INTO Packages (user_id, package_type, max_branches)
        VALUES (@user_id, @package_type, @max_branches)
      `);

    const token = jwt.sign(
      { email, role: 'admin', restaurant_id, branch_id, user_id },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' }
    );

    res.status(201).json({ token, restaurant_id, branch_id });
  } catch (err) {
    res.status(500).json({ message: 'Error registering', error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.request()
      .input('email', email)
      .query('SELECT * FROM Users WHERE email = @email');
    const user = result.recordset[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const packageResult = await pool.request()
      .input('user_id', user.id)
      .query('SELECT created_at FROM Packages WHERE user_id = @user_id');
    const createdAt = new Date(packageResult.recordset[0]?.created_at);
    const now = new Date();
    const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    if (diffDays > 30) {
      return res.status(403).json({ error: true, message: 'Ücretsiz deneme süreniz sona erdi' });
    }

    const branches = await pool.request()
      .input('restaurant_id', user.restaurant_id)
      .query('SELECT id, name, country, city FROM Branches WHERE restaurant_id = @restaurant_id');

    const token = jwt.sign(
      { email: user.email, role: user.role, restaurant_id: user.restaurant_id, branch_id: user.branch_id || branches.recordset[0]?.id, user_id: user.id },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' }
    );

    res.json({ token, restaurant_id: user.restaurant_id, branches: branches.recordset });
  } catch (err) {
    res.status(500).json({ message: 'Error logging in', error: err.message });
  }
});

export default router;

