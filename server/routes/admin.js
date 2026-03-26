const router = require('express').Router();
const auth   = require('../middleware/auth');
const admin  = require('../middleware/admin');
const { db, Users, Drones, Predictions, Alerts } = require('../database');

router.use(auth, admin);

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const stats = {
    users: {
      total:    db.prepare('SELECT COUNT(*) as n FROM users').get().n,
      admins:   db.prepare("SELECT COUNT(*) as n FROM users WHERE role='admin'").get().n,
      active:   db.prepare('SELECT COUNT(*) as n FROM users WHERE is_active=1').get().n,
      inactive: db.prepare('SELECT COUNT(*) as n FROM users WHERE is_active=0').get().n,
    },
    drones: {
      total:    db.prepare('SELECT COUNT(*) as n FROM drones').get().n,
      byStatus: Object.fromEntries(
        ['active','inactive','maintenance'].map(s => [
          s, db.prepare('SELECT COUNT(*) as n FROM drones WHERE status=?').get(s).n
        ])
      ),
    },
    predictions: {
      total:        db.prepare('SELECT COUNT(*) as n FROM predictions').get().n,
      withFeedback: db.prepare('SELECT COUNT(*) as n FROM predictions WHERE feedback_accurate IS NOT NULL').get().n,
    },
    alerts: {
      total:      db.prepare('SELECT COUNT(*) as n FROM alerts').get().n,
      unresolved: db.prepare('SELECT COUNT(*) as n FROM alerts WHERE acknowledged=0').get().n,
    },
    recentActivity: db.prepare(`
      SELECT p.id, p.name, p.uploaded_at, p.total_detections, p.media_type,
             u.username, d.name AS drone_name
      FROM predictions p
      JOIN users  u ON u.id = p.user_id
      JOIN drones d ON d.id = p.drone_id
      ORDER BY p.id DESC LIMIT 8
    `).all(),
  };
  res.json(stats);
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active, u.created_at,
           (SELECT COUNT(*) FROM drones      WHERE user_id=u.id) AS drone_count,
           (SELECT COUNT(*) FROM predictions WHERE user_id=u.id) AS prediction_count
    FROM users u ORDER BY u.id DESC
  `).all().map(u => ({ ...u, is_active: !!u.is_active }));
  res.json(users);
});

// ── PUT /api/admin/users/:id/role ─────────────────────────────────────────────
router.put('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['admin','user'].includes(role))
    return res.status(400).json({ message: 'Invalid role' });

  const targetId = Number(req.params.id);
  if (targetId === req.user.id && role === 'user')
    return res.status(400).json({ message: 'Cannot demote your own account' });

  const adminCount = db.prepare("SELECT COUNT(*) as n FROM users WHERE role='admin'").get().n;
  if (role === 'user' && adminCount <= 1)
    return res.status(400).json({ message: 'Cannot demote the last admin' });

  const user = Users.findById.get(targetId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const updated = Users.update(targetId, { role });
  const { password: _p, ...safe } = updated;
  res.json(safe);
});

// ── PUT /api/admin/users/:id/status ──────────────────────────────────────────
router.put('/users/:id/status', (req, res) => {
  const { is_active } = req.body;
  const targetId = Number(req.params.id);
  if (targetId === req.user.id)
    return res.status(400).json({ message: 'Cannot deactivate your own account' });

  const user = Users.findById.get(targetId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const updated = Users.update(targetId, { is_active: is_active ? 1 : 0 });
  const { password: _p, ...safe } = updated;
  res.json({ ...safe, is_active: !!updated.is_active });
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
router.delete('/users/:id', (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id)
    return res.status(400).json({ message: 'Cannot delete your own account' });

  const user = Users.findById.get(targetId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (user.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as n FROM users WHERE role='admin'").get().n;
    if (adminCount <= 1)
      return res.status(400).json({ message: 'Cannot delete the last admin' });
  }

  Users.delete(targetId);    // FK cascade removes drones, predictions, alerts
  res.json({ success: true });
});

// ── GET /api/admin/drones ─────────────────────────────────────────────────────
router.get('/drones', (req, res) => {
  const rows = db.prepare(`
    SELECT d.*, u.username AS owner_username, u.email AS owner_email,
           (SELECT COUNT(*) FROM predictions WHERE drone_id=d.id) AS prediction_count
    FROM drones d JOIN users u ON u.id=d.user_id ORDER BY d.id DESC
  `).all();
  res.json(rows);
});

// ── GET /api/admin/predictions ────────────────────────────────────────────────
router.get('/predictions', (req, res) => {
  res.json(Predictions.listAll());
});

// ── GET /api/admin/alerts ─────────────────────────────────────────────────────
router.get('/alerts', (req, res) => {
  res.json(Alerts.listAll());
});

// ── PUT /api/admin/alerts/:id/resolve ────────────────────────────────────────
router.put('/alerts/:id/resolve', (req, res) => {
  Alerts.acknowledge(Number(req.params.id));
  res.json({ success: true });
});

module.exports = router;
