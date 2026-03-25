const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { db, nextId } = require('../db');

router.use(authMiddleware);

// GET /api/drones
router.get('/', (req, res) => {
  const drones = db.get('drones')
    .filter(d => d.user_id === req.user.id)
    .orderBy(['created_at'], ['desc'])
    .value();
  res.json(drones);
});

// GET /api/drones/:id
router.get('/:id', (req, res) => {
  const drone = db.get('drones').find(d => d.id === Number(req.params.id) && d.user_id === req.user.id).value();
  if (!drone) return res.status(404).json({ message: 'Drone not found' });
  res.json(drone);
});

// POST /api/drones
router.post('/', (req, res) => {
  const { name, serialNumber, model, firmwareVersion, status } = req.body;
  if (!name || !serialNumber || !model || !firmwareVersion)
    return res.status(400).json({ message: 'All fields required' });

  const drone = {
    id: nextId('drones'),
    user_id: req.user.id,
    name,
    serial_number: serialNumber,
    model,
    firmware_version: firmwareVersion,
    status: status || 'Idle',
    created_at: new Date().toISOString(),
  };
  db.get('drones').push(drone).write();
  res.status(201).json(drone);
});

// PUT /api/drones/:id
router.put('/:id', (req, res) => {
  const { name, serialNumber, model, firmwareVersion, status } = req.body;
  const droneId = Number(req.params.id);
  const drone = db.get('drones').find(d => d.id === droneId && d.user_id === req.user.id).value();
  if (!drone) return res.status(404).json({ message: 'Drone not found' });

  db.get('drones').find(d => d.id === droneId).assign({
    name, serial_number: serialNumber, model,
    firmware_version: firmwareVersion, status,
    updated_at: new Date().toISOString(),
  }).write();

  res.json(db.get('drones').find(d => d.id === droneId).value());
});

// DELETE /api/drones/:id
router.delete('/:id', (req, res) => {
  const droneId = Number(req.params.id);
  const drone = db.get('drones').find(d => d.id === droneId && d.user_id === req.user.id).value();
  if (!drone) return res.status(404).json({ message: 'Drone not found' });

  db.get('drones').remove(d => d.id === droneId).write();
  db.get('predictions').remove(p => p.drone_id === droneId).write();
  res.json({ success: true });
});

module.exports = router;
