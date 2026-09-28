// ============================================================
//  L.A.B — admin sign-in for the control pages (Admin Portal, Manager
//  dashboard, Installer). Unlocking the Portal with the USB key gets a server
//  session; this adds it to every API call these pages make. When the server
//  says the session is missing or over, pages hear 'lab-admin-locked' and say
//  so, instead of every panel failing on its own.
// ============================================================
(() => {
  const KEY = 'lab_admin_session';
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
  const orig = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const s = get();
    if (s && s.token && typeof input === 'string' && url.includes('/api/')) {
      init = { ...(init || {}), headers: { ...((init && init.headers) || {}), 'X-Lab-Admin': s.token } };
    }
    return orig(input, init).then(r => {
      if (r.status === 401 && r.headers.get('WWW-Authenticate') === 'LabAdmin') window.dispatchEvent(new CustomEvent('lab-admin-locked'));
      return r;
    });
  };
  window.LabAdmin = {
    get,
    set: v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} },
    clear: () => { try { localStorage.removeItem(KEY); } catch {} },
    unlocked: () => { const s = get(); return !!(s && s.token); }
  };
})();
