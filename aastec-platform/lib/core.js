// ===================================================================
//  Shared server helpers: authentication, RBAC, audit chain,
//  notifications, settings and governance calculations
// ===================================================================
import { createHash, randomBytes } from 'node:crypto';
import { get, all, run, nowISO, json } from '../db/database.js';

// ---------------- Capability catalogue (role permission matrix) ----------------
export const CAPABILITIES = {
  'portfolio.view': 'View AASTEC-wide portfolio dashboards',
  'societies.manage': 'Create and edit universities, campuses and Societies',
  'users.manage': 'Manage user accounts, roles and the permission matrix',
  'settings.manage': 'Change platform settings, KPI targets and the handbook',
  'programmes.manage': 'Configure programmes, cohorts and outcomes',
  'events.aastec': 'Create AASTEC-wide calendar events',
  'events.training': 'Create training sessions on the shared calendar',
  'posts.aastec': 'Publish under the AASTEC Entrepreneurship Center identity',
  'posts.approve_national': 'Give the AASTEC approval step for national / partnership posts',
  'reports.review': 'Review submitted Society reports',
  'elections.configure': 'Configure annual election cycles and windows',
  'elections.validate': 'Validate election candidates',
  'moderation': 'Moderate community content across all Societies',
  'kpi.view_all': 'View KPIs across all Societies',
  'learning.manage': 'Create and edit courses, lessons and quizzes',
  'incubator.manage': 'Manage incubator cohorts, applications, mentors and milestones',
  'incubator.agent': 'Use Incubator Agent tools (scouting, info sessions)',
  'mentor.verify': 'Verify mentor and trainer registrations',
  'audit.view': 'View the immutable audit log',
};
export const ALL_CAPS = Object.keys(CAPABILITIES);

// Society-level authorizations a President can grant to members
export const GRANT_TYPES = {
  posting_official: 'Official posting (Society identity)',
  event_support: 'Event support',
  committee_access: 'Committee access',
  calendar_support: 'Calendar support (propose Society events)',
  community_moderation: 'Community moderation (own Society)',
  report_submission: 'Report submission',
};

// ---------------- Settings ----------------
export const SETTING_DEFAULTS = {
  platform_name: 'AASTEC Digital Platform',
  tagline: 'Innovation through Collaboration',
  footer_motto: 'Independent student leadership with supervised governance.',
  handbook_version: '2.0',
  election_window_start: '07-01',
  election_window_end: '08-31',
  election_sandbox: '0',
  risk_threshold: '60',
  report_due_day: '10',
  grant_expiry: '08-31',
  support_email: 'aastec@aast.edu',
};
export function settings() {
  const s = { ...SETTING_DEFAULTS };
  for (const r of all('SELECT key, value FROM settings')) s[r.key] = r.value;
  return s;
}
export const setting = (k) => settings()[k];

// ---------------- Dates ----------------
export const academicYear = (d = new Date()) => {
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const s = m >= 8 ? y : y - 1;
  return `${s}/${s + 1}`;
};
export const ayRange = (ay) => {
  const s = +String(ay).slice(0, 4);
  return { from: `${s}-09-01T00:00:00.000Z`, to: `${s + 1}-08-31T23:59:59.999Z`, start: s };
};
export const prevAY = (ay) => { const s = +String(ay).slice(0, 4) - 1; return `${s}/${s + 1}`; };
export const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
export const daysAhead = (n) => new Date(Date.now() + n * 864e5).toISOString();
// Next grant expiry: end of the academic year (31 Aug) — authorities reset at handover
export const grantExpiry = () => {
  const d = new Date(); const [mm, dd] = settings().grant_expiry.split('-').map(Number);
  let e = new Date(Date.UTC(d.getUTCFullYear(), mm - 1, dd, 23, 59, 59));
  if (e < d) e = new Date(Date.UTC(d.getUTCFullYear() + 1, mm - 1, dd, 23, 59, 59));
  return e.toISOString();
};

// ---------------- Users & sessions ----------------
export const newToken = () => randomBytes(32).toString('hex');
export const initials = (name = '') => name.replace(/^(Dr\.|Prof\.|Eng\.)\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export function loadUser(id) {
  const u = get(`SELECT u.*, r.key role_key, r.name role_name, r.scope role_scope, r.permissions role_perms,
      s.name society_name, s.short_name society_short, s.vp_delegation, s.advisor_id society_advisor_id,
      un.name university_name, c.name committee_name
    FROM users u JOIN roles r ON r.id = u.role_id
    LEFT JOIN societies s ON s.id = u.society_id
    LEFT JOIN universities un ON un.id = u.university_id
    LEFT JOIN committees c ON c.id = u.committee_id
    WHERE u.id = ?`, id);
  if (!u) return null;
  u.perms = u.role_key === 'admin' ? [...ALL_CAPS] : json(u.role_perms, []);
  u.grants = all(`SELECT perm_key FROM user_grants WHERE user_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`, id, nowISO()).map(g => g.perm_key);
  u.is_aastec = ['aastec', 'platform'].includes(u.role_scope);
  u.is_committee_head = !!get('SELECT 1 FROM committees WHERE head_user_id = ?', id);
  delete u.password_hash; delete u.role_perms;
  return u;
}

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, full_name: u.full_name, initials: initials(u.full_name), title: u.title, role_key: u.role_key, role_name: u.role_name,
    society_id: u.society_id, society_name: u.society_name, society_short: u.society_short, university_name: u.university_name, avatar_url: u.avatar_url };
}
// Lightweight user columns for JOINs
export const USER_COLS = `u.id user_id, u.full_name, u.title, u.avatar_url, r.key role_key, r.name role_name, s.short_name society_short`;
export const USER_JOIN = `JOIN users u ON u.id = {col} JOIN roles r ON r.id = u.role_id LEFT JOIN societies s ON s.id = u.society_id`;
export const userJoin = (col) => USER_JOIN.replace('{col}', col);

// ---------------- Middleware ----------------
export function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const sess = token && get('SELECT * FROM sessions WHERE token = ?', token);
  if (!sess || (sess.expires_at && sess.expires_at < nowISO())) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  const u = loadUser(sess.user_id);
  if (!u || !u.is_active) return res.status(401).json({ error: 'This account is inactive.' });
  req.user = u; next();
}
export const can = (u, cap) => !!u && (u.role_key === 'admin' || (u.perms || []).includes(cap));
export const requireCap = (...caps) => (req, res, next) =>
  caps.some(c => can(req.user, c)) ? next() : res.status(403).json({ error: 'You do not have permission for this action.' });
export const hasGrant = (u, key) => (u.grants || []).includes(key);

// ---------------- Society authority model ----------------
// President = final operational authority inside the Society.
// Vice President acts with President authority only while delegation is active.
// Faculty Advisor supervises: visibility, guidance, alerts and election activation approval.
export function societyOf(id) { return id ? get('SELECT * FROM societies WHERE id = ?', id) : null; }
export function leads(u, sid) {
  if (!u || !sid) return false;
  if (u.role_key === 'admin') return true;
  if (u.society_id !== +sid) return false;
  if (u.role_key === 'president') return true;
  if (u.role_key === 'vice_president') return !!societyOf(sid)?.vp_delegation;
  return false;
}
export const isLeadership = (u, sid) => leads(u, sid) || (u.role_key === 'vice_president' && u.society_id === +sid);
export function supervises(u, sid) {
  if (!u || !sid) return false;
  if (u.role_key !== 'advisor') return false;
  return u.society_id === +sid || societyOf(sid)?.advisor_id === u.id;
}
export const inSociety = (u, sid) => !!u && !!sid && u.society_id === +sid;
export const canViewSociety = (u, sid) => can(u, 'portfolio.view') || inSociety(u, sid) || supervises(u, sid);
export function presidentOf(sid) {
  return get(`SELECT u.* FROM users u JOIN roles r ON r.id = u.role_id WHERE r.key = 'president' AND u.society_id = ? AND u.is_active = 1`, sid);
}
export function vpOf(sid) {
  return get(`SELECT u.* FROM users u JOIN roles r ON r.id = u.role_id WHERE r.key = 'vice_president' AND u.society_id = ? AND u.is_active = 1`, sid);
}
export function usersWithCap(cap) {
  return all(`SELECT u.id, u.full_name, r.key role_key, r.permissions FROM users u JOIN roles r ON r.id = u.role_id WHERE u.is_active = 1`)
    .filter(u => u.role_key === 'admin' ? false : json(u.permissions, []).includes(cap));
}

// ---------------- Immutable, hash-chained audit log ----------------
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const auditPayload = (r) => JSON.stringify([r.actor_id, r.actor_name, r.entity_type, r.entity_id, r.action, r.detail, r.created_at, r.prev_hash]);
export function audit(actor, entity_type, entity_id, action, detail = {}, at = null) {
  const prev_hash = get('SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1')?.hash || 'GENESIS';
  const row = { actor_id: actor?.id ?? null, actor_name: actor?.full_name || 'System', entity_type, entity_id: entity_id ?? null,
    action, detail: JSON.stringify(detail || {}), created_at: at || nowISO(), prev_hash };
  row.hash = sha256(auditPayload(row));
  run('INSERT INTO audit_log(actor_id, actor_name, entity_type, entity_id, action, detail, created_at, prev_hash, hash) VALUES(?,?,?,?,?,?,?,?,?)',
    row.actor_id, row.actor_name, row.entity_type, row.entity_id, row.action, row.detail, row.created_at, row.prev_hash, row.hash);
}
export function verifyAuditChain() {
  let prev = 'GENESIS', count = 0;
  for (const r of all('SELECT * FROM audit_log ORDER BY id')) {
    if (r.prev_hash !== prev || sha256(auditPayload(r)) !== r.hash) return { ok: false, count, broken_at: r.id };
    prev = r.hash; count++;
  }
  return { ok: true, count, head: prev };
}

// ---------------- Notifications ----------------
export function notify(userIds, { type = 'system', icon = 'bell', title, body = null, link = null }) {
  const ids = [...new Set([].concat(userIds).filter(Boolean))];
  const at = nowISO();
  for (const id of ids) run('INSERT INTO notifications(user_id, type, icon, title, body, link, created_at) VALUES(?,?,?,?,?,?,?)', id, type, icon, title, body, link, at);
}
export function notifyCap(cap, payload) { notify(usersWithCap(cap).map(u => u.id), payload); }

// ---------------- Content risk check (posting workflow) ----------------
const BLOCKED = ['idiot', 'stupid', 'hate you', 'kill', 'scam', 'fraud', 'shut up', 'loser', 'dumb'];
const SENSITIVE = ['sponsor', 'sponsorship', 'partnership', 'partner', 'budget', 'contract', 'agreement', 'press', 'media coverage', 'ministry', 'funding', 'investment', 'mou'];
export function riskCheck({ body = '', title = '', identity = 'personal', media = [] }) {
  const text = `${title || ''} ${body || ''}`;
  const lower = text.toLowerCase();
  const checks = []; let score = 0;
  const add = (key, label, ok, weight, note) => { checks.push({ key, label, ok, note }); if (!ok) score += weight; };
  const blocked = BLOCKED.filter(w => lower.includes(w));
  add('guidelines', 'Content follows community guidelines', !blocked.length, 40, blocked.length ? `Flagged terms: ${blocked.join(', ')}` : null);
  const letters = text.replace(/[^A-Za-z]/g, ''); const caps = letters.replace(/[^A-Z]/g, '').length;
  const shouting = letters.length > 30 && caps / letters.length > 0.6;
  const exclaim = (text.match(/!/g) || []).length > 6;
  add('respectful', 'Respectful & inclusive language', !shouting && !exclaim, 15, shouting ? 'Excessive capital letters' : exclaim ? 'Excessive exclamation marks' : null);
  const phones = text.match(/(\+?\d[\d\s-]{9,}\d)/g) || [];
  const ids = text.match(/\b\d{14}\b/g) || [];
  add('personal_data', 'No personal or sensitive data', !phones.length && !ids.length, 25, phones.length || ids.length ? 'Contains a phone number or ID number' : null);
  const links = text.match(/https?:\/\/\S+/g) || [];
  const shortener = links.some(l => /bit\.ly|tinyurl|t\.co\/|goo\.gl/.test(l));
  add('links', 'Links are limited and transparent', links.length <= 2 && !shortener, shortener ? 15 : 10, shortener ? 'Uses a link shortener' : links.length > 2 ? `${links.length} external links` : null);
  const brandOk = identity === 'personal' || (title || '').trim().length >= 4;
  add('brand', 'Brand & identity usage compliant', brandOk, 5, brandOk ? null : 'Official posts need a clear title');
  const sens = SENSITIVE.filter(w => lower.includes(w));
  add('sensitivity', 'No partnership, budget or press commitments', !sens.length, 10, sens.length ? `Mentions: ${sens.slice(0, 3).join(', ')}` : null);
  score = Math.min(100, score);
  return { score, level: score < 30 ? 'low' : score < 60 ? 'medium' : 'high', checks, sensitive_hint: sens.length > 0, media_count: (media || []).length };
}

// ---------------- Society health & compliance ----------------
export function societyHealth(sid) {
  const members = get(`SELECT COUNT(*) n FROM users WHERE society_id = ? AND membership_status = 'active' AND is_active = 1`, sid).n;
  const acked = get(`SELECT COUNT(*) n FROM users WHERE society_id = ? AND membership_status = 'active' AND is_active = 1 AND handbook_ack_version IS NOT NULL`, sid).n;
  const handbook = members ? acked / members : 0;
  // Monthly reports for the last 3 complete months
  const months = [1, 2, 3].map(i => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); return d.toISOString().slice(0, 7); });
  const reportsIn = get(`SELECT COUNT(DISTINCT period) n FROM society_reports WHERE society_id = ? AND report_type = 'monthly_activity' AND period IN (${months.map(() => '?').join(',')})`, sid, ...months).n;
  const reports = reportsIn / 3;
  const events60 = get(`SELECT COUNT(*) n FROM events WHERE society_id = ? AND status IN ('published','completed','closed') AND start_at BETWEEN ? AND ?`, sid, daysAgo(60), daysAhead(30)).n;
  const posts30 = get(`SELECT COUNT(*) n FROM posts p JOIN users u ON u.id = p.author_id WHERE (p.society_id = ? OR u.society_id = ?) AND p.status = 'published' AND p.published_at > ?`, sid, sid, daysAgo(30)).n;
  const score = Math.round(100 * (0.35 * handbook + 0.25 * reports + 0.25 * Math.min(1, events60 / 4) + 0.15 * Math.min(1, posts30 / 8)));
  const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'At Risk';
  return { score, label, members, handbook_pct: Math.round(handbook * 100), reports_pct: Math.round(reports * 100), events60, posts30, missing_reports: months.length - reportsIn };
}
