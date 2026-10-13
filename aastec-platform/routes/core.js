// ===================================================================
//  Core routes: session, profile, directory, notifications, search,
//  administration (users, roles, institutions, settings), handbook,
//  audit log, AASTEC leadership centre and uploads
// ===================================================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { get, all, run, tx, nowISO, json } from '../db/database.js';
import { CAPABILITIES, GRANT_TYPES, settings, SETTING_DEFAULTS, can, requireCap, leads, supervises, inSociety, audit, verifyAuditChain, initials, publicUser, loadUser, societyHealth } from '../lib/core.js';
import { approvalItems } from '../lib/approvals.js';
import { scoreOf, badgesOf, activityScores } from '../lib/stats.js';
import { aiEnabled, AI_MODEL } from '../lib/ai.js';
import { h, bad, forbidden, notFound, need, clean, int } from '../lib/http.js';
import { UPLOAD_DIR } from '../lib/paths.js';

const r = Router();

// ---------------- session ----------------
r.post('/logout', (req, res) => { run('DELETE FROM sessions WHERE token = ?', (req.headers.authorization || '').replace(/^Bearer\s+/i, '')); res.json({ ok: true }); });

export function unreadMessages(uid) {
  return get(`SELECT COUNT(*) n FROM messages m JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
    WHERE m.sender_id != ? AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)`, uid, uid).n;
}

r.get('/me', (req, res) => {
  const u = req.user;
  const committees = all('SELECT id, name FROM committees WHERE head_user_id = ?', u.id);
  res.json({ ...u, initials: initials(u.full_name), led_committees: committees, leads: !!(u.society_id && leads(u, u.society_id)),
    supervises: !!(u.society_id && supervises(u, u.society_id)),
    counts: { notifications: get('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND is_read = 0', u.id).n, messages: unreadMessages(u.id), approvals: approvalItems(u).length },
    score: scoreOf(u.id) });
});

r.get('/meta', (req, res) => {
  const s = settings();
  res.json({
    settings: { platform_name: s.platform_name, tagline: s.tagline, footer_motto: s.footer_motto, handbook_version: s.handbook_version, election_window_start: s.election_window_start, election_window_end: s.election_window_end, election_sandbox: s.election_sandbox === '1', demo_mode: s.demo_mode === '1', report_due_day: +s.report_due_day, risk_threshold: +s.risk_threshold },
    roles: all('SELECT id, key, name, scope, rank, description FROM roles ORDER BY rank DESC'),
    capabilities: CAPABILITIES, grant_types: GRANT_TYPES,
    kpis: all('SELECT * FROM kpi_definitions ORDER BY sort'),
    societies: all(`SELECT s.id, s.name, s.short_name, s.status, s.advisor_id, u.country, u.kind FROM societies s JOIN universities u ON u.id = s.university_id ORDER BY s.status, u.kind DESC, s.short_name`),
    universities: all('SELECT id, name, short_name, kind, city, country FROM universities ORDER BY kind DESC, country, name'),
    committees: req.user.society_id ? all('SELECT id, name, key, head_user_id FROM committees WHERE society_id = ? ORDER BY id', req.user.society_id) : [],
    programmes: all('SELECT id, name, kind, color, status FROM programmes ORDER BY id'),
    cohorts: all('SELECT c.id, c.name, c.status, c.programme_id FROM cohorts c ORDER BY c.id DESC'),
    ai: { enabled: aiEnabled(), model: aiEnabled() ? AI_MODEL : null },
  });
});

// ---------------- profile ----------------
const PROFILE_FIELDS = ['full_name', 'title', 'faculty', 'study_year', 'city', 'phone', 'bio', 'linkedin', 'avatar_url'];
r.put('/me/profile', h((req, res) => {
  const b = req.body; const sets = []; const vals = [];
  for (const f of PROFILE_FIELDS) if (f in b) { sets.push(`${f} = ?`); vals.push(clean(b[f], f === 'bio' ? 1200 : 200)); }
  for (const f of ['interests', 'skills']) if (Array.isArray(b[f])) { sets.push(`${f} = ?`); vals.push(JSON.stringify(b[f].map(x => clean(x, 40)).filter(Boolean).slice(0, 15))); }
  if (b.full_name !== undefined && !clean(b.full_name)) throw bad('Name is required.');
  if (sets.length) run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...vals, req.user.id);
  res.json({ ok: true });
}));
r.put('/me/password', h((req, res) => {
  const u = get('SELECT password_hash FROM users WHERE id = ?', req.user.id);
  if (!bcrypt.compareSync(String(req.body.current || ''), u.password_hash)) throw bad('Your current password is incorrect.');
  const p = String(req.body.password || '');
  if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) throw bad('Password must be at least 8 characters and include letters and numbers.');
  run('UPDATE users SET password_hash = ? WHERE id = ?', bcrypt.hashSync(p, 10), req.user.id);
  audit(req.user, 'user', req.user.id, 'change_password');
  res.json({ ok: true });
}));

// ---------------- directory & profiles ----------------
const canSeePrivate = (viewer, target) => viewer.id === target.id || can(viewer, 'portfolio.view') || leads(viewer, target.society_id) || supervises(viewer, target.society_id) || viewer.role_key === 'admin';
r.get('/users', h((req, res) => {
  const { q, role, status } = req.query; const society_id = int(req.query.society_id), committee_id = int(req.query.committee_id);
  const where = ['u.is_active = 1']; const p = [];
  if (society_id) { where.push('u.society_id = ?'); p.push(society_id); }
  if (committee_id) { where.push('u.committee_id = ?'); p.push(committee_id); }
  if (role) { where.push('r.key = ?'); p.push(role); }
  if (q) { where.push('(u.full_name LIKE ? OR u.title LIKE ? OR u.faculty LIKE ?)'); p.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const privileged = society_id ? (leads(req.user, society_id) || supervises(req.user, society_id) || can(req.user, 'portfolio.view')) : can(req.user, 'portfolio.view');
  if (status && privileged) { where.push('u.membership_status = ?'); p.push(status); } else if (!privileged) where.push("u.membership_status = 'active'");
  const limit = Math.min(int(req.query.limit) || 60, 500);
  const rows = all(`SELECT u.id, u.full_name, u.title, u.email, u.faculty, u.study_year, u.membership_status, u.handbook_ack_version, u.created_at, u.last_login_at, u.committee_id, u.avatar_url,
      r.key role_key, r.name role_name, s.short_name society_short, s.id society_id, c.name committee_name
    FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN societies s ON s.id = u.society_id LEFT JOIN committees c ON c.id = u.committee_id
    WHERE ${where.join(' AND ')} ORDER BY r.rank DESC, u.full_name LIMIT ?`, ...p, limit);
  const scores = activityScores();
  res.json(rows.map(x => ({ ...x, email: privileged ? x.email : undefined, initials: initials(x.full_name), score: Math.round(scores.get(x.id) || 0) })));
}));

r.get('/users/:id', h((req, res) => {
  const t = loadUser(int(req.params.id));
  if (!t || !t.is_active) throw notFound('Member not found.');
  const priv = canSeePrivate(req.user, t);
  const n = (sql) => get(sql, t.id).n;
  const certs = all('SELECT c.code, c.title, c.issued_at, co.category FROM certificates c LEFT JOIN courses co ON co.id = c.course_id WHERE c.user_id = ? AND c.revoked = 0 ORDER BY c.issued_at DESC', t.id);
  const posts = all(`SELECT id, body, title, category, published_at, (SELECT COUNT(*) FROM reactions WHERE post_id = p.id) reactions FROM posts p WHERE author_id = ? AND status = 'published' AND identity = 'personal' ORDER BY published_at DESC LIMIT 5`, t.id);
  const venture = get('SELECT v.id, v.name, v.tagline, v.stage, vm.role_title FROM venture_members vm JOIN ventures v ON v.id = vm.venture_id WHERE vm.user_id = ?', t.id);
  const mentor = get('SELECT * FROM mentor_profiles WHERE user_id = ?', t.id);
  res.json({
    ...publicUser(t), initials: initials(t.full_name), faculty: t.faculty, study_year: t.study_year, city: t.city, bio: t.bio, linkedin: t.linkedin, committee_name: t.committee_name,
    interests: json(t.interests, []), skills: json(t.skills, []), created_at: t.created_at, membership_status: t.membership_status,
    email: priv ? t.email : undefined, phone: priv ? t.phone : undefined, handbook_ack_version: priv ? t.handbook_ack_version : undefined,
    followers: n('SELECT COUNT(*) n FROM follows WHERE followee_id = ?'), following: n('SELECT COUNT(*) n FROM follows WHERE follower_id = ?'),
    is_following: !!get('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?', req.user.id, t.id),
    score: scoreOf(t.id), ...badgesOf(t.id), certificates: certs, posts, venture,
    mentor: mentor ? { ...mentor, expertise: json(mentor.expertise, []), industries: json(mentor.industries, []) } : null,
    is_self: req.user.id === t.id,
  });
}));
r.post('/users/:id/follow', h((req, res) => {
  const id = int(req.params.id); if (id === req.user.id) throw bad('You cannot follow yourself.');
  if (get('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?', req.user.id, id)) run('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?', req.user.id, id);
  else run('INSERT INTO follows VALUES(?,?,?)', req.user.id, id, nowISO());
  res.json({ following: !!get('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?', req.user.id, id) });
}));

// ---------------- notifications ----------------
r.get('/notifications', (req, res) => res.json(all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60', req.user.id)));
r.post('/notifications/read-all', (req, res) => { run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', req.user.id); res.json({ ok: true }); });
r.post('/notifications/:id/read', (req, res) => { run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', int(req.params.id), req.user.id); res.json({ ok: true }); });
r.get('/counts', (req, res) => res.json({ notifications: get('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND is_read = 0', req.user.id).n, messages: unreadMessages(req.user.id), approvals: approvalItems(req.user).length }));

// ---------------- global search ----------------
r.get('/search', h((req, res) => {
  const q = clean(req.query.q, 80); if (!q || q.length < 2) return res.json({ members: [], societies: [], events: [], posts: [], courses: [], committees: [] });
  const like = `%${q}%`;
  res.json({
    members: all(`SELECT u.id, u.full_name, u.title, s.short_name society_short FROM users u LEFT JOIN societies s ON s.id = u.society_id WHERE u.is_active = 1 AND u.membership_status = 'active' AND u.full_name LIKE ? LIMIT 6`, like).map(x => ({ ...x, initials: initials(x.full_name) })),
    societies: all(`SELECT s.id, s.name, u.country FROM societies s JOIN universities u ON u.id = s.university_id WHERE s.name LIKE ? OR u.name LIKE ? OR u.city LIKE ? LIMIT 5`, like, like, like),
    events: all(`SELECT id, title, start_at, kind FROM events WHERE title LIKE ? AND status NOT IN ('rejected','cancelled') ORDER BY ABS(julianday(start_at) - julianday('now')) LIMIT 5`, like),
    posts: all(`SELECT id, title, substr(body, 1, 120) body, published_at FROM posts WHERE status = 'published' AND (body LIKE ? OR title LIKE ?) ORDER BY published_at DESC LIMIT 5`, like, like),
    courses: all('SELECT id, title, category FROM courses WHERE is_published = 1 AND (title LIKE ? OR category LIKE ?) LIMIT 5', like, like),
    committees: all('SELECT c.id, c.name, s.short_name society_short, s.id society_id FROM committees c JOIN societies s ON s.id = c.society_id WHERE c.name LIKE ? LIMIT 5', like),
  });
}));

// ---------------- administration: users & roles ----------------
r.get('/admin/users', requireCap('users.manage'), h((req, res) => {
  const q = clean(req.query.q, 80); const role = req.query.role; const society_id = int(req.query.society_id);
  const where = ['1 = 1']; const p = [];
  if (q) { where.push('(u.full_name LIKE ? OR u.email LIKE ?)'); p.push(`%${q}%`, `%${q}%`); }
  if (role) { where.push('r.key = ?'); p.push(role); }
  if (society_id) { where.push('u.society_id = ?'); p.push(society_id); }
  res.json(all(`SELECT u.id, u.full_name, u.email, u.title, u.is_active, u.membership_status, u.last_login_at, u.society_id, u.committee_id, u.org_unit_id, r.key role_key, r.name role_name, s.short_name society_short
    FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN societies s ON s.id = u.society_id WHERE ${where.join(' AND ')} ORDER BY r.rank DESC, u.full_name LIMIT 300`, ...p));
}));
function userPayload(b, creating) {
  const o = {};
  if (creating || b.full_name !== undefined) o.full_name = need(clean(b.full_name, 120), 'Full name is required.');
  if (creating || b.email !== undefined) { o.email = need(clean(b.email, 200)?.toLowerCase(), 'Email is required.'); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) throw bad('Please enter a valid email.'); }
  if (creating || b.role_key !== undefined) { const role = get('SELECT id FROM roles WHERE key = ?', b.role_key); if (!role) throw bad('Please choose a role.'); o.role_id = role.id; }
  for (const f of ['society_id', 'committee_id', 'org_unit_id']) if (b[f] !== undefined) o[f] = int(b[f]);
  if (o.society_id) o.university_id = get('SELECT university_id FROM societies WHERE id = ?', o.society_id)?.university_id ?? null;
  for (const f of ['title', 'membership_status']) if (b[f] !== undefined) o[f] = clean(b[f], 120);
  if (b.is_active !== undefined) o.is_active = b.is_active ? 1 : 0;
  return o;
}
r.post('/admin/users', requireCap('users.manage'), h((req, res) => {
  const o = userPayload(req.body, true);
  if (get('SELECT 1 FROM users WHERE lower(email) = ?', o.email)) throw bad('A user with this email already exists.');
  const password = String(req.body.password || ''); if (password.length < 8) throw bad('Initial password must be at least 8 characters.');
  o.password_hash = bcrypt.hashSync(password, 10); o.created_at = nowISO(); o.membership_status ??= 'active';
  const k = Object.keys(o);
  const id = Number(run(`INSERT INTO users(${k.join(',')}) VALUES(${k.map(() => '?').join(',')})`, ...k.map(x => o[x])).lastInsertRowid);
  audit(req.user, 'user', id, 'create', { email: o.email, role: req.body.role_key });
  res.json({ id });
}));
r.put('/admin/users/:id', requireCap('users.manage'), h((req, res) => {
  const id = int(req.params.id); const o = userPayload(req.body, false);
  if (req.body.password) { if (String(req.body.password).length < 8) throw bad('Password must be at least 8 characters.'); o.password_hash = bcrypt.hashSync(String(req.body.password), 10); }
  const k = Object.keys(o); if (!k.length) return res.json({ ok: true });
  run(`UPDATE users SET ${k.map(x => `${x} = ?`).join(', ')} WHERE id = ?`, ...k.map(x => o[x]), id);
  if (o.is_active === 0) run('DELETE FROM sessions WHERE user_id = ?', id);
  audit(req.user, 'user', id, 'update', { fields: k.filter(x => x !== 'password_hash'), password_reset: !!o.password_hash });
  res.json({ ok: true });
}));
r.get('/roles', requireCap('users.manage'), (req, res) => res.json(all('SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) users FROM roles r ORDER BY rank DESC').map(x => ({ ...x, permissions: json(x.permissions, []) }))));
r.put('/roles/:key', requireCap('users.manage'), h((req, res) => {
  if (req.params.key === 'admin') throw bad('The administrator role always has every permission.');
  const perms = (req.body.permissions || []).filter(p => CAPABILITIES[p]);
  run('UPDATE roles SET permissions = ?, description = COALESCE(?, description) WHERE key = ?', JSON.stringify(perms), clean(req.body.description, 400), req.params.key);
  audit(req.user, 'role', null, 'update_permissions', { role: req.params.key, permissions: perms });
  res.json({ ok: true });
}));

// ---------------- institutions ----------------
r.post('/universities', requireCap('societies.manage'), h((req, res) => {
  const name = need(clean(req.body.name, 160), 'University name is required.');
  const id = Number(run('INSERT INTO universities(name, short_name, kind, city, country, created_at) VALUES(?,?,?,?,?,?)', name, clean(req.body.short_name, 60) || name, req.body.kind === 'aast_campus' ? 'aast_campus' : 'partner', clean(req.body.city, 80), clean(req.body.country, 80), nowISO()).lastInsertRowid);
  if (req.body.create_society !== false) {
    const sid = Number(run("INSERT INTO societies(university_id, name, short_name, status, created_at) VALUES(?,?,?,?,?)", id, `Rally Society - ${clean(req.body.short_name, 60) || name}`, clean(req.body.short_name, 60) || name, 'forming', nowISO()).lastInsertRowid);
    for (const [key, n] of [['operations', 'Operations'], ['marketing', 'Marketing & Media'], ['hr', 'HR & Membership'], ['learning', 'Learning & Training'], ['partnerships', 'Partnerships'], ['events', 'Events']])
      run('INSERT INTO committees(society_id, name, key, created_at) VALUES(?,?,?,?)', sid, n, key, nowISO());
  }
  audit(req.user, 'university', id, 'create', { name });
  res.json({ id });
}));
r.put('/societies/:id', h((req, res) => {
  const id = int(req.params.id);
  if (!can(req.user, 'societies.manage')) throw forbidden();
  const s = get('SELECT * FROM societies WHERE id = ?', id); if (!s) throw notFound();
  const status = ['active', 'forming', 'probation', 'suspended'].includes(req.body.status) ? req.body.status : s.status;
  const advisor_id = req.body.advisor_id !== undefined ? int(req.body.advisor_id) : s.advisor_id;
  if (advisor_id && !get("SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? AND r.key = 'advisor' AND u.is_active = 1", advisor_id)) throw bad('The selected user is not an active Faculty Advisor.');
  run('UPDATE societies SET status = ?, advisor_id = ?, description = COALESCE(?, description) WHERE id = ?', status, advisor_id, clean(req.body.description, 600), id);
  audit(req.user, 'society', id, 'update', { status, advisor_id });
  res.json({ ok: true });
}));

// ---------------- settings & KPI targets ----------------
r.get('/settings', requireCap('settings.manage'), (req, res) => res.json({ settings: settings(), kpis: all('SELECT * FROM kpi_definitions ORDER BY sort') }));
r.put('/settings', requireCap('settings.manage'), h((req, res) => {
  const changed = {};
  for (const [k, v] of Object.entries(req.body.settings || {})) if (k in SETTING_DEFAULTS || k === 'demo_mode') { run('INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)', k, String(clean(v, 400) ?? '')); changed[k] = v; }
  for (const k of req.body.kpis || []) if (k.key && +k.target > 0) run('UPDATE kpi_definitions SET target = ?, weight = COALESCE(?, weight) WHERE key = ?', +k.target, k.weight ? +k.weight : null, k.key);
  audit(req.user, 'settings', null, 'update', { settings: changed, kpi_targets: (req.body.kpis || []).length });
  res.json({ ok: true });
}));

// ---------------- handbook ----------------
r.get('/handbook', (req, res) => {
  const u = get('SELECT handbook_ack_version, handbook_ack_at FROM users WHERE id = ?', req.user.id);
  res.json({ version: settings().handbook_version, sections: all('SELECT * FROM handbook_sections ORDER BY sort'), ack: u });
});
r.post('/handbook/ack', (req, res) => {
  run('UPDATE users SET handbook_ack_version = ?, handbook_ack_at = ? WHERE id = ?', settings().handbook_version, nowISO(), req.user.id);
  audit(req.user, 'handbook', null, 'acknowledge', { version: settings().handbook_version });
  res.json({ ok: true });
});
r.put('/handbook/:id', requireCap('settings.manage'), h((req, res) => {
  const id = int(req.params.id);
  run('UPDATE handbook_sections SET title = ?, body = ?, updated_at = ? WHERE id = ?', need(clean(req.body.title, 160), 'Title is required.'), need(clean(req.body.body, 6000), 'Content is required.'), nowISO(), id);
  audit(req.user, 'handbook', id, 'update_section', { title: req.body.title });
  res.json({ ok: true });
}));

// ---------------- audit log ----------------
r.get('/audit', requireCap('audit.view'), h((req, res) => {
  const where = ['1 = 1']; const p = [];
  if (req.query.entity_type) { where.push('entity_type = ?'); p.push(req.query.entity_type); }
  if (req.query.q) { where.push('(actor_name LIKE ? OR action LIKE ? OR detail LIKE ?)'); p.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`); }
  if (req.query.from) { where.push('created_at >= ?'); p.push(req.query.from); }
  if (req.query.to) { where.push('created_at <= ?'); p.push(req.query.to + 'T23:59:59Z'); }
  res.json({ rows: all(`SELECT * FROM audit_log WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 300`, ...p), types: all('SELECT DISTINCT entity_type FROM audit_log ORDER BY 1').map(r => r.entity_type) });
}));
r.get('/audit/verify', requireCap('audit.view'), (req, res) => res.json(verifyAuditChain()));

// ---------------- AASTEC leadership & role centre ----------------
r.get('/leadership', requireCap('portfolio.view'), (req, res) => {
  const units = all(`SELECT o.*, u.full_name lead_name, u.title lead_title FROM org_units o LEFT JOIN users u ON u.id = o.lead_user_id ORDER BY o.kind, o.sort`);
  const staff = all(`SELECT u.id, u.full_name, u.title, u.org_unit_id, r.key role_key, r.name role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE r.scope = 'aastec' AND u.is_active = 1 ORDER BY r.rank DESC, u.full_name`).map(x => ({ ...x, initials: initials(x.full_name) }));
  const q = approvalQueue();
  res.json({
    units, staff, queue: q,
    kpis: { programmes: get("SELECT COUNT(*) n FROM programmes WHERE status = 'active'").n, events: get("SELECT COUNT(*) n FROM events WHERE kind IN ('aastec','training') AND status = 'published' AND start_at > ?", nowISO()).n,
      initiatives: get("SELECT COUNT(*) n FROM cohorts WHERE status NOT IN ('completed')").n, staff: staff.length },
    roles: all("SELECT key, name, description FROM roles WHERE scope = 'aastec' ORDER BY rank DESC"),
  });
});
export function approvalQueue() {
  const n = (sql, ...p) => get(sql, ...p).n;
  return [
    ['Society reports awaiting review', n("SELECT COUNT(*) n FROM society_reports WHERE status = 'submitted'"), 'file-text', '#/reports'],
    ['Official posts in approval', n("SELECT COUNT(*) n FROM posts WHERE status = 'pending_approval'"), 'megaphone', '#/approvals'],
    ['Event proposals', n("SELECT COUNT(*) n FROM events WHERE status IN ('proposed','advisor_review')"), 'calendar-plus', '#/calendar'],
    ['Member authorization requests', n("SELECT COUNT(*) n FROM auth_requests WHERE status IN ('pending','head_reviewed')"), 'shield-check', '#/approvals'],
    ['Elections awaiting Advisor approval', n("SELECT COUNT(*) n FROM elections WHERE status = 'pending_advisor'"), 'vote', '#/elections'],
    ['Incubator applications', n("SELECT COUNT(*) n FROM applications WHERE status IN ('received','under_review','shortlisted')"), 'rocket', '#/incubator'],
    ['Mentor verifications', n("SELECT COUNT(*) n FROM mentor_profiles WHERE status = 'pending'"), 'badge-check', '#/mentors'],
    ['Open escalations', n("SELECT COUNT(*) n FROM escalations WHERE status != 'resolved'"), 'triangle-alert', '#/supervision'],
  ].map(([label, count, icon, link]) => ({ label, count, icon, link }));
}

// ---------------- network directory ----------------
r.get('/network', (req, res) => {
  const rows = all(`SELECT s.id, s.name, s.short_name, s.status, s.founded_on, u.name university, u.kind, u.city, u.country,
      (SELECT COUNT(*) FROM users m WHERE m.society_id = s.id AND m.membership_status = 'active' AND m.is_active = 1) members,
      (SELECT full_name FROM users p JOIN roles r ON r.id = p.role_id WHERE p.society_id = s.id AND r.key = 'president' LIMIT 1) president,
      (SELECT full_name FROM users a WHERE a.id = s.advisor_id) advisor
    FROM societies s JOIN universities u ON u.id = s.university_id ORDER BY s.status, u.kind DESC, members DESC`);
  res.json(rows.map(x => x.status === 'active' ? { ...x, health: societyHealth(x.id) } : x));
});

// ---------------- uploads (images) ----------------
r.post('/uploads', h((req, res) => {
  const m = /^data:(image\/(png|jpeg|webp|gif));base64,(.+)$/.exec(String(req.body.data || ''));
  if (!m) throw bad('Please upload a PNG, JPEG, WebP or GIF image.');
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > 4 * 1024 * 1024) throw bad('Images must be 4 MB or smaller.');
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${m[2] === 'jpeg' ? 'jpg' : m[2]}`;
  writeFileSync(join(UPLOAD_DIR, name), buf);
  res.json({ url: `/uploads/${name}` });
}));

export default r;
