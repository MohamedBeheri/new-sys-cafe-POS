// ===================================================================
//  Shell: sign-in, registration, role-based navigation, topbar,
//  notifications, search, Society context and boot sequence
// ===================================================================
'use strict';
const NAV = [
  { sec: 'Overview' },
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', show: () => true },
  { id: 'leadership', label: 'Leadership Centre', icon: 'network', show: () => can('portfolio.view') },
  { sec: 'Society' },
  { id: 'members', label: 'Members', icon: 'users', show: () => !!APP.me.society_id || isAastec() },
  { id: 'committees', label: 'Committees', icon: 'users-round', show: () => !!APP.me.society_id || isAastec() },
  { id: 'approvals', label: 'Approvals', icon: 'clipboard-check', badge: 'approvals', show: () => true },
  { id: 'elections', label: 'Elections', icon: 'vote', show: () => !!APP.me.society_id || can('elections.configure') || can('portfolio.view') },
  { id: 'reports', label: 'Reports', icon: 'file-text', show: () => isLeader() || role('advisor', 'incubator_agent') || can('reports.review') || can('portfolio.view') || hasGrant('report_submission') },
  { id: 'supervision', label: 'Supervision', icon: 'shield-check', show: () => role('advisor') || can('portfolio.view') },
  { id: 'handbook', label: 'Handbook & Governance', icon: 'book-open', show: () => true },
  { sec: 'Community & Calendar' },
  { id: 'community', label: 'Community', icon: 'messages-square', show: () => true },
  { id: 'messages', label: 'Messages', icon: 'mail', badge: 'messages', show: () => true },
  { id: 'calendar', label: 'Calendar & Events', icon: 'calendar-days', show: () => true },
  { id: 'moderation', label: 'Moderation', icon: 'flag', show: () => can('moderation') || hasGrant('community_moderation') },
  { sec: 'Learning & AI' },
  { id: 'learning', label: 'Learning Hub', icon: 'graduation-cap', show: () => true },
  { id: 'coach', label: 'AI Learning Coach', icon: 'sparkles', show: () => true },
  { id: 'certificates', label: 'Certificates', icon: 'award', show: () => true },
  { sec: 'Programmes' },
  { id: 'programmes', label: 'Programmes', icon: 'layers', show: () => true },
  { id: 'incubator', label: 'Incubator', icon: 'rocket', show: () => true },
  { id: 'mentors', label: 'Mentors & Trainers', icon: 'heart-handshake', show: () => true },
  { sec: 'Insights' },
  { id: 'kpi', label: 'KPI & Performance', icon: 'chart-column', show: () => can('kpi.view_all') || role('president', 'vice_president', 'advisor') },
  { id: 'societies', label: 'Societies & Universities', icon: 'landmark', show: () => true },
  { sec: 'Administration', show: () => can('users.manage') || can('audit.view') || can('settings.manage') },
  { id: 'users', label: 'Users & Roles', icon: 'user-cog', show: () => can('users.manage') },
  { id: 'audit', label: 'Audit Log', icon: 'history', show: () => can('audit.view') },
  { id: 'settings', label: 'Settings', icon: 'settings', show: () => can('settings.manage') },
];
const NAV_ALIASES = { post: 'community', groups: 'community', course: 'learning', lesson: 'learning', courses: 'learning', venture: 'incubator', programme: 'programmes', society: 'societies', profile: '', me: '', notifications: '', checkin: 'calendar', election: 'elections', 'mentor-register': 'mentors', 'course-edit': 'learning' };
function setActiveNav(id) { $$('.sb-nav a').forEach(a => a.classList.toggle('active', a.dataset.id === id)); }

// ---------------- theme ----------------
function setTheme(t) { document.documentElement.dataset.theme = t; localStorage.setItem('aastec_theme', t); if (APP.me) route(); }

// ---------------- auth screens ----------------
const authArt = () => `<div class="art">
  <div class="row gap-l"><img src="/img/emblem-white.png" alt="AAST emblem" style="width:82px">${wordmark('lg')}</div>
  <div><div class="chip solid-gold" style="font-size:12px">AASTEC | RALLY SOCIETY</div>
    <h1>Innovation through <span>Collaboration</span></h1>
    <p style="color:rgba(255,255,255,.78);max-width:470px;font-size:15px">One digital platform for every Rally Society — governance, community, the shared calendar, elections, learning, AI and incubation across AAST campuses and partner universities.</p>
    <div class="pillars">${[['sprout', 'Ecosystem'], ['users', 'Community'], ['landmark', 'Governance'], ['graduation-cap', 'Learning'], ['brain-circuit', 'AI'], ['rocket', 'Incubation']].map(([i, t]) => `<span>${ic(i, 'sm')}${t}</span>`).join('')}</div></div>
  <div class="row" style="font-family:Georgia,serif;font-style:italic;color:var(--gold)">${ic('shield-check')} Independent student leadership with supervised governance.</div></div>`;

async function renderLogin(msg = '') {
  document.title = 'Sign in — AASTEC Digital Platform';
  const root = $('#root');
  root.innerHTML = `<div class="auth">${authArt()}<div class="form-side"><div class="box">
    <div class="row mb-l" style="justify-content:center"><img src="/img/logo-full.png" alt="AASTEC" style="width:120px;border-radius:10px"></div>
    <h2>Welcome back</h2><p class="muted mb-l">Sign in to the AASTEC Digital Platform.</p>
    ${msg ? `<div class="banner info">${ic('info')}<div>${esc(msg)}</div></div>` : ''}
    <form id="lf"><div class="field"><label>Email</label><input name="email" type="email" autocomplete="username" required placeholder="name@university.edu"></div>
      <div class="field"><label>Password</label><input name="password" type="password" autocomplete="current-password" required></div>
      <button class="btn btn-primary btn-block btn-lg" type="submit">${ic('log-in')} Sign in</button></form>
    <p class="center mt-l">New to Rally Society? <a href="#" id="go-reg">Create your member account</a></p>
    <div id="demo" class="mt-l"></div>
    <p class="center mt-l small"><a href="/">${ic('arrow-left', 'sm')} Back to the AASTEC website</a> · <button class="link" onclick="setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark')">${ic('moon', 'sm')} Theme</button></p>
  </div></div></div>`;
  $('#lf').onsubmit = async (e) => {
    e.preventDefault(); const b = $('button[type=submit]', e.target);
    await guard(b, async () => { const d = await post('/login', formData(e.target)); TOKEN = d.token; localStorage.setItem('aastec_token', TOKEN); await boot(); });
  };
  $('#go-reg').onclick = (e) => { e.preventDefault(); renderRegister(); };
  try {
    const d = await api('/public/demo-accounts');
    if (d.enabled) $('#demo').innerHTML = `<div class="card surface tight"><div class="row between"><b class="small">${ic('key-round', 'sm')} Demo accounts</b><span class="xs muted">Password: <code>${esc(d.password)}</code></span></div>
      <div class="demo-grid">${d.accounts.map(a => `<button type="button" data-e="${esc(a.email)}" data-p="${esc(d.password)}"><b>${esc(a.label)}</b><span class="muted">${esc(a.full_name)}</span></button>`).join('')}</div></div>`;
    $$('#demo button').forEach(b => b.onclick = () => { $('[name=email]').value = b.dataset.e; $('[name=password]').value = b.dataset.p; $('#lf').requestSubmit(); });
  } catch { /* demo list optional */ }
}

async function renderRegister() {
  const opts = await api('/public/register-options');
  const root = $('#root');
  root.innerHTML = `<div class="auth">${authArt()}<div class="form-side"><div class="box" style="max-width:520px">
    <h2>Join Rally Society</h2><p class="muted mb-l">Create your member account. Your Society President approves new memberships.</p>
    <form id="rf" class="grid-form">
      <div class="field full"><label>Full name *</label><input name="full_name" required></div>
      <div class="field full"><label>University email *</label><input name="email" type="email" required></div>
      <div class="field"><label>Password *</label><input name="password" type="password" minlength="8" required><div class="hint">8+ characters with letters and numbers</div></div>
      <div class="field"><label>University / campus *</label><select name="university_id" id="rg-u" required><option value="">Select…</option>${opts.universities.map(u => `<option value="${u.id}">${esc(u.short_name || u.name)} — ${esc(u.country)}</option>`).join('')}</select></div>
      <div class="field full"><label>Rally Society *</label><select name="society_id" id="rg-s" required><option value="">Select your university first</option></select></div>
      <div class="field"><label>Faculty / major</label><input name="faculty"></div>
      <div class="field"><label>Study year</label><select name="study_year"><option></option>${['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Postgraduate'].map(y => `<option>${y}</option>`).join('')}</select></div>
      <div class="field full"><label>Why do you want to join?</label><textarea name="join_note" style="min-height:70px"></textarea></div>
      <div class="field full check"><input type="checkbox" name="handbook_ack" id="rg-ack" value="1"><label for="rg-ack">I have read and acknowledge the <a href="#" id="rg-hb">Rally Society Handbook</a> and community guidelines.</label></div>
      <div class="full"><button class="btn btn-primary btn-block btn-lg" type="submit">${ic('user-plus')} Create account</button></div>
    </form><p class="center mt-l">Already a member? <a href="#" id="go-login">Sign in</a></p></div></div></div>`;
  $('#rg-u').onchange = () => { const list = opts.societies.filter(s => s.university_id === +$('#rg-u').value); $('#rg-s').innerHTML = list.length ? list.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('') : '<option value="">No active Society yet at this university</option>'; };
  $('#go-login').onclick = (e) => { e.preventDefault(); renderLogin(); };
  $('#rg-hb').onclick = (e) => { e.preventDefault(); modal({ title: 'Rally Society Handbook — key rules', icon: 'book-open', size: 'wide', body: `<ul style="padding-left:18px;line-height:1.9"><li>Every verified member may post personally, subject to community guidelines and moderation.</li><li>Posting as the Society requires President authorization; sensitive posts follow a multi-level approval workflow.</li><li>Only the President creates Society events; members submit proposals.</li><li>Elections open only in the July–August window after Faculty Advisor activation approval. One member, one vote.</li><li>Respect, integrity and data privacy are mandatory; conduct violations affect election eligibility.</li></ul>` }); };
  $('#rf').onsubmit = async (e) => {
    e.preventDefault(); const b = $('button[type=submit]', e.target); const f = formData(e.target); f.handbook_ack = $('#rg-ack').checked;
    await guard(b, async () => { const d = await post('/register', f); TOKEN = d.token; localStorage.setItem('aastec_token', TOKEN); await boot(); toast('Welcome! Your membership is awaiting President approval.'); });
  };
}

function signOut(expired = false) {
  if (TOKEN && !expired) post('/logout').catch(() => {});
  TOKEN = null; APP.me = null; localStorage.removeItem('aastec_token'); APP.timers.forEach(clearInterval); clearInterval(APP.poll);
  location.hash = ''; renderLogin(expired ? 'Your session has ended. Please sign in again.' : '');
}

// ---------------- shell ----------------
function renderShell() {
  const me = APP.me;
  const items = []; let pendingSec = null;
  for (const n of NAV) {
    if (n.sec) { pendingSec = n.show && !n.show() ? null : n.sec; continue; }
    if (!n.show()) continue;
    if (pendingSec) { items.push(`<div class="sec">${pendingSec}</div>`); pendingSec = null; }
    items.push(`<a href="#/${n.id}" data-id="${n.id}">${ic(n.icon)}<span>${n.label}</span>${n.badge ? `<span class="badge hidden" data-badge="${n.badge}"></span>` : ''}</a>`);
  }
  const chapters = (APP.meta.societies.filter(s => s.status === 'active').sort((a, b) => (b.id === me.society_id) - (a.id === me.society_id))).slice(0, 3);
  $('#root').innerHTML = `<div class="app">
    <aside class="sidebar" id="sidebar">
      <div class="sb-brand"><img src="/img/emblem-white.png" alt="AAST">${wordmark()}</div>
      <nav class="sb-nav">${items.join('')}
      <div class="sb-chapters"><h5>OUR RALLY SOCIETIES</h5><div class="seals">${chapters.map(s => `<a href="#/society/${s.id}">${seal(s.short_name)}</a>`).join('')}</div>
        <a class="btn btn-sm" href="#/societies">View all chapters ${ic('arrow-right', 'sm')}</a></div></nav>
      <div class="sb-foot">${esc(APP.meta.settings.platform_name)} · v1.0</div>
    </aside>
    <div class="overlay" id="overlay"></div>
    <div class="main">
      <header class="topbar">
        <button class="tb-btn menu-toggle" id="menu-t" aria-label="Menu">${ic('menu')}</button>
        <div style="position:relative"><button class="ctx" id="ctx-btn">${ic('landmark')}<div class="grow"><b id="ctx-name"></b><small id="ctx-sub"></small></div>${isAastec() ? ic('chevron-down', 'sm') : ''}</button></div>
        <div class="search"><input id="gsearch" placeholder="Search members, events, committees, courses…" autocomplete="off" aria-label="Search">${ic('search')}<div class="search-results hidden" id="gs-res"></div></div>
        <div class="tb-icons">
          <div style="position:relative"><button class="tb-btn" id="bell" aria-label="Notifications">${ic('bell')}<span class="dot hidden" data-badge="notifications"></span></button></div>
          <a class="tb-btn" href="#/messages" aria-label="Messages">${ic('mail')}<span class="dot hidden" data-badge="messages"></span></a>
          <a class="tb-btn" href="#/handbook" aria-label="Help">${ic('circle-help')}</a>
          <div style="position:relative"><button class="me-btn" id="me-btn">${avatar(me.full_name, me.id, '', me.avatar_url)}<div class="who"><b>${esc(me.full_name)}</b><small>${esc(me.title || me.role_name)}</small></div>${ic('chevron-down', 'sm')}</button></div>
        </div>
      </header>
      <main class="content" id="view"></main>
      <footer class="footer-band"><img src="/img/emblem.png" alt="" style="filter:brightness(0) invert(1)">${esc(APP.meta.settings.footer_motto)}<span class="sep">|</span><span class="note">AASTEC Entrepreneurship Center — Building Leaders. Creating Impact.</span></footer>
    </div></div>`;
  updateCtx();
  $('#menu-t').onclick = () => { $('#sidebar').classList.toggle('open'); $('#overlay').classList.toggle('show'); };
  $('#overlay').onclick = () => { $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show'); };
  $$('.sb-nav a').forEach(a => a.addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show'); }));
  $('#me-btn').onclick = (e) => toggleDrop(e.currentTarget, `
    <div style="padding:8px 10px"><b>${esc(me.full_name)}</b><div class="small muted">${esc(me.email)}</div><div class="mt">${chip(me.role_name, 'navy')}</div></div><div class="sep"></div>
    <a href="#/profile/${me.id}">${ic('user')} My profile</a><a href="#/me">${ic('pencil')} Edit profile</a><a href="#/certificates">${ic('award')} My certificates</a>
    <button onclick="setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark')">${ic(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')} ${document.documentElement.dataset.theme === 'dark' ? 'Light' : 'Dark'} mode</button>
    <div class="sep"></div><button onclick="signOut()">${ic('log-out')} Sign out</button>`);
  $('#bell').onclick = (e) => openNotifications(e.currentTarget);
  $('#ctx-btn').onclick = (e) => { if (isAastec()) openCtxPicker(e.currentTarget); else if (me.society_id) location.hash = `#/society/${me.society_id}`; };
  initSearch();
}
function updateCtx() {
  const me = APP.me;
  if (isAastec()) { const sid = +APP.ctx; $('#ctx-name').textContent = sid ? societyName(sid) : 'All Rally Societies'; $('#ctx-sub').textContent = sid ? 'Rally Society' : `${APP.meta.societies.filter(s => s.status === 'active').length} active Societies`; }
  else if (me.society_id) { $('#ctx-name').textContent = me.society_short || societyName(me.society_id); $('#ctx-sub').textContent = 'Rally Society'; }
  else { $('#ctx-name').textContent = 'AASTEC'; $('#ctx-sub').textContent = 'Entrepreneurship Center'; }
}
function toggleDrop(anchor, html, cls = '') {
  const ex = $('.dropdown'); if (ex) { const same = ex.parentElement === anchor.parentElement; ex.remove(); if (same) return; }
  const d = document.createElement('div'); d.className = `dropdown ${cls}`; d.innerHTML = html; anchor.parentElement.appendChild(d);
  const off = (e) => { if (!d.contains(e.target) && !anchor.contains(e.target)) { d.remove(); document.removeEventListener('mousedown', off); } };
  setTimeout(() => document.addEventListener('mousedown', off), 0);
  $$('a', d).forEach(a => a.addEventListener('click', () => d.remove()));
  return d;
}
function openCtxPicker(anchor) {
  const socs = APP.meta.societies.filter(s => s.status === 'active');
  const d = toggleDrop(anchor, `<input class="input" id="ctx-q" placeholder="Filter Societies…" style="margin-bottom:6px"><div id="ctx-list" style="max-height:340px;overflow-y:auto"></div>`);
  if (!d) return;
  d.style.left = '0'; d.style.right = 'auto'; d.style.width = '300px';
  const draw = (q = '') => { $('#ctx-list', d).innerHTML = `<button data-id="">${ic('globe')} All Rally Societies</button>` + socs.filter(s => s.name.toLowerCase().includes(q.toLowerCase()) || (s.country || '').toLowerCase().includes(q.toLowerCase()))
    .map(s => `<button data-id="${s.id}">${seal(s.short_name, 'xs')}<span class="grow">${esc(s.short_name)}<div class="xs muted">${esc(s.country || '')}</div></span>${+APP.ctx === s.id ? ic('check', 'sm') : ''}</button>`).join('');
    $$('#ctx-list button', d).forEach(b => b.onclick = () => { APP.ctx = b.dataset.id; localStorage.setItem('aastec_ctx', APP.ctx); d.remove(); updateCtx(); route(); }); };
  draw(); $('#ctx-q', d).oninput = (e) => draw(e.target.value); $('#ctx-q', d).focus();
}
async function openNotifications(anchor) {
  const list = await api('/notifications').catch(() => []);
  const d = toggleDrop(anchor, `<div class="row between" style="padding:6px 8px"><b>Notifications</b><button class="link" id="nr-all">Mark all read</button></div>
    <div>${list.length ? list.map(n => `<div class="notif ${n.is_read ? '' : 'unread'}" data-id="${n.id}" data-link="${esc(n.link || '')}"><div class="ico">${ic(n.icon || 'bell', 'sm')}</div><div class="grow"><div class="strong small">${esc(n.title)}</div>${n.body ? `<div class="xs muted">${esc(n.body)}</div>` : ''}<div class="xs faint">${ago(n.created_at)}</div></div></div>`).join('') : empty('You are all caught up', 'bell')}</div>`, 'notif-panel');
  if (!d) return;
  $('#nr-all', d).onclick = async () => { await post('/notifications/read-all'); d.remove(); refreshCounts(); };
  $$('.notif', d).forEach(n => n.onclick = async () => { await post(`/notifications/${n.dataset.id}/read`); d.remove(); refreshCounts(); if (n.dataset.link) location.hash = n.dataset.link; });
}
function initSearch() {
  const inp = $('#gsearch'), box = $('#gs-res'); let t = null;
  inp.oninput = () => { clearTimeout(t); const q = inp.value.trim(); if (q.length < 2) { box.classList.add('hidden'); return; }
    t = setTimeout(async () => {
      const r = await api('/search?q=' + encodeURIComponent(q)).catch(() => null); if (!r) return;
      const grp = (title, rows, fn) => rows.length ? `<div class="grp">${title}</div>${rows.map(fn).join('')}` : '';
      const html = grp('Members', r.members, m => `<a href="#/profile/${m.id}">${avatar(m.full_name, m.id, 'sm')}<span class="grow">${esc(m.full_name)}<div class="xs muted">${esc(m.title || '')} ${m.society_short ? '· ' + esc(m.society_short) : ''}</div></span></a>`)
        + grp('Societies', r.societies, s => `<a href="#/society/${s.id}">${ic('landmark', 'sm')}<span class="grow">${esc(s.name)}<div class="xs muted">${esc(s.country)}</div></span></a>`)
        + grp('Events', r.events, e => `<a href="#/calendar/${e.id}">${ic('calendar', 'sm')}<span class="grow">${esc(e.title)}<div class="xs muted">${fmtDT(e.start_at)}</div></span></a>`)
        + grp('Committees', r.committees, c => `<a href="#/committees/${c.id}">${ic('users-round', 'sm')}<span class="grow">${esc(c.name)}<div class="xs muted">${esc(c.society_short)}</div></span></a>`)
        + grp('Courses', r.courses, c => `<a href="#/course/${c.id}">${ic('graduation-cap', 'sm')}<span class="grow">${esc(c.title)}<div class="xs muted">${esc(c.category)}</div></span></a>`)
        + grp('Posts', r.posts, p => `<a href="#/post/${p.id}">${ic('message-square', 'sm')}<span class="grow ellipsis">${esc(p.title || p.body)}</span></a>`);
      box.innerHTML = html || `<div class="empty small">No results for “${esc(q)}”</div>`; box.classList.remove('hidden');
      $$('a', box).forEach(a => a.addEventListener('click', () => { box.classList.add('hidden'); inp.value = ''; }));
    }, 220); };
  inp.onblur = () => setTimeout(() => box.classList.add('hidden'), 200);
  inp.onfocus = () => { if (inp.value.trim().length >= 2) box.classList.remove('hidden'); };
}
function paintBadges() {
  $$('[data-badge]').forEach(b => { const n = APP.counts[b.dataset.badge] || 0; b.textContent = n > 99 ? '99+' : n; b.classList.toggle('hidden', !n); });
}
async function refreshCounts() { try { APP.counts = await api('/counts'); paintBadges(); } catch { /* offline */ } }

// ---------------- boot ----------------
async function boot() {
  document.documentElement.dataset.theme = localStorage.getItem('aastec_theme') || 'light';
  if (!TOKEN) return renderLogin();
  try { [APP.me, APP.meta] = await Promise.all([api('/me'), api('/meta')]); }
  catch { TOKEN = null; localStorage.removeItem('aastec_token'); return renderLogin(); }
  APP.counts = APP.me.counts; document.title = `${APP.meta.settings.platform_name}`;
  renderShell(); paintBadges();
  clearInterval(APP.poll); APP.poll = setInterval(refreshCounts, 30000);
  if (!location.hash) location.hash = '#/dashboard'; else route();
}
document.addEventListener('DOMContentLoaded', boot);
