// ============================================================
//  L.A.B Hub Manager — SQL Brain (PostgreSQL)
//  The single source of truth: accounts, admins, devices, the telemetry
//  firehose, the Dev Team's update pipeline (with the tiered-approval model),
//  and the audit trail. Everything hangs off this.
// ============================================================
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8, idleTimeoutMillis: 30000 });
const uid = () => crypto.randomBytes(8).toString('hex');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS pin TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_name_lower ON accounts (lower(name));
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Administrator',
  token TEXT UNIQUE NOT NULL,
  paired BOOLEAN NOT NULL DEFAULT false,
  pc JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE admins ADD COLUMN IF NOT EXISTS key TEXT;          -- physical USB-key secret
ALTER TABLE admins ADD COLUMN IF NOT EXISTS key_issued_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT, kind TEXT, os TEXT,
  account_id BIGINT REFERENCES accounts(id),
  last_seen TIMESTAMPTZ, meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS ip TEXT;
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  account_id BIGINT, device_id TEXT,
  type TEXT NOT NULL,            -- page | activity | sauce | search | error
  payload JSONB
);
CREATE INDEX IF NOT EXISTS events_ts_idx ON events (ts DESC);
CREATE INDEX IF NOT EXISTS events_type_idx ON events (type);
-- Dev Team update pipeline + tiered approval model
CREATE TABLE IF NOT EXISTS updates (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,           -- app | update
  title TEXT NOT NULL,
  service TEXT,                 -- which service/area it affects
  summary TEXT,                 -- 1-2 line summary
  size_bytes BIGINT,
  significance INT,             -- 1..10 (QA agent)
  push_to_admin BOOLEAN NOT NULL DEFAULT false,
  qc_status TEXT NOT NULL DEFAULT 'pending',   -- pending | passed | failed
  qa_status TEXT NOT NULL DEFAULT 'pending',   -- pending | reviewed
  decision  TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected | auto-shipped | shipped
  agent TEXT, changelog TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);
ALTER TABLE updates ADD COLUMN IF NOT EXISTS path TEXT;
CREATE TABLE IF NOT EXISTS audit (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor TEXT, action TEXT NOT NULL, detail JSONB
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB
);
-- App Store: which accounts installed which first-party apps
CREATE TABLE IF NOT EXISTS installs (
  account_id BIGINT NOT NULL,
  app_id TEXT NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, app_id)
);

-- ===================================================================
--  MAJOR UPDATE — the evolving Ledger system (the AI build team's brain-store)
--  Four ledgers (team / client / admin / kiosk) as one ever-expanding table.
-- ===================================================================
CREATE TABLE IF NOT EXISTS ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  ledger TEXT NOT NULL,                 -- team | client | admin | kiosk
  scope  TEXT NOT NULL DEFAULT 'global',-- account id, kiosk name, or 'global'
  kind   TEXT NOT NULL,                 -- ideology | northstar | guardrail | plan | evolution | like | dislike | profile | signal | note
  key    TEXT,                          -- upsertable fact key (null = append-only log)
  value  JSONB,
  weight REAL NOT NULL DEFAULT 1,       -- confidence/strength; grows with reinforcement
  source TEXT,                          -- telemetry | feedback | agent | admin | system
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_idx ON ledger_entries(ledger, scope, kind);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_key_uq ON ledger_entries(ledger, scope, kind, key) WHERE key IS NOT NULL;

-- In-app feedback with smart categories (feeds the client + team ledgers)
CREATE TABLE IF NOT EXISTS feedback (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT,
  category TEXT,            -- love | meh | bug | idea | toomuch
  sentiment TEXT,          -- positive | neutral | negative
  text TEXT,
  context JSONB,
  seen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Precursive generations: things the AI autonomously makes (skins/widgets/apps)
CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,       -- skin | widget | app | overhaul
  name TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  meta JSONB,
  payload JSONB,            -- the actual generated definition
  status TEXT NOT NULL DEFAULT 'staged',  -- staged | published | rejected
  tested BOOLEAN NOT NULL DEFAULT false,
  agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Research agent logs (grounding for future builds)
CREATE TABLE IF NOT EXISTS research_logs (
  id BIGSERIAL PRIMARY KEY,
  agent TEXT,
  topic TEXT,
  findings JSONB,
  applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The master synthesis (the monthly major-update pass reads everything)
CREATE TABLE IF NOT EXISTS master_synthesis (
  id BIGSERIAL PRIMARY KEY,
  period TEXT,
  summary TEXT,
  graph JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================================================================
--  L.A.B Conductor — the NATIVE device engine (our own smart-home core)
-- ===================================================================
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'light',   -- light | led-strip | motion | sensor | switch | camera
  room TEXT NOT NULL DEFAULT 'general',
  driver TEXT NOT NULL,                 -- wled | wiz | push | virtual
  address TEXT, port INT,
  token TEXT UNIQUE,                    -- for push (sensor ingest) devices
  config JSONB NOT NULL DEFAULT '{}',
  state  JSONB NOT NULL DEFAULT '{}',
  online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trigger JSONB NOT NULL DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '[]',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================================================================
--  Web-facing Hub — the SHARED family surface (global, everyone sees it)
-- ===================================================================
CREATE TABLE IF NOT EXISTS shared_todos (
  id BIGSERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shared_events (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  day DATE NOT NULL,
  at_time TEXT,
  by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Per-device profiles produced by the install wizard's PC analysis
CREATE TABLE IF NOT EXISTS device_profiles (
  id TEXT PRIMARY KEY,
  account_id BIGINT,
  os TEXT,
  hostname TEXT,
  archetype TEXT,            -- work | creative | gaming | multitask | everything
  report JSONB,              -- the raw analysis
  personalization JSONB,     -- agent-generated: modules, theme, personalized tab, doc
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO settings(key,value) VALUES ('ai', '{"activity":5,"aggressiveness":5,"buildingPaused":false}')
  ON CONFLICT (key) DO NOTHING;
`;

let ready = false;
async function init() {
  await pool.query(SCHEMA);
  ready = true;
  return true;
}
function isReady() { return ready; }

async function health() {
  const c = await pool.query(`SELECT
    (SELECT count(*) FROM admins)   AS admins,
    (SELECT count(*) FROM accounts) AS accounts,
    (SELECT count(*) FROM devices)  AS devices,
    (SELECT count(*) FROM events)   AS events,
    (SELECT count(*) FROM updates)  AS updates`);
  const v = await pool.query('SHOW server_version');
  return { ok: true, version: v.rows[0].server_version, counts: c.rows[0] };
}

// admins now live in the SQL Brain
const admins = {
  list: () => pool.query('SELECT id,name,role,paired,pc,created_at,(key IS NOT NULL) AS has_key FROM admins ORDER BY created_at').then(r => r.rows),
  create: async (name) => {
    const id = uid(), token = uid() + uid(), key = uid() + uid() + uid();
    await pool.query('INSERT INTO admins(id,name,token,key,key_issued_at) VALUES($1,$2,$3,$4,now())', [id, name, token, key]);
    return { id, name, token, key };
  },
  byToken: (token) => pool.query('SELECT * FROM admins WHERE token=$1', [token]).then(r => r.rows[0]),
  pair: (token, pc) => pool.query('UPDATE admins SET paired=true, pc=$2 WHERE token=$1 RETURNING name', [token, pc]).then(r => r.rows[0]),
  // USB-key: ensure a key exists for this admin and hand back the key-file payload
  issueKey: async (token) => {
    const a = await pool.query('SELECT * FROM admins WHERE token=$1', [token]).then(r => r.rows[0]);
    if (!a) return null;
    let key = a.key;
    if (!key) { key = uid() + uid() + uid(); await pool.query('UPDATE admins SET key=$2, key_issued_at=now() WHERE id=$1', [a.id, key]); }
    return { adminId: a.id, name: a.name, role: a.role, token: a.token, key };
  },
  // Validate a presented key file (token + key must match the same admin)
  verifyKey: (token, key) => pool.query('SELECT id,name,role FROM admins WHERE token=$1 AND key=$2', [token, key]).then(r => r.rows[0] || null)
};

const updates = {
  list: () => pool.query('SELECT * FROM updates ORDER BY created_at DESC LIMIT 100').then(r => r.rows),
  pending: () => pool.query("SELECT * FROM updates WHERE push_to_admin=true AND decision='pending' ORDER BY significance DESC, created_at DESC").then(r => r.rows),
  decide: (id, decision) => pool.query("UPDATE updates SET decision=$2, decided_at=now() WHERE id=$1 RETURNING id,title,decision", [id, decision]).then(r => r.rows[0]),
  create: async (u) => {
    const id = uid();
    // QC is only 'passed' when something was genuinely validated (a tested
    // artifact); plain proposals stay 'pending' — shipped must mean real.
    const qc = u.qc_status || (u.validated ? 'passed' : 'pending');
    await pool.query(
      `INSERT INTO updates(id,kind,title,service,summary,size_bytes,significance,push_to_admin,agent,qc_status,qa_status,path,changelog)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'reviewed',$11,$12)`,
      [id, u.kind || 'update', u.title, u.service || null, u.summary || null, u.size_bytes || null, u.significance || 5, u.push_to_admin === true, u.agent || 'system', qc, u.path || null, u.changelog || null]);
    return { id };
  }
};

const settings = {
  get: (key, def) => pool.query('SELECT value FROM settings WHERE key=$1', [key]).then(r => r.rows[0] ? r.rows[0].value : def),
  set: (key, value) => pool.query('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2', [key, JSON.stringify(value)])
};

// Aggregates that power the Admin Portal's live graphs + AI-upgrade feed
const analytics = {
  shipsByDay: (days = 14) => pool.query(
    `SELECT to_char(d,'YYYY-MM-DD') AS day,
       COALESCE(u.auto,0) AS auto, COALESCE(u.approved,0) AS approved
     FROM generate_series((current_date - ($1::int-1)), current_date, '1 day') AS d
     LEFT JOIN (
       SELECT date_trunc('day', created_at) dd,
         count(*) FILTER (WHERE decision='auto-shipped' OR decision='shipped') auto,
         count(*) FILTER (WHERE decision='approved') approved
       FROM updates GROUP BY dd
     ) u ON u.dd = d
     ORDER BY d`, [days]).then(r => r.rows.map(x => ({ day: x.day, auto: +x.auto, approved: +x.approved }))),
  sigHistogram: () => pool.query('SELECT significance AS s, count(*) AS c FROM updates GROUP BY significance ORDER BY significance')
    .then(r => r.rows.map(x => ({ s: +x.s, c: +x.c }))),
  recentUpgrades: (n = 8) => pool.query(
    'SELECT id,title,service,path,significance,decision,agent,size_bytes,created_at FROM updates ORDER BY created_at DESC LIMIT $1', [n])
    .then(r => r.rows),
  telemetry: () => pool.query('SELECT type, count(*) AS c FROM events GROUP BY type ORDER BY c DESC')
    .then(r => r.rows.map(x => ({ type: x.type, c: +x.c }))),
  totals: () => pool.query(
    `SELECT count(*) AS total,
       count(*) FILTER (WHERE decision='auto-shipped' OR decision='shipped') AS shipped,
       count(*) FILTER (WHERE decision='approved') AS approved,
       count(*) FILTER (WHERE push_to_admin AND decision='pending') AS pending,
       COALESCE(sum(size_bytes),0) AS bytes
     FROM updates`).then(r => ({
       total: +r.rows[0].total, shipped: +r.rows[0].shipped, approved: +r.rows[0].approved,
       pending: +r.rows[0].pending, bytes: +r.rows[0].bytes
     }))
};

// Family accounts (the people who use the Home L.A.B Hub)
const accounts = {
  list: () => pool.query('SELECT id,name,role,created_at FROM accounts ORDER BY created_at').then(r => r.rows),
  create: (name, pin) => pool.query('INSERT INTO accounts(name,role,pin) VALUES($1,$2,$3) RETURNING id,name,role', [name, 'member', pin]).then(r => r.rows[0]),
  login: (name, pin) => pool.query('SELECT id,name,role FROM accounts WHERE lower(name)=lower($1) AND pin=$2', [name, pin]).then(r => r.rows[0] || null),
  exists: (name) => pool.query('SELECT 1 FROM accounts WHERE lower(name)=lower($1)', [name]).then(r => r.rowCount > 0)
};

// Telemetry firehose — what the Dev Team learns from
const events = {
  add: ({ account_id, device_id, type, payload }) => pool.query('INSERT INTO events(account_id,device_id,type,payload) VALUES($1,$2,$3,$4)', [account_id || null, device_id || null, type, payload ? JSON.stringify(payload) : null]),
  countByType: () => pool.query("SELECT type, count(*) FROM events GROUP BY type ORDER BY count DESC").then(r => r.rows),
  recent: (n = 30) => pool.query('SELECT ts,account_id,type,payload FROM events ORDER BY ts DESC LIMIT $1', [n]).then(r => r.rows)
};

// Fleet / MDM — enrolled devices & nodes
const devices = {
  list: () => pool.query('SELECT id,name,kind,os,ip,status,last_seen,meta,created_at FROM devices ORDER BY created_at').then(r => r.rows),
  create: async ({ name, kind, os }) => {
    const id = uid(), token = uid() + uid();
    await pool.query('INSERT INTO devices(id,name,kind,os,token,status) VALUES($1,$2,$3,$4,$5,$6)', [id, name, kind || 'pc', os || '', token, 'pending']);
    return { id, name, token };
  },
  byToken: (token) => pool.query('SELECT * FROM devices WHERE token=$1', [token]).then(r => r.rows[0]),
  checkin: (token, { os, ip, meta }) => pool.query(
    "UPDATE devices SET last_seen=now(), status='online', os=COALESCE($2,os), ip=$3, meta=COALESCE($4,meta) WHERE token=$1 RETURNING id,name",
    [token, os || null, ip || null, meta ? JSON.stringify(meta) : null]).then(r => r.rows[0]),
  remove: (id) => pool.query('DELETE FROM devices WHERE id=$1', [id])
};

// App Store installs (per account)
const installs = {
  forAccount: (accountId) => pool.query('SELECT app_id, installed_at FROM installs WHERE account_id=$1 ORDER BY installed_at', [accountId]).then(r => r.rows),
  add: (accountId, appId) => pool.query('INSERT INTO installs(account_id,app_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [accountId, appId]),
  remove: (accountId, appId) => pool.query('DELETE FROM installs WHERE account_id=$1 AND app_id=$2', [accountId, appId]),
  countByApp: () => pool.query('SELECT app_id, count(*) c FROM installs GROUP BY app_id').then(r => r.rows.map(x => ({ app_id: x.app_id, c: +x.c })))
};

function audit(actor, action, detail) {
  return pool.query('INSERT INTO audit(actor,action,detail) VALUES($1,$2,$3)', [actor, action, detail ? JSON.stringify(detail) : null]).catch(() => {});
}

module.exports = { pool, init, isReady, health, admins, updates, devices, settings, accounts, events, audit, analytics, installs };
