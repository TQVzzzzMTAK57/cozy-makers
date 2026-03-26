const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { Users } = require('../database');

const SECRET = process.env.JWT_SECRET || 'drowning-detection-secret-key-2024';

function makeToken(user) {
  return jwt.sign({
    id: user.id, username: user.username,
    email: user.email, role: user.role || 'user',
    full_name: user.full_name || user.username,
  }, SECRET, { expiresIn: '7d' });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const uname = username.trim().toLowerCase();
    const em    = email.trim().toLowerCase();

    if (Users.findByUsername.get(uname) || Users.findByEmail.get(em))
      return res.status(400).json({ message: 'Username or email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const user = Users.create({ username: uname, email: em, password: hash,
      full_name: (full_name || username).trim(), role: 'user', is_active: 1 });

    const token = makeToken(user);
    const { password: _p, ...safe } = user;
    res.status(201).json({ token, user: safe });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password are required' });

    const user = Users.findByUsername.get(username.trim().toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid username or password' });
    if (!user.is_active)
      return res.status(403).json({ message: 'Account deactivated. Contact admin.' });

    const token = makeToken(user);
    const { password: _p, ...safe } = user;
    res.json({ token, user: safe });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), (req, res) => {
  const user = Users.findById.get(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { password: _p, ...safe } = user;
  res.json(safe);
});

// PUT /api/auth/profile
router.put('/profile', require('../middleware/auth'), (req, res) => {
  const { full_name } = req.body;
  const user = Users.update(req.user.id, { full_name });
  const { password: _p, ...safe } = user;
  res.json(safe);
});

// PUT /api/auth/password
router.put('/password', require('../middleware/auth'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: 'Both fields are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'New password must be at least 6 characters' });

    const user = Users.findById.get(req.user.id);
    if (!(await bcrypt.compare(currentPassword, user.password)))
      return res.status(401).json({ message: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    Users.update(req.user.id, { password: hash });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
