import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const authMiddleware = (roles) => (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    if (roles && !roles.includes(decoded.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (decoded.role !== 'owner' && decoded.branch_id && req.params.branch_id && parseInt(req.params.branch_id) !== decoded.branch_id) {
      return res.status(403).json({ message: 'Bu şubeye erişim yetkiniz yok' });
    }

    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
