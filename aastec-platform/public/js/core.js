// ===================================================================
//  AASTEC Digital Platform — portal core
//  API client, router, formatting, icons, brand components, modals,
//  toasts and chart helpers shared by every view
// ===================================================================
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const APP = { me: null, meta: null, counts: {}, charts: [], timers: [], ctx: localStorage.getItem('aastec_ctx') || '' };
let TOKEN = localStorage.getItem('aastec_token');
const ROUTES = {};

// ---------------- API ----------------
async function api(path, { method = 'GET', body } = {}) {
  const opts = { method, headers: {} };
  if (TOKEN) opts.headers.Authorization = 'Bearer ' + TOKEN;
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let res;
  try { res = await fetch('/api' + path, opts); } catch { throw new Error('Network error — please check your connection.'); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && APP.me) { signOut(true); throw new Error(data.error || 'Session expired'); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
const post = (p, body = {}) => api(p, { method: 'POST', body });
const put = (p, body = {}) => api(p, { method: 'PUT', body });
const del = (p) => api(p, { method: 'DELETE' });

// ---------------- formatting ----------------
const esc = (s) => (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (name, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="/img/icons.svg#${name}"/></svg>`;
const LOC = 'en-GB';
const fmtDate = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => s ? new Date(s).toLocaleDateString(LOC, o) : '—';
const fmtTime = (s) => s ? new Date(s).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDT = (s) => s ? `${fmtDate(s)}, ${fmtTime(s)}` : '—';
const fmtMonth = (ym) => new Date(ym + '-01T00:00:00Z').toLocaleDateString(LOC, { month: 'short', year: '2-digit' });
const num = (n, d = 0) => (+n || 0).toLocaleString(LOC, { maximumFractionDigits: d });
const compact = (n) => { n = +n || 0; return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : num(n); };
const ago = (s) => {
  if (!s) return '';
  const m = Math.round((Date.now() - new Date(s)) / 6e4);
  if (m < 0) { const f = -m; return f < 60 ? `in ${f}m` : f < 1440 ? `in ${Math.round(f / 60)}h` : `in ${Math.round(f / 1440)}d`; }
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : m < 43200 ? `${Math.round(m / 1440)}d ago` : fmtDate(s);
};
const cap = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const pct = (a, b) => (b ? Math.round(100 * a / b) : 0);
const todayISO = () => new Date().toISOString().slice(0, 10);
const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
const fromLocalInput = (v) => v ? new Date(v).toISOString() : null;

// ---------------- brand & UI atoms ----------------
const wordmark = (cls = '') => `<span class="wordmark ${cls}"><span class="wm"><span class="a">AAST</span><span class="e">EC</span></span><span class="sub">Entrepreneurship Center</span></span>`;
const seal = (short = '', cls = '', aastec = false) => `<span class="seal ${cls} ${aastec ? 'aastec' : ''}" title="${esc(aastec ? 'AASTEC' : 'Rally Society ' + short)}">${aastec ? '<b>AAST</b><small>EC</small>' : `<b>RALLY</b><small>SOCIETY</small><i>${esc(short.replace(/^AAST /, ''))}</i>`}</span>`;
const avatar = (name = '?', id = 0, size = '', url = null) => {
  const init = (name || '?').replace(/^(Dr\.|Prof\.|Eng\.)\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return `<span class="av ${size} c${((+id || init.charCodeAt(0) || 1) % 8) + 1}" title="${esc(name)}">${url ? `<img src="${esc(url)}" alt="">` : esc(init)}</span>`;
};
const chip = (text, tone = '', icon = '') => `<span class="chip ${tone}">${icon ? ic(icon, 'sm') : ''}${esc(text)}</span>`;
const STATUS = {
  active: ['Active', 'green'], pending: ['Pending', 'amber'], approved: ['Approved', 'green'], rejected: ['Rejected', 'red'], head_reviewed: ['Head reviewed', 'blue'],
  published: ['Published', 'green'], pending_approval: ['Pending approval', 'amber'], scheduled: ['Scheduled', 'blue'], flagged: ['Flagged', 'red'], hidden: ['Hidden', ''], removed: ['Removed', 'red'],
  proposed: ['Proposed', 'amber'], advisor_review: ['Advisor review', 'purple'], completed: ['Completed', 'blue'], closed: ['Closed', ''], cancelled: ['Cancelled', 'red'],
  submitted: ['Submitted', 'amber'], returned: ['Returned', 'red'], overdue: ['Overdue', 'red'], due: ['Due', 'amber'],
  pending_advisor: ['Awaiting Advisor', 'amber'], nominations: ['Nominations open', 'blue'], review: ['Candidate review', 'purple'], voting: ['Voting open', 'green'], tally: ['Counting', 'navy'], results: ['Results published', 'gold'], handover: ['Handover', 'navy'],
  open: ['Open', 'red'], in_progress: ['In progress', 'blue'], resolved: ['Resolved', 'green'], not_started: ['Not started', ''], in_review: ['In review', 'purple'], done: ['Done', 'green'],
  on_track: ['On track', 'green'], needs_support: ['Needs support', 'red'], on_hold: ['On hold', 'amber'], verified: ['Verified', 'green'], draft: ['Draft', ''],
  received: ['Received', ''], under_review: ['Under review', 'amber'], shortlisted: ['Shortlisted', 'blue'], selected: ['Selected', 'green'], open_call: ['Open call', 'green'], screening: ['Screening', 'amber'], demo_day: ['Demo Day', 'gold'],
  identified: ['Identified', ''], interested: ['Interested', 'blue'], screened: ['Screened', 'purple'], ready: ['Incubator ready', 'green'], converted: ['Converted', 'navy'], dropped: ['Dropped', 'red'],
  going: ['Going', 'green'], interested_rsvp: ['Interested', 'blue'], declined: ['Declined', ''], met: ['Met', 'green'], near: ['Near target', 'blue'], improve: ['Needs improvement', 'amber'], off: ['Off track', 'red'],
  forming: ['Forming', 'amber'], suspended: ['Suspended', 'red'], probation: ['Probation', 'amber'], applicant: ['Applicant', 'amber'], graduated: ['Graduated', 'navy'], paused: ['Paused', 'amber'], requested: ['Requested', 'amber'],
};
const status = (s) => { const [t, tone] = STATUS[s] || [cap(s), '']; return chip(t, tone); };
const PRIORITY = { high: 'red', medium: 'amber', low: 'green' };
const bar = (p, tone = '', cls = '') => `<div class="bar ${tone} ${cls}"><span style="width:${Math.max(0, Math.min(100, +p || 0))}%"></span></div>`;
const empty = (text = 'Nothing here yet', icon = 'inbox') => `<div class="empty">${ic(icon)}<div>${esc(text)}</div></div>`;
const kpi = ({ icon = 'activity', tone = 'navy', label, value, meta = '', cls = '', valCls = '', link = '' }) =>
  `<div class="kpi tone-${tone} ${cls}" ${link ? `style="cursor:pointer" onclick="location.hash='${link}'"` : ''}><div class="ico">${ic(icon, 'lg')}</div><div class="grow"><div class="lbl">${esc(label)}</div><div class="val ${valCls}">${value}</div>${meta ? `<div class="meta">${meta}</div>` : ''}</div></div>`;
const card = (title, icon, body, { link = '', linkText = 'View all', count = null, cls = '', actions = '' } = {}) =>
  `<div class="card ${cls}"><div class="card-h"><h3>${icon ? ic(icon) : ''}${esc(title)}${count ? ` <span class="count">${count}</span>` : ''}</h3>${actions}${link ? `<a class="link" href="${link}">${esc(linkText)} ${ic('arrow-right', 'sm')}</a>` : ''}</div>${body}</div>`;
const dateTile = (s) => { const d = new Date(s); return `<div class="date-tile"><div class="m">${d.toLocaleDateString(LOC, { month: 'short' })}</div><div class="d">${d.getDate()}</div><div class="w">${d.toLocaleDateString(LOC, { weekday: 'short' })}</div></div>`; };
const ring = (value, { size = 120, stroke = 12, color = 'var(--navy)', label = '', sub = '' } = {}) => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, +value || 0));
  return `<div class="score-ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line-soft)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}"/></svg>
    <div class="lbl"><b style="font-size:${size / 4.4}px">${label || v + '%'}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`;
};
const qrImg = (text, cell = 4) => { try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return `<img src="${q.createDataURL(cell, 2)}" alt="QR code" style="image-rendering:pixelated">`; } catch { return ''; } };
const pageHead = (title, sub = '', actions = '', icon = '') => `<div class="page-head"><div><h1>${icon ? ic(icon, 'lg') : ''}${esc(title)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="actions">${actions}</div></div>`;
const updated = () => `<span class="updated">Last updated: ${fmtDT(new Date().toISOString())} <button class="btn-icon tb-btn" onclick="route()" title="Refresh">${ic('refresh-cw', 'sm')}</button></span>`;

// ---------------- feedback ----------------
function toast(msg, kind = 'ok') {
  let w = $('.toast-wrap'); if (!w) { w = document.createElement('div'); w.className = 'toast-wrap'; document.body.appendChild(w); }
  const t = document.createElement('div'); t.className = `toast ${kind}`; t.innerHTML = `${ic(kind === 'err' ? 'circle-alert' : 'circle-check')}<span>${esc(msg)}</span>`;
  w.appendChild(t); setTimeout(() => t.remove(), kind === 'err' ? 5200 : 3200);
}
function modal({ title, icon = '', body = '', foot = '', size = '', onClose = null }) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true"><div class="mh"><h3>${icon ? ic(icon) : ''}${esc(title)}</h3><button class="btn-icon tb-btn" data-close aria-label="Close">${ic('x')}</button></div><div class="mb">${body}</div>${foot ? `<div class="mf">${foot}</div>` : ''}</div>`;
  const close = () => { bg.remove(); onClose?.(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
  $$('[data-close]', bg).forEach(b => b.onclick = close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(bg); bg.close = close;
  setTimeout(() => $('input:not([type=hidden]),textarea,select', bg)?.focus(), 30);
  return bg;
}
function confirmBox(message, { title = 'Please confirm', ok = 'Confirm', danger = false } = {}) {
  return new Promise(resolve => {
    const m = modal({ title, icon: danger ? 'triangle-alert' : 'circle-help', body: `<p>${esc(message)}</p>`, foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="cb-ok">${esc(ok)}</button>`, onClose: () => resolve(false) });
    $('#cb-ok', m).onclick = () => { m.remove(); resolve(true); };
  });
}
function askNote({ title, label = 'Note', placeholder = '', required = false, ok = 'Submit', danger = false }) {
  return new Promise(resolve => {
    const m = modal({ title, icon: 'message-square', body: `<div class="field"><label>${esc(label)}${required ? ' *' : ''}</label><textarea id="an-v" placeholder="${esc(placeholder)}"></textarea></div>`,
      foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="an-ok">${esc(ok)}</button>`, onClose: () => resolve(null) });
    $('#an-ok', m).onclick = () => { const v = $('#an-v', m).value.trim(); if (required && !v) return toast('Please add a note.', 'err'); m.remove(); resolve(v); };
  });
}
const formData = (form) => Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
async function guard(btn, fn) {
  if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;margin:0;border-width:2px"></span>'; }
  try { return await fn(); } catch (e) { toast(e.message, 'err'); } finally { if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label; } }
}

// ---------------- charts ----------------
const PALETTE = ['#102D5A', '#F2B91E', '#247BC1', '#16A34A', '#7C3AED', '#EA580C', '#0891B2', '#B4182D', '#94A3B8'];
function chart(el, config) {
  if (!el || !window.Chart) return null;
  const dark = document.documentElement.dataset.theme === 'dark';
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif"; Chart.defaults.font.size = 11.5;
  Chart.defaults.color = dark ? '#93A3BA' : '#64748B'; Chart.defaults.borderColor = dark ? '#22344F' : '#E9EEF5';
  if (dark) { // navy series disappear on the dark surface; lift them to a lighter brand blue
    const swap = (v) => v === '#102D5A' ? '#5B8FD6' : v === 'rgba(16,45,90,.08)' ? 'rgba(91,143,214,.14)' : v;
    (config.data?.datasets || []).forEach(ds => ['backgroundColor', 'borderColor'].forEach(k => { if (Array.isArray(ds[k])) ds[k] = ds[k].map(swap); else if (ds[k]) ds[k] = swap(ds[k]); }));
  }
  config.options = { responsive: true, maintainAspectRatio: false, ...config.options, plugins: { legend: { labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } }, ...(config.options?.plugins || {}) } };
  const c = new Chart(el, config); APP.charts.push(c); return c;
}
function destroyCharts() { APP.charts.forEach(c => c.destroy()); APP.charts = []; }

// ---------------- permissions ----------------
const can = (cap) => APP.me && (APP.me.role_key === 'admin' || (APP.me.perms || []).includes(cap));
const hasGrant = (k) => (APP.me?.grants || []).includes(k);
const role = (...keys) => keys.includes(APP.me?.role_key);
const isAastec = () => !!APP.me?.is_aastec;
const isLeader = () => role('president', 'vice_president') || APP.me?.is_committee_head;
function ctxSociety() {
  if (!isAastec() && APP.me?.society_id) return APP.me.society_id;
  const sel = +APP.ctx; if (sel) return sel;
  return APP.me?.society_id || APP.meta?.societies.find(s => s.status === 'active')?.id;
}
const societyName = (id) => APP.meta?.societies.find(s => s.id === +id)?.short_name || '';

// ---------------- router ----------------
async function route() {
  if (!APP.me) return;
  const [name = 'dashboard', ...params] = location.hash.replace(/^#\/?/, '').split('/');
  const view = $('#view'); if (!view) return;
  destroyCharts(); APP.timers.forEach(clearInterval); APP.timers = [];
  $$('.modal-bg, .dropdown').forEach(m => m.remove());
  $('#gs-res')?.classList.add('hidden');
  const nav = NAV.find(n => n.id === name);
  if (nav && nav.show && !nav.show()) { location.hash = '#/dashboard'; return; }
  setActiveNav(nav?.id || NAV_ALIASES[name] || name);
  const fn = ROUTES[name] || ROUTES.dashboard;
  view.innerHTML = '<div class="spinner"></div>';
  window.scrollTo(0, 0);
  try { await fn(view, ...params.map(decodeURIComponent)); }
  catch (e) { view.innerHTML = `<div class="banner danger">${ic('circle-alert')}<div><b>Unable to load this page.</b><div>${esc(e.message)}</div></div></div>`; }
}
window.addEventListener('hashchange', route);
