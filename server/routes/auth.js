const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, nextId } = require('../db');

const SECRET = process.env.JWT_SECRET || 'drowning-detection-secret-key-2024';

function makeToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role || 'user',
    full_name: user.full_name || user.username,
  };
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const existing = db.get('users').find(u =>
      u.username === username.trim().toLowerCase() ||
      u.email === email.trim().toLowerCase()
    ).value();
    if (existing)
      return res.status(400).json({ message: 'Username or email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const user = {
      id: nextId('users'),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password: hash,
      role: 'user',
      is_active: true,
      full_name: (full_name || username).trim(),
      created_at: new Date().toISOString(),
    };
    db.get('users').push(user).write();

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

    const user = db.get('users').find(u => u.username === username.trim().toLowerCase()).value();
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid username or password' });

    if (!user.is_active)
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact admin.' });

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
  const user = db.get('users').find(u => u.id === req.user.id).value();
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { password: _p, ...safe } = user;
  res.json(safe);
});

// PUT /api/auth/profile — update full_name
router.put('/profile', require('../middleware/auth'), (req, res) => {
  const { full_name } = req.body;
  db.get('users').find(u => u.id === req.user.id).assign({ full_name }).write();
  const user = db.get('users').find(u => u.id === req.user.id).value();
  const { password: _p, ...safe } = user;
  res.json(safe);
});

// PUT /api/auth/password — change password
router.put('/password', require('../middleware/auth'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: 'Both fields are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'New password must be at least 6 characters' });

    const user = db.get('users').find(u => u.id === req.user.id).value();
    if (!(await bcrypt.compare(currentPassword, user.password)))
      return res.status(401).json({ message: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    db.get('users').find(u => u.id === req.user.id).assign({ password: hash }).write();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
