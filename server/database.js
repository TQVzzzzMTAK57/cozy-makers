/**
 * database.js  –  PostgreSQL layer for SeaDrone AI Detection System
 *
 * Uses `pg` (node-postgres) with a connection pool.
 * All exported helpers return Promises (async/await).
 *
 * Tables (created via seadrone_postgres.sql in pgAdmin4):
 *   users, drones, predictions, alerts
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

// ── Connection pool ───────────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.PG_HOST     || 'localhost',
  port:     Number(process.env.PG_PORT)  || 5432,
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || '',
  database: process.env.PG_DATABASE || 'seadrone',
  max: 10,               // max pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('⚠️  PostgreSQL pool error:', err.message);
});

// Helper: run a parameterised query
async function query(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

// ── Schema bootstrap (create tables if they don't exist) ─────────────────────
async function bootstrap() {
  await pool.query(`
    -- ENUM types (ignore if already exist)
    DO $$ BEGIN
      CREATE TYPE user_role    AS ENUM ('admin', 'user');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE drone_status AS ENUM ('active', 'inactive', 'maintenance');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE media_type_enum AS ENUM ('image', 'video');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- users
    CREATE TABLE IF NOT EXISTS users (
      id           SERIAL        PRIMARY KEY,
      username     VARCHAR(80)   NOT NULL UNIQUE,
      email        VARCHAR(120)  NOT NULL UNIQUE,
      password     TEXT          NOT NULL,
      full_name    VARCHAR(120),
      role         user_role     NOT NULL DEFAULT 'user',
      is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- drones
    CREATE TABLE IF NOT EXISTS drones (
      id           SERIAL        PRIMARY KEY,
      user_id      INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name         VARCHAR(120)  NOT NULL,
      model        VARCHAR(100),
      serial_num   VARCHAR(100),
      firmware     VARCHAR(80),
      status       drone_status  NOT NULL DEFAULT 'active',
      created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- predictions
    CREATE TABLE IF NOT EXISTS predictions (
      id                   SERIAL          PRIMARY KEY,
      drone_id             INTEGER         NOT NULL REFERENCES drones(id) ON DELETE CASCADE,
      user_id              INTEGER         NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
      name                 VARCHAR(200),
      media_type           media_type_enum NOT NULL DEFAULT 'image',
      file_url             TEXT,
      result_url           TEXT,
      has_result           BOOLEAN         NOT NULL DEFAULT FALSE,
      detections           JSONB           NOT NULL DEFAULT '[]',
      frame_results        JSONB           NOT NULL DEFAULT '[]',
      drone_gps            JSONB,
      image_size           JSONB,
      total_detections     INTEGER         NOT NULL DEFAULT 0,
      elapsed_seconds      NUMERIC(8,3),
      feedback_accurate    BOOLEAN,
      feedback_comment     TEXT,
      uploaded_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
    );

    -- alerts
    CREATE TABLE IF NOT EXISTS alerts (
      id              SERIAL          PRIMARY KEY,
      prediction_id   INTEGER         NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
      drone_id        INTEGER         NOT NULL REFERENCES drones(id)      ON DELETE CASCADE,
      user_id         INTEGER         NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
      label           VARCHAR(80)     NOT NULL,
      confidence      NUMERIC(5,4)    NOT NULL,
      message         TEXT,
      acknowledged    BOOLEAN         NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_drones_user        ON drones(user_id);
    CREATE INDEX IF NOT EXISTS idx_predictions_drone  ON predictions(drone_id);
    CREATE INDEX IF NOT EXISTS idx_predictions_user   ON predictions(user_id);
    CREATE INDEX IF NOT EXISTS idx_predictions_date   ON predictions(uploaded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_user        ON alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_pred        ON alerts(prediction_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_ack         ON alerts(acknowledged) WHERE acknowledged = FALSE;
    CREATE INDEX IF NOT EXISTS idx_detections_gin     ON predictions USING GIN (detections);
  `);

  // Seed default accounts if table is empty
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if (n === 0) {
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO users (username, email, password, full_name, role, is_active, created_at)
       VALUES ($1,$2,$3,$4,'admin',true,$5)`,
      ['admin', 'admin@seadrone.ai', bcrypt.hashSync('Admin@123', 10), 'System Administrator', now]
    );
    await pool.query(
      `INSERT INTO users (username, email, password, full_name, role, is_active, created_at)
       VALUES ($1,$2,$3,$4,'user',true,$5)`,
      ['user1', 'user1@test.com', bcrypt.hashSync('User@123', 10), 'Demo User', now]
    );
    console.log('\n📦 Seeded default accounts:');
    console.log('  👑 Admin : admin  / Admin@123');
    console.log('  👤 User  : user1  / User@123\n');
  }

  // Ensure at least one admin
  const { rows: [{ na }] } = await pool.query("SELECT COUNT(*)::int AS na FROM users WHERE role='admin'");
  if (na === 0) {
    const first = await queryOne('SELECT id, username FROM users ORDER BY id LIMIT 1');
    if (first) {
      await pool.query("UPDATE users SET role='admin' WHERE id=$1", [first.id]);
      console.log(`✅ Promoted "${first.username}" to admin`);
    }
  }

  console.log('✅ PostgreSQL connected –', process.env.PG_DATABASE || 'seadrone');
}

// ── Expand prediction row (JSONB already parsed by pg driver) ─────────────────
function expandPrediction(row) {
  if (!row) return null;
  return {
    ...row,
    // pg returns JSONB as JS objects directly – normalise nulls
    detections:    row.detections    || [],
    frame_results: row.frame_results || [],
    drone_gps:     row.drone_gps     || null,
    image_size:    row.image_size    || null,
    video_url:     row.file_url,   // legacy alias
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────
const Users = {
  async findByUsername(username) {
    return queryOne('SELECT * FROM users WHERE username=$1', [username]);
  },
  async findByEmail(email) {
    return queryOne('SELECT * FROM users WHERE email=$1', [email]);
  },
  async findById(id) {
    return queryOne('SELECT * FROM users WHERE id=$1', [id]);
  },
  async list() {
    return query('SELECT id,username,email,full_name,role,is_active,created_at FROM users ORDER BY id');
  },
  async create(data) {
    const row = await queryOne(
      `INSERT INTO users (username,email,password,full_name,role,is_active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data.username, data.email, data.password, data.full_name, data.role || 'user', data.is_active !== false]
    );
    return row;
  },
  async update(id, data) {
    const keys   = Object.keys(data);
    const values = Object.values(data);
    const sets   = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
    return queryOne(`UPDATE users SET ${sets} WHERE id=$${keys.length + 1} RETURNING *`, [...values, id]);
  },
  async delete(id) {
    return pool.query('DELETE FROM users WHERE id=$1', [id]);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Drones
// ─────────────────────────────────────────────────────────────────────────────
const Drones = {
  async findById(id) {
    return queryOne('SELECT * FROM drones WHERE id=$1', [id]);
  },
  async listForUser(userId) {
    return query('SELECT * FROM drones WHERE user_id=$1 ORDER BY id DESC', [userId]);
  },
  async listAll() {
    return query(`
      SELECT d.*, u.username FROM drones d
      JOIN users u ON u.id=d.user_id ORDER BY d.id DESC
    `);
  },
  async create(data) {
    return queryOne(
      `INSERT INTO drones (user_id,name,model,serial_num,firmware,status)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data.user_id, data.name, data.model||null, data.serial_num||null, data.firmware||null, data.status||'active']
    );
  },
  async update(id, data) {
    const keys   = Object.keys(data);
    const values = Object.values(data);
    const sets   = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
    return queryOne(`UPDATE drones SET ${sets} WHERE id=$${keys.length + 1} RETURNING *`, [...values, id]);
  },
  async delete(id) {
    return pool.query('DELETE FROM drones WHERE id=$1', [id]);
  },
  async countForUser(userId) {
    const row = await queryOne('SELECT COUNT(*)::int AS n FROM drones WHERE user_id=$1', [userId]);
    return row.n;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Predictions
// ─────────────────────────────────────────────────────────────────────────────
const Predictions = {
  async findById(id) {
    const row = await queryOne(`
      SELECT p.*, u.username, d.name AS drone_name
      FROM predictions p
      JOIN users  u ON u.id=p.user_id
      JOIN drones d ON d.id=p.drone_id
      WHERE p.id=$1
    `, [id]);
    return expandPrediction(row);
  },

  async listForUser(userId) {
    const rows = await query(`
      SELECT p.*, d.name AS drone_name
      FROM predictions p JOIN drones d ON d.id=p.drone_id
      WHERE p.user_id=$1 ORDER BY p.id DESC
    `, [userId]);
    return rows.map(expandPrediction);
  },

  async listAll() {
    const rows = await query(`
      SELECT p.*, u.username, d.name AS drone_name
      FROM predictions p
      JOIN users  u ON u.id=p.user_id
      JOIN drones d ON d.id=p.drone_id
      ORDER BY p.id DESC
    `);
    return rows.map(expandPrediction);
  },

  async create(data) {
    const row = await queryOne(`
      INSERT INTO predictions
        (drone_id, user_id, name, media_type, file_url, result_url, has_result,
         detections, frame_results, drone_gps, image_size,
         total_detections, elapsed_seconds, uploaded_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      data.drone_id,
      data.user_id,
      data.name,
      data.media_type,
      data.file_url   || null,
      data.result_url || null,
      data.has_result || false,
      JSON.stringify(data.detections    || []),
      JSON.stringify(data.frame_results || []),
      data.drone_gps  ? JSON.stringify(data.drone_gps)  : null,
      data.image_size ? JSON.stringify(data.image_size) : null,
      (data.detections || []).length,
      data.elapsed_seconds ?? null,
      data.uploaded_at || new Date().toISOString(),
    ]);
    return expandPrediction(row);
  },

  async updateFeedback(id, accurate, comment) {
    const row = await queryOne(
      `UPDATE predictions SET feedback_accurate=$1, feedback_comment=$2 WHERE id=$3 RETURNING *`,
      [accurate, comment || null, id]
    );
    return expandPrediction(row);
  },

  async delete(id) {
    return pool.query('DELETE FROM predictions WHERE id=$1', [id]);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Alerts
// ─────────────────────────────────────────────────────────────────────────────
const Alerts = {
  async listForUser(userId) {
    return query(`
      SELECT a.*, d.name AS drone_name, p.name AS prediction_name
      FROM alerts a
      JOIN drones      d ON d.id=a.drone_id
      JOIN predictions p ON p.id=a.prediction_id
      WHERE a.user_id=$1 ORDER BY a.id DESC LIMIT 100
    `, [userId]);
  },

  async listAll() {
    return query(`
      SELECT a.*, u.username, d.name AS drone_name, p.name AS prediction_name
      FROM alerts a
      JOIN users       u ON u.id=a.user_id
      JOIN drones      d ON d.id=a.drone_id
      JOIN predictions p ON p.id=a.prediction_id
      ORDER BY a.id DESC LIMIT 200
    `);
  },

  async create(data) {
    return queryOne(`
      INSERT INTO alerts (prediction_id,drone_id,user_id,label,confidence,message,acknowledged)
      VALUES ($1,$2,$3,$4,$5,$6,false) RETURNING *
    `, [data.prediction_id, data.drone_id, data.user_id, data.label, data.confidence, data.message || '']);
  },

  async acknowledge(id) {
    return pool.query('UPDATE alerts SET acknowledged=true WHERE id=$1', [id]);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Stats helper
// ─────────────────────────────────────────────────────────────────────────────
async function getStats(userId, isAdmin) {
  if (isAdmin) {
    const [u, d, p, a] = await Promise.all([
      queryOne('SELECT COUNT(*)::int AS n FROM users'),
      queryOne('SELECT COUNT(*)::int AS n FROM drones'),
      queryOne('SELECT COUNT(*)::int AS n FROM predictions'),
      queryOne('SELECT COUNT(*)::int AS n FROM alerts'),
    ]);
    return { total_users: u.n, total_drones: d.n, total_predictions: p.n, total_alerts: a.n };
  }
  const [d, p, a] = await Promise.all([
    queryOne('SELECT COUNT(*)::int AS n FROM drones WHERE user_id=$1', [userId]),
    queryOne('SELECT COUNT(*)::int AS n FROM predictions WHERE user_id=$1', [userId]),
    queryOne('SELECT COUNT(*)::int AS n FROM alerts WHERE user_id=$1', [userId]),
  ]);
  return { total_drones: d.n, total_predictions: p.n, total_alerts: a.n };
}

module.exports = { pool, query, queryOne, bootstrap, Users, Drones, Predictions, Alerts, getStats };
