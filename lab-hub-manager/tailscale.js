// ============================================================
//  Off-site access — the server's own view of its Tailscale network.
//  Tailscale is how family reach the Hub from outside the house: a private
//  network between their devices and this box, nothing published anywhere.
//
//  Reading the network needs no privileges (`tailscale status --json`).
//  Switching access on and off needs the service user to be tailscaled's
//  operator, set once at install:   sudo tailscale set --operator=tao
//
//  This module reports; it never decides who is trusted. The off-network guard
//  in server.js treats every Tailscale address as outside the house.
// ============================================================
const { execFile } = require('child_process');
const http = require('http');

const BIN = process.env.TAILSCALE_BIN || 'tailscale';
const SOCK = process.env.TAILSCALE_SOCKET || '/var/run/tailscale/tailscaled.sock';

/// Addresses Tailscale hands out: 100.64.0.0/10, and fd7a:115c:a1e0::/48 on IPv6.
function isTailnetIP(ip) {
  const m = /^100\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(ip || '');
  if (m) return +m[1] >= 64 && +m[1] <= 127;
  return /^fd7a:115c:a1e0:/i.test(ip || '');
}

const cli = (args, ms = 8000) => new Promise(res => execFile(BIN, args, { timeout: ms, maxBuffer: 4 << 20 },
  (e, out, err) => res({ ok: !e, missing: !!(e && e.code === 'ENOENT'), out: String(out || ''), err: String(err || '').trim() })));

// The daemon's local API, for the one thing the CLI can't do without re-stating
// every setting: ask Tailscale for a fresh sign-in link.
function local(method, route) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: SOCK, method, path: '/localapi/v0/' + route,
      headers: { Host: 'local-tailscaled.sock', 'Sec-Tailscale': 'localapi' }, timeout: 8000 }, r => {
      let d = ''; r.on('data', c => { d += c; });
      r.on('end', () => (r.statusCode < 300 ? resolve(d) : reject(new Error(d.trim() || 'tailscaled said ' + r.statusCode))));
    });
    req.on('timeout', () => req.destroy(new Error('tailscaled did not answer')));
    req.on('error', reject);
    req.end();
  });
}

// Which tailnet addresses have actually used the Manager lately — so the Admin
// page can say who reaches the Hub, not just who could. Memory only.
const seen = new Map();
const touch = ip => { seen.set(ip, Date.now()); };

const NEVER = /^0001-01-01/;
const stamp = t => (!t || NEVER.test(t) ? null : t);
const bare = s => String(s || '').replace(/\.$/, '') || null;
const v4 = list => (list || []).find(a => a.includes('.')) || null;

function shape(j) {
  const users = j.User || {}, self = j.Self || {};
  const owner = p => (p.Tags && p.Tags.length ? p.Tags.join(' ')
    : ((users[p.UserID] || {}).DisplayName || (users[p.UserID] || {}).LoginName || 'unknown'));
  const peers = Object.values(j.Peer || {}).map(p => {
    const ip = v4(p.TailscaleIPs);
    return {
      name: p.HostName, dns: bare(p.DNSName), ip, os: p.OS || '',
      owner: owner(p), guest: !!p.ShareeNode,          // guest = someone this server was shared with
      online: !!p.Online, last_seen: stamp(p.LastSeen), expired: !!p.Expired,
      // how it reaches us, without publishing where it is: direct, or which relay city
      link: p.CurAddr ? 'direct' : (p.Relay ? 'relay · ' + p.Relay : null),
      hub_seen: ip && seen.has(ip) ? new Date(seen.get(ip)).toISOString() : null
    };
  }).sort((a, b) => (b.online - a.online) || String(a.name).localeCompare(String(b.name)));
  return {
    installed: true,
    state: j.BackendState,          // NeedsLogin · NeedsMachineAuth · Stopped · Starting · Running
    auth_url: j.AuthURL || null,
    version: String(j.Version || '').split('-')[0] || null,
    tailnet: j.CurrentTailnet ? { name: j.CurrentTailnet.Name, magic_dns: !!j.CurrentTailnet.MagicDNSEnabled } : null,
    self: { name: self.HostName || null, dns: bare(self.DNSName), ip: v4(j.TailscaleIPs || self.TailscaleIPs),
      key_expiry: stamp(self.KeyExpiry) },           // null = expiry switched off (or a tagged server)
    health: (j.Health || []).slice(0, 5),
    peers
  };
}

let cache = { t: 0, v: null };
async function status(fresh) {
  if (!fresh && cache.v && Date.now() - cache.t < 5000) return cache.v;
  const r = await cli(['status', '--json']);
  let v;
  if (r.missing) v = { installed: false };
  else {
    let j = null; try { j = JSON.parse(r.out); } catch {}
    v = j ? shape(j) : { installed: true, state: 'Unavailable',
      error: (r.err || r.out).split('\n')[0].slice(0, 200) || 'tailscaled is not answering' };
  }
  cache = { t: Date.now(), v };
  return v;
}

/// Where someone outside the house points a browser. Answers from the last
/// reading so a page load never waits on the daemon; null until the server is
/// on the network and switched on.
function address(port) {
  if (!cache.v || Date.now() - cache.t > 30000) status().catch(() => {});
  const s = cache.v;
  if (!s || s.state !== 'Running' || !s.self || !s.self.ip) return null;
  return { ip: s.self.ip, url: `http://${s.self.ip}:${port}/hub/`, dns_url: s.self.dns ? `http://${s.self.dns}:${port}/hub/` : null };
}

const explain = err => (/access denied|permission|operator|must be root/i.test(err)
  ? 'The Manager is not allowed to switch Tailscale. On the server run: sudo tailscale set --operator=tao'
  : (err.split('\n')[0] || 'Tailscale refused'));

/// The off-site switch. `down` keeps the sign-in, so `up` comes straight back.
async function setRunning(on) {
  const cur = await status(true);
  if (!cur.installed) throw new Error('Tailscale is not installed on this server.');
  if (on && /^Needs/.test(cur.state || '')) throw new Error('Sign the server in first.');
  const r = await cli([on ? 'up' : 'down'], 20000);
  cache.t = 0;
  if (!r.ok) throw new Error(explain(r.err));
  return status(true);
}

/// A fresh sign-in link — for when the server was signed out or its key expired.
async function login() {
  await local('POST', 'login-interactive');
  for (let i = 0; i < 20; i++) {                       // the link arrives from Tailscale a moment later
    const s = await status(true);
    if (s.auth_url || s.state === 'Running') return s;
    await new Promise(r => setTimeout(r, 500));
  }
  return status(true);
}

module.exports = { isTailnetIP, touch, status, address, setRunning, login };
