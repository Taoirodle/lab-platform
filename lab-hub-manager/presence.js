// ============================================================
//  Presence — who is home, worked out from the network alone.
//  No hardware, no app on anyone's phone, no location tracking. A phone that
//  is associated with the wifi is in the house; one that has not answered for
//  a while is not.
//
//  Three honesty problems this has to solve:
//   1. Phones sleep. A device that has not answered for two minutes has not
//      left — hence the grace window before anyone is called away.
//   2. Modern phones randomise their MAC, so identity has to be pinned once by
//      a human rather than inferred forever.
//   3. Absence of evidence is not evidence of absence. Confidence is reported,
//      never hidden, and "unknown" is a legitimate answer.
// ============================================================
const { execFile } = require('child_process');
const db = require('./db');

const GRACE_MS = Number(process.env.LAB_PRESENCE_GRACE_MS) || 12 * 60000;  // a sleeping phone is not an absent person
const POLL_MS = 60000;
const sh = (cmd, args, ms = 10000) => new Promise(res => execFile(cmd, args, { timeout: ms }, (e, out) => res(out || '')));

let timer = null;
let last = { people: [], devices: [], at: null };
const state = new Map();   // asset id → { home, since }
let onChange = () => {};

/// Devices worth watching: anything on the register with an address, that is a
/// phone, tablet, laptop or PC — the things that come and go with a person.
const WATCH_KINDS = new Set(['phone', 'tablet', 'laptop', 'pc', 'watch']);

async function watched() {
  const rows = await db.pool.query(
    `SELECT a.id, a.name, a.kind, a.ip, a.mac, a.owner_account_id, a.last_seen, acc.name AS owner
     FROM house_assets a LEFT JOIN accounts acc ON acc.id = a.owner_account_id
     WHERE a.status = 'active' AND (a.ip IS NOT NULL OR a.mac IS NOT NULL)`).then(r => r.rows);
  return rows.filter(r => WATCH_KINDS.has(r.kind));
}

/// One sweep: knock on each watched address, then read the ARP table for truth.
async function sweep() {
  const rows = await watched();
  if (!rows.length) { last = { people: [], devices: [], at: new Date().toISOString(), note: 'no phones or PCs on the register yet' }; return last; }

  const ips = [...new Set(rows.map(r => r.ip).filter(Boolean))];
  for (let i = 0; i < ips.length; i += 32) {
    await Promise.all(ips.slice(i, i + 32).map(ip => sh('ping', ['-c', '1', '-W', '1', ip], 3000)));
  }
  const arp = await sh('ip', ['neigh']);
  const liveMacs = new Set(), liveIps = new Set();
  for (const line of arp.split('\n')) {
    if (/FAILED|INCOMPLETE/i.test(line)) continue;
    const ip = (line.trim().split(/\s+/)[0] || '');
    const mac = (/lladdr\s+([0-9a-f:]{17})/i.exec(line) || [])[1];
    if (mac) { liveMacs.add(mac.toLowerCase()); liveIps.add(ip); }
  }

  const now = Date.now(), devices = [];
  for (const r of rows) {
    const seenNow = (r.mac && liveMacs.has(r.mac.toLowerCase())) || (r.ip && liveIps.has(r.ip));
    if (seenNow) await db.pool.query('UPDATE house_assets SET last_seen=now() WHERE id=$1', [r.id]).catch(() => {});
    const lastSeen = seenNow ? now : (r.last_seen ? new Date(r.last_seen).getTime() : 0);
    const home = seenNow || (now - lastSeen) < GRACE_MS;
    const prev = state.get(r.id);
    if (!prev || prev.home !== home) {
      state.set(r.id, { home, since: now });
      if (prev) {
        // a real transition, not the first reading after a restart
        db.events.add({ type: 'presence', payload: { device: r.name, owner: r.owner || null, home } }).catch(() => {});
        db.audit('presence', home ? 'device.arrived' : 'device.left', { device: r.name, owner: r.owner || null }).catch(() => {});
        onChange({ device: r, home });
      }
    }
    devices.push({
      id: r.id, name: r.name, kind: r.kind, owner: r.owner, owner_account_id: r.owner_account_id,
      home, seen_now: seenNow,
      last_seen: seenNow ? new Date().toISOString() : (r.last_seen || null),
      confidence: seenNow ? 'certain' : (home ? 'recent' : (lastSeen ? 'stale' : 'unknown'))
    });
  }

  // Roll devices up to people. Someone is home if any device of theirs is.
  const byOwner = new Map();
  for (const d of devices) {
    if (!d.owner_account_id) continue;
    const cur = byOwner.get(d.owner_account_id) || { account_id: d.owner_account_id, name: d.owner, home: false, devices: [], confidence: 'unknown' };
    cur.devices.push(d.name);
    if (d.home) { cur.home = true; cur.confidence = d.seen_now ? 'certain' : 'recent'; }
    else if (!cur.home) cur.confidence = d.confidence;
    byOwner.set(d.owner_account_id, cur);
  }

  last = {
    at: new Date().toISOString(),
    people: [...byOwner.values()],
    devices,
    unassigned: devices.filter(d => !d.owner_account_id).length,
    note: byOwner.size ? undefined : 'no device on the register has an owner yet, so this is device-level only'
  };
  return last;
}

const current = () => last;
function start(hook) {
  if (hook) onChange = hook;
  if (timer) return;
  setTimeout(() => sweep().catch(() => {}), 8000);
  timer = setInterval(() => sweep().catch(() => {}), POLL_MS);
}

module.exports = { sweep, current, start, GRACE_MS };
