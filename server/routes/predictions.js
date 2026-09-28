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

const DETECT_SCRIPT     = path.resolve(__dirname, '../../detect/detect.py');
const PYTHON_BIN        = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
const DETECT_TIMEOUT_MS = Number(process.env.DETECT_TIMEOUT_MS) || 30 * 60 * 1000;

// detect.py prints a single JSON object on its last "{"-line, including on failure ({"error": ...})
function parseDetectOutput(stdout) {
  const lines = stdout.split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));
  if (!lines.length) return null;
  try { return JSON.parse(lines[lines.length - 1]); } catch { return null; }
}

function runDetection(inputPath, outputPath, conf = 0.25, model = 'yolo11') {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [
      DETECT_SCRIPT,
      '--input',  inputPath,
      '--output', outputPath,
      '--conf',   String(conf),
      '--model',  model,
    ]);
    let stdout = '', stderr = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; proc.kill(); }, DETECT_TIMEOUT_MS);
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', err => { clearTimeout(timer); reject(new Error(`Cannot start ${PYTHON_BIN}: ${err.message}`)); });
    proc.on('close', code => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error(`Detection timed out after ${Math.round(DETECT_TIMEOUT_MS / 1000)}s`));
      const parsed = parseDetectOutput(stdout);
      if (code !== 0) {
        console.error('[detect stderr]', stderr.slice(-500));
        return reject(new Error(parsed?.error || `Detection exited ${code}`));
      }
      if (!parsed) return reject(new Error('Failed to parse detection output'));
      if (parsed.error) return reject(new Error(parsed.error));
      resolve(parsed);
    });
  });
}

// Labels that raise an alert, and the minimum confidence. Override in .env, e.g.
//   ALERT_LABELS=drowning,swimmer   ALERT_MIN_CONFIDENCE=0.7
const ALERT_LABELS = new Set(
  (process.env.ALERT_LABELS || 'drowning,drown,person_distress,swimmer,person')
    .split(',').map(l => l.trim().toLowerCase()).filter(Boolean)
);
const ALERT_MIN_CONFIDENCE = Number(process.env.ALERT_MIN_CONFIDENCE) || 0.60;

// Creates at most one alert for the most confident dangerous detection across the given results.
// Runs after predictions are saved, so a failure here is logged but never fails the request.
async function createAutoAlert(results, drone, userId) {
  try {
    let best = null;
    for (const { prediction, detections, model } of results) {
      for (const d of detections || []) {
        if (!ALERT_LABELS.has(String(d.label).toLowerCase()) || d.confidence < ALERT_MIN_CONFIDENCE) continue;
        if (!best || d.confidence > best.det.confidence) best = { det: d, prediction, model };
      }
    }
    if (!best) return;
    const { det, prediction, model } = best;
    const alert = await Alerts.create({
      prediction_id: prediction.id,
      drone_id:      drone.id,
      user_id:       userId,
      label:         det.label,
      confidence:    det.confidence,
      message:       `[${drone.name}]${model ? ` [${model}]` : ''} ${det.label} detected with ${(det.confidence * 100).toFixed(0)}% confidence`,
    });
    console.log(`🚨 ALERT: ${alert.message}`);
  } catch (err) {
    console.error('[alert] creation failed:', err.message);
  }
}

function removeFiles(...paths) {
  paths.filter(Boolean).forEach(fp => { try { fs.unlinkSync(fp); } catch (_) {} });
}

// Result files may get a different extension than requested (e.g. .avi fallback)
function detectionOutputFiles(det, requestedPath) {
  return [requestedPath, det?.output_path].filter(Boolean);
}

// Multer errors (wrong type, too large) → JSON 400 instead of Express's HTML error page
function uploadSingle(field) {
  const mw = upload.single(field);
  return (req, res, next) => mw(req, res, err => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 500MB)' : err.message;
    res.status(400).json({ message });
  });
}

// Validates droneId from the form body and checks ownership; removes the upload on rejection
async function requireOwnedDrone(req, res) {
  const droneId = Number(req.body.droneId);
  if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return null; }
  if (!Number.isInteger(droneId) || droneId <= 0) {
    removeFiles(req.file.path);
    res.status(400).json({ message: 'droneId is required' });
    return null;
  }
  const drone = await Drones.findById(droneId);
  if (!drone || drone.user_id !== req.user.id) {
    removeFiles(req.file.path);
    res.status(403).json({ message: 'Drone not found or access denied' });
    return null;
  }
  return drone;
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
router.post('/upload', uploadSingle('file'), async (req, res) => {
  const { droneId, name, conf, model } = req.body;
  const modelKey = ['yolo11','yolo26'].includes(model) ? model : 'yolo11';

  let drone;
  try {
    drone = await requireOwnedDrone(req, res);
  } catch (err) {
    console.error('[upload] drone lookup failed:', err.message);
    removeFiles(req.file?.path);
    return res.status(500).json({ message: 'Server error' });
  }
  if (!drone) return;

  const isImage    = IMAGE_MIMES.has(req.file.mimetype);
  const inputPath  = req.file.path;
  const ext        = isImage ? path.extname(req.file.originalname).toLowerCase() || '.jpg' : '.mp4';
  const outputPath = path.join(resultsDir, `result_${uuidv4()}${ext}`);
  const fileUrl    = `/uploads/${req.file.filename}`;

  let detection;
  try {
    console.log(`🔍 Running detection [${modelKey.toUpperCase()}]: ${req.file.originalname}`);
    detection = await runDetection(inputPath, outputPath, parseFloat(conf) || 0.25, modelKey);
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

    await createAutoAlert([{ prediction, detections }], drone, req.user.id);

    res.status(201).json(prediction);
  } catch (err) {
    console.error('[upload] detection failed:', err.message);
    removeFiles(inputPath, ...detectionOutputFiles(detection, outputPath));
    res.status(500).json({ message: `Detection failed: ${err.message}` });
  }
});

// POST /api/predictions/compare   — run BOTH models on the same file
router.post('/compare', uploadSingle('file'), async (req, res) => {
  const { droneId, name, conf } = req.body;

  let drone;
  try {
    drone = await requireOwnedDrone(req, res);
  } catch (err) {
    console.error('[compare] drone lookup failed:', err.message);
    removeFiles(req.file?.path);
    return res.status(500).json({ message: 'Server error' });
  }
  if (!drone) return;

  const isImage   = IMAGE_MIMES.has(req.file.mimetype);
  const inputPath = req.file.path;
  const ext       = isImage ? path.extname(req.file.originalname).toLowerCase() || '.jpg' : '.mp4';
  const fileUrl   = `/uploads/${req.file.filename}`;
  const threshold = parseFloat(conf) || 0.25;

  const outputY11 = path.join(resultsDir, `cmp_yolo11_${uuidv4()}${ext}`);
  const outputY26 = path.join(resultsDir, `cmp_yolo26_${uuidv4()}${ext}`);

  let det11, det26;
  try {
    console.log(`🔍 COMPARE: running YOLO11 & YOLO26 in parallel on ${req.file.originalname}`);

    // allSettled so a failure in one model still lets us clean up the other's output
    const [r11, r26] = await Promise.allSettled([
      runDetection(inputPath, outputY11, threshold, 'yolo11'),
      runDetection(inputPath, outputY26, threshold, 'yolo26'),
    ]);
    det11 = r11.value;
    det26 = r26.value;
    if (r11.status === 'rejected') throw r11.reason;
    if (r26.status === 'rejected') throw r26.reason;

    console.log(`✅ YOLO11: ${det11.total_detections} detections in ${det11.elapsed_seconds}s`);
    console.log(`✅ YOLO26: ${det26.total_detections} detections in ${det26.elapsed_seconds}s`);

    const buildPred = async (det, outputP, modelName) => {
      const actualFile = path.basename(det.output_path || outputP);
      return Predictions.create({
        drone_id:       Number(droneId),
        user_id:        req.user.id,
        name:           `[${modelName}] ${name || req.file.originalname}`,
        media_type:     isImage ? 'image' : 'video',
        file_url:       fileUrl,
        result_url:     `/uploads/results/${actualFile}`,
        has_result:     true,
        detections:     det.detections     || [],
        frame_results:  det.frame_results  || [],
        drone_gps:      det.drone_gps      || null,
        image_size:     det.image_size     || null,
        elapsed_seconds: det.elapsed_seconds,
        uploaded_at:    new Date().toISOString(),
      });
    };

    const [pred11, pred26] = await Promise.all([
      buildPred(det11, outputY11, 'YOLO11'),
      buildPred(det26, outputY26, 'YOLO26'),
    ]);

    await createAutoAlert([
      { prediction: pred11, detections: pred11.detections, model: 'YOLO11' },
      { prediction: pred26, detections: pred26.detections, model: 'YOLO26' },
    ], drone, req.user.id);

    res.status(201).json({
      yolo11: pred11,
      yolo26: pred26,
    });
  } catch (err) {
    console.error('[compare] detection failed:', err.message);
    removeFiles(inputPath, ...detectionOutputFiles(det11, outputY11), ...detectionOutputFiles(det26, outputY26));
    res.status(500).json({ message: `Compare failed: ${err.message}` });
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
    await Predictions.delete(predId);
    // Compare mode shares the uploaded file between two predictions – keep it while still referenced
    for (const url of [p.file_url, p.result_url].filter(Boolean)) {
      if (await Predictions.countByUrl(url) > 0) continue;
      const fp = path.resolve(__dirname, '..', '.' + url);
      if (fp.startsWith(uploadsDir + path.sep)) removeFiles(fp);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
