-- Esquema de CampusControl (PostgreSQL / Supabase). Idempotente: se puede ejecutar varias veces.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL CHECK (role IN ('admin','coordinador','tecnico','trainer','camper'))
);

CREATE TABLE IF NOT EXISTS spaces (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('aula','cubiculo','laboratorio','auditorio')),
  capacity    INTEGER NOT NULL CHECK (capacity > 0),
  location    TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'disponible' CHECK (status IN ('disponible','mantenimiento','bloqueado'))
);

CREATE TABLE IF NOT EXISTS equipment (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('portatil','proyector','tablet','audio','red','otro')),
  location    TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'disponible' CHECK (status IN ('disponible','prestado','en_revision','danado'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id           SERIAL PRIMARY KEY,
  space_id     TEXT NOT NULL REFERENCES spaces(id),
  title        TEXT NOT NULL,
  organizer_id TEXT NOT NULL REFERENCES users(id),
  date         TEXT NOT NULL,
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  attendees    INTEGER NOT NULL CHECK (attendees > 0),
  status       TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada','cancelada')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_space_date ON bookings (space_id, date);

CREATE TABLE IF NOT EXISTS loans (
  id            SERIAL PRIMARY KEY,
  equipment_id  TEXT NOT NULL REFERENCES equipment(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  start_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at        TIMESTAMPTZ NOT NULL,
  returned_at   TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo','devuelto'))
);

CREATE TABLE IF NOT EXISTS incidents (
  id             SERIAL PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  category       TEXT NOT NULL,
  priority       TEXT NOT NULL CHECK (priority IN ('Baja','Media','Alta','Crítica')),
  area           TEXT NOT NULL,
  justification  TEXT NOT NULL DEFAULT '',
  space_id       TEXT REFERENCES spaces(id),
  equipment_id   TEXT REFERENCES equipment(id),
  status         TEXT NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta','en_progreso','resuelta')),
  ai_model       TEXT,
  reported_by    TEXT NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS import_errors (
  id          SERIAL PRIMARY KEY,
  source      TEXT NOT NULL,
  row_number  INTEGER NOT NULL,
  raw         TEXT NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity (
  id          SERIAL PRIMARY KEY,
  type        TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
