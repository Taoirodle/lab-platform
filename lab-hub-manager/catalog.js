// ============================================================
//  L.A.B App Store — first-party catalog
//  Real store data: each app has an icon, a tagline, a full description,
//  a category, a size/version, and generated preview "screenshots".
//  The Dev Team's App-Store build pipeline publishes into this catalog;
//  for Beta 1.0 the first-party line-up is defined here.
// ============================================================

// --- Line-drawn app icons (match the Hub's glass/line aesthetic) ------------
const ICON = {
  sauce:   `<circle cx="16" cy="16" r="9"/><circle cx="16" cy="16" r="3.4"/><path d="M16 3.5v3M16 25.5v3M3.5 16h3M25.5 16h3"/>`,
  rooms:   `<path d="M5 14 16 5l11 9"/><path d="M8 13v13h16V13"/><rect x="13.5" y="18" width="5" height="8"/>`,
  family:  `<circle cx="11" cy="12" r="3.4"/><circle cx="21" cy="12" r="3.4"/><path d="M5 26c0-4 3-6.5 6-6.5S17 22 17 26M15 26c0-4 3-6.5 6-6.5s6 2.5 6 6.5"/>`,
  vault:   `<rect x="5" y="5" width="22" height="22" rx="3"/><circle cx="16" cy="16" r="4.5"/><path d="M16 16v5"/>`,
  pulse:   `<path d="M4 16h5l3-8 4 16 3-8h5"/>`,
  media:   `<rect x="4" y="7" width="24" height="18" rx="3"/><path d="M13 12.5l6 3.5-6 3.5z"/>`,
  notes:   `<path d="M8 4h12l4 4v20H8z"/><path d="M20 4v4h4M12 15h8M12 20h8"/>`,
  guardian:`<path d="M16 4l10 4v7c0 6.5-4.4 10.6-10 13-5.6-2.4-10-6.5-10-13V8z"/><path d="M12 15.5l3 3 5-6"/>`
};

// --- Generated preview "screenshots" (SVG, tinted per app) ------------------
function preview(style, accent) {
  const bg = '#0d1020', card = 'rgba(255,255,255,.06)', line = 'rgba(255,255,255,.12)', dim = 'rgba(255,255,255,.28)';
  const head = `<rect width="320" height="180" fill="${bg}"/><rect x="0" y="0" width="320" height="30" fill="rgba(255,255,255,.03)"/><circle cx="16" cy="15" r="5" fill="${accent}"/><rect x="28" y="12" width="70" height="6" rx="3" fill="${dim}"/>`;
  const box = (x, y, w, h, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${f || card}" stroke="${line}"/>`;
  const bar = (x, y, w, c) => `<rect x="${x}" y="${y}" width="${w}" height="6" rx="3" fill="${c || dim}"/>`;
  let body = '';
  if (style === 'chat') {
    body = box(16, 44, 200, 22) + bar(26, 52, 150, dim)
      + `<rect x="120" y="76" width="184" height="24" rx="12" fill="${accent}" opacity=".85"/>` + bar(132, 85, 150, '#0d1020')
      + box(16, 110, 210, 22) + bar(26, 118, 160, dim)
      + `<rect x="16" y="150" width="288" height="18" rx="9" fill="${card}" stroke="${line}"/>`;
  } else if (style === 'controls') {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const on = (i + j) % 2 === 0;
      body += box(16 + i * 100, 44 + j * 62, 88, 52, on ? accent + '30' : card);
      body += `<circle cx="${30 + i * 100}" cy="${60 + j * 62}" r="7" fill="${on ? accent : dim}"/>` + bar(24 + i * 100, 78 + j * 62, 50);
    }
  } else if (style === 'board') {
    for (let c = 0; c < 3; c++) { body += box(16 + c * 100, 44, 88, 120); bar(0, 0, 0);
      for (let r = 0; r < 3; r++) body += box(24 + c * 100, 54 + r * 34, 72, 26, accent + (r === 0 ? '35' : '18')); }
  } else if (style === 'grid') {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++)
      body += box(16 + i * 74, 44 + j * 64, 64, 54, i % 2 === j % 2 ? accent + '25' : card);
  } else if (style === 'dashboard') {
    body = box(16, 44, 140, 120) + `<path d="M28 130 L58 100 L88 116 L118 78 L144 92" fill="none" stroke="${accent}" stroke-width="2.5"/>`
      + box(168, 44, 136, 56) + bar(180, 60, 90, accent) + bar(180, 74, 60)
      + box(168, 108, 136, 56) + bar(180, 124, 70) + bar(180, 138, 100, accent);
  } else if (style === 'media') {
    for (let i = 0; i < 3; i++) body += box(16 + i * 100, 44, 88, 74, accent + '22') + `<path d="M${52 + i * 100} 72 l14 9 -14 9z" fill="${accent}"/>`;
    body += box(16, 128, 288, 36) + bar(28, 140, 120, accent) + bar(28, 152, 200);
  } else if (style === 'list') {
    for (let i = 0; i < 4; i++) body += box(16, 44 + i * 30, 288, 24) + bar(28, 52 + i * 30, 40, accent) + bar(80, 52 + i * 30, 180);
  } else { // shield
    body = box(16, 44, 288, 120) + `<path d="M160 60 l40 16 v26 c0 24-17 40-40 50 -23-10-40-26-40-50 V76z" fill="${accent}22" stroke="${accent}" stroke-width="2"/>`
      + bar(60, 150, 70) + bar(200, 150, 60, accent);
  }
  return `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" width="100%" preserveAspectRatio="xMidYMid slice">${head}${body}</svg>`;
}

const APPS = [
  { id: 'sauce', name: 'The Sauce', tagline: 'Your AI, wired into your whole L.A.B', category: 'Assistant', accent: '#b79bff',
    version: '0.9', size_bytes: 48_400_000, status: 'soon', featured: true, screens: 'chat',
    desc: 'The Sauce is the AI that runs your world. Ask it anything, hand it real tasks, and let it act across your Hub, your devices, and your server. It learns how you work and quietly gets more useful every day.' },
  { id: 'rooms', name: 'Rooms', tagline: 'Control every light and device at home', category: 'Home', accent: '#38d9c4',
    version: '1.0', size_bytes: 12_100_000, status: 'published', screens: 'controls',
    desc: 'One clean panel for the whole house — lights, plugs, and smart devices grouped by room. Tap to toggle, set scenes, and see what is on at a glance. Runs entirely on your own server, no cloud account required.' },
  { id: 'family', name: 'Family Board', tagline: 'Shared calendar, notes and chores', category: 'Family', accent: '#f2b23e',
    version: '1.0', size_bytes: 9_800_000, status: 'published', screens: 'board',
    desc: 'The whiteboard for your household. A shared calendar, running lists, and chores everyone can see and update. Each family member gets their own lane, and the board stays in sync across every device on your L.A.B.' },
  { id: 'vault', name: 'Vault', tagline: 'Private files and photos, on your server', category: 'Storage', accent: '#6fb4ff',
    version: '1.0', size_bytes: 15_300_000, status: 'published', screens: 'grid',
    desc: 'Your own private cloud. Drop in files and photos and reach them from anywhere on your L.A.B — encrypted at rest on the server SSD, never on someone else\'s machine. Automatic backups keep everything safe.' },
  { id: 'pulse', name: 'Pulse', tagline: 'Live health of all your devices', category: 'System', accent: '#4ade80',
    version: '1.0', size_bytes: 7_200_000, status: 'published', screens: 'dashboard',
    desc: 'A calm, live read-out of your fleet — which devices are online, how the server is holding up, and what the Dev Team just shipped. Pulse turns the Manager\'s telemetry into something anyone in the house can understand.' },
  { id: 'media', name: 'Media', tagline: 'Your home library, streamed anywhere', category: 'Entertainment', accent: '#ff6f9c',
    version: '0.8', size_bytes: 22_600_000, status: 'published', screens: 'media',
    desc: 'Every film, show, and track you own, streamed from the server to any screen on your L.A.B. Pick up where you left off, build shared playlists, and keep it all under your own roof.' },
  { id: 'notes', name: 'Notes', tagline: 'Fast, private notes that sync', category: 'Productivity', accent: '#9aa4bd',
    version: '1.0', size_bytes: 4_100_000, status: 'published', screens: 'list',
    desc: 'Frictionless notes that open instantly and sync across your devices through your server. No accounts, no ads, no cloud — just a fast place to think, kept private on your own L.A.B.' },
  { id: 'guardian', name: 'Guardian', tagline: 'Network safety and content controls', category: 'Safety', accent: '#ff7a6b',
    version: '0.9', size_bytes: 11_400_000, status: 'published', screens: 'shield',
    desc: 'Household-wide safety, powered by the server\'s Pi-Hole. Block ads and trackers, set content boundaries per account, and see a clean summary of what your network is filtering — with the sensitive detail dropped, never stored.' }
];

const list = () => APPS.map(a => ({
  id: a.id, name: a.name, tagline: a.tagline, category: a.category, accent: a.accent,
  version: a.version, size_bytes: a.size_bytes, status: a.status, featured: !!a.featured,
  icon: ICON[a.id] || '', preview: preview(a.screens, a.accent)
}));

const get = id => {
  const a = APPS.find(x => x.id === id);
  if (!a) return null;
  return { ...a, icon: ICON[a.id] || '', preview: preview(a.screens, a.accent) };
};

const categories = () => [...new Set(APPS.map(a => a.category))];

module.exports = { list, get, categories, APPS };
