// ============================================================
//  Load-shedding — the one thing a South African wall screen must get right.
//  ------------------------------------------------------------
//  Two sources, deliberately layered so the useful half needs nothing from
//  anyone:
//
//   1. THE NATIONAL STAGE, from Eskom directly. No key, no account, no third
//      party, no rate limit worth worrying about. This answers "is it happening
//      and how bad", which is most of what anyone actually asks.
//   2. THE AREA SCHEDULE, from EskomSePush, which answers "when does OUR power
//      go off". That needs a token, so it is optional and the module works
//      without it rather than sitting broken until someone signs up.
//
//  Note for whoever reads this later: SePush v2.0 is retired and answers 410.
//  v3.1 is current. Do not trust an older snippet.
//
//  On honesty: the stage is reported with the time we observed it and the time
//  it last changed, never as a bare number. "Stage 2" alone is a claim about
//  right now that goes stale silently; "Stage 2, seen 40 seconds ago" does not.
// ============================================================
const db = require('./db');

const ESKOM = 'https://loadshedding.eskom.co.za/LoadShedding/GetStatus';
const SEPUSH = 'https://developer.sepush.co.za/business/3.1';
const POLL_MS = 5 * 60000;        // the stage changes rarely, but matters fast
const AREA_MS = 30 * 60000;       // SePush quota is small — be a good citizen

let timer = null, areaTimer = null;
let onChange = () => {};
let state = {
  stage: null,          // 0 = no load-shedding
  raw: null,            // exactly what Eskom returned, so this is auditable
  at: null,             // when we last successfully asked
  since: null,          // when the stage last actually changed
  ok: false,
  error: null,
  area: null            // { name, next: {start,end,stage}, today: [...] } when a token exists
};

// Eskom returns the stage OFFSET BY ONE: 1 means no load-shedding, 2 means
// stage 1, and so on. Anything below 1 means the endpoint is confused rather
// than that the country is unusually calm.
function parseStage(text) {
  const n = Number(String(text).trim());
  if (!Number.isFinite(n) || n < 1) return null;
  return n - 1;
}

async function get(url, opts = {}, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

async function pollStage() {
  try {
    const r = await get(ESKOM);
    if (!r.ok) throw new Error(`Eskom returned ${r.status}`);
    const raw = (await r.text()).trim();
    const stage = parseStage(raw);
    if (stage === null) throw new Error(`could not read "${raw.slice(0, 40)}" as a stage`);

    const prev = state.stage;
    const changed = prev !== null && prev !== stage;
    // `since` means "the stage changed at this time", which we can only know if
    // we were watching when it did. On the first reading after a restart we
    // were not, so it stays null rather than claiming the stage began the
    // moment we happened to look.
    state = { ...state, stage, raw, at: new Date().toISOString(), ok: true, error: null,
              since: changed ? new Date().toISOString() : state.since };

    if (changed) {
      db.events.add({ type: 'loadshedding', payload: { stage, previous: prev } }).catch(() => {});
      db.audit('loadshedding', stage > 0 ? 'stage.up' : 'stage.clear', { stage }).catch(() => {});
      onChange({ stage });
    }
  } catch (e) {
    // Keep the last known stage rather than flashing "unknown" on a wall screen
    // because one request timed out — but say the reading is old.
    state = { ...state, ok: false, error: e.message };
  }
  return state;
}

// ---- the area schedule (optional, needs a token) -----------------------
const token = () => db.settings.get('sepush_token', null).catch(() => null);

async function findArea(query) {
  const key = await token();
  if (!key) throw new Error('no EskomSePush token saved');
  const r = await get(`${SEPUSH}/areas_search?text=${encodeURIComponent(query)}`, { headers: { token: key } });
  if (r.status === 403) throw new Error('EskomSePush rejected the token');
  if (!r.ok) throw new Error(`EskomSePush returned ${r.status}`);
  const j = await r.json();
  return (j.areas || []).map(a => ({ id: a.id, name: a.name, region: a.region }));
}

async function pollArea() {
  const key = await token();
  const id = await db.settings.get('sepush_area_id', null).catch(() => null);
  if (!key || !id) return state.area;
  try {
    const r = await get(`${SEPUSH}/area?id=${encodeURIComponent(id)}`, { headers: { token: key } });
    if (!r.ok) throw new Error(`EskomSePush returned ${r.status}`);
    const j = await r.json();
    const events = (j.events || []).map(e => ({ start: e.start, end: e.end, note: e.note }));
    const now = Date.now();
    const next = events.find(e => new Date(e.end).getTime() > now) || null;
    state.area = { name: (j.info && j.info.name) || String(id), next, events: events.slice(0, 6),
                   at: new Date().toISOString() };
  } catch (e) {
    state.area = { ...(state.area || {}), error: e.message };
  }
  return state.area;
}

// ---- what the rest of the platform sees ---------------------------------
function current() {
  const ageMs = state.at ? Date.now() - new Date(state.at).getTime() : null;
  return {
    ...state,
    stale: ageMs !== null && ageMs > POLL_MS * 2.5,
    age_seconds: ageMs === null ? null : Math.round(ageMs / 1000),
    on: state.stage !== null && state.stage > 0
  };
}

/// A one-line answer for a wall screen. Says how fresh it is, always.
function headline() {
  const s = current();
  if (s.stage === null) return { value: '—', label: 'load-shedding', sub: s.error || 'no reading yet' };
  const when = s.stale ? `last checked ${Math.round(s.age_seconds / 60)} min ago`
    : s.since ? `since ${new Date(s.since).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`
    : 'checked just now';
  if (!s.on) return { value: 'Off', label: 'load-shedding', sub: `no stage active · ${when}`, items: [] };
  const nxt = s.area && s.area.next
    ? `ours: ${new Date(s.area.next.start).toLocaleString('en-ZA', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`
    : 'area schedule not set up';
  return { value: `Stage ${s.stage}`, label: 'load-shedding', sub: `${when} · ${nxt}`,
           items: (s.area && s.area.events || []).slice(0, 3)
             .map(e => `${new Date(e.start).toLocaleString('en-ZA', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} – ${new Date(e.end).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`) };
}

function start(hook) {
  if (hook) onChange = hook;
  if (timer) return;
  pollStage().catch(() => {});
  pollArea().catch(() => {});
  timer = setInterval(() => pollStage().catch(() => {}), POLL_MS);
  areaTimer = setInterval(() => pollArea().catch(() => {}), AREA_MS);
}

module.exports = { start, current, headline, pollStage, pollArea, findArea, POLL_MS };
