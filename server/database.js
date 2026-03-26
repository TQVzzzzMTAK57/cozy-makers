/**
 * database.js  –  SQLite layer for SeaDrone AI Detection System
 *
 * Tables:
 *   users        – accounts (admin / user roles)
 *   drones       – drone fleet
 *   predictions  – detection jobs (image + video) with YOLO results
 *   alerts       – auto-generated danger alerts
 *
 * Uses better-sqlite3 (synchronous SQLite, perfect for Express).
 */

const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = path.join(__dirname, 'seadrone.db');
const db = new Database(DB_PATH);

// ── Performance settings ────────────────────────────────────────────────────
db.pragma('journal_mode = WAL');   // Write-Ahead Logging – concurrent reads
db.pragma('foreign_keys = ON');    // enforce FK constraints

// ── Schema creation ─────────────────────────────────────────────────────────
db.exec(`
  -- ── Users ────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT    NOT NULL UNIQUE,
    email        TEXT    NOT NULL UNIQUE,
    password     TEXT    NOT NULL,
    full_name    TEXT,
    role         TEXT    NOT NULL DEFAULT 'user'          CHECK(role IN ('admin','user')),
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Drones ───────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS drones (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    model        TEXT,
    serial_num   TEXT,
    firmware     TEXT,
    status       TEXT    NOT NULL DEFAULT 'active'        CHECK(status IN ('active','inactive','maintenance')),
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Predictions ───────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS predictions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    drone_id         INTEGER NOT NULL REFERENCES drones(id) ON DELETE CASCADE,
    user_id          INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    name             TEXT,
    media_type       TEXT    NOT NULL DEFAULT 'image'     CHECK(media_type IN ('image','video')),
    file_url         TEXT,
    result_url       TEXT,
    has_result       INTEGER NOT NULL DEFAULT 0,
    detections_json  TEXT    NOT NULL DEFAULT '[]',    -- JSON array of detection objects
    frame_results_json TEXT  NOT NULL DEFAULT '[]',
    drone_gps_json   TEXT,                             -- JSON {lat,lon,alt} | NULL
    image_size_json  TEXT,                             -- JSON [w,h] | NULL
    total_detections INTEGER NOT NULL DEFAULT 0,
    elapsed_seconds  REAL,
    feedback_accurate INTEGER,                         -- NULL | 1 | 0
    feedback_comment TEXT,
    uploaded_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Alerts ────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS alerts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    prediction_id INTEGER NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
    drone_id      INTEGER NOT NULL REFERENCES drones(id)      ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
    label         TEXT    NOT NULL,
    confidence    REAL    NOT NULL,
    message       TEXT,
    acknowledged  INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Indexes ───────────────────────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_drones_user       ON drones(user_id);
  CREATE INDEX IF NOT EXISTS idx_predictions_drone ON predictions(drone_id);
  CREATE INDEX IF NOT EXISTS idx_predictions_user  ON predictions(user_id);
  CREATE INDEX IF NOT EXISTS idx_alerts_user       ON alerts(user_id);
  CREATE INDEX IF NOT EXISTS idx_alerts_pred       ON alerts(prediction_id);
`);

// ── JSON helpers ─────────────────────────────────────────────────────────────
const toJSON = (v) => v == null ? null : JSON.stringify(v);
const fromJSON = (v) => {
  if (v == null) return null;
  try { return JSON.parse(v); } catch { return v; }
};

/** Expand JSON fields of a prediction row into proper JS objects */
function expandPrediction(row) {
  if (!row) return null;
  return {
    ...row,
    detections:    fromJSON(row.detections_json)    || [],
    frame_results: fromJSON(row.frame_results_json) || [],
    drone_gps:     fromJSON(row.drone_gps_json)     || null,
    image_size:    fromJSON(row.image_size_json)    || null,
    has_result:    !!row.has_result,
    feedback_accurate: row.feedback_accurate === null ? null : !!row.feedback_accurate,
    // legacy alias
    video_url: row.file_url,
  };
}

// ── Migration: import from lowdb data.json if it exists ─────────────────────
const DATA_JSON = path.join(__dirname, 'data.json');
const MIGRATED_FLAG = path.join(__dirname, '.migrated');

if (fs.existsSync(DATA_JSON) && !fs.existsSync(MIGRATED_FLAG)) {
  // Temporarily disable FK enforcement so we can bulk-insert in any order
  db.pragma('foreign_keys = OFF');
  try {
    const data = JSON.parse(fs.readFileSync(DATA_JSON, 'utf8'));

    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, username, email, password, full_name, role, is_active, created_at)
      VALUES (@id, @username, @email, @password, @full_name, @role, @is_active, @created_at)
    `);
    const insertDrone = db.prepare(`
      INSERT OR IGNORE INTO drones (id, user_id, name, model, serial_num, firmware, status, created_at)
      VALUES (@id, @user_id, @name, @model, @serial_num, @firmware, @status, @created_at)
    `);
    const insertPred = db.prepare(`
      INSERT OR IGNORE INTO predictions
        (id, drone_id, user_id, name, media_type, file_url, result_url, has_result,
         detections_json, frame_results_json, drone_gps_json, image_size_json,
         total_detections, elapsed_seconds, feedback_accurate, feedback_comment, uploaded_at)
      VALUES
        (@id, @drone_id, @user_id, @name, @media_type, @file_url, @result_url, @has_result,
         @detections_json, @frame_results_json, @drone_gps_json, @image_size_json,
         @total_detections, @elapsed_seconds, @feedback_accurate, @feedback_comment, @uploaded_at)
    `);
    const insertAlert = db.prepare(`
      INSERT OR IGNORE INTO alerts
        (id, prediction_id, drone_id, user_id, label, confidence, message, acknowledged, created_at)
      VALUES
        (@id, @prediction_id, @drone_id, @user_id, @label, @confidence, @message, @acknowledged, @created_at)
    `);

    // Normalize legacy status values to new enum
    const STATUS_MAP = { idle: 'active', active: 'active', maintenance: 'maintenance', offline: 'inactive', inactive: 'inactive' };

    const migrateAll = db.transaction(() => {
      let counts = { users: 0, drones: 0, predictions: 0, alerts: 0 };

      for (const u of data.users || []) {
        insertUser.run({ ...u, full_name: u.full_name || u.username, is_active: u.is_active ? 1 : 0 });
        counts.users++;
      }
      for (const d of data.drones || []) {
        const rawStatus = (d.status || 'active').toLowerCase();
        insertDrone.run({
          id:         d.id,
          user_id:    d.user_id,
          name:       d.name,
          model:      d.model            || null,
          serial_num: d.serial_num       || d.serial_number || null,
          firmware:   d.firmware         || d.firmware_version || null,
          status:     STATUS_MAP[rawStatus] || 'active',
          created_at: d.created_at       || new Date().toISOString(),
        });
        counts.drones++;
      }
      for (const p of data.predictions || []) {
        insertPred.run({
          ...p,
          has_result:         p.has_result ? 1 : 0,
          detections_json:    toJSON(p.detections    || []),
          frame_results_json: toJSON(p.frame_results || []),
          drone_gps_json:     toJSON(p.drone_gps     || null),
          image_size_json:    toJSON(p.image_size    || null),
          total_detections:   (p.detections || []).length,
          feedback_accurate:  p.feedback_accurate === null ? null : (p.feedback_accurate ? 1 : 0),
        });
        counts.predictions++;
      }
      for (const a of data.alerts || []) {
        try {
          insertAlert.run({
            id:            a.id,
            prediction_id: a.prediction_id,
            drone_id:      a.drone_id,
            user_id:       a.user_id,
            label:         a.type || a.label || 'unknown',
            confidence:    a.confidence || 0,
            message:       a.message || '',
            acknowledged:  (a.resolved || a.acknowledged) ? 1 : 0,
            created_at:    a.created_at || new Date().toISOString(),
          });
          counts.alerts++;
        } catch (_) { /* skip malformed alert rows */ }
      }
      return counts;
    });

    const counts = migrateAll();
    fs.writeFileSync(MIGRATED_FLAG, new Date().toISOString());
    console.log(`\n✅ Migrated from data.json → seadrone.db`);
    console.log(`   users=${counts.users} drones=${counts.drones} predictions=${counts.predictions} alerts=${counts.alerts}\n`);
  } catch (err) {
    console.warn('⚠️  Migration warning:', err.message);
  } finally {
    db.pragma('foreign_keys = ON');   // Re-enable for normal operation
  }
}

// ── Seed default accounts if DB is empty ─────────────────────────────────────
const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
if (userCount === 0) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (username, email, password, full_name, role, is_active, created_at)
    VALUES (?, ?, ?, ?, 'admin', 1, ?)
  `).run('admin', 'admin@seadrone.ai', bcrypt.hashSync('Admin@123', 10), 'System Administrator', now);

  db.prepare(`
    INSERT INTO users (username, email, password, full_name, role, is_active, created_at)
    VALUES (?, ?, ?, ?, 'user', 1, ?)
  `).run('user1', 'user1@test.com', bcrypt.hashSync('User@123', 10), 'Demo User', now);

  console.log('\n📦 Seeded default accounts:');
  console.log('  👑 Admin : admin  / Admin@123');
  console.log('  👤 User  : user1  / User@123\n');
}

// Ensure at least one admin
const adminCount = db.prepare("SELECT COUNT(*) as n FROM users WHERE role='admin'").get().n;
if (adminCount === 0) {
  const firstUser = db.prepare('SELECT id, username FROM users ORDER BY id LIMIT 1').get();
  if (firstUser) {
    db.prepare("UPDATE users SET role='admin' WHERE id=?").run(firstUser.id);
    console.log(`✅ Promoted "${firstUser.username}" to admin`);
  }
}

// ── Prepared statement helpers ────────────────────────────────────────────────

// ── Users ─────────────────────────────────────────────────────────────────────
const Users = {
  findByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  findByEmail:    db.prepare('SELECT * FROM users WHERE email = ?'),
  findById:       db.prepare('SELECT * FROM users WHERE id = ?'),
  list:           db.prepare('SELECT id, username, email, full_name, role, is_active, created_at FROM users ORDER BY id'),

  create(data) {
    const r = db.prepare(`
      INSERT INTO users (username, email, password, full_name, role, is_active)
      VALUES (@username, @email, @password, @full_name, @role, @is_active)
    `).run(data);
    return this.findById.get(r.lastInsertRowid);
  },

  update(id, data) {
    const sets = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE users SET ${sets} WHERE id = @id`).run({ ...data, id });
    return this.findById.get(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },
};

// ── Drones ────────────────────────────────────────────────────────────────────
const Drones = {
  findById:      db.prepare('SELECT * FROM drones WHERE id = ?'),
  listForUser:   db.prepare('SELECT * FROM drones WHERE user_id = ? ORDER BY id DESC'),
  listAll:       db.prepare(`
    SELECT d.*, u.username FROM drones d
    JOIN users u ON u.id = d.user_id ORDER BY d.id DESC
  `),

  create(data) {
    const r = db.prepare(`
      INSERT INTO drones (user_id, name, model, serial_num, firmware, status)
      VALUES (@user_id, @name, @model, @serial_num, @firmware, @status)
    `).run({
      model: null, serial_num: null, firmware: null, status: 'active', ...data,
    });
    return this.findById.get(r.lastInsertRowid);
  },

  update(id, data) {
    const sets = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE drones SET ${sets} WHERE id = @id`).run({ ...data, id });
    return this.findById.get(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM drones WHERE id = ?').run(id);
  },

  countForUser(userId) {
    return db.prepare('SELECT COUNT(*) as n FROM drones WHERE user_id = ?').get(userId).n;
  },
};

// ── Predictions ───────────────────────────────────────────────────────────────
const Predictions = {
  findById(id) {
    const row = db.prepare(`
      SELECT p.*, u.username, d.name AS drone_name
      FROM predictions p
      JOIN users  u ON u.id = p.user_id
      JOIN drones d ON d.id = p.drone_id
      WHERE p.id = ?
    `).get(id);
    return expandPrediction(row);
  },

  listForUser(userId) {
    return db.prepare(`
      SELECT p.*, d.name AS drone_name
      FROM predictions p JOIN drones d ON d.id = p.drone_id
      WHERE p.user_id = ? ORDER BY p.id DESC
    `).all(userId).map(expandPrediction);
  },

  listAll() {
    return db.prepare(`
      SELECT p.*, u.username, d.name AS drone_name
      FROM predictions p
      JOIN users  u ON u.id = p.user_id
      JOIN drones d ON d.id = p.drone_id
      ORDER BY p.id DESC
    `).all().map(expandPrediction);
  },

  create(data) {
    const r = db.prepare(`
      INSERT INTO predictions
        (drone_id, user_id, name, media_type, file_url, result_url, has_result,
         detections_json, frame_results_json, drone_gps_json, image_size_json,
         total_detections, elapsed_seconds, uploaded_at)
      VALUES
        (@drone_id, @user_id, @name, @media_type, @file_url, @result_url, @has_result,
         @detections_json, @frame_results_json, @drone_gps_json, @image_size_json,
         @total_detections, @elapsed_seconds, @uploaded_at)
    `).run({
      has_result:          data.has_result ? 1 : 0,
      detections_json:     toJSON(data.detections    || []),
      frame_results_json:  toJSON(data.frame_results || []),
      drone_gps_json:      toJSON(data.drone_gps     || null),
      image_size_json:     toJSON(data.image_size    || null),
      total_detections:    (data.detections || []).length,
      elapsed_seconds:     data.elapsed_seconds ?? null,
      uploaded_at:         data.uploaded_at || new Date().toISOString(),
      drone_id:            data.drone_id,
      user_id:             data.user_id,
      name:                data.name,
      media_type:          data.media_type,
      file_url:            data.file_url ?? null,
      result_url:          data.result_url ?? null,
    });
    return this.findById(r.lastInsertRowid);
  },

  updateFeedback(id, accurate, comment) {
    db.prepare(`
      UPDATE predictions SET feedback_accurate = ?, feedback_comment = ? WHERE id = ?
    `).run(accurate ? 1 : 0, comment || null, id);
    return this.findById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM predictions WHERE id = ?').run(id);
  },
};

// ── Alerts ────────────────────────────────────────────────────────────────────
const Alerts = {
  listForUser(userId) {
    return db.prepare(`
      SELECT a.*, d.name AS drone_name, p.name AS prediction_name
      FROM alerts a
      JOIN drones      d ON d.id = a.drone_id
      JOIN predictions p ON p.id = a.prediction_id
      WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 100
    `).all(userId);
  },

  listAll() {
    return db.prepare(`
      SELECT a.*, u.username, d.name AS drone_name, p.name AS prediction_name
      FROM alerts a
      JOIN users       u ON u.id = a.user_id
      JOIN drones      d ON d.id = a.drone_id
      JOIN predictions p ON p.id = a.prediction_id
      ORDER BY a.id DESC LIMIT 200
    `).all();
  },

  create(data) {
    const r = db.prepare(`
      INSERT INTO alerts (prediction_id, drone_id, user_id, label, confidence, message, acknowledged)
      VALUES (@prediction_id, @drone_id, @user_id, @label, @confidence, @message, 0)
    `).run(data);
    return db.prepare('SELECT * FROM alerts WHERE id = ?').get(r.lastInsertRowid);
  },

  acknowledge(id) {
    return db.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(id);
  },
};

// ── Stats helper ──────────────────────────────────────────────────────────────
function getStats(userId, isAdmin) {
  if (isAdmin) {
    return {
      total_users:       db.prepare('SELECT COUNT(*) as n FROM users').get().n,
      total_drones:      db.prepare('SELECT COUNT(*) as n FROM drones').get().n,
      total_predictions: db.prepare('SELECT COUNT(*) as n FROM predictions').get().n,
      total_alerts:      db.prepare('SELECT COUNT(*) as n FROM alerts').get().n,
    };
  }
  return {
    total_drones:      db.prepare('SELECT COUNT(*) as n FROM drones      WHERE user_id=?').get(userId).n,
    total_predictions: db.prepare('SELECT COUNT(*) as n FROM predictions WHERE user_id=?').get(userId).n,
    total_alerts:      db.prepare('SELECT COUNT(*) as n FROM alerts      WHERE user_id=?').get(userId).n,
  };
}

module.exports = { db, Users, Drones, Predictions, Alerts, getStats };
