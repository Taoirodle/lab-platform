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
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS avatar JSONB;    -- {emoji, color}
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS privacy JSONB;   -- {share_stats, share_calendar}
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS prefs JSONB;     -- app prefs synced across your installs: {widgets, look, skin, skinvars, updated_at}
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
-- Personal-app usage telemetry (the Stats page). One row per device-minute:
-- which app was in front, what kind of thing it is, machine load, away/active.
-- Window titles are never sent here by design.
CREATE TABLE IF NOT EXISTS usage_samples (
  device_id TEXT NOT NULL,
  account_id BIGINT,
  ts TIMESTAMPTZ NOT NULL,
  app TEXT,
  category TEXT,
  cpu SMALLINT,
  mem SMALLINT,
  idle BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (device_id, ts)
);
CREATE INDEX IF NOT EXISTS usage_samples_ts_idx ON usage_samples (ts DESC);
-- Calendar: external ICS subscriptions (Google/Apple/Outlook) expanded into instances
CREATE TABLE IF NOT EXISTS calendar_feeds (
  id TEXT PRIMARY KEY,
  account_id BIGINT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  color TEXT,
  shared BOOLEAN NOT NULL DEFAULT false,   -- visible to the whole family
  tz TEXT,
  last_fetch TIMESTAMPTZ, last_status TEXT, event_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS calendar_events (
  id BIGSERIAL PRIMARY KEY,
  feed_id TEXT NOT NULL REFERENCES calendar_feeds(id) ON DELETE CASCADE,
  uid TEXT, instance_start BIGINT,
  title TEXT NOT NULL, location TEXT, description TEXT,
  start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT false,
  day DATE NOT NULL, at_time TEXT, end_time TEXT
);
CREATE INDEX IF NOT EXISTS calendar_events_day_idx ON calendar_events (day);
CREATE INDEX IF NOT EXISTS calendar_events_feed_idx ON calendar_events (feed_id);
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
  list: () => pool.query('SELECT id,name,role,avatar,created_at FROM accounts ORDER BY created_at').then(r => r.rows),
  create: (name, pin) => pool.query('INSERT INTO accounts(name,role,pin) VALUES($1,$2,$3) RETURNING id,name,role,avatar,privacy', [name, 'member', pin]).then(r => r.rows[0]),
  login: (name, pin) => pool.query('SELECT id,name,role,avatar,privacy FROM accounts WHERE lower(name)=lower($1) AND pin=$2', [name, pin]).then(r => r.rows[0] || null),
  exists: (name) => pool.query('SELECT 1 FROM accounts WHERE lower(name)=lower($1)', [name]).then(r => r.rowCount > 0),
  get: (id) => pool.query('SELECT id,name,role,avatar,privacy,created_at FROM accounts WHERE id=$1', [id]).then(r => r.rows[0] || null),
  checkPin: (id, pin) => pool.query('SELECT 1 FROM accounts WHERE id=$1 AND pin=$2', [id, pin]).then(r => r.rowCount > 0),
  // profile edits: avatar {emoji,color}, privacy {share_stats, share_calendar}; PIN change needs the old PIN (checked by the route)
  update: (id, { avatar, privacy, pin }) => pool.query(
    `UPDATE accounts SET avatar=COALESCE($2::jsonb, avatar), privacy=COALESCE($3::jsonb, privacy), pin=COALESCE($4, pin) WHERE id=$1 RETURNING id,name,role,avatar,privacy`,
    [id, avatar ? JSON.stringify(avatar) : null, privacy ? JSON.stringify(privacy) : null, pin || null]).then(r => r.rows[0] || null),
  devices: (id) => pool.query(
    `SELECT d.id, d.name, d.kind, d.os, d.last_seen,
       (SELECT count(*) FROM usage_samples u WHERE u.device_id=d.id AND u.ts > now() - interval '7 days' AND NOT u.idle)::int AS active_7d
     FROM devices d WHERE d.account_id=$1 ORDER BY d.last_seen DESC NULLS LAST`, [id]).then(r => r.rows),
  profiles: (id) => pool.query('SELECT id,os,hostname,archetype,created_at FROM device_profiles WHERE account_id=$1 ORDER BY created_at DESC', [id]).then(r => r.rows),
  getPrefs: (id) => pool.query('SELECT prefs FROM accounts WHERE id=$1', [id]).then(r => (r.rows[0] && r.rows[0].prefs) || null),
  setPrefs: (id, prefs) => pool.query('UPDATE accounts SET prefs=COALESCE(prefs, \'{}\'::jsonb) || $2::jsonb WHERE id=$1 RETURNING prefs', [id, JSON.stringify(prefs)]).then(r => (r.rows[0] && r.rows[0].prefs) || null)
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

// Personal-app usage telemetry → the Stats page. Ingest is idempotent per
// (device, minute); summaries are computed in the caller's timezone.
function safeTz(tz) {
  tz = String(tz || 'UTC');
  if (!/^[A-Za-z0-9_\/+\-]{1,64}$/.test(tz)) return 'UTC';
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return tz; } catch { return 'UTC'; }
}
const usage = {
  ingest: async ({ device_id, account_id, hostname, os, samples }) => {
    const s = (samples || []).slice(-600).filter(x => x && Number.isFinite(+x.t) && +x.t > 1e9);
    if (!s.length) return { inserted: 0 };
    const r = await pool.query(
      `INSERT INTO usage_samples(device_id,account_id,ts,app,category,cpu,mem,idle)
       SELECT $1,$2,to_timestamp(t),app,cat,cpu,mem,idle
       FROM unnest($3::bigint[],$4::text[],$5::text[],$6::int[],$7::int[],$8::boolean[]) AS u(t,app,cat,cpu,mem,idle)
       ON CONFLICT (device_id, ts) DO NOTHING`,
      [String(device_id), account_id || null,
        s.map(x => Math.floor(+x.t)), s.map(x => x.app ? String(x.app).slice(0, 80) : null), s.map(x => String(x.cat || 'Other').slice(0, 24)),
        s.map(x => Math.max(0, Math.min(100, Math.round(+x.cpu || 0)))), s.map(x => Math.max(0, Math.min(100, Math.round(+x.mem || 0)))), s.map(x => !!x.idle)]);
    // the app registers itself as a device so the Admin fleet view sees it
    await pool.query(
      `INSERT INTO devices(id,name,kind,os,account_id,last_seen,status) VALUES($1,$2,'hub-app',$3,$4,now(),'online')
       ON CONFLICT (id) DO UPDATE SET last_seen=now(), status='online',
         account_id=COALESCE(EXCLUDED.account_id, devices.account_id), name=COALESCE(EXCLUDED.name, devices.name), os=COALESCE(EXCLUDED.os, devices.os)`,
      [String(device_id), hostname || null, os || null, account_id || null]).catch(() => {});
    return { inserted: r.rowCount };
  },
  summary: async ({ device_id, days, tz }) => {
    days = Math.max(1, Math.min(90, Math.round(+days) || 14)); tz = safeTz(tz);
    const q = (sql, p) => pool.query(sql, p).then(r => r.rows);
    const [byDay, top, hoursRows, meta] = await Promise.all([
      q(`SELECT to_char(ts AT TIME ZONE $3,'YYYY-MM-DD') d, category, count(*)::int mins FROM usage_samples
         WHERE device_id=$1 AND ts >= now() - make_interval(days => $2::int) AND NOT idle GROUP BY 1,2`, [device_id, days, tz]),
      q(`SELECT app, min(category) category, count(*)::int mins FROM usage_samples
         WHERE device_id=$1 AND ts >= now() - interval '7 days' AND NOT idle AND app IS NOT NULL GROUP BY app ORDER BY mins DESC LIMIT 10`, [device_id]),
      q(`SELECT extract(hour from ts AT TIME ZONE $2)::int h, count(*)::int mins FROM usage_samples
         WHERE device_id=$1 AND ts >= now() - interval '14 days' AND NOT idle GROUP BY 1`, [device_id, tz]),
      q(`SELECT count(*)::int total, (count(*) FILTER (WHERE NOT idle))::int active, min(ts) first_seen, max(ts) last_seen FROM usage_samples WHERE device_id=$1`, [device_id])
    ]);
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
    const [Y, M, D] = todayStr.split('-').map(Number); const base = Date.UTC(Y, M - 1, D);
    const list = []; for (let i = days - 1; i >= 0; i--) list.push({ d: new Date(base - i * 86400000).toISOString().slice(0, 10), cats: {}, total: 0 });
    const idx = Object.fromEntries(list.map((x, i) => [x.d, i]));
    for (const r of byDay) { const e = list[idx[r.d]]; if (!e) continue; const k = r.category || 'Other'; e.cats[k] = (e.cats[k] || 0) + r.mins; e.total += r.mins; }
    const hours = new Array(24).fill(0); for (const r of hoursRows) if (r.h >= 0 && r.h < 24) hours[r.h] = r.mins;
    const m = meta[0] || {};
    return { device_id, tz, days: list, top_apps: top, hours, total_minutes: m.total || 0, active_minutes: m.active || 0, first_seen: m.first_seen, last_seen: m.last_seen };
  },
  // one local day as runs: consecutive minutes of the same app (or idle) collapse into a block
  day: async ({ device_id, date, tz }) => {
    tz = safeTz(tz);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) date = new Date().toLocaleDateString('en-CA', { timeZone: tz });
    const rows = await pool.query(`SELECT ts, app, category, idle FROM usage_samples WHERE device_id=$1 AND (ts AT TIME ZONE $3)::date = $2::date ORDER BY ts`, [device_id, date, tz]).then(r => r.rows);
    const hhmm = ms => new Date(ms).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
    const runs = [];
    for (const r of rows) {
      const t = new Date(r.ts).getTime(), key = r.idle ? 'idle' : (r.app || 'other'), last = runs[runs.length - 1];
      if (last && last.key === key && t - last.end_ms <= 120000) { last.end_ms = t + 60000; last.mins++; }
      else runs.push({ key, app: r.idle ? null : r.app, category: r.idle ? 'Idle' : (r.category || 'Other'), idle: !!r.idle, start_ms: t, end_ms: t + 60000, mins: 1 });
    }
    return { device_id, date, tz, active_minutes: rows.filter(r => !r.idle).length, runs: runs.map(x => ({ app: x.app, category: x.category, idle: x.idle, mins: x.mins, start: hhmm(x.start_ms), end: hhmm(x.end_ms) })) };
  },
  devices: () => pool.query(
    `SELECT d.id, d.name, d.os, d.account_id, a.name AS account, d.last_seen,
       (SELECT count(*) FROM usage_samples u WHERE u.device_id=d.id AND u.ts > now() - interval '7 days' AND NOT u.idle)::int AS active_7d
     FROM devices d LEFT JOIN accounts a ON a.id=d.account_id WHERE d.kind='hub-app' ORDER BY d.last_seen DESC NULLS LAST`).then(r => r.rows)
};

module.exports = { pool, init, isReady, health, admins, updates, devices, settings, accounts, events, audit, analytics, installs, usage };
