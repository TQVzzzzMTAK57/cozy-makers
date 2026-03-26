require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const { bootstrap } = require('./database');

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
app.use(cors({
  origin: ['http://localhost:8080', 'http://[::1]:8080', 'http://[::]:8080', 'http://localhost:5173'],
  credentials: true,
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir, {
  acceptRanges: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.avi')) res.setHeader('Content-Type', 'video/x-msvideo');
  },
}));

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/drones',      require('./routes/drones'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/alerts',      require('./routes/alerts'));
app.use('/api/admin',       require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use((req, res) => res.status(404).json({ message: 'Not found' }));

const PORT = process.env.PORT || 3001;

// ── Boot: connect PostgreSQL first, then start HTTP server ────────────────────
bootstrap()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 AI Drowning Detection API  →  http://localhost:${PORT}`);
      console.log(`📂 Uploads  →  ${uploadsDir}\n`);
    });
  })
  .catch(err => {
    console.error('\n❌ Failed to connect to PostgreSQL:', err.message);
    console.error('   Check your .env file (PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE)\n');
    process.exit(1);
  });
