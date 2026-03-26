const router = require('express').Router();
const auth   = require('../middleware/auth');
const { Alerts } = require('../database');

router.use(auth);

// GET /api/alerts
router.get('/', (req, res) => {
  res.json(Alerts.listForUser(req.user.id));
});

// PUT /api/alerts/:id/resolve
router.put('/:id/resolve', (req, res) => {
  const alertId = Number(req.params.id);
  Alerts.acknowledge(alertId);
  res.json({ success: true });
});

module.exports = router;
