// ============================================================
//  L.A.B Conductor — the native device engine
//  Our own smart-home core. Zero third-party platform, zero borrowed code —
//  the good IDEAS of the genre (entities, a state store, an event bus,
//  drivers, scenes, automations) reimplemented as L.A.B architecture:
//
//    entities    — every device the house knows (SQL-backed, ledger-fed)
//    drivers     — one small protocol driver per device family:
//                    wled    · WLED LED strips (local HTTP JSON)
//                    wiz     · WiZ bulbs (local UDP 38899 JSON)
//                    push    · our own ESP32 sensors (they call US)
//                    virtual · simulated devices (kiosk rooms, demos, tests)
//    scenes      — named looks ("movie-night") = a set of entity commands;
//                  the showcase choreography rides on these
//    automations — trigger (an event) → actions (entity commands)
//
//  Every state change lands in the events firehose + kiosk/client ledgers,
//  so the Dev Team finally gets real-world signal. New device family = one
//  new driver file the AI team can write as a future "driver" artifact kind.
// ============================================================
const crypto = require('crypto');
const dgram = require('dgram');
const http = require('http');
const { EventEmitter } = require('events');
const db = require('./db');
const ledgers = require('./ledgers');

const uid = () => crypto.randomBytes(6).toString('hex');
const bus = new EventEmitter();          // the in-process event bus
bus.setMaxListeners(50);

// ---------------------------------------------------------------------------
//  Drivers — tiny, honest protocol adapters. Each: probe(entity) -> bool,
//  apply(entity, cmd) -> newStatePatch. cmd: {on,toggle,bri(0-255),color:[r,g,b],temp,effect}
// ---------------------------------------------------------------------------
function httpJSON(method, host, port, path, body, timeout = 3500) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({ host, port, path, method, timeout,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} },
      res => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); });
    req.on('error', reject); req.on('timeout', () => { req.destroy(new Error('timeout')); });
    if (data) req.write(data); req.end();
  });
}
function udpJSON(host, port, obj, waitReply = true, timeout = 2500) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4');
    const msg = Buffer.from(JSON.stringify(obj));
    const t = setTimeout(() => { sock.close(); waitReply ? reject(new Error('timeout')) : resolve(null); }, timeout);
    if (waitReply) sock.on('message', m => { clearTimeout(t); sock.close(); try { resolve(JSON.parse(m.toString())); } catch { resolve(null); } });
    sock.send(msg, port, host, err => {
      if (err) { clearTimeout(t); sock.close(); return reject(err); }
      if (!waitReply) { clearTimeout(t); sock.close(); resolve(null); }
    });
  });
}

const DRIVERS = {
  // WLED strips — http://<addr>/json/state
  wled: {
    probe: async (e) => { const r = await httpJSON('GET', e.address, e.port || 80, '/json/state').catch(() => null); return !!r; },
    apply: async (e, cmd) => {
      const body = {};
      if (cmd.toggle) body.on = !(e.state && e.state.on);
      if (cmd.on !== undefined) body.on = !!cmd.on;
      if (cmd.bri !== undefined) body.bri = Math.max(1, Math.min(255, cmd.bri | 0));
      if (cmd.color) body.seg = [{ col: [cmd.color.slice(0, 3).map(v => Math.max(0, Math.min(255, v | 0)))] }];
      if (cmd.effect !== undefined) body.seg = [{ ...(body.seg ? body.seg[0] : {}), fx: cmd.effect | 0 }];
      await httpJSON('POST', e.address, e.port || 80, '/json/state', body);
      return { on: body.on !== undefined ? body.on : (e.state && e.state.on), bri: body.bri ?? (e.state && e.state.bri), color: cmd.color || (e.state && e.state.color) };
    }
  },
  // WiZ bulbs — UDP :38899 {"method":"setPilot","params":{...}}
  wiz: {
    probe: async (e) => { const r = await udpJSON(e.address, e.port || 38899, { method: 'getPilot', params: {} }).catch(() => null); return !!(r && r.result); },
    apply: async (e, cmd) => {
      const p = {};
      if (cmd.toggle) p.state = !(e.state && e.state.on);
      if (cmd.on !== undefined) p.state = !!cmd.on;
      if (cmd.bri !== undefined) p.dimming = Math.max(10, Math.min(100, Math.round((cmd.bri / 255) * 100)));
      if (cmd.color) { const [r, g, b] = cmd.color; p.r = r | 0; p.g = g | 0; p.b = b | 0; }
      if (cmd.temp !== undefined) p.temp = Math.max(2200, Math.min(6500, cmd.temp | 0));
      await udpJSON(e.address, e.port || 38899, { method: 'setPilot', params: p }, false);
      return { on: p.state !== undefined ? p.state : (e.state && e.state.on), bri: cmd.bri ?? (e.state && e.state.bri), color: cmd.color || (e.state && e.state.color), temp: p.temp ?? (e.state && e.state.temp) };
    }
  },
  // Our own ESP32 sensors — passive: the device pushes to /api/ingest/<token>
  push: {
    probe: async (e) => !!(e.last_seen && Date.now() - new Date(e.last_seen).getTime() < 10 * 60000),
    apply: async () => { throw new Error('push devices are read-only sensors'); }
  },
  // Virtual devices — kiosk rooms, demos, tests. Always work.
  virtual: {
    probe: async () => true,
    apply: async (e, cmd) => {
      const s = { ...(e.state || {}) };
      if (cmd.toggle) s.on = !s.on;
      if (cmd.on !== undefined) s.on = !!cmd.on;
      if (cmd.bri !== undefined) s.bri = cmd.bri | 0;
      if (cmd.color) s.color = cmd.color.slice(0, 3);
      return s;
    }
  }
};

// ---------------------------------------------------------------------------
//  Entity store
// ---------------------------------------------------------------------------
async function listEntities() {
  return db.pool.query('SELECT * FROM entities ORDER BY room, name').then(r => r.rows);
}
async function getEntity(id) {
  return db.pool.query('SELECT * FROM entities WHERE id=$1', [id]).then(r => r.rows[0] || null);
}
async function addEntity({ name, kind = 'light', room = 'general', driver = 'virtual', address = null, port = null, config = {} }) {
  if (!DRIVERS[driver]) throw new Error('unknown driver: ' + driver);
  const id = uid(), token = uid() + uid();
  await db.pool.query(
    `INSERT INTO entities(id,name,kind,room,driver,address,port,token,config,state)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'{}')`,
    [id, name, kind, room, driver, address, port, token, JSON.stringify(config)]);
  bus.emit('entity', { entity: id, event: 'added' });
  return { id, name, token };
}
async function removeEntity(id) { await db.pool.query('DELETE FROM entities WHERE id=$1', [id]); }

async function setState(id, patch, source = 'driver') {
  const r = await db.pool.query(
    `UPDATE entities SET state = state || $2::jsonb, online=true, last_seen=now() WHERE id=$1 RETURNING id,name,room,kind,state`,
    [id, JSON.stringify(patch || {})]);
  const e = r.rows[0]; if (!e) return null;
  const ev = { entity: e.id, name: e.name, room: e.room, kind: e.kind, state: e.state, source };
  bus.emit('state', ev);
  db.events.add({ type: 'device', payload: { entity: e.id, room: e.room, kind: e.kind, patch } }).catch(() => {});
  ledgers.signal('kiosk', e.room, 'device:' + e.kind, 1).catch(() => {});
  runAutomations({ type: 'state', ...ev }).catch(() => {});
  return e;
}

// The one way anything (Hub, kiosk, Sauce, showcase) drives a device.
async function command(id, cmd, actor = 'system') {
  const e = await getEntity(id); if (!e) throw new Error('no such entity');
  const drv = DRIVERS[e.driver]; if (!drv) throw new Error('no driver ' + e.driver);
  const patch = await drv.apply(e, cmd || {});
  const out = await setState(id, patch, actor);
  db.audit(actor, 'device.command', { entity: id, cmd }).catch(() => {});
  return out;
}

// Sensor ingest (our ESP32s POST here through the server route)
async function ingest(token, payload) {
  const r = await db.pool.query('SELECT id,room,kind FROM entities WHERE token=$1', [token]);
  const e = r.rows[0]; if (!e) return null;
  await setState(e.id, payload || { triggered: true, at: Date.now() }, 'sensor');
  if (e.kind === 'motion') {
    db.events.add({ type: 'motion', payload: { entity: e.id, room: e.room } }).catch(() => {});
    bus.emit('motion', { entity: e.id, room: e.room });
    runAutomations({ type: 'motion', entity: e.id, room: e.room }).catch(() => {});
  }
  return e;
}

// ---------------------------------------------------------------------------
//  Scenes — named looks. The showcase's choreography primitives.
// ---------------------------------------------------------------------------
async function listScenes() { return db.pool.query('SELECT * FROM scenes ORDER BY name').then(r => r.rows); }
async function saveScene({ id, name, actions }) {
  id = id || uid();
  await db.pool.query(
    `INSERT INTO scenes(id,name,actions) VALUES($1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET name=$2, actions=$3`, [id, name, JSON.stringify(actions || [])]);
  return { id, name };
}
async function runScene(idOrName, actor = 'scene') {
  const r = await db.pool.query('SELECT * FROM scenes WHERE id=$1 OR lower(name)=lower($1) LIMIT 1', [idOrName]);
  const sc = r.rows[0]; if (!sc) throw new Error('no such scene');
  const results = [];
  for (const a of (sc.actions || [])) {
    try { results.push(await command(a.entity, a.cmd, actor + ':' + sc.name)); }
    catch (e) { results.push({ entity: a.entity, error: e.message }); }
  }
  db.events.add({ type: 'scene', payload: { scene: sc.name } }).catch(() => {});
  return { scene: sc.name, results };
}

// ---------------------------------------------------------------------------
//  Automations — trigger (event) → actions (commands or a scene)
//  trigger: {type:'motion'|'state', room?, entity?}  ·  action: {scene} or {entity,cmd}
// ---------------------------------------------------------------------------
async function listAutomations() { return db.pool.query('SELECT * FROM automations ORDER BY name').then(r => r.rows); }
async function saveAutomation({ id, name, trigger, actions, enabled = true }) {
  id = id || uid();
  await db.pool.query(
    `INSERT INTO automations(id,name,trigger,actions,enabled) VALUES($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET name=$2, trigger=$3, actions=$4, enabled=$5`,
    [id, name, JSON.stringify(trigger || {}), JSON.stringify(actions || []), enabled]);
  return { id, name };
}
async function runAutomations(ev) {
  const autos = await db.pool.query('SELECT * FROM automations WHERE enabled=true').then(r => r.rows).catch(() => []);
  for (const a of autos) {
    const t = a.trigger || {};
    if (t.type && t.type !== ev.type) continue;
    if (t.room && t.room !== ev.room) continue;
    if (t.entity && t.entity !== ev.entity) continue;
    for (const act of (a.actions || [])) {
      try {
        if (act.scene) await runScene(act.scene, 'automation:' + a.name);
        else if (act.entity) await command(act.entity, act.cmd, 'automation:' + a.name);
      } catch { /* an automation must never crash the engine */ }
    }
    db.audit('automation', 'fired', { name: a.name, on: ev.type }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
//  Health + seeding (kiosk rooms become real engine entities)
// ---------------------------------------------------------------------------
async function probeAll() {
  const list = await listEntities(); const out = [];
  for (const e of list) {
    const ok = await (DRIVERS[e.driver] ? DRIVERS[e.driver].probe(e).catch(() => false) : false);
    await db.pool.query('UPDATE entities SET online=$2 WHERE id=$1', [e.id, !!ok]).catch(() => {});
    out.push({ id: e.id, name: e.name, driver: e.driver, online: !!ok });
  }
  return out;
}
async function seed() {
  const n = await db.pool.query('SELECT count(*) c FROM entities').then(r => +r.rows[0].c).catch(() => 1);
  if (n > 0) return;
  // migrate the kiosk's rooms into real (virtual-driver) engine entities
  const rooms = await db.settings.get('rooms', null) ||
    [{ id: 'living', name: 'Living Room', on: false }, { id: 'kitchen', name: 'Kitchen', on: false },
     { id: 'bedroom', name: 'Bedroom', on: false }, { id: 'studio', name: 'Studio', on: false },
     { id: 'outside', name: 'Outside', on: false }];
  for (const r of rooms) {
    const { id } = await addEntity({ name: r.name, kind: 'light', room: r.id, driver: 'virtual' });
    await setState(id, { on: !!r.on }, 'seed');
  }
  await saveScene({ name: 'movie-night', actions: (await listEntities()).filter(e => e.room === 'living').map(e => ({ entity: e.id, cmd: { on: true, bri: 60, color: [255, 160, 90] } })) });
  await saveScene({ name: 'all-off', actions: (await listEntities()).map(e => ({ entity: e.id, cmd: { on: false } })) });
  return true;
}

module.exports = { bus, DRIVERS: Object.keys(DRIVERS), listEntities, getEntity, addEntity, removeEntity, command, setState, ingest, listScenes, saveScene, runScene, listAutomations, saveAutomation, probeAll, seed };
