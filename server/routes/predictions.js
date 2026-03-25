const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { db, nextId } = require('../db');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { spawn } = require('child_process');

router.use(authMiddleware);

// ── directories ───────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../uploads');
const resultsDir = path.join(__dirname, '../uploads/results');
[uploadsDir, resultsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── multer: accept image + video ──────────────────────────────────────────────
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/bmp', 'image/gif', 'image/webp']);
const VIDEO_MIMES_RE = /^video\//;

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_MIMES.has(file.mimetype) || VIDEO_MIMES_RE.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image or video files are allowed'));
  },
});

// ── detect script path ────────────────────────────────────────────────────────
const DETECT_SCRIPT = path.resolve(__dirname, '../../detect/detect.py');

// ── run Python detection, returns parsed JSON result ─────────────────────────
function runDetection(inputPath, outputPath, conf = 0.25) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', [
      DETECT_SCRIPT,
      '--input', inputPath,
      '--output', outputPath,
      '--conf', String(conf),
    ]);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      if (code !== 0) {
        console.error('[detect stderr]', stderr.slice(-500));
        return reject(new Error(`Detection process exited with code ${code}`));
      }
      try {
        // last non-empty JSON line (script may print warnings before JSON)
        const lines = stdout.split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));
        const parsed = JSON.parse(lines[lines.length - 1]);
        if (parsed.error) return reject(new Error(parsed.error));
        resolve(parsed);
      } catch (e) {
        console.error('[detect stdout]', stdout.slice(-200));
        reject(new Error('Failed to parse detection output'));
      }
    });
  });
}

// ── helpers ───────────────────────────────────────────────────────────────────
function parsePrediction(p) {
  return {
    ...p,
    detections: Array.isArray(p.detections) ? p.detections : JSON.parse(p.detections || '[]'),
    has_result: Boolean(p.has_result),
    feedback_accurate: p.feedback_accurate !== null && p.feedback_accurate !== undefined
      ? Boolean(p.feedback_accurate) : null,
  };
}

function isImageMime(mime) { return IMAGE_MIMES.has(mime); }

// ── GET /api/predictions?droneId=X ───────────────────────────────────────────
router.get('/', (req, res) => {
  const { droneId } = req.query;
  if (!droneId) return res.status(400).json({ message: 'droneId is required' });

  const drone = db.get('drones').find(d => d.id === Number(droneId) && d.user_id === req.user.id).value();
  if (!drone) return res.status(403).json({ message: 'Drone not found or access denied' });

  const predictions = db.get('predictions')
    .filter(p => p.drone_id === Number(droneId) && p.user_id === req.user.id)
    .orderBy(['uploaded_at'], ['desc'])
    .value()
    .map(parsePrediction);

  res.json(predictions);
});

// ── GET /api/predictions/:id ──────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const p = db.get('predictions').find(p => p.id === Number(req.params.id) && p.user_id === req.user.id).value();
  if (!p) return res.status(404).json({ message: 'Prediction not found' });
  res.json(parsePrediction(p));
});

// ── POST /api/predictions/upload ──────────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req, res) => {
  const { droneId, name, conf } = req.body;
  if (!droneId) return res.status(400).json({ message: 'droneId is required' });
  if (!req.file)  return res.status(400).json({ message: 'No file uploaded' });

  const drone = db.get('drones').find(d => d.id === Number(droneId) && d.user_id === req.user.id).value();
  if (!drone) return res.status(403).json({ message: 'Drone not found or access denied' });

  const isImage = isImageMime(req.file.mimetype);
  const inputPath = req.file.path;
  // detect.py now writes H.264 MP4 via PyAV (browser-compatible)
  const ext = isImage ? path.extname(req.file.originalname).toLowerCase() || '.jpg' : '.mp4';
  const outputFilename = `result_${uuidv4()}${ext}`;
  const outputPath = path.join(resultsDir, outputFilename);
  const fileUrl = `/uploads/${req.file.filename}`;
  // resultUrl resolved after detection since detect.py controls the actual output path


  try {
    console.log(`🔍 Running detection on ${isImage ? 'image' : 'video'}: ${req.file.originalname}`);
    const detection = await runDetection(inputPath, outputPath, parseFloat(conf) || 0.25);
    console.log(`✅ Detection done in ${detection.elapsed_seconds}s – ${detection.total_detections} unique class(es)`);

    // detect.py returns the actual output_path (may differ in extension for video)
    const actualOutputPath = detection.output_path || outputPath;
    const actualFilename = path.basename(actualOutputPath);
    const resultUrl = `/uploads/results/${actualFilename}`;

    const detections = detection.detections || [];

    const prediction = {
      id: nextId('predictions'),
      drone_id: Number(droneId),
      user_id: req.user.id,
      name: name || req.file.originalname || `Upload_${Date.now()}`,
      uploaded_at: new Date().toISOString(),
      media_type: isImage ? 'image' : 'video',
      file_url: fileUrl,         // original upload (kept for compatibility as video_url)
      video_url: fileUrl,        // legacy field
      result_url: resultUrl,     // annotated output
      has_result: true,
      detections,
      frame_results: detection.frame_results || [],
      elapsed_seconds: detection.elapsed_seconds,
      feedback_accurate: null,
      feedback_comment: null,
    };
    db.get('predictions').push(prediction).write();

    // ── Auto-alert on dangerous detections ───────────────────────────────────
    const DANGEROUS_LABELS = new Set(['drowning', 'drown', 'person_distress', 'swimmer', 'person']);
    const dangerous = detections.filter(d =>
      DANGEROUS_LABELS.has(d.label.toLowerCase()) && d.confidence >= 0.60
    );
    if (dangerous.length > 0) {
      const top = dangerous.sort((a, b) => b.confidence - a.confidence)[0];
      const alert = {
        id: nextId('alerts'),
        prediction_id: prediction.id,
        drone_id: Number(droneId),
        user_id: req.user.id,
        type: top.label.toLowerCase().includes('distress') ? 'PERSON_IN_DISTRESS' : 'SWIMMER_DETECTED',
        severity: top.confidence >= 0.85 ? 'CRITICAL' : 'HIGH',
        message: `[${drone.name}] ${top.label} detected with ${(top.confidence * 100).toFixed(0)}% confidence`,
        resolved: false,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };
      db.get('alerts').push(alert).write();
      console.log(`🚨 ALERT: ${alert.message}`);
    }

    res.status(201).json(parsePrediction(prediction));
  } catch (err) {
    console.error('[upload] detection failed:', err.message);
    // clean up uploaded file on failure
    try { fs.unlinkSync(inputPath); } catch (_) {}
    res.status(500).json({ message: `Detection failed: ${err.message}` });
  }
});

// ── POST /api/predictions/:id/feedback ───────────────────────────────────────
router.post('/:id/feedback', (req, res) => {
  const { accurate, comment } = req.body;
  const predId = Number(req.params.id);
  const p = db.get('predictions').find(p => p.id === predId && p.user_id === req.user.id).value();
  if (!p) return res.status(404).json({ message: 'Prediction not found' });
  db.get('predictions').find(p => p.id === predId).assign({
    feedback_accurate: Boolean(accurate),
    feedback_comment: comment || '',
  }).write();
  res.json({ success: true });
});

// ── DELETE /api/predictions/:id ───────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const predId = Number(req.params.id);
  const p = db.get('predictions').find(p => p.id === predId && p.user_id === req.user.id).value();
  if (!p) return res.status(404).json({ message: 'Prediction not found' });

  // delete original + result files
  [p.file_url, p.video_url, p.result_url].filter(Boolean).forEach(url => {
    const fp = path.join(__dirname, '..', url);
    if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (_) {} }
  });
  db.get('predictions').remove(p => p.id === predId).write();
  db.get('alerts').remove(a => a.prediction_id === predId).write();
  res.json({ success: true });
});

module.exports = router;
