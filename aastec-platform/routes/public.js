// ===================================================================
//  Public routes (no session): health, sign-in, registration,
//  landing-page overview and certificate verification
// ===================================================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { get, all, run, nowISO } from '../db/database.js';
import { settings, newToken, audit, notify, presidentOf, daysAhead } from '../lib/core.js';
import { h, bad, need, clean, int } from '../lib/http.js';
import { DEMO_PASSWORD } from '../db/seed.js';

const r = Router();

r.get('/health', (req, res) => res.json({ ok: true, time: nowISO() }));

// Simple in-memory throttle for sign-in attempts (per email + IP)
const attempts = new Map();
const throttled = (key) => { const a = attempts.get(key); return a && a.count >= 8 && Date.now() - a.first < 10 * 60e3; };
const fail = (key) => { const a = attempts.get(key); if (!a || Date.now() - a.first > 10 * 60e3) attempts.set(key, { count: 1, first: Date.now() }); else a.count++; };

r.post('/login', h((req, res) => {
  const email = clean(req.body.email, 200)?.toLowerCase(); const password = String(req.body.password || '');
  need(email, 'Please enter your email.'); need(password, 'Please enter your password.');
  const key = `${email}|${req.ip}`;
  if (throttled(key)) throw bad('Too many attempts. Please wait a few minutes and try again.');
  const u = get('SELECT * FROM users WHERE lower(email) = ?', email);
  if (!u || !bcrypt.compareSync(password, u.password_hash)) { fail(key); throw bad('Incorrect email or password.'); }
  if (!u.is_active) throw bad('This account is inactive. Please contact the AASTEC team.');
  attempts.delete(key);
  const token = newToken();
  run('INSERT INTO sessions(token, user_id, created_at, expires_at) VALUES(?,?,?,?)', token, u.id, nowISO(), daysAhead(14));
  run('UPDATE users SET last_login_at = ? WHERE id = ?', nowISO(), u.id);
  res.json({ token });
}));

r.get('/public/register-options', (req, res) => {
  res.json({
    universities: all("SELECT id, name, short_name, kind, city, country FROM universities WHERE is_active = 1 ORDER BY kind DESC, country, name"),
    societies: all("SELECT id, name, short_name, university_id FROM societies WHERE status = 'active' ORDER BY name"),
  });
});

r.post('/register', h((req, res) => {
  const full_name = need(clean(req.body.full_name, 120), 'Please enter your full name.');
  const email = need(clean(req.body.email, 200)?.toLowerCase(), 'Please enter your email.');
  const password = String(req.body.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Please enter a valid email address.');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw bad('Password must be at least 8 characters and include letters and numbers.');
  const society_id = int(req.body.society_id);
  const soc = society_id && get("SELECT * FROM societies WHERE id = ? AND status = 'active'", society_id);
  if (!soc) throw bad('Please choose your Rally Society.');
  if (!req.body.handbook_ack) throw bad('Please acknowledge the Rally Society Handbook.');
  if (get('SELECT 1 FROM users WHERE lower(email) = ?', email)) throw bad('An account with this email already exists.');
  const role = get("SELECT id FROM roles WHERE key = 'member'");
  const at = nowISO();
  const id = Number(run(`INSERT INTO users(full_name, email, password_hash, role_id, university_id, society_id, title, membership_status, join_note, faculty, study_year, city, handbook_ack_version, handbook_ack_at, created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, full_name, email, bcrypt.hashSync(password, 10), role.id, soc.university_id, soc.id, 'Member', 'pending',
    clean(req.body.join_note, 600), clean(req.body.faculty, 120), clean(req.body.study_year, 30), clean(req.body.city, 80), settings().handbook_version, at, at).lastInsertRowid);
  audit({ id, full_name }, 'membership', id, 'apply', { society: soc.name });
  const pres = presidentOf(soc.id);
  if (pres) notify(pres.id, { icon: 'user-plus', title: 'New membership application', body: `${full_name} applied to join ${soc.name}.`, link: '#/members' });
  const token = newToken();
  run('INSERT INTO sessions(token, user_id, created_at, expires_at) VALUES(?,?,?,?)', token, id, at, daysAhead(14));
  res.json({ token });
}));

r.get('/public/overview', (req, res) => {
  const s = settings();
  const n = (sql, ...p) => get(sql, ...p).n;
  res.json({
    settings: { platform_name: s.platform_name, tagline: s.tagline, footer_motto: s.footer_motto, demo_mode: s.demo_mode === '1' },
    stats: {
      aast_campuses: n("SELECT COUNT(*) n FROM universities WHERE kind = 'aast_campus'"),
      partners: n("SELECT COUNT(*) n FROM universities WHERE kind = 'partner'"),
      countries: n('SELECT COUNT(DISTINCT country) n FROM universities'),
      societies: n("SELECT COUNT(*) n FROM societies WHERE status = 'active'"),
      members: n("SELECT COUNT(*) n FROM users WHERE membership_status = 'active' AND society_id IS NOT NULL AND is_active = 1"),
      events: n("SELECT COUNT(*) n FROM events WHERE status IN ('completed','closed')"),
      certificates: n('SELECT COUNT(*) n FROM certificates WHERE revoked = 0'),
      ventures: n('SELECT COUNT(*) n FROM ventures'),
      mentors: n("SELECT COUNT(*) n FROM mentor_profiles WHERE status = 'verified'"),
    },
    programmes: all("SELECT id, name, kind, description, color FROM programmes WHERE status = 'active' ORDER BY id"),
    events: all(`SELECT e.id, e.title, e.kind, e.category, e.start_at, e.location, e.mode, s.short_name society FROM events e LEFT JOIN societies s ON s.id = e.society_id
      WHERE e.visibility = 'all' AND e.status = 'published' AND e.start_at > ? ORDER BY CASE e.kind WHEN 'aastec' THEN 0 ELSE 1 END, e.start_at LIMIT 6`, nowISO()),
    courses: all('SELECT id, title, category, level, duration_label, instructor, color, tag, rating FROM courses WHERE is_published = 1 AND is_featured = 1 ORDER BY id LIMIT 6'),
    societies: all(`SELECT s.id, s.name, s.short_name, u.city, u.country, u.kind, (SELECT COUNT(*) FROM users m WHERE m.society_id = s.id AND m.membership_status = 'active') members
      FROM societies s JOIN universities u ON u.id = s.university_id WHERE s.status = 'active' ORDER BY members DESC LIMIT 12`),
    countries: all("SELECT country, COUNT(*) n FROM universities GROUP BY country ORDER BY n DESC"),
  });
});

r.get('/public/demo-accounts', (req, res) => {
  if (settings().demo_mode !== '1') return res.json({ enabled: false, accounts: [] });
  const pick = (email, label) => { const u = get('SELECT u.email, u.full_name, r.name role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ?', email); return u && { ...u, label }; };
  res.json({ enabled: true, password: DEMO_PASSWORD, accounts: [
    pick('director@aastec.demo', 'Executive Director'), pick('pm@aastec.demo', 'Programme Manager'), pick('incubator@aastec.demo', 'Incubator PM'),
    pick('staff@aastec.demo', 'AASTEC Staff'), pick('president@miami.rally.demo', 'Society President'), pick('vp@miami.rally.demo', 'Vice President'),
    pick('committee@miami.rally.demo', 'Committee Head'), pick('advisor@miami.rally.demo', 'Faculty Advisor'), pick('member@miami.rally.demo', 'Member'),
    pick('agent@miami.rally.demo', 'Incubator Agent'), pick('founder@miami.rally.demo', 'Founder'), pick('mentor@aastec.demo', 'Mentor'), pick('admin@aastec.demo', 'Administrator'),
  ].filter(Boolean) });
});

r.get('/public/verify/:code', (req, res) => {
  const c = get(`SELECT c.code, c.title, c.issued_at, c.revoked, u.full_name, co.category, co.hours, co.instructor, s.name society
    FROM certificates c JOIN users u ON u.id = c.user_id LEFT JOIN courses co ON co.id = c.course_id LEFT JOIN societies s ON s.id = u.society_id WHERE c.code = ?`, String(req.params.code).toUpperCase());
  if (!c) return res.status(404).json({ valid: false });
  res.json({ valid: !c.revoked, certificate: c });
});

export default r;
