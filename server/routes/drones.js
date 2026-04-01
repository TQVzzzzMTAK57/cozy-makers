const router = require('express').Router();
const auth   = require('../middleware/auth');
const { Drones } = require('../database');

router.use(auth);

// Map UI labels → PostgreSQL ENUM values
const STATUS_MAP = {
  idle:        'active',
  active:      'active',
  maintenance: 'maintenance',
  offline:     'inactive',
  inactive:    'inactive',
};
const normalizeStatus = (s) => STATUS_MAP[(s || 'active').toLowerCase()] || 'active';

// Map DB row → frontend field names
const toResponse = (d) => d ? ({
  ...d,
  serial_number:    d.serial_num,
  firmware_version: d.firmware,
  // keep status as-is (lowercase from DB is fine for display)
}) : null;

router.get('/', async (req, res) => {
  try { res.json((await Drones.listForUser(req.user.id)).map(toResponse)); }
  catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const drone = await Drones.findById(Number(req.params.id));
    if (!drone || drone.user_id !== req.user.id)
      return res.status(404).json({ message: 'Drone not found' });
    res.json(toResponse(drone));
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, serialNumber, model, firmwareVersion, status } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const drone = await Drones.create({
      user_id:    req.user.id,
      name,
      serial_num: serialNumber    || null,
      model:      model           || null,
      firmware:   firmwareVersion || null,
      status:     normalizeStatus(status),
    });
    res.status(201).json(toResponse(drone));
  } catch (err) {
    console.error('Create drone error:', err.message);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const droneId = Number(req.params.id);
    const drone   = await Drones.findById(droneId);
    if (!drone || drone.user_id !== req.user.id)
      return res.status(404).json({ message: 'Drone not found' });

    const { name, serialNumber, model, firmwareVersion, status } = req.body;
    const updated = await Drones.update(droneId, {
      name:       name            || drone.name,
      serial_num: serialNumber    ?? drone.serial_num,
      model:      model           ?? drone.model,
      firmware:   firmwareVersion ?? drone.firmware,
      status:     status ? normalizeStatus(status) : drone.status,
    });
    res.json(toResponse(updated));
  } catch (err) {
    console.error('Update drone error:', err.message);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const droneId = Number(req.params.id);
    const drone   = await Drones.findById(droneId);
    if (!drone || drone.user_id !== req.user.id)
      return res.status(404).json({ message: 'Drone not found' });
    await Drones.delete(droneId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
