const router = require('express').Router();
const auth   = require('../middleware/auth');
const { Drones, Predictions, Alerts, db } = require('../database');
const multer  = require('multer');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');
const fs      = require('fs');
const { spawn } = require('child_process');

router.use(auth);

// ── directories ───────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../uploads');
const resultsDir = path.join(__dirname, '../uploads/results');
[uploadsDir, resultsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── multer ─────────────────────────────────────────────────────────────────────
const IMAGE_MIMES   = new Set(['image/jpeg','image/png','image/bmp','image/gif','image/webp']);
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

// ── Python detection ──────────────────────────────────────────────────────────
const DETECT_SCRIPT = path.resolve(__dirname, '../../detect/detect.py');

function runDetection(inputPath, outputPath, conf = 0.25) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', [DETECT_SCRIPT, '--input', inputPath, '--output', outputPath, '--conf', String(conf)]);
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      if (code !== 0) {
        console.error('[detect stderr]', stderr.slice(-500));
        return reject(new Error(`Detection process exited with code ${code}`));
      }
      try {
        const lines = stdout.split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));
        const parsed = JSON.parse(lines[lines.length - 1]);
        if (parsed.error) return reject(new Error(parsed.error));
        resolve(parsed);
      } catch {
        console.error('[detect stdout]', stdout.slice(-200));
        reject(new Error('Failed to parse detection output'));
      }
    });
  });
}

// ── GET /api/predictions?droneId=X ───────────────────────────────────────────
router.get('/', (req, res) => {
  const { droneId } = req.query;
  if (!droneId) return res.status(400).json({ message: 'droneId is required' });

  const drone = Drones.findById.get(Number(droneId));
  if (!drone || drone.user_id !== req.user.id)
    return res.status(403).json({ message: 'Drone not found or access denied' });

  const rows = db.prepare(`
    SELECT p.*, d.name AS drone_name
    FROM predictions p JOIN drones d ON d.id=p.drone_id
    WHERE p.drone_id=? AND p.user_id=? ORDER BY p.id DESC
  `).all(Number(droneId), req.user.id);

  res.json(rows.map(r => Predictions.findById ? Predictions.findById(r.id) : r));
});

// ── GET /api/predictions/:id ──────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const p = Predictions.findById(Number(req.params.id));
  if (!p || p.user_id !== req.user.id)
    return res.status(404).json({ message: 'Prediction not found' });
  res.json(p);
});

// ── POST /api/predictions/upload ──────────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req, res) => {
  const { droneId, name, conf } = req.body;
  if (!droneId)    return res.status(400).json({ message: 'droneId is required' });
  if (!req.file)   return res.status(400).json({ message: 'No file uploaded' });

  const drone = Drones.findById.get(Number(droneId));
  if (!drone || drone.user_id !== req.user.id)
    return res.status(403).json({ message: 'Drone not found or access denied' });

  const isImage    = IMAGE_MIMES.has(req.file.mimetype);
  const inputPath  = req.file.path;
  const ext        = isImage ? path.extname(req.file.originalname).toLowerCase() || '.jpg' : '.mp4';
  const outputPath = path.join(resultsDir, `result_${uuidv4()}${ext}`);
  const fileUrl    = `/uploads/${req.file.filename}`;

  try {
    console.log(`🔍 Running detection on ${isImage ? 'image' : 'video'}: ${req.file.originalname}`);
    const detection = await runDetection(inputPath, outputPath, parseFloat(conf) || 0.25);
    console.log(`✅ Detection done in ${detection.elapsed_seconds}s – ${detection.total_detections} detections`);

    const actualFilename = path.basename(detection.output_path || outputPath);
    const resultUrl      = `/uploads/results/${actualFilename}`;
    const detections     = detection.detections || [];

    // ─── Save to SQLite ───────────────────────────────────────────────────────
    const prediction = Predictions.create({
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

    // ─── Auto-alert on dangerous detections ──────────────────────────────────
    const DANGEROUS = new Set(['drowning','drown','person_distress','swimmer','person']);
    const dangerous = detections.filter(d => DANGEROUS.has(d.label.toLowerCase()) && d.confidence >= 0.60);
    if (dangerous.length > 0) {
      const top = dangerous.sort((a, b) => b.confidence - a.confidence)[0];
      const alert = Alerts.create({
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

// ── POST /api/predictions/:id/feedback ───────────────────────────────────────
router.post('/:id/feedback', (req, res) => {
  const { accurate, comment } = req.body;
  const predId = Number(req.params.id);
  const p = Predictions.findById(predId);
  if (!p || p.user_id !== req.user.id)
    return res.status(404).json({ message: 'Prediction not found' });

  const updated = Predictions.updateFeedback(predId, Boolean(accurate), comment || '');
  res.json({ success: true, prediction: updated });
});

// ── DELETE /api/predictions/:id ───────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const predId = Number(req.params.id);
  const p = Predictions.findById(predId);
  if (!p || p.user_id !== req.user.id)
    return res.status(404).json({ message: 'Prediction not found' });

  // Remove files from disk
  [p.file_url, p.result_url].filter(Boolean).forEach(url => {
    const fp = path.join(__dirname, '..', url);
    if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (_) {} }
  });

  Predictions.delete(predId);   // FK cascade removes related alerts
  res.json({ success: true });
});

module.exports = router;
