const router = require('express').Router();
const auth   = require('../middleware/auth');
const admin  = require('../middleware/admin');
const { pool, query, queryOne, Users, Drones, Predictions, Alerts } = require('../database');

router.use(auth, admin);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, drones, preds, alerts] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE role='admin')::int AS admins,
          COUNT(*) FILTER (WHERE is_active=true)::int  AS active,
          COUNT(*) FILTER (WHERE is_active=false)::int AS inactive
        FROM users
      `),
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='active')::int       AS active_count,
          COUNT(*) FILTER (WHERE status='inactive')::int     AS inactive_count,
          COUNT(*) FILTER (WHERE status='maintenance')::int  AS maintenance_count
        FROM drones
      `),
      pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE feedback_accurate IS NOT NULL)::int AS with_feedback
        FROM predictions
      `),
      pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE acknowledged=false)::int AS unresolved
        FROM alerts
      `),
    ]);

    const recentActivity = await query(`
      SELECT p.id, p.name, p.uploaded_at, p.total_detections, p.media_type,
             u.username, d.name AS drone_name
      FROM predictions p
      JOIN users  u ON u.id=p.user_id
      JOIN drones d ON d.id=p.drone_id
      ORDER BY p.id DESC LIMIT 8
    `);

    const u = users.rows[0];
    const d = drones.rows[0];
    const p = preds.rows[0];
    const a = alerts.rows[0];

    res.json({
      users:       { total: u.total, admins: u.admins, active: u.active, inactive: u.inactive },
      drones:      { total: d.total, byStatus: { active: d.active_count, inactive: d.inactive_count, maintenance: d.maintenance_count } },
      predictions: { total: p.total, withFeedback: p.with_feedback },
      alerts:      { total: a.total, unresolved: a.unresolved },
      recentActivity,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await query(`
      SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active, u.created_at,
             (SELECT COUNT(*)::int FROM drones      WHERE user_id=u.id) AS drone_count,
             (SELECT COUNT(*)::int FROM predictions WHERE user_id=u.id) AS prediction_count
      FROM users u ORDER BY u.id DESC
    `);
    res.json(users);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin','user'].includes(role))
      return res.status(400).json({ message: 'Invalid role' });
    const targetId = Number(req.params.id);
    if (targetId === req.user.id && role === 'user')
      return res.status(400).json({ message: 'Cannot demote your own account' });
    const { rows: [{ na }] } = await pool.query("SELECT COUNT(*)::int AS na FROM users WHERE role='admin'");
    if (role === 'user' && na <= 1)
      return res.status(400).json({ message: 'Cannot demote the last admin' });
    const user = await Users.findById(targetId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const updated = await Users.update(targetId, { role });
    const { password: _p, ...safe } = updated;
    res.json(safe);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// PUT /api/admin/users/:id/status
router.put('/users/:id/status', async (req, res) => {
  try {
    const { is_active } = req.body;
    const targetId = Number(req.params.id);
    if (targetId === req.user.id)
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    const user = await Users.findById(targetId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const updated = await Users.update(targetId, { is_active: Boolean(is_active) });
    const { password: _p, ...safe } = updated;
    res.json(safe);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.user.id)
      return res.status(400).json({ message: 'Cannot delete your own account' });
    const user = await Users.findById(targetId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') {
      const { rows: [{ na }] } = await pool.query("SELECT COUNT(*)::int AS na FROM users WHERE role='admin'");
      if (na <= 1) return res.status(400).json({ message: 'Cannot delete the last admin' });
    }
    await Users.delete(targetId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// GET /api/admin/drones
router.get('/drones', async (req, res) => {
  try {
    const rows = await query(`
      SELECT d.*, u.username AS owner_username, u.email AS owner_email,
             (SELECT COUNT(*)::int FROM predictions WHERE drone_id=d.id) AS prediction_count
      FROM drones d JOIN users u ON u.id=d.user_id ORDER BY d.id DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// GET /api/admin/predictions
router.get('/predictions', async (req, res) => {
  try { res.json(await Predictions.listAll()); }
  catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// GET /api/admin/alerts
router.get('/alerts', async (req, res) => {
  try { res.json(await Alerts.listAll()); }
  catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// PUT /api/admin/alerts/:id/resolve
router.put('/alerts/:id/resolve', async (req, res) => {
  try {
    await Alerts.acknowledge(Number(req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
