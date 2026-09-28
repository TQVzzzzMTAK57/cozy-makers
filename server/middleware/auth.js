const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { Users } = require('../database');

// Verifies the JWT, then reloads the user so deactivation and role changes apply immediately.
module.exports = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized - No token provided' });
  }
  const token = auth.replace('Bearer ', '');
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Unauthorized - Invalid token' });
  }
  try {
    const user = await Users.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'Unauthorized - User no longer exists' });
    if (!user.is_active) return res.status(403).json({ message: 'Account deactivated. Contact admin.' });
    req.user = {
      id: user.id, username: user.username, email: user.email,
      role: user.role, full_name: user.full_name || user.username,
    };
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
