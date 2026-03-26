const router = require('express').Router();
const auth   = require('../middleware/auth');
const { Drones } = require('../database');

router.use(auth);

// GET /api/drones
router.get('/', (req, res) => {
  res.json(Drones.listForUser.all(req.user.id));
});

// GET /api/drones/:id
router.get('/:id', (req, res) => {
  const drone = Drones.findById.get(Number(req.params.id));
  if (!drone || drone.user_id !== req.user.id)
    return res.status(404).json({ message: 'Drone not found' });
  res.json(drone);
});

// POST /api/drones
router.post('/', (req, res) => {
  const { name, serialNumber, model, firmwareVersion, status } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });

  const drone = Drones.create({
    user_id:    req.user.id,
    name,
    serial_num: serialNumber   || null,
    model:      model          || null,
    firmware:   firmwareVersion|| null,
    status:     status         || 'active',
  });
  res.status(201).json(drone);
});

// PUT /api/drones/:id
router.put('/:id', (req, res) => {
  const droneId = Number(req.params.id);
  const drone   = Drones.findById.get(droneId);
  if (!drone || drone.user_id !== req.user.id)
    return res.status(404).json({ message: 'Drone not found' });

  const { name, serialNumber, model, firmwareVersion, status } = req.body;
  const updated = Drones.update(droneId, {
    name:       name            || drone.name,
    serial_num: serialNumber    ?? drone.serial_num,
    model:      model           ?? drone.model,
    firmware:   firmwareVersion ?? drone.firmware,
    status:     status          || drone.status,
  });
  res.json(updated);
});

// DELETE /api/drones/:id
router.delete('/:id', (req, res) => {
  const droneId = Number(req.params.id);
  const drone   = Drones.findById.get(droneId);
  if (!drone || drone.user_id !== req.user.id)
    return res.status(404).json({ message: 'Drone not found' });

  Drones.delete(droneId);   // cascades to predictions + alerts via FK
  res.json({ success: true });
});

module.exports = router;
