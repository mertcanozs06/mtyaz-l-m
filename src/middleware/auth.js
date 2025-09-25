import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const authMiddleware = (roles) => (req, res, next) => {
  console.log('Authorization header:', req.headers.authorization);
  const token = req.headers.authorization?.split(' ')[1];
 console.log('Extracted token:', token);
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    req.user = decoded;
    if (roles && !roles.includes(decoded.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
