const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { db, nextId } = require('../db');

router.use(authMiddleware);

// GET /api/alerts  — current user's unresolved alerts
router.get('/', (req, res) => {
  const alerts = db.get('alerts')
    .filter(a => a.user_id === req.user.id)
    .orderBy(['created_at'], ['desc'])
    .value()
    .map(a => {
      const drone = db.get('drones').find(d => d.id === a.drone_id).value();
      return { ...a, drone_name: drone?.name || 'Unknown' };
    });
  res.json(alerts);
});

// PUT /api/alerts/:id/resolve
router.put('/:id/resolve', (req, res) => {
  const alertId = Number(req.params.id);
  const alert = db.get('alerts').find(a => a.id === alertId && a.user_id === req.user.id).value();
  if (!alert) return res.status(404).json({ message: 'Alert not found' });
  db.get('alerts').find(a => a.id === alertId).assign({ resolved: true, resolved_at: new Date().toISOString() }).write();
  res.json({ success: true });
});

module.exports = router;
