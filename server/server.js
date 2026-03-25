const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
app.use(cors({
  origin: ['http://localhost:8080', 'http://[::1]:8080', 'http://[::]:8080', 'http://localhost:5173'],
  credentials: true,
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
}));
app.use(express.json());
// express.static supports Range requests (byte serving) out of the box; make it explicit
// Also set correct MIME type for .avi (MJPEG) so browsers can play it
app.use('/uploads', express.static(uploadsDir, {
  acceptRanges: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.avi')) {
      res.setHeader('Content-Type', 'video/x-msvideo');
    }
  },
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/drones', require('./routes/drones'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use((req, res) => res.status(404).json({ message: 'Not found' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 AI Drowning Detection API  →  http://localhost:${PORT}`);
  console.log(`📂 Uploads  →  ${uploadsDir}\n`);
});
