-- ============================================================
--  SeaDrone AI Detection System  –  PostgreSQL Schema
--  Run this in pgAdmin4 Query Tool to create tables + view ERD
-- ============================================================
-- Drop in reverse dependency order (safe re-run)
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS drones CASCADE;
DROP TABLE IF EXISTS users CASCADE;
-- ── Custom ENUM types ─────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN CREATE TYPE drone_status AS ENUM ('active', 'inactive', 'maintenance');
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN CREATE TYPE media_type AS ENUM ('image', 'video');
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;
-- ── 1. users ──────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name VARCHAR(120),
  role user_role NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE users IS 'User accounts (admin + regular users)';
COMMENT ON COLUMN users.role IS 'admin | user';
COMMENT ON COLUMN users.is_active IS 'FALSE = deactivated account';
-- ── 2. drones ─────────────────────────────────────────────────────────────────
CREATE TABLE drones (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  model VARCHAR(100),
  serial_num VARCHAR(100),
  firmware VARCHAR(80),
  status drone_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE drones IS 'Drone fleet belonging to users';
COMMENT ON COLUMN drones.user_id IS 'Owner of this drone';
COMMENT ON COLUMN drones.status IS 'active | inactive | maintenance';
-- ── 3. predictions ────────────────────────────────────────────────────────────
CREATE TABLE predictions (
  id SERIAL PRIMARY KEY,
  drone_id INTEGER NOT NULL REFERENCES drones(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200),
  media_type media_type NOT NULL DEFAULT 'image',
  file_url TEXT,
  -- original uploaded file path
  result_url TEXT,
  -- YOLO-annotated output path
  has_result BOOLEAN NOT NULL DEFAULT FALSE,
  -- YOLO detections stored as JSON array
  -- Each element: {label, confidence, x, y, width, height, center_px, gps?}
  detections JSONB NOT NULL DEFAULT '[]',
  frame_results JSONB NOT NULL DEFAULT '[]',
  -- GPS metadata extracted from image EXIF
  -- {lat: float, lon: float, alt: float|null}
  drone_gps JSONB,
  -- Original image dimensions [width, height]
  image_size JSONB,
  total_detections INTEGER NOT NULL DEFAULT 0,
  elapsed_seconds NUMERIC(8, 3),
  feedback_accurate BOOLEAN,
  -- NULL = no feedback yet
  feedback_comment TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE predictions IS 'AI detection jobs (image & video)';
COMMENT ON COLUMN predictions.detections IS 'JSONB array of YOLO detection objects';
COMMENT ON COLUMN predictions.drone_gps IS 'Drone GPS at capture time {lat,lon,alt}';
COMMENT ON COLUMN predictions.image_size IS '[width, height] in pixels';
COMMENT ON COLUMN predictions.feedback_accurate IS 'User feedback: true=accurate, false=inaccurate, null=no feedback';
-- ── 4. alerts ─────────────────────────────────────────────────────────────────
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  prediction_id INTEGER NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  drone_id INTEGER NOT NULL REFERENCES drones(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(80) NOT NULL,
  -- detected object class
  confidence NUMERIC(5, 4) NOT NULL,
  -- 0.0000 – 1.0000
  message TEXT,
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE alerts IS 'Auto-generated danger alerts from high-confidence detections';
COMMENT ON COLUMN alerts.label IS 'YOLO class label that triggered the alert';
COMMENT ON COLUMN alerts.confidence IS 'Detection confidence score (0–1)';
COMMENT ON COLUMN alerts.acknowledged IS 'TRUE = operator has seen/dismissed this alert';
-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_drones_user ON drones(user_id);
CREATE INDEX idx_predictions_drone ON predictions(drone_id);
CREATE INDEX idx_predictions_user ON predictions(user_id);
CREATE INDEX idx_predictions_date ON predictions(uploaded_at DESC);
CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_pred ON alerts(prediction_id);
CREATE INDEX idx_alerts_ack ON alerts(acknowledged)
WHERE acknowledged = FALSE;
-- GIN index for JSONB querying (e.g. filter by label inside detections)
CREATE INDEX idx_detections_gin ON predictions USING GIN (detections);
CREATE INDEX idx_drone_gps_gin ON predictions USING GIN (drone_gps);
-- ── Seed data (optional – comment out if not needed) ──────────────────────────
-- Default admin account  (password: Admin@123)
INSERT INTO users (username, email, password, full_name, role)
VALUES (
    'admin',
    'admin@seadrone.ai',
    '$2a$10$placeholder_bcrypt_hash_here',
    -- replace with real bcrypt hash
    'System Administrator',
    'admin'
  ) ON CONFLICT (username) DO NOTHING;
-- ── Verification query ────────────────────────────────────────────────────────
SELECT table_name,
  (
    SELECT COUNT(*)
    FROM information_schema.columns c
    WHERE c.table_name = t.table_name
      AND c.table_schema = 'public'
  ) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;