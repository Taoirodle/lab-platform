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
// Same, but keeps the exit status. A ping that replied is the strongest evidence
// we have and the old code threw it on the floor.
const shOk = (cmd, args, ms = 10000) => new Promise(res => execFile(cmd, args, { timeout: ms }, e => res(!e)));

let timer = null;
let last = { people: [], devices: [], at: null };
const state = new Map();   // asset id → { home, since }
let onChange = () => {};

/// Devices worth watching: anything on the register with an address, that is a
/// phone, tablet, laptop or PC — the things that come and go with a person.
const WATCH_KINDS = new Set(['phone', 'tablet', 'laptop', 'pc', 'watch']);

async function watched() {
  const rows = await db.pool.query(
    `SELECT a.id, a.name, a.kind, a.ip, a.mac, a.owner_account_id, a.confirmed, a.source, a.last_seen, acc.name AS owner
     FROM house_assets a LEFT JOIN accounts acc ON acc.id = a.owner_account_id
     WHERE a.status = 'active' AND (a.ip IS NOT NULL OR a.mac IS NOT NULL)`).then(r => r.rows);
  return rows.filter(r => WATCH_KINDS.has(r.kind));
}

/// One sweep: knock on each watched address, then read the ARP table for truth.
async function sweep() {
  const rows = await watched();
  if (!rows.length) { last = { people: [], devices: [], at: new Date().toISOString(), note: 'no phones or PCs on the register yet' }; return last; }

  // Knock, and remember who answered.
  const ips = [...new Set(rows.map(r => r.ip).filter(Boolean))];
  const replied = new Set();
  for (let i = 0; i < ips.length; i += 32) {
    const batch = ips.slice(i, i + 32);
    const oks = await Promise.all(batch.map(ip => shOk('ping', ['-c', '1', '-W', '1', ip], 3000)));
    batch.forEach((ip, k) => { if (oks[k]) replied.add(ip); });
  }

  // Three grades of evidence, because they are genuinely different things:
  //   replied   — it answered us just now. Proof.
  //   REACHABLE — the kernel confirmed it inside its own reachability window. Proof.
  //   cached    — there is a neighbour entry with a MAC, but nothing has
  //               confirmed it recently. That is where it WAS, not where it is.
  // The old code lumped all three together, so a cached entry refreshed
  // last_seen on every sweep and the grace window could never expire: a phone
  // that left the house stayed "home · certain" indefinitely.
  //
  // Note we cannot simply demand REACHABLE either. ICMP does not give the
  // kernel upper-layer confirmation, so a device we just pinged typically reads
  // DELAY or PROBE for a few seconds — which is why the ping result, not the
  // table, is the primary signal.
  const arp = await sh('ip', ['neigh']);
  const sure = { macs: new Set(), ips: new Set() };
  const cached = { macs: new Set(), ips: new Set() };
  for (const line of arp.split('\n')) {
    if (!line.trim() || /FAILED|INCOMPLETE/i.test(line)) continue;
    const ip = (line.trim().split(/\s+/)[0] || '');
    const mac = (/lladdr\s+([0-9a-f:]{17})/i.exec(line) || [])[1];
    if (!mac) continue;
    const bucket = /\bREACHABLE\b/i.test(line) ? sure : cached;
    bucket.macs.add(mac.toLowerCase());
    bucket.ips.add(ip);
  }

  const now = Date.now(), devices = [];
  for (const r of rows) {
    const mac = r.mac ? r.mac.toLowerCase() : null;
    const answered = !!(r.ip && replied.has(r.ip));
    const reachable = !!((mac && sure.macs.has(mac)) || (r.ip && sure.ips.has(r.ip)));
    const onlyCached = !!((mac && cached.macs.has(mac)) || (r.ip && cached.ips.has(r.ip)));
    const seenNow = answered || reachable;
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
    // A device with no IP cannot be pinged, so the only confirmation available
    // is a REACHABLE row we did not ask for. Rather than quietly calling those
    // people absent, say we do not know and ask for an address.
    const probeable = !!r.ip;
    const why = answered ? 'answered a ping'
      : reachable ? 'confirmed on the network by the kernel'
      : onlyCached ? 'a cached address entry only — not confirmed this sweep'
      : probeable ? 'did not answer' : 'no IP on the register, so it cannot be probed';

    devices.push({
      id: r.id, name: r.name, kind: r.kind, owner: r.owner, owner_account_id: r.owner_account_id,
      owner_confirmed: !!r.confirmed, owner_source: r.source || null,
      home, seen_now: seenNow, probeable, why,
      last_seen: seenNow ? new Date().toISOString() : (r.last_seen || null),
      confidence: seenNow ? 'certain'
        : home ? 'recent'
        : (!probeable && onlyCached) ? 'unknown'
        : (lastSeen ? 'stale' : 'unknown')
    });
  }

  // Roll devices up to people. Someone is home if any device of theirs is.
  //
  // A claim about a PERSON is only as good as the claim that the device is
  // theirs. Several of these links were guessed by a scan, not confirmed by a
  // human, and a guess about the owner cannot produce certainty about the
  // person — so an unconfirmed link caps confidence and says whose word it is on.
  const byOwner = new Map();
  for (const d of devices) {
    if (!d.owner_account_id) continue;
    const cur = byOwner.get(d.owner_account_id) ||
      { account_id: d.owner_account_id, name: d.owner, home: false, devices: [], confidence: 'unknown', assumed: false };
    cur.devices.push(d.name);
    if (d.home) {
      cur.home = true;
      const fromDevice = d.seen_now ? 'certain' : 'recent';
      cur.confidence = d.owner_confirmed ? fromDevice : 'recent';
      if (!d.owner_confirmed) cur.assumed = true;
    } else if (!cur.home) cur.confidence = d.confidence;
    byOwner.set(d.owner_account_id, cur);
  }
  for (const p of byOwner.values()) {
    if (!p.assumed) continue;
    const guessed = devices.filter(d => d.owner_account_id === p.account_id && !d.owner_confirmed).map(d => d.name);
    p.why = `nobody has confirmed ${guessed.join(' or ')} belongs to ${p.name} — confirm it in Admin → The House → Kit`;
  }

  const unprobeable = devices.filter(d => !d.probeable).map(d => d.name);
  last = {
    at: new Date().toISOString(),
    people: [...byOwner.values()],
    devices,
    unassigned: devices.filter(d => !d.owner_account_id).length,
    note: byOwner.size ? undefined : 'no device on the register has an owner yet, so this is device-level only',
    needs_address: unprobeable.length ? unprobeable : undefined
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
