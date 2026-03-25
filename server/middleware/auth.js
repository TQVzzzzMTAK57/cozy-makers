const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'drowning-detection-secret-key-2024';

module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized - No token provided' });
  }
  const token = auth.replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized - Invalid token' });
  }
};
