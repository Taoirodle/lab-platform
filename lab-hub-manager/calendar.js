// ============================================================
//  L.A.B Calendar — external calendars WITHOUT OAuth or a tunnel.
//  Every big provider hands out a private ICS subscription URL (Google "secret
//  address in iCal format", iCloud "public calendar" webcal link, Outlook
//  "publish calendar"). We fetch those on a schedule, parse them ourselves
//  (no dependencies), expand recurrences into a window, and store instances
//  as plain rows. The family calendar (shared_events) merges in at query time.
// ============================================================
const db = require('./db');

const REFRESH_MS = 30 * 60 * 1000;
const WINDOW_PAST_DAYS = 30, WINDOW_FUTURE_DAYS = 365, MAX_INSTANCES = 500, MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TZ = process.env.LAB_TZ || 'Africa/Johannesburg';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Windows time-zone names Outlook likes to put in TZID → IANA
const WIN_TZ = {
  'south africa standard time': 'Africa/Johannesburg', 'gmt standard time': 'Europe/London', 'w. europe standard time': 'Europe/Berlin',
  'central europe standard time': 'Europe/Budapest', 'romance standard time': 'Europe/Paris', 'e. europe standard time': 'Europe/Bucharest',
  'eastern standard time': 'America/New_York', 'central standard time': 'America/Chicago', 'mountain standard time': 'America/Denver',
  'pacific standard time': 'America/Los_Angeles', 'aus eastern standard time': 'Australia/Sydney', 'india standard time': 'Asia/Kolkata',
  'china standard time': 'Asia/Shanghai', 'tokyo standard time': 'Asia/Tokyo', 'utc': 'UTC', 'coordinated universal time': 'UTC'
};
function ianaTz(t, fallback) {
  if (!t) return fallback;
  t = String(t).replace(/^"|"$/g, '');
  if (WIN_TZ[t.toLowerCase()]) return WIN_TZ[t.toLowerCase()];
  try { new Intl.DateTimeFormat('en', { timeZone: t }); return t; } catch { return fallback; }
}

// ---- time helpers (no libs) -------------------------------------------------
function tzOffsetMs(utcMs, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second) - utcMs;
}
function zonedToUtc(y, mo, d, h, mi, s, tz) {
  const naive = Date.UTC(y, mo - 1, d, h, mi, s);
  let guess = naive;
  for (let i = 0; i < 2; i++) guess = naive - tzOffsetMs(guess, tz);   // converge across DST edges
  return guess;
}
const fmtDay = (ms, tz) => new Date(ms).toLocaleDateString('en-CA', { timeZone: tz });
const fmtTime = (ms, tz) => new Date(ms).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });

/// "20260905T170000" / "20260905T150000Z" / "20260905" (+ tzid) → { ms, allDay }
function parseDt(value, params, defaultTz) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(value).trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h) return { ms: Date.UTC(+y, +mo - 1, +d), allDay: true };            // DATE value — floating day
  if (z) return { ms: Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0)), allDay: false };
  const tz = ianaTz(params.TZID, defaultTz);
  return { ms: zonedToUtc(+y, +mo, +d, +h, +mi, +(s || 0), tz), allDay: false };
}
function parseDuration(v) {                       // P1D, PT1H30M, P1W
  const m = /^(-)?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v || '').trim());
  if (!m) return null;
  const ms = ((+m[2] || 0) * 7 * 86400 + (+m[3] || 0) * 86400 + (+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) * 1000;
  return m[1] ? -ms : ms;
}

// ---- ICS → events -----------------------------------------------------------
function unfold(text) { return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, ''); }
function parseLine(line) {
  const i = line.indexOf(':'); if (i < 0) return null;
  const left = line.slice(0, i), value = line.slice(i + 1);
  const [name, ...ps] = left.split(';');
  const params = {}; for (const p of ps) { const j = p.indexOf('='); if (j > 0) params[p.slice(0, j).toUpperCase()] = p.slice(j + 1); }
  return { name: name.toUpperCase(), params, value };
}
const unesc = s => String(s || '').replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

/// Returns { tz, events:[{uid, summary, location, description, start:{ms,allDay}, end:{ms}, rrule, exdates:Set, recurrenceId, cancelled}] }
function parseIcs(text, fallbackTz) {
  const lines = unfold(text).split('\n');
  let tz = fallbackTz, cur = null; const events = [];
  for (const raw of lines) {
    const l = parseLine(raw); if (!l) continue;
    if (l.name === 'X-WR-TIMEZONE') { tz = ianaTz(l.value, fallbackTz); continue; }
    if (l.name === 'BEGIN' && l.value.toUpperCase() === 'VEVENT') { cur = { exdates: new Set(), raw: {} }; continue; }
    if (l.name === 'END' && l.value.toUpperCase() === 'VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    cur.raw[l.name] = l;
  }
  const out = [];
  for (const e of events) {
    const r = e.raw, get = n => r[n] ? r[n].value : null;
    const start = r.DTSTART ? parseDt(r.DTSTART.value, r.DTSTART.params, tz) : null;
    if (!start) continue;
    let end = r.DTEND ? parseDt(r.DTEND.value, r.DTEND.params, tz) : null;
    if (!end && r.DURATION) { const d = parseDuration(r.DURATION.value); if (d != null) end = { ms: start.ms + d, allDay: start.allDay }; }
    if (!end) end = { ms: start.ms + (start.allDay ? 86400000 : 0), allDay: start.allDay };
    for (const k of Object.keys(r)) if (k === 'EXDATE') for (const v of r[k].value.split(',')) { const p = parseDt(v, r[k].params, tz); if (p) e.exdates.add(p.ms); }
    out.push({
      uid: get('UID') || uid(), summary: unesc(get('SUMMARY')) || '(untitled)', location: unesc(get('LOCATION')) || null,
      description: unesc(get('DESCRIPTION')) || null, start, end, rrule: get('RRULE'), exdates: e.exdates,
      recurrenceId: r['RECURRENCE-ID'] ? parseDt(r['RECURRENCE-ID'].value, r['RECURRENCE-ID'].params, tz) : null,
      cancelled: String(get('STATUS') || '').toUpperCase() === 'CANCELLED'
    });
  }
  return { tz, events: out };
}

const DOW = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
/// Expand one VEVENT into instance start times (ms) inside [winStart, winEnd].
function expand(ev, winStart, winEnd, tz) {
  const s = ev.start.ms;
  if (!ev.rrule) return (s <= winEnd && ev.end.ms >= winStart) ? [s] : [];
  const rule = Object.fromEntries(ev.rrule.split(';').map(p => { const [k, v] = p.split('='); return [k.toUpperCase(), v]; }));
  const freq = rule.FREQ, interval = Math.max(1, +rule.INTERVAL || 1), count = +rule.COUNT || Infinity;
  let until = Infinity; if (rule.UNTIL) { const u = parseDt(rule.UNTIL, {}, tz); if (u) until = u.allDay ? u.ms + 86400000 - 1 : u.ms; }
  const limit = Math.min(until, winEnd);
  const out = []; let n = 0, iter = 0;
  const push = ms => { if (ms < s) return true; n++; if (n > count) return false; if (ms > limit) return false; if (ms >= winStart - (ev.end.ms - s)) out.push(ms); return out.length < MAX_INSTANCES; };
  // work in the feed's local wall-clock so DST doesn't drift a 09:00 meeting
  const off0 = tzOffsetMs(s, tz), local = new Date(s + off0);
  const Y = local.getUTCFullYear(), M = local.getUTCMonth(), D = local.getUTCDate(), h = local.getUTCHours(), mi = local.getUTCMinutes(), sec = local.getUTCSeconds();
  const at = (y, m, d) => ev.start.allDay ? Date.UTC(y, m, d) : zonedToUtc(y, m + 1, d, h, mi, sec, tz);
  if (freq === 'DAILY') {
    for (let i = 0; iter++ < 20000; i += interval) { const ms = at(Y, M, D + i); if (!push(ms)) break; if (ms > limit) break; }
  } else if (freq === 'WEEKLY') {
    const days = (rule.BYDAY ? rule.BYDAY.split(',').map(x => DOW[x.slice(-2)]).filter(x => x != null) : [local.getUTCDay()]).sort((a, b) => a - b);
    const startDow = local.getUTCDay(), weekMon = D - ((startDow + 6) % 7);            // Monday of the start week
    outer: for (let w = 0; iter++ < 5000; w += interval) {
      for (const dw of days) { const ms = at(Y, M, weekMon + w * 7 + ((dw + 6) % 7)); if (ms < s) continue; if (!push(ms)) break outer; if (ms > limit) break outer; }
    }
  } else if (freq === 'MONTHLY') {
    const byday = rule.BYDAY && /^(-?\d)?([A-Z]{2})$/.exec(rule.BYDAY.split(',')[0]);
    const mday = rule.BYMONTHDAY ? +rule.BYMONTHDAY.split(',')[0] : D;
    for (let i = 0; iter++ < 2400; i += interval) {
      let ms;
      if (byday && byday[1]) {                                                            // e.g. 2TU = second Tuesday, -1FR = last Friday
        const ord = +byday[1], dw = DOW[byday[2]]; const first = new Date(Date.UTC(Y, M + i, 1)); const dim = new Date(Date.UTC(Y, M + i + 1, 0)).getUTCDate();
        let d; if (ord > 0) { d = 1 + ((dw - first.getUTCDay() + 7) % 7) + (ord - 1) * 7; } else { const lastDow = new Date(Date.UTC(Y, M + i, dim)).getUTCDay(); d = dim - ((lastDow - dw + 7) % 7) + (ord + 1) * 7; }
        if (d < 1 || d > dim) continue; ms = at(Y, M + i, d);
      } else { const dim = new Date(Date.UTC(Y, M + i + 1, 0)).getUTCDate(); if (mday > dim) continue; ms = at(Y, M + i, mday); }
      if (!push(ms)) break; if (ms > limit) break;
    }
  } else if (freq === 'YEARLY') {
    for (let i = 0; iter++ < 200; i += interval) { const ms = at(Y + i, M, D); if (!push(ms)) break; if (ms > limit) break; }
  } else return [s];
  return out.filter(ms => !ev.exdates.has(ms));
}

/// Fetch + parse + expand a feed into rows ready for calendar_events.
async function materialize(feed) {
  let url = String(feed.url).trim().replace(/^webcal:\/\//i, 'https://');
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('only http(s)/webcal links');
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[::1\]|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname)) throw new Error('local addresses are not allowed');
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 20000);
  let text;
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': 'L.A.B-Calendar/1.0', Accept: 'text/calendar, text/plain;q=0.8, */*;q=0.5' }, redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const len = +r.headers.get('content-length') || 0; if (len > MAX_BYTES) throw new Error('feed too large');
    text = await r.text(); if (text.length > MAX_BYTES) throw new Error('feed too large');
  } finally { clearTimeout(t); }
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('that link is not an iCal feed');
  const tz = feed.tz || DEFAULT_TZ;
  const { tz: feedTz, events } = parseIcs(text, tz);
  const now = Date.now(), winStart = now - WINDOW_PAST_DAYS * 86400000, winEnd = now + WINDOW_FUTURE_DAYS * 86400000;
  // overridden instances (RECURRENCE-ID) replace the master's instance at that time
  const overrides = new Set(events.filter(e => e.recurrenceId).map(e => e.uid + '@' + e.recurrenceId.ms));
  const rows = [];
  for (const ev of events) {
    if (ev.cancelled) continue;
    const dur = ev.end.ms - ev.start.ms;
    const starts = ev.recurrenceId ? [ev.start.ms] : expand(ev, winStart, winEnd, feedTz);
    for (const st of starts) {
      if (!ev.recurrenceId && overrides.has(ev.uid + '@' + st)) continue;
      const en = st + dur;
      rows.push({ uid: ev.uid, instance: st, title: ev.summary.slice(0, 200), location: ev.location && ev.location.slice(0, 200), description: ev.description && ev.description.slice(0, 2000),
        start_at: new Date(st), end_at: new Date(en), all_day: ev.start.allDay, day: fmtDay(st, feedTz), at_time: ev.start.allDay ? null : fmtTime(st, feedTz), end_time: ev.start.allDay ? null : fmtTime(en, feedTz) });
      if (rows.length >= 5000) break;
    }
  }
  return { rows, tz: feedTz };
}

async function refreshFeed(feed) {
  try {
    const { rows, tz } = await materialize(feed);
    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('DELETE FROM calendar_events WHERE feed_id=$1', [feed.id]);
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        await c.query(
          `INSERT INTO calendar_events(feed_id,uid,instance_start,title,location,description,start_at,end_at,all_day,day,at_time,end_time)
           SELECT $1, u.uid, u.instance, u.title, u.location, u.description, u.start_at, u.end_at, u.all_day, u.day::date, u.at_time, u.end_time
           FROM unnest($2::text[],$3::bigint[],$4::text[],$5::text[],$6::text[],$7::timestamptz[],$8::timestamptz[],$9::boolean[],$10::text[],$11::text[],$12::text[])
           AS u(uid,instance,title,location,description,start_at,end_at,all_day,day,at_time,end_time)`,
          [feed.id, chunk.map(r => r.uid), chunk.map(r => r.instance), chunk.map(r => r.title), chunk.map(r => r.location), chunk.map(r => r.description),
            chunk.map(r => r.start_at), chunk.map(r => r.end_at), chunk.map(r => r.all_day), chunk.map(r => r.day), chunk.map(r => r.at_time), chunk.map(r => r.end_time)]);
      }
      await c.query('UPDATE calendar_feeds SET last_fetch=now(), last_status=$2, event_count=$3, tz=$4 WHERE id=$1', [feed.id, 'ok', rows.length, tz]);
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
    return { ok: true, events: rows.length, tz };
  } catch (e) {
    await db.pool.query('UPDATE calendar_feeds SET last_fetch=now(), last_status=$2 WHERE id=$1', [feed.id, ('error: ' + e.message).slice(0, 200)]).catch(() => {});
    return { ok: false, error: e.message };
  }
}

// ---- API surface ------------------------------------------------------------
const listFeeds = (accountId) => db.pool.query(
  `SELECT id,account_id,name,url,color,shared,tz,last_fetch,last_status,event_count,created_at FROM calendar_feeds
   WHERE ($1::bigint IS NULL AND shared) OR account_id=$1 OR shared ORDER BY created_at`, [accountId || null]).then(r => r.rows.map(f => ({ ...f, url: maskUrl(f.url) })));
const maskUrl = u => { try { const x = new URL(u); return x.origin + x.pathname.replace(/[^/]{6,}(?=[^/]*$)/, m => m.slice(0, 3) + '…' + m.slice(-3)); } catch { return '…'; } };

async function addFeed({ account_id, name, url, color, shared }) {
  const id = uid();
  await db.pool.query('INSERT INTO calendar_feeds(id,account_id,name,url,color,shared,tz) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [id, account_id || null, String(name || 'Calendar').slice(0, 60), String(url).trim().slice(0, 2000), /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#6fb4ff', !!shared, DEFAULT_TZ]);
  const feed = (await db.pool.query('SELECT * FROM calendar_feeds WHERE id=$1', [id])).rows[0];
  const result = await refreshFeed(feed);
  if (!result.ok) { await db.pool.query('DELETE FROM calendar_feeds WHERE id=$1', [id]); throw new Error(result.error); }
  return { id, name: feed.name, color: feed.color, shared: feed.shared, events: result.events, tz: result.tz };
}
const removeFeed = (id, accountId) => db.pool.query('DELETE FROM calendar_feeds WHERE id=$1 AND ($2::bigint IS NULL OR account_id=$2 OR account_id IS NULL)', [id, accountId || null]).then(r => ({ ok: r.rowCount > 0 }));
async function refreshById(id) { const f = (await db.pool.query('SELECT * FROM calendar_feeds WHERE id=$1', [id])).rows[0]; if (!f) throw new Error('no such feed'); return refreshFeed(f); }

/// Merged view: family events + feed instances visible to this account, by day.
async function events({ account_id, from, to }) {
  const f = /^\d{4}-\d{2}-\d{2}$/.test(from || '') ? from : new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: DEFAULT_TZ });
  const t = /^\d{4}-\d{2}-\d{2}$/.test(to || '') ? to : new Date(Date.now() + 60 * 86400000).toLocaleDateString('en-CA', { timeZone: DEFAULT_TZ });
  const [fam, feed] = await Promise.all([
    db.pool.query(`SELECT id,title,to_char(day,'YYYY-MM-DD') AS day,at_time,by_name FROM shared_events WHERE day BETWEEN $1 AND $2 ORDER BY day, at_time`, [f, t]).then(r => r.rows),
    db.pool.query(
      `SELECT e.id,e.title,to_char(e.day,'YYYY-MM-DD') AS day,e.at_time,e.end_time,e.all_day,e.location,f.id AS feed_id,f.name AS feed,f.color
       FROM calendar_events e JOIN calendar_feeds f ON f.id=e.feed_id
       WHERE e.day BETWEEN $1 AND $2 AND (f.shared OR f.account_id=$3) ORDER BY e.day, e.all_day DESC, e.at_time LIMIT 2000`, [f, t, account_id || null]).then(r => r.rows)
  ]);
  const out = fam.map(e => ({ id: 'fam:' + e.id, title: e.title, day: e.day, at_time: e.at_time, all_day: !e.at_time, source: 'family', by: e.by_name, color: null }))
    .concat(feed.map(e => ({ id: 'feed:' + e.id, title: e.title, day: e.day, at_time: e.at_time, end_time: e.end_time, all_day: e.all_day, location: e.location, source: 'feed', feed: e.feed, feed_id: e.feed_id, color: e.color })));
  out.sort((a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : (a.all_day && !b.all_day) ? -1 : (!a.all_day && b.all_day) ? 1 : String(a.at_time || '').localeCompare(String(b.at_time || '')));
  return out;
}

// ---- the other direction: the family calendar as an ICS feed phones can subscribe to ----
const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsUtc = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const icsDay = s => String(s).replace(/-/g, '');
const fold = line => { const out = []; let l = line; while (l.length > 72) { out.push(l.slice(0, 72)); l = ' ' + l.slice(72); } out.push(l); return out.join('\r\n'); };
async function familyIcs() {
  const tz = DEFAULT_TZ;
  const from = new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA', { timeZone: tz }), to = new Date(Date.now() + 365 * 86400000).toLocaleDateString('en-CA', { timeZone: tz });
  const [fam, feed] = await Promise.all([
    db.pool.query(`SELECT id,title,to_char(day,'YYYY-MM-DD') AS day,at_time,by_name,created_at FROM shared_events WHERE day BETWEEN $1 AND $2 ORDER BY day`, [from, to]).then(r => r.rows),
    db.pool.query(`SELECT e.id,e.uid,e.title,e.location,e.all_day,e.start_at,e.end_at,to_char(e.day,'YYYY-MM-DD') AS day,f.name AS feed
      FROM calendar_events e JOIN calendar_feeds f ON f.id=e.feed_id WHERE f.shared AND e.day BETWEEN $1 AND $2 ORDER BY e.start_at LIMIT 3000`, [from, to]).then(r => r.rows)
  ]);
  const now = icsUtc(new Date()), L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//L.A.B//Family Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Family (L.A.B)', 'X-WR-TIMEZONE:' + tz];
  for (const e of fam) {
    L.push('BEGIN:VEVENT', 'UID:fam-' + e.id + '@lab', 'DTSTAMP:' + now, fold('SUMMARY:' + icsEsc(e.title)));
    if (e.at_time && /^\d{2}:\d{2}/.test(e.at_time)) {
      const [h, m] = e.at_time.split(':').map(Number), [Y, M, D] = e.day.split('-').map(Number);
      const st = zonedToUtc(Y, M, D, h, m, 0, tz);
      L.push('DTSTART:' + icsUtc(st), 'DTEND:' + icsUtc(st + 3600000));
    } else { L.push('DTSTART;VALUE=DATE:' + icsDay(e.day), 'DTEND;VALUE=DATE:' + icsDay(new Date(new Date(e.day + 'T12:00:00Z').getTime() + 86400000).toISOString().slice(0, 10))); }
    if (e.by_name) L.push(fold('DESCRIPTION:' + icsEsc('Added by ' + e.by_name + ' on the family Hub')));
    L.push('END:VEVENT');
  }
  for (const e of feed) {
    L.push('BEGIN:VEVENT', 'UID:feed-' + e.id + '@lab', 'DTSTAMP:' + now, fold('SUMMARY:' + icsEsc(e.title)));
    if (e.all_day) { L.push('DTSTART;VALUE=DATE:' + icsDay(e.day), 'DTEND;VALUE=DATE:' + icsDay(new Date(new Date(e.day + 'T12:00:00Z').getTime() + 86400000).toISOString().slice(0, 10))); }
    else { L.push('DTSTART:' + icsUtc(e.start_at), 'DTEND:' + icsUtc(e.end_at || new Date(new Date(e.start_at).getTime() + 3600000))); }
    if (e.location) L.push(fold('LOCATION:' + icsEsc(e.location)));
    L.push(fold('DESCRIPTION:' + icsEsc('From ' + e.feed + ' (shared on the family Hub)')), 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}

let timer = null;
async function refreshAll() {
  const feeds = (await db.pool.query('SELECT * FROM calendar_feeds ORDER BY last_fetch NULLS FIRST')).rows;
  for (const f of feeds) await refreshFeed(f);
  return feeds.length;
}
function start() {
  if (timer) return;
  setTimeout(() => refreshAll().catch(() => {}), 15000);
  timer = setInterval(() => refreshAll().catch(() => {}), REFRESH_MS);
}

module.exports = { parseIcs, expand, materialize, refreshFeed, refreshById, refreshAll, listFeeds, addFeed, removeFeed, events, familyIcs, start, DEFAULT_TZ };
