// ===================================================================
//  Programmes & incubator: programmes, cohorts, ventures, milestones,
//  applications, mentor & trainer registry, matching, sessions and the
//  Incubator Agent scouting funnel
// ===================================================================
import { Router } from 'express';
import { get, all, run, tx, nowISO, json } from '../db/database.js';
import { can, requireCap, inSociety, audit, notify, notifyCap, initials, daysAgo } from '../lib/core.js';
import { h, bad, forbidden, notFound, need, clean, int } from '../lib/http.js';

const r = Router();
const STAGES = ['ideation', 'validation', 'mvp', 'early_traction', 'growth'];
const LEAD_STAGES = ['identified', 'interested', 'screened', 'ready', 'converted', 'dropped'];
const MILESTONES = ['Problem Validation', 'Solution Fit', 'Customer Interviews (20+)', 'MVP Development', 'Pilot Testing', 'Revenue Generation'];
const isTeam = (u, vid) => !!get('SELECT 1 FROM venture_members WHERE venture_id = ? AND user_id = ?', vid, u.id);
const isMentorOf = (u, vid) => !!get("SELECT 1 FROM mentorships WHERE venture_id = ? AND mentor_id = ? AND status = 'active'", vid, u.id);
const agentFor = (u, v) => can(u, 'incubator.agent') && (v.agent_id === u.id || inSociety(u, v.society_id));
const canSeeVenture = (u, v) => can(u, 'incubator.manage') || can(u, 'portfolio.view') || isTeam(u, v.id) || isMentorOf(u, v.id) || agentFor(u, v);

export function traction(v) {
  const sc = json(v.scores, {}); const vals = Object.values(sc).filter(n => typeof n === 'number');
  const m = get("SELECT COUNT(*) total, SUM(status = 'completed') done FROM milestones WHERE venture_id = ?", v.id);
  const milestone = m.total ? 100 * (m.done || 0) / m.total : 0;
  return { score: Math.round(0.6 * (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 50) + 0.4 * milestone), milestone_pct: Math.round(milestone), scores: sc };
}
const VSELECT = `SELECT v.*, f.full_name founder_name, s.short_name society_short, c.name cohort_name, a.full_name agent_name,
  (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.id) team, (SELECT COUNT(*) FROM mentorships ms WHERE ms.venture_id = v.id AND ms.status = 'active') mentors
  FROM ventures v LEFT JOIN users f ON f.id = v.founder_id LEFT JOIN societies s ON s.id = v.society_id LEFT JOIN cohorts c ON c.id = v.cohort_id LEFT JOIN users a ON a.id = v.agent_id`;

// ---------------- programmes & cohorts ----------------
r.get('/programmes', (req, res) => {
  res.json(all(`SELECT p.*, u.full_name manager_name, (SELECT COUNT(*) FROM cohorts c WHERE c.programme_id = p.id) cohorts,
      (SELECT COUNT(*) FROM ventures v JOIN cohorts c ON c.id = v.cohort_id WHERE c.programme_id = p.id) ventures,
      (SELECT COUNT(*) FROM applications a JOIN cohorts c ON c.id = a.cohort_id WHERE c.programme_id = p.id) applications,
      (SELECT COUNT(*) FROM events e WHERE e.programme_id = p.id) events
    FROM programmes p LEFT JOIN users u ON u.id = p.manager_id ORDER BY p.id`).map(p => ({ ...p,
      participants: p.kind === 'society' ? get("SELECT COUNT(*) n FROM users WHERE membership_status = 'active' AND society_id IS NOT NULL").n
        : p.kind === 'training' ? get("SELECT COUNT(DISTINCT user_id) n FROM enrollments").n : p.kind === 'mentoring' ? get("SELECT COUNT(*) n FROM mentor_profiles WHERE status = 'verified'").n : p.ventures })));
});
r.get('/programmes/:id', h((req, res) => {
  const p = get('SELECT p.*, u.full_name manager_name FROM programmes p LEFT JOIN users u ON u.id = p.manager_id WHERE p.id = ?', int(req.params.id)); if (!p) throw notFound();
  const cohorts = all('SELECT * FROM cohorts WHERE programme_id = ? ORDER BY id DESC', p.id).map(c => ({ ...c,
    applications: all('SELECT status, COUNT(*) n FROM applications WHERE cohort_id = ? GROUP BY status', c.id), ventures: get('SELECT COUNT(*) n FROM ventures WHERE cohort_id = ?', c.id).n }));
  res.json({ ...p, cohorts, events: all("SELECT id, title, start_at, status FROM events WHERE programme_id = ? ORDER BY start_at DESC LIMIT 8", p.id), can_manage: can(req.user, 'programmes.manage') });
}));
r.post('/programmes', requireCap('programmes.manage'), h((req, res) => {
  const b = req.body;
  const id = Number(run('INSERT INTO programmes(name, kind, manager_id, status, description, start_on, end_on, color, created_at) VALUES(?,?,?,?,?,?,?,?,?)', need(clean(b.name, 120), 'Programme name is required.'), clean(b.kind, 30) || 'training',
    int(b.manager_id) || req.user.id, ['planning', 'active', 'paused', 'closed'].includes(b.status) ? b.status : 'planning', clean(b.description, 1000), clean(b.start_on, 10), clean(b.end_on, 10), clean(b.color, 12) || '#247BC1', nowISO()).lastInsertRowid);
  audit(req.user, 'programme', id, 'create', { name: b.name });
  res.json({ id });
}));
r.put('/programmes/:id', requireCap('programmes.manage'), h((req, res) => {
  const b = req.body; const p = get('SELECT * FROM programmes WHERE id = ?', int(req.params.id)); if (!p) throw notFound();
  run('UPDATE programmes SET name = ?, status = ?, description = ?, manager_id = ?, end_on = ? WHERE id = ?', clean(b.name, 120) || p.name, ['planning', 'active', 'paused', 'closed'].includes(b.status) ? b.status : p.status, clean(b.description, 1000) ?? p.description, int(b.manager_id) || p.manager_id, clean(b.end_on, 10) ?? p.end_on, p.id);
  audit(req.user, 'programme', p.id, 'update', { status: b.status });
  res.json({ ok: true });
}));
r.post('/cohorts', h((req, res) => {
  if (!can(req.user, 'programmes.manage') && !can(req.user, 'incubator.manage')) throw forbidden();
  const b = req.body;
  const id = Number(run('INSERT INTO cohorts(programme_id, name, status, open_on, close_on, start_on, end_on, capacity, created_at) VALUES(?,?,?,?,?,?,?,?,?)', need(int(b.programme_id), 'Choose a programme.'), need(clean(b.name, 120), 'Cohort name is required.'),
    'open_call', clean(b.open_on, 10), clean(b.close_on, 10), clean(b.start_on, 10), clean(b.end_on, 10), int(b.capacity), nowISO()).lastInsertRowid);
  audit(req.user, 'cohort', id, 'create', { name: b.name });
  res.json({ id });
}));
r.put('/cohorts/:id', h((req, res) => {
  if (!can(req.user, 'programmes.manage') && !can(req.user, 'incubator.manage')) throw forbidden();
  const st = ['open_call', 'screening', 'in_progress', 'demo_day', 'completed'].includes(req.body.status) ? req.body.status : null; if (!st) throw bad('Unknown status.');
  run('UPDATE cohorts SET status = ? WHERE id = ?', st, int(req.params.id));
  audit(req.user, 'cohort', int(req.params.id), 'status', { status: st });
  res.json({ ok: true });
}));

// ---------------- incubator overview (Programme Manager) ----------------
r.get('/incubator/overview', h((req, res) => {
  if (!can(req.user, 'incubator.manage') && !can(req.user, 'portfolio.view')) throw forbidden();
  const ventures = all(VSELECT + ' ORDER BY v.id').map(v => ({ ...v, traction: traction(v), tags: json(v.tags, []) }));
  res.json({
    cohorts: all("SELECT c.*, p.name programme, (SELECT COUNT(*) FROM ventures v WHERE v.cohort_id = c.id) ventures, (SELECT COUNT(*) FROM applications a WHERE a.cohort_id = c.id) applications FROM cohorts c JOIN programmes p ON p.id = c.programme_id WHERE p.kind IN ('incubator','accelerator') ORDER BY c.id DESC"),
    ventures, stages: STAGES.map(s => ({ stage: s, n: ventures.filter(v => v.stage === s).length })),
    applications: all('SELECT status, COUNT(*) n FROM applications GROUP BY status'),
    mentors: get("SELECT COUNT(*) n FROM mentor_profiles WHERE status = 'verified'").n, pending_mentors: get("SELECT COUNT(*) n FROM mentor_profiles WHERE status = 'pending'").n,
    sessions: get("SELECT COUNT(*) n, COALESCE(AVG(rating),0) rating FROM mentor_sessions WHERE status = 'completed'"),
    agents: all(`SELECT u.id, u.full_name, s.short_name society_short, (SELECT COUNT(*) FROM startup_leads l WHERE l.agent_id = u.id) leads, (SELECT COUNT(*) FROM ventures v WHERE v.agent_id = u.id) ventures
      FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN societies s ON s.id = u.society_id WHERE r.key = 'incubator_agent' AND u.is_active = 1`).map(a => ({ ...a, initials: initials(a.full_name) })),
    funnel: LEAD_STAGES.slice(0, 4).map(s => ({ stage: s, n: get('SELECT COUNT(*) n FROM startup_leads WHERE stage = ?', s).n })),
  });
}));

// ---------------- ventures ----------------
r.get('/ventures', (req, res) => {
  const u = req.user; const where = []; const p = [];
  if (!can(u, 'incubator.manage') && !can(u, 'portfolio.view')) { where.push(`(v.id IN (SELECT venture_id FROM venture_members WHERE user_id = ?) OR v.id IN (SELECT venture_id FROM mentorships WHERE mentor_id = ?) OR (v.society_id = ? AND ? = 1))`); p.push(u.id, u.id, u.society_id || 0, can(u, 'incubator.agent') ? 1 : 0); }
  if (req.query.cohort_id) { where.push('v.cohort_id = ?'); p.push(int(req.query.cohort_id)); }
  if (STAGES.includes(req.query.stage)) { where.push('v.stage = ?'); p.push(req.query.stage); }
  res.json(all(`${VSELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY v.name`, ...p).map(v => ({ ...v, traction: traction(v), tags: json(v.tags, []) })));
});
r.get('/ventures/:id', h((req, res) => {
  const v = get(`${VSELECT} WHERE v.id = ?`, int(req.params.id)); if (!v || !canSeeVenture(req.user, v)) throw notFound('Venture not found.');
  res.json({ ...v, tags: json(v.tags, []), traction: traction(v),
    team: all('SELECT vm.role_title, u.id, u.full_name, u.title FROM venture_members vm JOIN users u ON u.id = vm.user_id WHERE vm.venture_id = ? ORDER BY vm.role_title LIKE \'Founder%\' DESC', v.id).map(m => ({ ...m, initials: initials(m.full_name) })),
    milestones: all('SELECT * FROM milestones WHERE venture_id = ? ORDER BY sort, id', v.id),
    mentors: all("SELECT ms.*, u.full_name, mp.headline FROM mentorships ms JOIN users u ON u.id = ms.mentor_id LEFT JOIN mentor_profiles mp ON mp.user_id = ms.mentor_id WHERE ms.venture_id = ? AND ms.status = 'active'", v.id).map(m => ({ ...m, initials: initials(m.full_name) })),
    sessions: all('SELECT s.*, u.full_name mentor_name FROM mentor_sessions s JOIN users u ON u.id = s.mentor_id WHERE s.venture_id = ? ORDER BY s.start_at DESC', v.id),
    tasks: all('SELECT t.*, u.full_name assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.venture_id = ? ORDER BY t.status = \'done\', t.due_on', v.id),
    applications: all('SELECT a.*, c.name cohort FROM applications a JOIN cohorts c ON c.id = a.cohort_id WHERE a.venture_id = ? ORDER BY a.created_at DESC', v.id),
    can_edit: isTeam(req.user, v.id) || can(req.user, 'incubator.manage'), can_manage: can(req.user, 'incubator.manage'), can_match: can(req.user, 'incubator.manage') || agentFor(req.user, v) });
}));
r.post('/ventures', h((req, res) => {
  const u = req.user; const b = req.body;
  if (!u.society_id && !can(u, 'incubator.manage')) throw forbidden('Ventures are registered by Society members or the incubator team.');
  if (!can(u, 'incubator.manage') && get('SELECT 1 FROM ventures WHERE founder_id = ?', u.id)) throw bad('You already lead a venture. Invite co-founders to it instead.');
  const at = nowISO();
  const id = tx(() => {
    const vid = Number(run('INSERT INTO ventures(name, tagline, sector, stage, society_id, university_id, founder_id, agent_id, status, website, email, team_size, color, scores, tags, description, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      need(clean(b.name, 100), 'Venture name is required.'), clean(b.tagline, 200), clean(b.sector, 60), STAGES.includes(b.stage) ? b.stage : 'ideation', u.society_id, u.university_id, u.id,
      get("SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.key = 'incubator_agent' AND u.society_id = ? LIMIT 1", u.society_id || 0)?.id ?? null, 'applicant', clean(b.website, 200), clean(b.email, 200), 1, '#247BC1', '{}',
      JSON.stringify((b.tags || []).map(t => clean(t, 30)).filter(Boolean).slice(0, 6)), clean(b.description, 2000), at).lastInsertRowid);
    run('INSERT INTO venture_members(venture_id, user_id, role_title) VALUES(?,?,?)', vid, u.id, 'Founder & CEO');
    MILESTONES.forEach((t, i) => run('INSERT INTO milestones(venture_id, title, status, sort) VALUES(?,?,?,?)', vid, t, 'pending', i));
    return vid;
  });
  audit(u, 'venture', id, 'create', { name: b.name });
  res.json({ id });
}));
r.put('/ventures/:id', h((req, res) => {
  const v = get('SELECT * FROM ventures WHERE id = ?', int(req.params.id)); if (!v) throw notFound();
  const pm = can(req.user, 'incubator.manage'); if (!isTeam(req.user, v.id) && !pm) throw forbidden();
  const b = req.body;
  run('UPDATE ventures SET name = ?, tagline = ?, sector = ?, stage = ?, website = ?, email = ?, registration = ?, description = ?, scores = ?, status = ? WHERE id = ?',
    clean(b.name, 100) || v.name, clean(b.tagline, 200) ?? v.tagline, clean(b.sector, 60) ?? v.sector, STAGES.includes(b.stage) ? b.stage : v.stage, clean(b.website, 200) ?? v.website, clean(b.email, 200) ?? v.email,
    clean(b.registration, 200) ?? v.registration, clean(b.description, 2000) ?? v.description, pm && b.scores ? JSON.stringify(Object.fromEntries(Object.entries(b.scores).map(([k, n]) => [k, Math.max(0, Math.min(100, +n || 0))]))) : v.scores,
    pm && ['applicant', 'active', 'graduated', 'paused'].includes(b.status) ? b.status : v.status, v.id);
  audit(req.user, 'venture', v.id, 'update', {});
  res.json({ ok: true });
}));
r.post('/ventures/:id/members', h((req, res) => {
  const v = get('SELECT * FROM ventures WHERE id = ?', int(req.params.id)); if (!v) throw notFound();
  if (v.founder_id !== req.user.id && !can(req.user, 'incubator.manage')) throw forbidden('Only the founder can add team members.');
  const uid = need(int(req.body.user_id), 'Choose a member.');
  run('INSERT OR REPLACE INTO venture_members(venture_id, user_id, role_title) VALUES(?,?,?)', v.id, uid, clean(req.body.role_title, 60) || 'Co-founder');
  run('UPDATE ventures SET team_size = (SELECT COUNT(*) FROM venture_members WHERE venture_id = ?) WHERE id = ?', v.id, v.id);
  notify(uid, { icon: 'rocket', title: `You joined ${v.name}`, body: 'You were added to a startup team.', link: '#/incubator' });
  res.json({ ok: true });
}));
r.post('/ventures/:id/milestones', h((req, res) => {
  const v = get('SELECT * FROM ventures WHERE id = ?', int(req.params.id)); if (!v || (!isTeam(req.user, v.id) && !can(req.user, 'incubator.manage'))) throw forbidden();
  const sort = get('SELECT COALESCE(MAX(sort), -1) + 1 n FROM milestones WHERE venture_id = ?', v.id).n;
  res.json({ id: Number(run('INSERT INTO milestones(venture_id, title, due_on, sort) VALUES(?,?,?,?)', v.id, need(clean(req.body.title, 120), 'Milestone title is required.'), clean(req.body.due_on, 10), sort).lastInsertRowid) });
}));
r.put('/milestones/:id', h((req, res) => {
  const m = get('SELECT * FROM milestones WHERE id = ?', int(req.params.id)); if (!m) throw notFound();
  if (!isTeam(req.user, m.venture_id) && !can(req.user, 'incubator.manage')) throw forbidden();
  const st = ['pending', 'in_progress', 'completed'].includes(req.body.status) ? req.body.status : m.status;
  run('UPDATE milestones SET status = ?, evidence = COALESCE(?, evidence), completed_at = ? WHERE id = ?', st, clean(req.body.evidence, 1000), st === 'completed' ? (m.completed_at || nowISO()) : null, m.id);
  if (st === 'completed' && m.status !== 'completed') audit(req.user, 'venture', m.venture_id, 'milestone_completed', { milestone: m.title });
  res.json({ ok: true });
}));

// ---------------- applications ----------------
r.get('/applications', (req, res) => {
  const pm = can(req.user, 'incubator.manage'); const where = []; const p = [];
  if (!pm) { where.push('a.applicant_id = ?'); p.push(req.user.id); }
  if (req.query.cohort_id) { where.push('a.cohort_id = ?'); p.push(int(req.query.cohort_id)); }
  if (req.query.status) { where.push('a.status = ?'); p.push(req.query.status); }
  res.json(all(`SELECT a.*, u.full_name applicant_name, s.short_name society_short, c.name cohort, v.name venture FROM applications a JOIN users u ON u.id = a.applicant_id LEFT JOIN societies s ON s.id = u.society_id JOIN cohorts c ON c.id = a.cohort_id LEFT JOIN ventures v ON v.id = a.venture_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.created_at DESC LIMIT 300`, ...p));
});
r.post('/applications', h((req, res) => {
  const c = get('SELECT * FROM cohorts WHERE id = ?', int(req.body.cohort_id)); if (!c || c.status !== 'open_call') throw bad('This cohort is not accepting applications.');
  if (get("SELECT 1 FROM applications WHERE cohort_id = ? AND applicant_id = ? AND status != 'rejected'", c.id, req.user.id)) throw bad('You have already applied to this cohort.');
  const vid = int(req.body.venture_id); if (vid && !isTeam(req.user, vid)) throw forbidden();
  const id = Number(run('INSERT INTO applications(cohort_id, venture_id, applicant_id, status, pitch, created_at) VALUES(?,?,?,?,?,?)', c.id, vid, req.user.id, 'received', need(clean(req.body.pitch, 4000), 'Describe your venture and why you are applying.'), nowISO()).lastInsertRowid);
  notifyCap('incubator.manage', { icon: 'rocket', title: 'New incubator application', body: `${req.user.full_name} — ${c.name}`, link: '#/incubator' });
  audit(req.user, 'application', id, 'submit', { cohort: c.name });
  res.json({ id });
}));
r.post('/applications/:id/review', requireCap('incubator.manage'), h((req, res) => {
  const a = get('SELECT * FROM applications WHERE id = ?', int(req.params.id)); if (!a) throw notFound();
  const st = ['under_review', 'shortlisted', 'selected', 'rejected'].includes(req.body.status) ? req.body.status : null; if (!st) throw bad('Choose a decision.');
  tx(() => {
    run('UPDATE applications SET status = ?, score = COALESCE(?, score), notes = COALESCE(?, notes), reviewed_by = ?, reviewed_at = ? WHERE id = ?', st, int(req.body.score), clean(req.body.notes, 1000), req.user.id, nowISO(), a.id);
    if (st === 'selected' && a.venture_id) run("UPDATE ventures SET cohort_id = ?, status = 'active' WHERE id = ?", a.cohort_id, a.venture_id);
  });
  notify(a.applicant_id, { icon: st === 'selected' ? 'party-popper' : 'info', title: `Application ${st.replace('_', ' ')}`, body: clean(req.body.notes, 200) || 'Your incubator application status was updated.', link: '#/incubator' });
  audit(req.user, 'application', a.id, st, { score: req.body.score });
  res.json({ ok: true });
}));

// ---------------- mentors & trainers ----------------
const profileOut = (m) => m && { ...m, expertise: json(m.expertise, []), industries: json(m.industries, []), availability: json(m.availability, {}), preferences: json(m.preferences, []), socials: json(m.socials, {}) };
r.get('/mentors', (req, res) => {
  const pm = can(req.user, 'mentor.verify');
  const rows = all(`SELECT m.*, u.full_name, u.bio, (SELECT COUNT(*) FROM mentorships ms WHERE ms.mentor_id = m.user_id AND ms.status = 'active') mentees,
      (SELECT COUNT(*) FROM mentor_sessions s WHERE s.mentor_id = m.user_id AND s.status = 'completed') sessions, (SELECT ROUND(AVG(rating),1) FROM mentor_sessions s WHERE s.mentor_id = m.user_id AND rating IS NOT NULL) rating
    FROM mentor_profiles m JOIN users u ON u.id = m.user_id WHERE ${pm ? "m.status IN ('verified','pending')" : "m.status = 'verified'"} ORDER BY m.status = 'pending' DESC, u.full_name`);
  res.json(rows.map(m => ({ ...profileOut(m), initials: initials(m.full_name) })));
});
r.get('/mentors/match', h((req, res) => {
  const v = get('SELECT * FROM ventures WHERE id = ?', int(req.query.venture_id)); if (!v) throw notFound();
  const terms = [v.sector, ...json(v.tags, []), v.stage === 'ideation' || v.stage === 'validation' ? 'Business Model' : 'Fundraising', 'Entrepreneurship'].filter(Boolean).map(t => t.toLowerCase());
  const rows = all("SELECT m.*, u.full_name FROM mentor_profiles m JOIN users u ON u.id = m.user_id WHERE m.status = 'verified'").map(m => {
    const pool = [...json(m.expertise, []), ...json(m.industries, [])].map(x => x.toLowerCase());
    const hits = terms.filter(t => pool.some(p => p.includes(t) || t.includes(p)));
    return { user_id: m.user_id, full_name: m.full_name, initials: initials(m.full_name), headline: m.headline, organisation: m.organisation, expertise: json(m.expertise, []), score: Math.min(98, 55 + hits.length * 12 + Math.min(10, m.years_experience || 0)), reasons: hits };
  }).sort((a, b) => b.score - a.score);
  res.json(rows);
}));
r.get('/mentor-profile', (req, res) => res.json(profileOut(get('SELECT * FROM mentor_profiles WHERE user_id = ?', req.user.id)) || null));
r.put('/mentor-profile', h((req, res) => {
  const b = req.body; const ex = get('SELECT * FROM mentor_profiles WHERE user_id = ?', req.user.id);
  if (ex?.status === 'verified' && b.submit) throw bad('Your profile is already verified.');
  const arr = (x) => JSON.stringify((Array.isArray(x) ? x : []).map(v => clean(v, 60)).filter(Boolean).slice(0, 20));
  const vals = [['mentor', 'trainer', 'both'].includes(b.kind) ? b.kind : (ex?.kind || 'mentor'), clean(b.headline, 120), clean(b.organisation, 120), clean(b.country, 60), clean(b.city, 60), int(b.years_experience), arr(b.expertise), arr(b.industries),
    JSON.stringify(b.availability && typeof b.availability === 'object' ? b.availability : {}), arr(b.preferences), JSON.stringify(b.socials && typeof b.socials === 'object' ? b.socials : {}), Math.min(6, Math.max(1, int(b.step) || 1))];
  if (ex) run('UPDATE mentor_profiles SET kind = ?, headline = ?, organisation = ?, country = ?, city = ?, years_experience = ?, expertise = ?, industries = ?, availability = ?, preferences = ?, socials = ?, step = ? WHERE user_id = ?', ...vals, req.user.id);
  else run("INSERT INTO mentor_profiles(kind, headline, organisation, country, city, years_experience, expertise, industries, availability, preferences, socials, step, user_id, status, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?)", ...vals, req.user.id, nowISO());
  if (b.submit) {
    if (!clean(b.headline) || !(b.expertise || []).length) throw bad('Please complete your professional headline and expertise before submitting.');
    run("UPDATE mentor_profiles SET status = 'pending', step = 6 WHERE user_id = ?", req.user.id);
    notifyCap('mentor.verify', { icon: 'badge-check', title: 'Mentor/trainer registration submitted', body: `${req.user.full_name} — ${clean(b.headline, 80)}`, link: '#/mentors' });
    audit(req.user, 'mentor', req.user.id, 'submit_registration', {});
  }
  res.json(profileOut(get('SELECT * FROM mentor_profiles WHERE user_id = ?', req.user.id)));
}));
r.post('/mentors/:id/verify', requireCap('mentor.verify'), h((req, res) => {
  const m = get('SELECT * FROM mentor_profiles WHERE user_id = ?', int(req.params.id)); if (!m) throw notFound();
  const approve = !!req.body.approve;
  run('UPDATE mentor_profiles SET status = ?, verified_by = ?, verified_at = ? WHERE user_id = ?', approve ? 'verified' : 'rejected', req.user.id, nowISO(), m.user_id);
  notify(m.user_id, { icon: approve ? 'badge-check' : 'circle-x', title: approve ? 'You are now a verified AASTEC mentor' : 'Registration not approved', body: clean(req.body.note, 200), link: '#/mentors' });
  audit(req.user, 'mentor', m.user_id, approve ? 'verify' : 'reject', {});
  res.json({ ok: true });
}));
r.post('/mentorships', h((req, res) => {
  const v = get('SELECT * FROM ventures WHERE id = ?', int(req.body.venture_id)); if (!v) throw notFound();
  if (!can(req.user, 'incubator.manage') && !agentFor(req.user, v)) throw forbidden('Mentor matching is done by the Incubator Programme Manager or Agent.');
  const mid = need(int(req.body.mentor_id), 'Choose a mentor.');
  if (!get("SELECT 1 FROM mentor_profiles WHERE user_id = ? AND status = 'verified'", mid)) throw bad('Only verified mentors can be matched.');
  if (get("SELECT 1 FROM mentorships WHERE venture_id = ? AND mentor_id = ? AND status = 'active'", v.id, mid)) throw bad('This mentor is already matched with the venture.');
  run("INSERT INTO mentorships(venture_id, mentor_id, status, match_score, assigned_by, created_at) VALUES(?,?,'active',?,?,?)", v.id, mid, int(req.body.match_score), req.user.id, nowISO());
  notify([mid, v.founder_id], { icon: 'handshake', title: 'New mentor match', body: `${v.name} has been matched with a mentor.`, link: '#/incubator' });
  audit(req.user, 'venture', v.id, 'mentor_match', { mentor_id: mid });
  res.json({ ok: true });
}));
r.get('/mentor-sessions', (req, res) => {
  const pm = can(req.user, 'incubator.manage');
  res.json(all(`SELECT s.*, u.full_name mentor_name, v.name venture FROM mentor_sessions s JOIN users u ON u.id = s.mentor_id LEFT JOIN ventures v ON v.id = s.venture_id
    WHERE ${pm && req.query.scope === 'all' ? '1 = 1' : '(s.mentor_id = ? OR s.venture_id IN (SELECT venture_id FROM venture_members WHERE user_id = ?))'} ORDER BY s.start_at DESC LIMIT 200`, ...(pm && req.query.scope === 'all' ? [] : [req.user.id, req.user.id])));
});
r.post('/mentor-sessions', h((req, res) => {
  const b = req.body; const vid = int(b.venture_id); const mid = need(int(b.mentor_id), 'Choose a mentor.');
  const v = vid && get('SELECT * FROM ventures WHERE id = ?', vid);
  const pm = can(req.user, 'incubator.manage'); const team = v && isTeam(req.user, v.id); const mentor = req.user.id === mid;
  if (!pm && !team && !mentor && !(v && agentFor(req.user, v))) throw forbidden();
  if (v && !get("SELECT 1 FROM mentorships WHERE venture_id = ? AND mentor_id = ? AND status = 'active'", v.id, mid) && !pm) throw bad('Sessions can be booked with matched mentors only.');
  const start = need(clean(b.start_at, 30), 'Choose a date and time.');
  const status = team && !pm ? 'requested' : 'scheduled';
  const id = Number(run('INSERT INTO mentor_sessions(venture_id, mentor_id, topic, start_at, duration_min, mode, status, created_by, created_at) VALUES(?,?,?,?,?,?,?,?,?)', vid, mid, need(clean(b.topic, 160), 'Session topic is required.'),
    new Date(start).toISOString(), int(b.duration_min) || 60, b.mode === 'in_person' ? 'in_person' : 'online', status, req.user.id, nowISO()).lastInsertRowid);
  notify(status === 'requested' ? mid : v?.founder_id, { icon: 'calendar-clock', title: status === 'requested' ? 'Mentoring session requested' : 'Mentoring session scheduled', body: `${clean(b.topic, 100)}${v ? ` — ${v.name}` : ''}`, link: '#/incubator' });
  res.json({ id, status });
}));
r.put('/mentor-sessions/:id', h((req, res) => {
  const s = get('SELECT * FROM mentor_sessions WHERE id = ?', int(req.params.id)); if (!s) throw notFound();
  const mentor = s.mentor_id === req.user.id, team = s.venture_id && isTeam(req.user, s.venture_id), pm = can(req.user, 'incubator.manage');
  if (!mentor && !team && !pm) throw forbidden();
  const st = ['scheduled', 'completed', 'cancelled'].includes(req.body.status) ? req.body.status : s.status;
  if (st === 'scheduled' && s.status === 'requested' && !mentor && !pm) throw forbidden('The mentor confirms requested sessions.');
  run('UPDATE mentor_sessions SET status = ?, notes = COALESCE(?, notes), rating = COALESCE(?, rating) WHERE id = ?', st, clean(req.body.notes, 1500), team && req.body.rating ? Math.max(1, Math.min(5, int(req.body.rating))) : null, s.id);
  res.json({ ok: true });
}));

// ---------------- Incubator Agent scouting funnel ----------------
r.get('/leads', h((req, res) => {
  const pm = can(req.user, 'incubator.manage'); if (!pm && !can(req.user, 'incubator.agent')) throw forbidden();
  res.json(all(`SELECT l.*, u.full_name agent_name, s.short_name society_short FROM startup_leads l JOIN users u ON u.id = l.agent_id LEFT JOIN societies s ON s.id = l.society_id WHERE ${pm ? '1 = 1' : 'l.agent_id = ?'} ORDER BY l.updated_at DESC LIMIT 400`, ...(pm ? [] : [req.user.id])));
}));
r.post('/leads', requireCap('incubator.agent'), h((req, res) => {
  const at = nowISO();
  const id = Number(run('INSERT INTO startup_leads(agent_id, society_id, name, contact, idea, stage, notes, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?)', req.user.id, req.user.society_id, need(clean(req.body.name, 120), 'Lead name is required.'),
    clean(req.body.contact, 120), clean(req.body.idea, 1000), 'identified', clean(req.body.notes, 1000), at, at).lastInsertRowid);
  res.json({ id });
}));
r.put('/leads/:id', h((req, res) => {
  const l = get('SELECT * FROM startup_leads WHERE id = ?', int(req.params.id)); if (!l) throw notFound();
  if (l.agent_id !== req.user.id && !can(req.user, 'incubator.manage')) throw forbidden();
  const st = LEAD_STAGES.includes(req.body.stage) ? req.body.stage : l.stage;
  run('UPDATE startup_leads SET stage = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?', st, clean(req.body.notes, 1000), nowISO(), l.id);
  res.json({ ok: true });
}));

export default r;
