const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'market_masters_secret_key');
    const user = await User.findById(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token.', error: error.message });
  }
};

const shopkeeperOnly = (req, res, next) => {
  if (req.user.role !== 'shopkeeper') {
    return res.status(403).json({ message: 'Access denied. Shopkeeper only.' });
  }
  next();
};

module.exports = { authMiddleware, shopkeeperOnly };
