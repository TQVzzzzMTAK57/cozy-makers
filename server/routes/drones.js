const router = require('express').Router();
const auth   = require('../middleware/auth');
const { Drones } = require('../database');
const { toDbStatus, droneToResponse: toResponse } = require('../drone-status');

router.use(auth);

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
      status:     toDbStatus(status),
    });
    res.status(201).json(toResponse(drone));
  } catch (err) {
    console.error('Create drone error:', err.message);
    res.status(500).json({ message: 'Server error' });
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
      status:     status ? toDbStatus(status) : drone.status,
    });
    res.json(toResponse(updated));
  } catch (err) {
    console.error('Update drone error:', err.message);
    res.status(500).json({ message: 'Server error' });
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
