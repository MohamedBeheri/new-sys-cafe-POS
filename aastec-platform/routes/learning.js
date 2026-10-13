// ===================================================================
//  Learning & AI: course catalogue, player, quizzes, certificates,
//  learning paths, Learning Hub, AI Learning Coach and AI tools,
//  and course authoring for authorized trainers / staff
// ===================================================================
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { get, all, run, tx, nowISO, json } from '../db/database.js';
import { can, requireCap, canViewSociety, isLeadership, audit, notify, initials, societyHealth, daysAgo } from '../lib/core.js';
import { invalidateScores } from '../lib/stats.js';
import * as AI from '../lib/ai.js';
import { h, bad, forbidden, notFound, need, clean, int } from '../lib/http.js';

const r = Router();
const today = () => nowISO().slice(0, 10);
const certCode = () => `AASTEC-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;
const lessonIds = (cid) => all('SELECT l.id FROM lessons l JOIN course_modules m ON m.id = l.module_id WHERE l.course_id = ? ORDER BY m.sort, l.sort', cid).map(x => x.id);
const enrollmentOf = (cid, uid) => { const e = get('SELECT * FROM enrollments WHERE course_id = ? AND user_id = ?', cid, uid); return e && { ...e, completed_lessons: json(e.completed_lessons, []) }; };

function issueIfComplete(cid, uid) {
  const e = enrollmentOf(cid, uid); const course = get('SELECT * FROM courses WHERE id = ?', cid);
  const total = lessonIds(cid).length; const hasQuiz = get('SELECT COUNT(*) n FROM quiz_questions WHERE course_id = ?', cid).n > 0;
  const lessonsDone = e.completed_lessons.length >= total;
  const quizOk = !hasQuiz || (e.quiz_score ?? 0) >= course.pass_mark;
  if (e.status === 'completed' || !lessonsDone || !quizOk) return null;
  const at = nowISO(); const code = certCode();
  run("UPDATE enrollments SET status = 'completed', progress = 100, completed_at = ? WHERE id = ?", at, e.id);
  if (!get('SELECT 1 FROM certificates WHERE user_id = ? AND course_id = ? AND revoked = 0', uid, cid)) run('INSERT INTO certificates(code, user_id, course_id, title, issued_at) VALUES(?,?,?,?,?)', code, uid, cid, course.title, at);
  notify(uid, { icon: 'award', title: 'Certificate earned!', body: `You completed ${course.title}. Share it on LinkedIn from your certificates page.`, link: '#/certificates' });
  audit({ id: uid, full_name: get('SELECT full_name FROM users WHERE id = ?', uid).full_name }, 'certificate', cid, 'issue', { course: course.title, code });
  invalidateScores();
  return code;
}
const logMinutes = (uid, minutes) => run('INSERT INTO learning_activity(user_id, day, minutes) VALUES(?,?,?) ON CONFLICT(user_id, day) DO UPDATE SET minutes = minutes + excluded.minutes', uid, today(), minutes);
function streak(uid) {
  const days = new Set(all('SELECT day FROM learning_activity WHERE user_id = ? AND minutes > 0', uid).map(x => x.day));
  let s = 0; const d = new Date(); if (!days.has(today())) d.setUTCDate(d.getUTCDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) { s++; d.setUTCDate(d.getUTCDate() - 1); }
  return s;
}

// ---------------- catalogue ----------------
r.get('/courses', (req, res) => {
  const where = ['c.is_published = 1']; const p = [];
  if (can(req.user, 'learning.manage') && req.query.all === '1') where.length = 0;
  if (req.query.category) { where.push('c.category = ?'); p.push(req.query.category); }
  if (req.query.q) { where.push('(c.title LIKE ? OR c.summary LIKE ?)'); p.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  res.json(all(`SELECT c.*, (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) learners, (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) lessons,
      (SELECT progress FROM enrollments e WHERE e.course_id = c.id AND e.user_id = ?) my_progress, (SELECT status FROM enrollments e WHERE e.course_id = c.id AND e.user_id = ?) my_status
    FROM courses c ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.is_featured DESC, learners DESC`, req.user.id, req.user.id, ...p));
});
r.get('/courses/:id', h((req, res) => {
  const c = get('SELECT * FROM courses WHERE id = ?', int(req.params.id)); if (!c || (!c.is_published && !can(req.user, 'learning.manage'))) throw notFound('Course not found.');
  const e = enrollmentOf(c.id, req.user.id); const done = new Set(e?.completed_lessons || []);
  const modules = all('SELECT * FROM course_modules WHERE course_id = ? ORDER BY sort', c.id).map(m => ({ ...m, lessons: all('SELECT id, title, duration_min, video_url, sort FROM lessons WHERE module_id = ? ORDER BY sort', m.id).map(l => ({ ...l, done: done.has(l.id) })) }));
  const quiz = get('SELECT COUNT(*) n FROM quiz_questions WHERE course_id = ?', c.id).n;
  res.json({ ...c, modules, enrollment: e || null, quiz_questions: quiz, learners: get('SELECT COUNT(*) n FROM enrollments WHERE course_id = ?', c.id).n,
    certificate: get('SELECT code, issued_at FROM certificates WHERE user_id = ? AND course_id = ? AND revoked = 0', req.user.id, c.id) || null,
    peers: all(`SELECT u.id, u.full_name, s.short_name society_short, e.completed_at FROM enrollments e JOIN users u ON u.id = e.user_id LEFT JOIN societies s ON s.id = u.society_id WHERE e.course_id = ? AND e.status = 'completed' ORDER BY e.completed_at DESC LIMIT 5`, c.id).map(p => ({ ...p, initials: initials(p.full_name) })),
    can_manage: can(req.user, 'learning.manage') });
}));
r.post('/courses/:id/enroll', h((req, res) => {
  const c = get('SELECT * FROM courses WHERE id = ? AND is_published = 1', int(req.params.id)); if (!c) throw notFound();
  const first = lessonIds(c.id)[0];
  run("INSERT OR IGNORE INTO enrollments(course_id, user_id, status, progress, completed_lessons, last_lesson_id, enrolled_at) VALUES(?,?,?,?,?,?,?)", c.id, req.user.id, 'active', 0, '[]', first, nowISO());
  res.json({ ok: true, first_lesson: first });
}));
r.get('/lessons/:id', h((req, res) => {
  const l = get('SELECT l.*, m.title module_title FROM lessons l JOIN course_modules m ON m.id = l.module_id WHERE l.id = ?', int(req.params.id)); if (!l) throw notFound();
  const e = enrollmentOf(l.course_id, req.user.id);
  if (!e && !can(req.user, 'learning.manage')) throw forbidden('Enroll in the course to open its lessons.');
  if (e) run('UPDATE enrollments SET last_lesson_id = ? WHERE id = ?', l.id, e.id);
  const ids = lessonIds(l.course_id); const i = ids.indexOf(l.id);
  res.json({ ...l, prev_id: ids[i - 1] || null, next_id: ids[i + 1] || null, done: !!e?.completed_lessons.includes(l.id), position: i + 1, total: ids.length });
}));
r.post('/lessons/:id/complete', h((req, res) => {
  const l = get('SELECT * FROM lessons WHERE id = ?', int(req.params.id)); if (!l) throw notFound();
  const e = enrollmentOf(l.course_id, req.user.id); if (!e) throw forbidden('Enroll in the course first.');
  if (!e.completed_lessons.includes(l.id)) {
    const done = [...e.completed_lessons, l.id]; const total = lessonIds(l.course_id).length;
    run('UPDATE enrollments SET completed_lessons = ?, progress = ? WHERE id = ?', JSON.stringify(done), Math.min(e.status === 'completed' ? 100 : 99, Math.round(100 * done.length / total)), e.id);
    logMinutes(req.user.id, l.duration_min || 10);
    invalidateScores();
  }
  const code = issueIfComplete(l.course_id, req.user.id);
  res.json({ ok: true, certificate: code, enrollment: enrollmentOf(l.course_id, req.user.id) });
}));
r.get('/courses/:id/quiz', h((req, res) => {
  const cid = int(req.params.id); if (!enrollmentOf(cid, req.user.id)) throw forbidden('Enroll in the course first.');
  res.json(all('SELECT id, question, options FROM quiz_questions WHERE course_id = ? ORDER BY sort', cid).map(q => ({ ...q, options: json(q.options, []) })));
}));
r.post('/courses/:id/quiz', h((req, res) => {
  const cid = int(req.params.id); const e = enrollmentOf(cid, req.user.id); if (!e) throw forbidden('Enroll in the course first.');
  const qs = all('SELECT * FROM quiz_questions WHERE course_id = ? ORDER BY sort', cid); const answers = req.body.answers || {};
  const review = qs.map(q => ({ id: q.id, correct: int(answers[q.id]) === q.answer_index, answer_index: q.answer_index, explanation: q.explanation }));
  const score = qs.length ? Math.round(100 * review.filter(x => x.correct).length / qs.length) : 100;
  const course = get('SELECT pass_mark FROM courses WHERE id = ?', cid);
  run('UPDATE enrollments SET quiz_score = MAX(COALESCE(quiz_score, 0), ?), quiz_attempts = quiz_attempts + 1 WHERE id = ?', score, e.id);
  const code = issueIfComplete(cid, req.user.id);
  res.json({ score, passed: score >= course.pass_mark, pass_mark: course.pass_mark, review, certificate: code, lessons_remaining: lessonIds(cid).length - e.completed_lessons.length });
}));

// ---------------- certificates ----------------
r.get('/certificates', h((req, res) => {
  const uid = int(req.query.user_id) || req.user.id;
  res.json(all('SELECT c.*, co.category, co.hours, co.instructor, u.full_name FROM certificates c JOIN users u ON u.id = c.user_id LEFT JOIN courses co ON co.id = c.course_id WHERE c.user_id = ? AND c.revoked = 0 ORDER BY c.issued_at DESC', uid));
}));

// ---------------- paths & hub ----------------
function pathsFor(u) {
  return all('SELECT * FROM learning_paths ORDER BY id').map(p => {
    const ids = json(p.course_ids, []);
    const courses = ids.map(id => { const c = get('SELECT id, title, category, hours FROM courses WHERE id = ?', id); const e = enrollmentOf(id, u.id); return c && { ...c, progress: e?.progress || 0, status: e?.status || null }; }).filter(Boolean);
    return { ...p, courses, progress: courses.length ? Math.round(courses.reduce((s, c) => s + (c.status === 'completed' ? 100 : c.progress), 0) / courses.length) : 0, completed: courses.filter(c => c.status === 'completed').length };
  });
}
const pathAudience = (u) => ({ president: 'president', vice_president: 'president', committee_head: 'president', founder: 'founder', incubator_agent: 'incubator_agent' }[u.role_key] || 'member');
r.get('/learning/paths', (req, res) => res.json(pathsFor(req.user)));
r.get('/learning/hub', (req, res) => {
  const u = req.user; const n = (sql, ...p) => get(sql, ...p).n;
  const paths = pathsFor(u); const audience = pathAudience(u);
  res.json({
    stats: { learners: n("SELECT COUNT(DISTINCT user_id) n FROM enrollments WHERE status = 'active' OR completed_at > ?", daysAgo(90)), completions: n("SELECT COUNT(*) n FROM enrollments WHERE status = 'completed'"),
      certificates: n('SELECT COUNT(*) n FROM certificates WHERE issued_at > ?', daysAgo(30)), mentoring_hours: Math.round(n("SELECT COALESCE(SUM(duration_min),0) n FROM mentor_sessions WHERE status = 'completed'") / 60) },
    featured: all('SELECT c.*, (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) learners, (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) lessons FROM courses c WHERE c.is_published = 1 AND c.is_featured = 1 ORDER BY c.id'),
    my_path: paths.find(p => p.audience === audience) || paths[0], paths,
    continue: all(`SELECT e.course_id, e.progress, e.last_lesson_id, c.title, c.category, c.color FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ? AND e.status = 'active' ORDER BY e.enrolled_at DESC LIMIT 4`, u.id),
    certificates: all('SELECT c.code, c.title, c.issued_at FROM certificates c WHERE c.user_id = ? AND c.revoked = 0 ORDER BY c.issued_at DESC LIMIT 4', u.id),
    workshops: all(`SELECT e.id, e.title, e.start_at, e.location, e.mode, (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'going') going FROM events e
      WHERE (e.category IN ('training','workshop') OR e.kind = 'training') AND e.status = 'published' AND e.start_at > ? AND (e.visibility = 'all' OR e.society_id = ?) ORDER BY e.start_at LIMIT 4`, nowISO(), u.society_id || 0),
    categories: all('SELECT category, COUNT(*) n FROM courses WHERE is_published = 1 GROUP BY category ORDER BY n DESC'),
    activity: all(`SELECT c.title, c.issued_at, u.id user_id, u.full_name FROM certificates c JOIN users u ON u.id = c.user_id ORDER BY c.issued_at DESC LIMIT 4`).map(a => ({ ...a, initials: initials(a.full_name) })),
    societies: all(`SELECT s.id, s.short_name, COUNT(DISTINCT e.user_id) learners, SUM(e.status = 'completed') completions FROM enrollments e JOIN users u ON u.id = e.user_id JOIN societies s ON s.id = u.society_id GROUP BY s.id ORDER BY completions DESC LIMIT 3`),
    streak: streak(u.id),
  });
});

// ---------------- AI Learning Coach ----------------
const SKILLS = ['Entrepreneurship', 'Leadership', 'Pitching', 'Design Thinking', 'Finance', 'Marketing', 'AI Literacy', 'Teamwork'];
const COURSE_SKILLS = {
  'Entrepreneurship Fundamentals': { Entrepreneurship: 40, 'Design Thinking': 10, Finance: 10 }, 'Design Thinking & Innovation': { 'Design Thinking': 40, Teamwork: 10 },
  'Financial Literacy for Entrepreneurs': { Finance: 45 }, 'Pitching & Storytelling That Converts': { Pitching: 45, Leadership: 10 }, 'Digital Marketing & Growth Hacking': { Marketing: 45 },
  'Society Leadership & Governance': { Leadership: 40, Teamwork: 20 }, 'Rally Society Member Onboarding': { Teamwork: 15, Leadership: 5 }, 'AI for Entrepreneurs': { 'AI Literacy': 45 },
  'Event Management & Reporting': { Leadership: 20, Teamwork: 20 }, 'Cybersecurity & Digital Safety Essentials': { 'AI Literacy': 15 }, 'Incubator Agent Certification': { Entrepreneurship: 20, Teamwork: 15 },
};
const TARGETS = { member: 60, committee_head: 70, vice_president: 75, president: 75, founder: 75, incubator_agent: 70 };
export function skillProfile(u) {
  const level = Object.fromEntries(SKILLS.map(s => [s, 20]));
  for (const e of all('SELECT e.progress, e.status, c.title FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ?', u.id))
    for (const [s, w] of Object.entries(COURSE_SKILLS[e.title] || {})) level[s] += w * (e.status === 'completed' ? 1 : e.progress / 100);
  const checkins = get('SELECT COUNT(*) n FROM event_rsvps WHERE user_id = ? AND checked_in_at IS NOT NULL', u.id).n;
  const posts = get("SELECT COUNT(*) n FROM posts WHERE author_id = ? AND status = 'published'", u.id).n;
  level.Teamwork += Math.min(20, checkins); level.Leadership += Math.min(10, checkins / 2); level.Marketing += Math.min(10, posts);
  const base = TARGETS[u.role_key] || 60;
  const target = Object.fromEntries(SKILLS.map(s => [s, Math.min(95, base + ((['president', 'vice_president', 'committee_head'].includes(u.role_key) && ['Leadership', 'Teamwork'].includes(s)) || (u.role_key === 'founder' && ['Pitching', 'Finance', 'Entrepreneurship'].includes(s)) ? 15 : 0))]));
  const radar = SKILLS.map(s => ({ skill: s, level: Math.min(100, Math.round(level[s])), target: target[s] }));
  const gaps = radar.map(x => ({ skill: x.skill, gap: Math.max(0, x.target - x.level) })).filter(g => g.gap > 0).sort((a, b) => b.gap - a.gap);
  return { radar, gaps, mastered: radar.filter(x => x.level >= x.target).length, total: SKILLS.length };
}
r.get('/learning/coach', (req, res) => {
  const u = req.user; const prof = skillProfile(u);
  const taken = new Set(all("SELECT course_id FROM enrollments WHERE user_id = ? AND status = 'completed'", u.id).map(x => x.course_id));
  const recs = all('SELECT id, title, category, level, hours, rating FROM courses WHERE is_published = 1').filter(c => !taken.has(c.id))
    .map(c => ({ ...c, fit: prof.gaps.slice(0, 3).reduce((s, g) => s + (COURSE_SKILLS[c.title]?.[g.skill] || 0) * g.gap, 0) })).sort((a, b) => b.fit - a.fit).slice(0, 3);
  const avg = Math.round(prof.radar.reduce((s, x) => s + x.level, 0) / prof.radar.length);
  const next = all(`SELECT id, title, start_at FROM events WHERE status = 'published' AND start_at > ? AND (visibility = 'all' OR society_id = ?) AND category IN ('training','workshop','competition') ORDER BY start_at LIMIT 2`, nowISO(), u.society_id || 0);
  const active = all("SELECT c.title FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ? AND e.status = 'active' ORDER BY e.progress DESC LIMIT 2", u.id);
  const plan = [...active.map(a => ({ action: `Complete: ${a.title}`, kind: 'course' })), ...next.map(e => ({ action: `Attend: ${e.title}`, kind: 'event', at: e.start_at })), { action: 'Practise: two-minute pitch with the AI coach', kind: 'ai' }].slice(0, 4);
  const gapWord = `%${(prof.gaps[0]?.skill || 'Entrepreneurship').split(' ')[0]}%`;
  const mentor = get(`SELECT u.id, u.full_name, m.headline, m.expertise FROM mentor_profiles m JOIN users u ON u.id = m.user_id WHERE m.status = 'verified' ORDER BY (m.expertise LIKE ?) DESC, m.years_experience DESC LIMIT 1`, gapWord);
  res.json({ ...prof, level: avg >= 75 ? 'Advanced' : avg >= 50 ? 'Intermediate' : 'Foundation', progress: avg, streak: streak(u.id), recommendations: recs, plan,
    mentor: mentor && { ...mentor, initials: initials(mentor.full_name), expertise: json(mentor.expertise, []) },
    groups: all(`SELECT g.id, g.name, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) members FROM groups g WHERE g.kind = 'interest' AND g.visibility = 'public' AND NOT EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ?) LIMIT 4`, u.id),
    ai: { enabled: AI.aiEnabled() } });
});

// ---------------- AI tools ----------------
r.get('/ai/status', (req, res) => res.json({ enabled: AI.aiEnabled(), model: AI.aiEnabled() ? AI.AI_MODEL : null }));
r.post('/ai/coach', h(async (req, res) => {
  const msgs = (Array.isArray(req.body.messages) ? req.body.messages : []).filter(m => m && typeof m.content === 'string' && m.content.trim()).slice(-12);
  need(msgs.length && msgs[msgs.length - 1].role === 'user' ? msgs : null, 'Please type a question.');
  const u = req.user; const prof = skillProfile(u);
  const context = { name: u.full_name.split(' ')[0], role: u.role_name, society: u.society_name, skill_gaps: prof.gaps.slice(0, 3),
    completed_courses: all("SELECT c.title FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ? AND e.status = 'completed'", u.id).map(x => x.title),
    catalogue: all('SELECT title, category, level FROM courses WHERE is_published = 1') };
  res.json(await AI.coach(u, msgs, context));
}));
const lessonFor = (u, id) => { const l = get('SELECT * FROM lessons WHERE id = ?', int(id)); if (!l) throw notFound('Lesson not found.'); if (!enrollmentOf(l.course_id, u.id) && !can(u, 'learning.manage')) throw forbidden('Enroll in the course first.'); return l; };
r.post('/ai/summarize', h(async (req, res) => res.json(await AI.summarizeLesson(req.user, lessonFor(req.user, req.body.lesson_id)))));
r.post('/ai/quiz', h(async (req, res) => res.json(await AI.generateQuiz(req.user, lessonFor(req.user, req.body.lesson_id)))));
r.post('/ai/pitch', h(async (req, res) => {
  const pitch = need(clean(req.body.pitch, 8000), 'Paste your pitch text first.');
  const venture = int(req.body.venture_id) ? get('SELECT * FROM ventures WHERE id = ?', int(req.body.venture_id)) : null;
  res.json(await AI.pitchReview(req.user, pitch, venture));
}));
r.post('/ai/handbook', h(async (req, res) => res.json(await AI.handbookAnswer(req.user, need(clean(req.body.question, 1000), 'Please type a question.')))));
r.post('/ai/report', h(async (req, res) => {
  const sid = int(req.body.society_id) || req.user.society_id;
  if (!canViewSociety(req.user, sid) || !(isLeadership(req.user, sid) || req.user.is_committee_head || req.user.grants.includes('report_submission') || req.user.role_key === 'incubator_agent' || can(req.user, 'portfolio.view'))) throw forbidden();
  const period = clean(req.body.period, 7) || new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 7);
  const [y, m] = period.split('-').map(Number); const from = new Date(Date.UTC(y, m - 1, 1)).toISOString(), to = new Date(Date.UTC(y, m, 0, 23, 59, 59)).toISOString();
  const s = get('SELECT short_name FROM societies WHERE id = ?', sid);
  const events = all(`SELECT title, substr(start_at,1,10) date, attendance_count attendance, training_hours FROM events WHERE society_id = ? AND status IN ('completed','closed') AND start_at BETWEEN ? AND ? ORDER BY start_at`, sid, from, to);
  const n = (sql, ...p) => get(sql, ...p).n;
  const data = { society: s.short_name, period, period_label: new Date(from).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), events,
    training_hours: events.reduce((a, e) => a + (e.training_hours || 0), 0),
    checkins: n('SELECT COUNT(*) n FROM event_rsvps r JOIN events e ON e.id = r.event_id WHERE e.society_id = ? AND r.checked_in_at BETWEEN ? AND ?', sid, from, to),
    posts: n("SELECT COUNT(*) n FROM posts WHERE society_id = ? AND status = 'published' AND published_at BETWEEN ? AND ?", sid, from, to),
    comments: n('SELECT COUNT(*) n FROM comments c JOIN posts p ON p.id = c.post_id WHERE p.society_id = ? AND c.created_at BETWEEN ? AND ?', sid, from, to),
    new_members: n("SELECT COUNT(*) n FROM users WHERE society_id = ? AND created_at BETWEEN ? AND ?", sid, from, to),
    course_completions: n("SELECT COUNT(*) n FROM enrollments e JOIN users u ON u.id = e.user_id WHERE u.society_id = ? AND e.completed_at BETWEEN ? AND ?", sid, from, to),
    certificates: n('SELECT COUNT(*) n FROM certificates c JOIN users u ON u.id = c.user_id WHERE u.society_id = ? AND c.issued_at BETWEEN ? AND ?', sid, from, to),
    handbook_pct: societyHealth(sid).handbook_pct, open_escalations: n("SELECT COUNT(*) n FROM escalations WHERE society_id = ? AND status != 'resolved'", sid) };
  res.json({ ...(await AI.draftReport(req.user, data)), data });
}));

// ---------------- course authoring ----------------
const manage = requireCap('learning.manage');
r.post('/courses', manage, h((req, res) => {
  const b = req.body;
  const id = Number(run('INSERT INTO courses(title, category, level, duration_label, hours, instructor, summary, description, color, tag, is_published, is_featured, pass_mark, created_by, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    need(clean(b.title, 160), 'Course title is required.'), clean(b.category, 60) || 'Entrepreneurship', clean(b.level, 30) || 'Beginner', clean(b.duration_label, 30), +b.hours || 0, clean(b.instructor, 120) || req.user.full_name,
    clean(b.summary, 400), clean(b.description, 2000), clean(b.color, 12) || '#102D5A', clean(b.tag, 20), b.is_published ? 1 : 0, b.is_featured ? 1 : 0, Math.min(100, Math.max(0, int(b.pass_mark) ?? 70)), req.user.id, nowISO()).lastInsertRowid);
  audit(req.user, 'course', id, 'create', { title: b.title });
  res.json({ id });
}));
r.put('/courses/:id', manage, h((req, res) => {
  const id = int(req.params.id); const b = req.body; const c = get('SELECT * FROM courses WHERE id = ?', id); if (!c) throw notFound();
  run('UPDATE courses SET title = ?, category = ?, level = ?, duration_label = ?, hours = ?, instructor = ?, summary = ?, description = ?, color = ?, tag = ?, is_published = ?, is_featured = ?, pass_mark = ? WHERE id = ?',
    clean(b.title, 160) || c.title, clean(b.category, 60) || c.category, clean(b.level, 30) || c.level, clean(b.duration_label, 30) ?? c.duration_label, b.hours !== undefined ? +b.hours : c.hours, clean(b.instructor, 120) ?? c.instructor,
    clean(b.summary, 400) ?? c.summary, clean(b.description, 2000) ?? c.description, clean(b.color, 12) || c.color, clean(b.tag, 20) ?? c.tag, b.is_published !== undefined ? (b.is_published ? 1 : 0) : c.is_published,
    b.is_featured !== undefined ? (b.is_featured ? 1 : 0) : c.is_featured, b.pass_mark !== undefined ? int(b.pass_mark) : c.pass_mark, id);
  audit(req.user, 'course', id, 'update', {});
  res.json({ ok: true });
}));
r.post('/courses/:id/modules', manage, h((req, res) => {
  const cid = int(req.params.id); const sort = get('SELECT COALESCE(MAX(sort), -1) + 1 n FROM course_modules WHERE course_id = ?', cid).n;
  res.json({ id: Number(run('INSERT INTO course_modules(course_id, title, sort) VALUES(?,?,?)', cid, need(clean(req.body.title, 160), 'Module title is required.'), sort).lastInsertRowid) });
}));
r.put('/modules/:id', manage, h((req, res) => { run('UPDATE course_modules SET title = ? WHERE id = ?', need(clean(req.body.title, 160), 'Module title is required.'), int(req.params.id)); res.json({ ok: true }); }));
r.delete('/modules/:id', manage, h((req, res) => { run('DELETE FROM course_modules WHERE id = ?', int(req.params.id)); res.json({ ok: true }); }));
r.post('/modules/:id/lessons', manage, h((req, res) => {
  const m = get('SELECT * FROM course_modules WHERE id = ?', int(req.params.id)); if (!m) throw notFound();
  const sort = get('SELECT COALESCE(MAX(sort), -1) + 1 n FROM lessons WHERE module_id = ?', m.id).n;
  res.json({ id: Number(run('INSERT INTO lessons(module_id, course_id, title, duration_min, content, video_url, sort) VALUES(?,?,?,?,?,?,?)', m.id, m.course_id, need(clean(req.body.title, 160), 'Lesson title is required.'), int(req.body.duration_min) || 10, clean(req.body.content, 20000), clean(req.body.video_url, 400), sort).lastInsertRowid) });
}));
r.put('/lessons/:id', manage, h((req, res) => {
  run('UPDATE lessons SET title = ?, duration_min = ?, content = ?, video_url = ? WHERE id = ?', need(clean(req.body.title, 160), 'Lesson title is required.'), int(req.body.duration_min) || 10, clean(req.body.content, 20000), clean(req.body.video_url, 400), int(req.params.id));
  res.json({ ok: true });
}));
r.delete('/lessons/:id', manage, h((req, res) => { run('DELETE FROM lessons WHERE id = ?', int(req.params.id)); res.json({ ok: true }); }));
r.get('/courses/:id/questions', manage, (req, res) => res.json(all('SELECT * FROM quiz_questions WHERE course_id = ? ORDER BY sort', int(req.params.id)).map(q => ({ ...q, options: json(q.options, []) }))));
r.post('/courses/:id/questions', manage, h((req, res) => {
  const opts = (req.body.options || []).map(o => clean(o, 200)).filter(Boolean); if (opts.length < 2) throw bad('Add at least two options.');
  const ans = int(req.body.answer_index); if (ans == null || ans < 0 || ans >= opts.length) throw bad('Choose the correct answer.');
  const sort = get('SELECT COALESCE(MAX(sort), -1) + 1 n FROM quiz_questions WHERE course_id = ?', int(req.params.id)).n;
  res.json({ id: Number(run('INSERT INTO quiz_questions(course_id, question, options, answer_index, explanation, sort) VALUES(?,?,?,?,?,?)', int(req.params.id), need(clean(req.body.question, 400), 'Question is required.'), JSON.stringify(opts), ans, clean(req.body.explanation, 400), sort).lastInsertRowid) });
}));
r.delete('/questions/:id', manage, h((req, res) => { run('DELETE FROM quiz_questions WHERE id = ?', int(req.params.id)); res.json({ ok: true }); }));

export default r;
