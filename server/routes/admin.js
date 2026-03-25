const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { db } = require('../db');

router.use(authMiddleware, adminMiddleware);

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const users = db.get('users').value();
  const drones = db.get('drones').value();
  const predictions = db.get('predictions').value();
  const alerts = db.get('alerts').value();

  const recentActivity = db.get('predictions')
    .orderBy(['uploaded_at'], ['desc'])
    .take(8)
    .value()
    .map(p => {
      const drone = db.get('drones').find(d => d.id === p.drone_id).value();
      const u = db.get('users').find(u => u.id === p.user_id).value();
      return {
        ...p,
        drone_name: drone?.name || 'Unknown',
        username: u?.username || 'Unknown',
      };
    });

  // Drone status distribution
  const droneStatusCount = ['Idle', 'Active', 'Maintenance', 'Offline'].reduce((acc, s) => {
    acc[s] = drones.filter(d => d.status === s).length;
    return acc;
  }, {});

  res.json({
    users: {
      total: users.length,
      admins: users.filter(u => u.role === 'admin').length,
      active: users.filter(u => u.is_active).length,
      inactive: users.filter(u => !u.is_active).length,
    },
    drones: {
      total: drones.length,
      byStatus: droneStatusCount,
    },
    predictions: {
      total: predictions.length,
      withFeedback: predictions.filter(p => p.feedback_accurate !== null).length,
    },
    alerts: {
      total: alerts.length,
      unresolved: alerts.filter(a => !a.resolved).length,
    },
    recentActivity,
  });
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', (req, res) => {
  const users = db.get('users')
    .orderBy(['created_at'], ['desc'])
    .value()
    .map(u => {
      const { password: _p, ...safe } = u;
      // Add stats
      safe.drone_count = db.get('drones').filter(d => d.user_id === u.id).size().value();
      safe.prediction_count = db.get('predictions').filter(p => p.user_id === u.id).size().value();
      return safe;
    });
  res.json(users);
});

// ─── PUT /api/admin/users/:id/role ────────────────────────────────────────────
router.put('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role))
    return res.status(400).json({ message: 'Invalid role. Must be "admin" or "user"' });

  const targetId = Number(req.params.id);

  // Cannot demote yourself
  if (targetId === req.user.id && role === 'user')
    return res.status(400).json({ message: 'Cannot demote your own admin account' });

  // Ensure at least one admin remains
  if (role === 'user') {
    const adminCount = db.get('users').filter(u => u.role === 'admin').size().value();
    if (adminCount <= 1)
      return res.status(400).json({ message: 'Cannot demote the last admin' });
  }

  const user = db.get('users').find(u => u.id === targetId).value();
  if (!user) return res.status(404).json({ message: 'User not found' });

  db.get('users').find(u => u.id === targetId).assign({ role }).write();
  const updated = db.get('users').find(u => u.id === targetId).value();
  const { password: _p, ...safe } = updated;
  res.json(safe);
});

// ─── PUT /api/admin/users/:id/status ─────────────────────────────────────────
router.put('/users/:id/status', (req, res) => {
  const { is_active } = req.body;
  const targetId = Number(req.params.id);

  // Cannot deactivate yourself
  if (targetId === req.user.id)
    return res.status(400).json({ message: 'Cannot deactivate your own account' });

  const user = db.get('users').find(u => u.id === targetId).value();
  if (!user) return res.status(404).json({ message: 'User not found' });

  db.get('users').find(u => u.id === targetId).assign({ is_active: Boolean(is_active) }).write();
  const updated = db.get('users').find(u => u.id === targetId).value();
  const { password: _p, ...safe } = updated;
  res.json(safe);
});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
router.delete('/users/:id', (req, res) => {
  const targetId = Number(req.params.id);

  if (targetId === req.user.id)
    return res.status(400).json({ message: 'Cannot delete your own account' });

  const user = db.get('users').find(u => u.id === targetId).value();
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (user.role === 'admin') {
    const adminCount = db.get('users').filter(u => u.role === 'admin').size().value();
    if (adminCount <= 1)
      return res.status(400).json({ message: 'Cannot delete the last admin' });
  }

  // Cascade delete
  db.get('users').remove(u => u.id === targetId).write();
  db.get('drones').remove(d => d.user_id === targetId).write();
  db.get('predictions').remove(p => p.user_id === targetId).write();
  db.get('alerts').remove(a => a.user_id === targetId).write();

  res.json({ success: true });
});

// ─── GET /api/admin/drones ────────────────────────────────────────────────────
router.get('/drones', (req, res) => {
  const drones = db.get('drones')
    .orderBy(['created_at'], ['desc'])
    .value()
    .map(d => {
      const owner = db.get('users').find(u => u.id === d.user_id).value();
      return {
        ...d,
        owner_username: owner?.username || 'Unknown',
        owner_email: owner?.email || '',
        prediction_count: db.get('predictions').filter(p => p.drone_id === d.id).size().value(),
      };
    });
  res.json(drones);
});

// ─── GET /api/admin/predictions ───────────────────────────────────────────────
router.get('/predictions', (req, res) => {
  const predictions = db.get('predictions')
    .orderBy(['uploaded_at'], ['desc'])
    .take(100)
    .value()
    .map(p => {
      const drone = db.get('drones').find(d => d.id === p.drone_id).value();
      const user = db.get('users').find(u => u.id === p.user_id).value();
      return {
        ...p,
        drone_name: drone?.name || 'Unknown',
        username: user?.username || 'Unknown',
      };
    });
  res.json(predictions);
});

// ─── GET /api/admin/alerts ────────────────────────────────────────────────────
router.get('/alerts', (req, res) => {
  const alerts = db.get('alerts')
    .orderBy(['created_at'], ['desc'])
    .value()
    .map(a => {
      const drone = db.get('drones').find(d => d.id === a.drone_id).value();
      const user = db.get('users').find(u => u.id === a.user_id).value();
      return { ...a, drone_name: drone?.name || 'Unknown', username: user?.username || 'Unknown' };
    });
  res.json(alerts);
});

// ─── PUT /api/admin/alerts/:id/resolve ───────────────────────────────────────
router.put('/alerts/:id/resolve', (req, res) => {
  const alertId = Number(req.params.id);
  const alert = db.get('alerts').find(a => a.id === alertId).value();
  if (!alert) return res.status(404).json({ message: 'Alert not found' });
  db.get('alerts').find(a => a.id === alertId).assign({ resolved: true, resolved_at: new Date().toISOString() }).write();
  res.json({ success: true });
});

module.exports = router;
