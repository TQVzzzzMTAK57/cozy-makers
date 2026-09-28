const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { Users } = require('../database');

// Verifies the JWT, then reloads the user so deactivation and role changes apply immediately.
// allowQueryToken: also accept ?token=… (needed for <img>/<video> src, which cannot send headers)
function authenticate({ allowQueryToken = false } = {}) {
  return async (req, res, next) => {
    const auth = req.headers.authorization;
    let token = auth && auth.startsWith('Bearer ') ? auth.replace('Bearer ', '') : null;
    if (!token && allowQueryToken && typeof req.query.token === 'string') token = req.query.token;
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized - No token provided' });
    }
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
}

module.exports = authenticate();
module.exports.authenticate = authenticate;
