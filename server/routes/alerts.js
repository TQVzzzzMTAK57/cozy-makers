const router = require('express').Router();
const auth   = require('../middleware/auth');
const { Alerts } = require('../database');

router.use(auth);

router.get('/', async (req, res) => {
  try { res.json(await Alerts.listForUser(req.user.id)); }
  catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.put('/:id/resolve', async (req, res) => {
  try {
    await Alerts.acknowledge(Number(req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
