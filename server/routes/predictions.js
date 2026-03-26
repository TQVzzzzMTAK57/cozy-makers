const router = require('express').Router();
const auth   = require('../middleware/auth');
const { Drones, Predictions, Alerts, query } = require('../database');
const multer  = require('multer');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');
const fs      = require('fs');
const { spawn } = require('child_process');

router.use(auth);

const uploadsDir = path.join(__dirname, '../uploads');
const resultsDir = path.join(__dirname, '../uploads/results');
[uploadsDir, resultsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const IMAGE_MIMES    = new Set(['image/jpeg','image/png','image/bmp','image/gif','image/webp']);
const VIDEO_MIMES_RE = /^video\//;

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_MIMES.has(file.mimetype) || VIDEO_MIMES_RE.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image or video files are allowed'));
  },
});

const DETECT_SCRIPT = path.resolve(__dirname, '../../detect/detect.py');

function runDetection(inputPath, outputPath, conf = 0.25) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', [DETECT_SCRIPT, '--input', inputPath, '--output', outputPath, '--conf', String(conf)]);
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      if (code !== 0) { console.error('[detect stderr]', stderr.slice(-500)); return reject(new Error(`Detection exited ${code}`)); }
      try {
        const lines = stdout.split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));
        const parsed = JSON.parse(lines[lines.length - 1]);
        if (parsed.error) return reject(new Error(parsed.error));
        resolve(parsed);
      } catch { reject(new Error('Failed to parse detection output')); }
    });
  });
}

// GET /api/predictions?droneId=X
router.get('/', async (req, res) => {
  try {
    const { droneId } = req.query;
    if (!droneId) return res.status(400).json({ message: 'droneId is required' });
    const drone = await Drones.findById(Number(droneId));
    if (!drone || drone.user_id !== req.user.id)
      return res.status(403).json({ message: 'Drone not found or access denied' });
    const rows = await query(`
      SELECT p.*, d.name AS drone_name
      FROM predictions p JOIN drones d ON d.id=p.drone_id
      WHERE p.drone_id=$1 AND p.user_id=$2 ORDER BY p.id DESC
    `, [Number(droneId), req.user.id]);
    // Fetch full expanded predictions
    res.json(await Promise.all(rows.map(r => Predictions.findById(r.id))));
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// GET /api/predictions/:id
router.get('/:id', async (req, res) => {
  try {
    const p = await Predictions.findById(Number(req.params.id));
    if (!p || p.user_id !== req.user.id)
      return res.status(404).json({ message: 'Prediction not found' });
    res.json(p);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// POST /api/predictions/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  const { droneId, name, conf } = req.body;
  if (!droneId)  return res.status(400).json({ message: 'droneId is required' });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const drone = await Drones.findById(Number(droneId));
  if (!drone || drone.user_id !== req.user.id)
    return res.status(403).json({ message: 'Drone not found or access denied' });

  const isImage    = IMAGE_MIMES.has(req.file.mimetype);
  const inputPath  = req.file.path;
  const ext        = isImage ? path.extname(req.file.originalname).toLowerCase() || '.jpg' : '.mp4';
  const outputPath = path.join(resultsDir, `result_${uuidv4()}${ext}`);
  const fileUrl    = `/uploads/${req.file.filename}`;

  try {
    console.log(`🔍 Running detection: ${req.file.originalname}`);
    const detection = await runDetection(inputPath, outputPath, parseFloat(conf) || 0.25);
    console.log(`✅ Done in ${detection.elapsed_seconds}s – ${detection.total_detections} detections`);

    const actualFilename = path.basename(detection.output_path || outputPath);
    const resultUrl      = `/uploads/results/${actualFilename}`;
    const detections     = detection.detections || [];

    const prediction = await Predictions.create({
      drone_id:       Number(droneId),
      user_id:        req.user.id,
      name:           name || req.file.originalname || `Upload_${Date.now()}`,
      media_type:     isImage ? 'image' : 'video',
      file_url:       fileUrl,
      result_url:     resultUrl,
      has_result:     true,
      detections,
      frame_results:  detection.frame_results  || [],
      drone_gps:      detection.drone_gps      || null,
      image_size:     detection.image_size     || null,
      elapsed_seconds: detection.elapsed_seconds,
      uploaded_at:    new Date().toISOString(),
    });

    // Auto-alert
    const DANGEROUS = new Set(['drowning','drown','person_distress','swimmer','person']);
    const dangerous = detections.filter(d => DANGEROUS.has(d.label.toLowerCase()) && d.confidence >= 0.60);
    if (dangerous.length > 0) {
      const top = dangerous.sort((a, b) => b.confidence - a.confidence)[0];
      const alert = await Alerts.create({
        prediction_id: prediction.id,
        drone_id:      Number(droneId),
        user_id:       req.user.id,
        label:         top.label,
        confidence:    top.confidence,
        message:       `[${drone.name}] ${top.label} detected with ${(top.confidence * 100).toFixed(0)}% confidence`,
      });
      console.log(`🚨 ALERT: ${alert.message}`);
    }

    res.status(201).json(prediction);
  } catch (err) {
    console.error('[upload] detection failed:', err.message);
    try { fs.unlinkSync(inputPath); } catch (_) {}
    res.status(500).json({ message: `Detection failed: ${err.message}` });
  }
});

// POST /api/predictions/:id/feedback
router.post('/:id/feedback', async (req, res) => {
  try {
    const { accurate, comment } = req.body;
    const predId = Number(req.params.id);
    const p = await Predictions.findById(predId);
    if (!p || p.user_id !== req.user.id)
      return res.status(404).json({ message: 'Prediction not found' });
    const updated = await Predictions.updateFeedback(predId, Boolean(accurate), comment || '');
    res.json({ success: true, prediction: updated });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// DELETE /api/predictions/:id
router.delete('/:id', async (req, res) => {
  try {
    const predId = Number(req.params.id);
    const p = await Predictions.findById(predId);
    if (!p || p.user_id !== req.user.id)
      return res.status(404).json({ message: 'Prediction not found' });
    [p.file_url, p.result_url].filter(Boolean).forEach(url => {
      const fp = path.join(__dirname, '..', url);
      if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (_) {} }
    });
    await Predictions.delete(predId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
