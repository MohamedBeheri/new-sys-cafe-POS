// ===================================================================
//  Insights: role-based dashboards (one per role family) and the
//  KPI & Society Performance Centre
// ===================================================================
import { Router } from 'express';
import { get, all, run, nowISO, json } from '../db/database.js';
import { can, leads, isLeadership, supervises, canViewSociety, societyOf, audit, initials, societyHealth, daysAgo, daysAhead, prevAY, academicYear } from '../lib/core.js';
import { approvalItems } from '../lib/approvals.js';
import { scoreOf, badgesOf } from '../lib/stats.js';
import { kpiValues, scoreTrend, reportingYear, yearOptions, activeSocietyIds, defs } from '../lib/kpi.js';
import { hierarchy, electionSummary, dueReports } from './society.js';
import { approvalQueue } from './core.js';
import { traction } from './incubator.js';
import { eligibility } from './elections.js';
import { h, bad, forbidden, need, clean, int } from '../lib/http.js';

const r = Router();
const monthStart = () => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const upcomingFor = (u, n = 5) => all(`SELECT e.id, e.title, e.start_at, e.location, e.kind, e.category, e.mode, s.short_name society_short,
    (SELECT status FROM event_rsvps r WHERE r.event_id = e.id AND r.user_id = ?) my_rsvp
  FROM events e LEFT JOIN societies s ON s.id = e.society_id WHERE e.status = 'published' AND e.start_at > ? AND (e.visibility = 'all' OR e.society_id = ?) AND (e.society_id = ? OR e.kind IN ('aastec','training'))
  ORDER BY e.start_at LIMIT ?`, u.id, nowISO(), u.society_id || 0, u.society_id || 0, n);

// ---------------- builders ----------------
function executive(u) {
  const ay = reportingYear(); const kv = kpiValues(null, ay);
  const ids = activeSocietyIds();
  const ranking = all(`SELECT s.id, s.short_name, u.country, (SELECT full_name FROM users p JOIN roles r ON r.id = p.role_id WHERE p.society_id = s.id AND r.key = 'president' LIMIT 1) president
    FROM societies s JOIN universities u ON u.id = s.university_id WHERE s.status = 'active'`).map(s => ({ ...s, ...societyHealth(s.id) })).sort((a, b) => b.score - a.score);
  const months = all(`SELECT substr(start_at, 1, 7) m, kind, COUNT(*) n FROM events WHERE start_at BETWEEN ? AND ? AND status IN ('published','completed','closed') GROUP BY m, kind ORDER BY m`, daysAgo(365), daysAhead(31));
  const n = (sql, ...p) => get(sql, ...p).n;
  const queue = approvalQueue();
  return {
    reporting_year: ay, rallians_score: kv.rallians_score,
    kpis: {
      programmes: n("SELECT COUNT(*) n FROM programmes WHERE status = 'active'"), societies: ids.length, societies_total: n('SELECT COUNT(*) n FROM societies'),
      countries: n("SELECT COUNT(DISTINCT u.country) n FROM societies s JOIN universities u ON u.id = s.university_id WHERE s.status = 'active'"),
      members: n("SELECT COUNT(*) n FROM users WHERE membership_status = 'active' AND society_id IS NOT NULL AND is_active = 1"), members_new: n("SELECT COUNT(*) n FROM users WHERE created_at > ? AND society_id IS NOT NULL", daysAgo(30)),
      events_upcoming: n("SELECT COUNT(*) n FROM events WHERE status = 'published' AND start_at BETWEEN ? AND ?", nowISO(), daysAhead(30)),
      approvals: queue.reduce((s, q) => s + q.count, 0), my_approvals: approvalItems(u).length,
      health: Math.round(ranking.reduce((s, x) => s + x.score, 0) / (ranking.length || 1)), compliance: Math.round(ranking.reduce((s, x) => s + x.handbook_pct, 0) / (ranking.length || 1)),
      ventures: n("SELECT COUNT(*) n FROM ventures WHERE status = 'active'"), certificates: n('SELECT COUNT(*) n FROM certificates WHERE issued_at > ?', daysAgo(365)),
    },
    ranking: ranking.slice(0, 8), at_risk: ranking.filter(s => s.score < 55 || s.missing_reports >= 2).slice(0, 6),
    trend: [...new Set(months.map(x => x.m))].map(m => ({ month: m, society: months.filter(x => x.m === m && ['society', 'info_session'].includes(x.kind)).reduce((s, x) => s + x.n, 0), aastec: months.filter(x => x.m === m && ['aastec', 'training'].includes(x.kind)).reduce((s, x) => s + x.n, 0) })),
    countries: all("SELECT un.country, COUNT(*) n FROM users u JOIN societies s ON s.id = u.society_id JOIN universities un ON un.id = s.university_id WHERE u.membership_status = 'active' GROUP BY un.country ORDER BY n DESC"),
    programmes: all("SELECT p.id, p.name, p.kind, p.status, p.color, m.full_name manager_name, (SELECT COUNT(*) FROM cohorts c WHERE c.programme_id = p.id AND c.status != 'completed') open_cohorts FROM programmes p LEFT JOIN users m ON m.id = p.manager_id ORDER BY p.id"),
    queue, elections: all("SELECT status, COUNT(*) n FROM elections WHERE sandbox = 0 AND cycle_year = (SELECT MAX(cycle_year) FROM elections WHERE sandbox = 0) GROUP BY status"),
    activity: all('SELECT actor_name, entity_type, action, detail, created_at FROM audit_log ORDER BY id DESC LIMIT 8'),
    role: get('SELECT name, description FROM roles WHERE key = ?', u.role_key), kpi_top: kv.kpis.slice().sort((a, b) => b.achievement - a.achievement).slice(0, 4), kpi_low: kv.kpis.slice().sort((a, b) => a.achievement - b.achievement).slice(0, 4),
  };
}
function societyCore(u) {
  const sid = u.society_id; const h = societyHealth(sid); const n = (sql, ...p) => get(sql, ...p).n;
  return {
    society: get('SELECT s.*, un.name university, un.city, un.country FROM societies s JOIN universities un ON un.id = s.university_id WHERE s.id = ?', sid), health: h, hierarchy: hierarchy(sid), elections: electionSummary(sid),
    counts: { members: h.members, new_this_month: n("SELECT COUNT(*) n FROM users WHERE society_id = ? AND membership_status = 'active' AND created_at >= ?", sid, monthStart()),
      approvals: approvalItems(u).length, upcoming_month: n("SELECT COUNT(*) n FROM events WHERE (society_id = ? OR kind = 'aastec') AND status = 'published' AND start_at BETWEEN ? AND ?", sid, nowISO(), daysAhead(30)),
      pending_society: n("SELECT COUNT(*) n FROM auth_requests WHERE society_id = ? AND status IN ('pending','head_reviewed')", sid) + n("SELECT COUNT(*) n FROM users WHERE society_id = ? AND membership_status = 'pending'", sid) },
    requests: all(`SELECT a.id, a.perm_key, a.scope_note, a.status, a.created_at, u.full_name FROM auth_requests a JOIN users u ON u.id = a.user_id WHERE a.society_id = ? AND a.status IN ('pending','head_reviewed') ORDER BY a.created_at DESC LIMIT 6`, sid).map(x => ({ ...x, initials: initials(x.full_name) })),
    upcoming: upcomingFor(u, 5), escalations: all("SELECT * FROM escalations WHERE society_id = ? AND status != 'resolved' ORDER BY created_at DESC LIMIT 5", sid),
    chapters: all(`SELECT s.id, s.short_name, un.city, un.country FROM societies s JOIN universities un ON un.id = s.university_id WHERE s.status = 'active' AND s.id != ? ORDER BY (un.country = (SELECT u2.country FROM societies s2 JOIN universities u2 ON u2.id = s2.university_id WHERE s2.id = ?)) DESC, s.id LIMIT 4`, sid, sid),
    reports_due: dueReports(sid),
  };
}
function president(u) { return { ...societyCore(u), delegation: !!societyOf(u.society_id).vp_delegation }; }
function vicePresident(u) {
  const sid = u.society_id; const core = societyCore(u); const n = (sql, ...p) => get(sql, ...p).n;
  const agenda = [
    ...all("SELECT title, start_at at, location, 'event' type FROM events WHERE (society_id = ? OR kind = 'aastec') AND status = 'published' AND start_at BETWEEN ? AND ? ORDER BY start_at", sid, nowISO(), daysAhead(3)),
    ...all("SELECT title, due_on || 'T17:00:00.000Z' at, NULL location, 'task' type FROM tasks WHERE society_id = ? AND status != 'done' AND due_on BETWEEN date('now') AND date('now', '+3 day')", sid),
  ].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 6);
  const committees = core.hierarchy.committees;
  const readiness = [
    { label: 'Documentation', ok: n('SELECT COUNT(*) n FROM documents WHERE society_id = ?', sid) >= 3 },
    { label: 'Delegation recorded', ok: !!get("SELECT 1 FROM audit_log WHERE entity_type = 'society' AND entity_id = ? AND action LIKE 'delegation%' AND created_at > ?", sid, daysAgo(365)) },
    { label: 'Action plans in progress', ok: n("SELECT COUNT(*) n FROM tasks WHERE society_id = ? AND status IN ('in_progress','in_review')", sid) >= committees.length },
    { label: 'Committee heads assigned', ok: committees.every(c => c.head) },
    { label: 'Reports up to date', ok: core.health.missing_reports === 0 },
  ];
  const scores = all("SELECT u.id, u.full_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.society_id = ? AND r.key = 'member' AND u.membership_status = 'active'", sid).map(m => ({ ...m, ...scoreOf(m.id) })).sort((a, b) => b.score - a.score);
  return { ...core, delegation: !!societyOf(sid).vp_delegation, agenda, readiness: { items: readiness, pct: Math.round(100 * readiness.filter(x => x.ok).length / readiness.length) },
    pipeline: { heads: committees.filter(c => c.head).length, emerging: scores.filter(s => s.top <= 25).length, top: scores.slice(0, 3).map(s => ({ id: s.id, full_name: s.full_name, initials: initials(s.full_name), score: s.score })) },
    approvals: approvalItems(u).slice(0, 6) };
}
function committeeHead(u) {
  const c = get('SELECT * FROM committees WHERE head_user_id = ? ORDER BY id LIMIT 1', u.id);
  if (!c) return member(u);
  const sid = c.society_id; const n = (sql, ...p) => get(sql, ...p).n;
  const tasks = all('SELECT t.*, a.full_name assignee_name FROM tasks t LEFT JOIN users a ON a.id = t.assignee_id WHERE t.committee_id = ? ORDER BY t.status = \'done\', t.due_on', c.id);
  const done = tasks.filter(t => t.status === 'done').length;
  const members = all("SELECT u.id, u.full_name, u.title, u.handbook_ack_version FROM users u WHERE u.committee_id = ? AND u.membership_status = 'active' AND u.id != ?", c.id, u.id).map(m => ({ ...m, initials: initials(m.full_name) }));
  const ids = members.map(m => m.id).concat(u.id); const IN = `(${ids.join(',')})`;
  const active = n(`SELECT COUNT(DISTINCT uid) n FROM (SELECT author_id uid FROM posts WHERE author_id IN ${IN} AND created_at > ? UNION SELECT user_id uid FROM event_rsvps WHERE user_id IN ${IN} AND checked_in_at > ? UNION SELECT user_id uid FROM learning_activity WHERE user_id IN ${IN} AND day > ?)`, daysAgo(30), daysAgo(30), daysAgo(30).slice(0, 10));
  const monthEvents = all("SELECT id FROM events WHERE society_id = ? AND status IN ('completed','closed') AND start_at >= ?", sid, monthStart()).map(e => e.id);
  const attended = monthEvents.length ? n(`SELECT COUNT(*) n FROM event_rsvps WHERE event_id IN (${monthEvents.join(',')}) AND user_id IN ${IN} AND checked_in_at IS NOT NULL`) : 0;
  const chat = get("SELECT c.id, c.title FROM conversations c JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ? WHERE c.kind = 'group' ORDER BY c.last_message_at DESC LIMIT 1", u.id);
  const unacked = members.filter(m => !m.handbook_ack_version).length;
  return {
    committee: c, society: societyOf(sid), hierarchy: hierarchy(sid), members,
    stats: { contribution: tasks.length ? Math.round(100 * done / tasks.length) : 0, delivered: done, deliverables: tasks.length, engagement: Math.round(100 * active / ids.length),
      events_supported: n("SELECT COUNT(*) n FROM events WHERE committee_id = ? AND status IN ('published','completed','closed') AND start_at > ?", c.id, daysAgo(30)),
      attendance: monthEvents.length ? Math.min(100, Math.round(100 * attended / (monthEvents.length * ids.length))) : 0, events_month: monthEvents.length, attended },
    tasks: tasks.filter(t => t.status !== 'done').slice(0, 6), deadlines: tasks.filter(t => t.status !== 'done' && t.due_on && t.due_on <= daysAhead(14).slice(0, 10)).slice(0, 5),
    duties: all("SELECT id, title, start_at, status FROM events WHERE committee_id = ? AND start_at > ? ORDER BY start_at LIMIT 5", c.id, daysAgo(7)),
    approvals: approvalItems(u).slice(0, 5), documents: all('SELECT d.*, u.full_name uploaded_by_name FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by WHERE d.committee_id = ? ORDER BY d.created_at DESC LIMIT 5', c.id),
    chat: chat ? { ...chat, messages: all('SELECT m.body, m.created_at, u.full_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.conversation_id = ? ORDER BY m.created_at DESC LIMIT 3', chat.id).reverse().map(m => ({ ...m, initials: initials(m.full_name) })) } : null,
    compliance: [
      { label: 'Content aligned with the Society mission and values', ok: true },
      { label: 'Official content approved before publication', ok: !get("SELECT 1 FROM posts p JOIN users a ON a.id = p.author_id WHERE a.committee_id = ? AND p.identity = 'society' AND p.status = 'rejected' AND p.created_at > ?", c.id, daysAgo(30)) },
      { label: 'Committee members acknowledged the handbook', ok: unacked === 0, note: unacked ? `${unacked} pending` : null },
      { label: 'Tasks tracked with owners and deadlines', ok: tasks.every(t => t.assignee_id && t.due_on) },
      { label: 'No overdue deliverables', ok: !tasks.some(t => t.status !== 'done' && t.due_on && t.due_on < nowISO().slice(0, 10)) },
    ],
  };
}
function member(u) {
  const sid = u.society_id; const sc = scoreOf(u.id); const b = badgesOf(u.id);
  const elections = sid ? all("SELECT * FROM elections WHERE society_id = ? AND status IN ('nominations','voting') ORDER BY id DESC", sid).map(el => ({ id: el.id, title: el.title, status: el.status, sandbox: el.sandbox, voting_end: el.voting_end, nomination_end: el.nomination_end,
    eligible: eligibility(u, el).eligible, voted: !!get('SELECT 1 FROM ballots WHERE election_id = ? AND voter_id = ?', el.id, u.id) })) : [];
  return {
    profile: { full_name: u.full_name, initials: initials(u.full_name), title: u.title, society: u.society_name, university: u.university_name, faculty: u.faculty, study_year: u.study_year, membership_status: u.membership_status, ...sc, badges: b.badges, counts: b.counts },
    learning: all("SELECT e.course_id, e.progress, c.title, c.category, c.color FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ? AND e.status = 'active' ORDER BY e.progress DESC LIMIT 3", u.id),
    certificates: get('SELECT COUNT(*) n FROM certificates WHERE user_id = ? AND revoked = 0', u.id).n,
    streak: (() => { const days = new Set(all('SELECT day FROM learning_activity WHERE user_id = ?', u.id).map(x => x.day)); let s = 0; const d = new Date(); if (!days.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1); while (days.has(d.toISOString().slice(0, 10))) { s++; d.setUTCDate(d.getUTCDate() - 1); } return s; })(),
    my_events: all(`SELECT e.id, e.title, e.start_at, e.location, e.kind, e.mode FROM events e JOIN event_rsvps r ON r.event_id = e.id AND r.user_id = ? AND r.status = 'going' WHERE e.start_at > ? AND e.status = 'published' ORDER BY e.start_at LIMIT 4`, u.id, nowISO()),
    suggested: upcomingFor(u, 6).filter(e => !e.my_rsvp).slice(0, 3),
    requests: all('SELECT id, perm_key, scope_note, status, created_at, decision_note FROM auth_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 4', u.id),
    grants: all('SELECT perm_key, scope_note, expires_at FROM user_grants WHERE user_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)', u.id, nowISO()),
    elections, announcements: all(`SELECT p.id, p.title, p.body, p.identity, p.published_at, s.short_name society_short FROM posts p LEFT JOIN societies s ON s.id = p.society_id
      WHERE p.status = 'published' AND p.visibility = 'public' AND (p.identity = 'aastec' OR (p.identity = 'society' AND p.society_id = ?)) ORDER BY p.pinned DESC, p.published_at DESC LIMIT 3`, sid || 0),
    pass: `AASTEC-M-${u.id}`, handbook_ack: !!u.handbook_ack_version,
  };
}
function agent(u) {
  const sid = u.society_id; const n = (sql, ...p) => get(sql, ...p).n;
  const leads = all('SELECT stage, COUNT(*) n FROM startup_leads WHERE agent_id = ? GROUP BY stage', u.id); const by = (s) => leads.find(x => x.stage === s)?.n || 0;
  const order = ['identified', 'interested', 'screened', 'ready', 'converted'];
  const atLeast = (s) => order.slice(order.indexOf(s)).reduce((t, k) => t + by(k), 0);
  const ventures = all("SELECT v.* FROM ventures v WHERE v.agent_id = ? OR v.society_id = ?", u.id, sid || 0);
  const vids = ventures.map(v => v.id); const VIN = `(${vids.join(',') || 'NULL'})`;
  const sessions = all(`SELECT id, title, start_at, location, (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.checked_in_at IS NOT NULL) reached FROM events e WHERE e.kind = 'info_session' AND e.organizer_id = ? ORDER BY e.start_at`, u.id);
  const path = get("SELECT course_ids FROM learning_paths WHERE audience = 'incubator_agent'");
  const pathIds = json(path?.course_ids, []);
  const pathDone = pathIds.length ? n(`SELECT COUNT(*) n FROM enrollments WHERE user_id = ? AND status = 'completed' AND course_id IN (${pathIds.join(',')})`, u.id) : 0;
  return {
    profile: { full_name: u.full_name, initials: initials(u.full_name), society: u.society_name, university: u.university_name, academic_year: academicYear() },
    impact: { startups: atLeast('identified'), teams: ventures.length, events: sessions.length, reached: sessions.reduce((s, e) => s + e.reached, 0) },
    funnel: [['Ideas identified', 'identified'], ['Interested', 'interested'], ['Screened', 'screened'], ['Incubator ready', 'ready']].map(([label, s]) => ({ label, n: atLeast(s) })),
    applications: all(`SELECT a.status, COUNT(*) n FROM applications a JOIN users p ON p.id = a.applicant_id JOIN cohorts c ON c.id = a.cohort_id WHERE p.society_id = ? AND c.status IN ('open_call','screening') GROUP BY a.status`, sid || 0),
    stages: ['ideation', 'validation', 'mvp', 'early_traction'].map(s => ({ stage: s, n: ventures.filter(v => v.stage === s).length })),
    matching: { mentors: n(`SELECT COUNT(DISTINCT mentor_id) n FROM mentorships WHERE venture_id IN ${VIN}`), sessions: n(`SELECT COUNT(*) n FROM mentor_sessions WHERE venture_id IN ${VIN}`), teams: n(`SELECT COUNT(DISTINCT venture_id) n FROM mentorships WHERE venture_id IN ${VIN}`),
      rating: +(get(`SELECT COALESCE(AVG(rating), 0) n FROM mentor_sessions WHERE venture_id IN ${VIN} AND rating IS NOT NULL`).n).toFixed(1),
      recent: all(`SELECT ms.created_at, m.full_name mentor, mp.headline, v.name venture FROM mentorships ms JOIN users m ON m.id = ms.mentor_id LEFT JOIN mentor_profiles mp ON mp.user_id = ms.mentor_id JOIN ventures v ON v.id = ms.venture_id WHERE ms.venture_id IN ${VIN} ORDER BY ms.created_at DESC LIMIT 3`).map(x => ({ ...x, initials: initials(x.mentor) })) },
    sessions: sessions.filter(e => e.start_at > nowISO()).slice(0, 3),
    reports: all("SELECT title, period, status, submitted_at FROM society_reports WHERE submitted_by = ? AND report_type = 'incubator_agent' ORDER BY period DESC LIMIT 3", u.id),
    training: { done: pathDone, total: pathIds.length, pct: pathIds.length ? Math.round(100 * pathDone / pathIds.length) : 0 },
    network: all(`SELECT u.id, u.full_name, s.short_name society_short, un.country FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN societies s ON s.id = u.society_id LEFT JOIN universities un ON un.id = s.university_id WHERE r.key = 'incubator_agent' AND u.is_active = 1 ORDER BY u.id = ? DESC LIMIT 6`, u.id).map(a => ({ ...a, initials: initials(a.full_name), me: a.id === u.id })),
  };
}
function founder(u) {
  const v = get('SELECT v.*, c.name cohort_name, s.short_name society_short FROM ventures v LEFT JOIN cohorts c ON c.id = v.cohort_id LEFT JOIN societies s ON s.id = v.society_id WHERE v.founder_id = ? OR v.id IN (SELECT venture_id FROM venture_members WHERE user_id = ?) ORDER BY v.founder_id = ? DESC LIMIT 1', u.id, u.id, u.id);
  const base = member(u);
  if (!v) return { ...base, venture: null };
  const path = json(get("SELECT course_ids FROM learning_paths WHERE audience = 'founder'")?.course_ids, []);
  return {
    ...base, venture: { ...v, tags: json(v.tags, []), traction: traction(v) },
    team: all('SELECT vm.role_title, u.id, u.full_name FROM venture_members vm JOIN users u ON u.id = vm.user_id WHERE vm.venture_id = ?', v.id).map(m => ({ ...m, initials: initials(m.full_name) })),
    milestones: all('SELECT * FROM milestones WHERE venture_id = ? ORDER BY sort', v.id),
    sessions: all('SELECT s.*, m.full_name mentor_name, mp.headline FROM mentor_sessions s JOIN users m ON m.id = s.mentor_id LEFT JOIN mentor_profiles mp ON mp.user_id = s.mentor_id WHERE s.venture_id = ? AND s.status != \'cancelled\' ORDER BY s.start_at >= ? DESC, ABS(julianday(s.start_at) - julianday(?)) LIMIT 3', v.id, nowISO(), nowISO()).map(s => ({ ...s, initials: initials(s.mentor_name) })),
    tasks: all("SELECT * FROM tasks WHERE venture_id = ? AND status != 'done' ORDER BY due_on LIMIT 5", v.id),
    incubator_events: all(`SELECT id, title, start_at, mode, location FROM events WHERE status = 'published' AND start_at > ? AND (kind IN ('training','info_session','aastec') AND visibility = 'all') ORDER BY start_at LIMIT 3`, nowISO()),
    certificates_path: path.map(id => { const c = get('SELECT id, title FROM courses WHERE id = ?', id); const e = get('SELECT status, progress FROM enrollments WHERE course_id = ? AND user_id = ?', id, u.id); return c && { ...c, status: e?.status || null, progress: e?.progress || 0 }; }).filter(Boolean),
    activity: all("SELECT actor_name, action, detail, created_at FROM audit_log WHERE entity_type = 'venture' AND entity_id = ? ORDER BY id DESC LIMIT 4", v.id),
  };
}
function mentor(u) {
  const p = get('SELECT * FROM mentor_profiles WHERE user_id = ?', u.id);
  return {
    profile: p ? { ...p, expertise: json(p.expertise, []), industries: json(p.industries, []) } : null,
    mentees: all("SELECT v.id, v.name, v.tagline, v.stage, v.color, s.short_name society_short FROM mentorships ms JOIN ventures v ON v.id = ms.venture_id LEFT JOIN societies s ON s.id = v.society_id WHERE ms.mentor_id = ? AND ms.status = 'active'", u.id),
    upcoming: all("SELECT s.*, v.name venture FROM mentor_sessions s LEFT JOIN ventures v ON v.id = s.venture_id WHERE s.mentor_id = ? AND s.start_at > ? AND s.status IN ('scheduled','requested') ORDER BY s.start_at LIMIT 5", u.id, nowISO()),
    stats: get("SELECT COUNT(*) completed, COALESCE(ROUND(AVG(rating), 1), 0) rating, COALESCE(SUM(duration_min), 0) minutes FROM mentor_sessions WHERE mentor_id = ? AND status = 'completed'", u.id),
    requested: get("SELECT COUNT(*) n FROM mentor_sessions WHERE mentor_id = ? AND status = 'requested'", u.id).n,
    trainings: all("SELECT id, title, start_at, status FROM events WHERE organizer_id = ? ORDER BY start_at DESC LIMIT 4", u.id),
    upcoming_events: upcomingFor(u, 3),
  };
}

r.get('/dashboard', h((req, res) => {
  const u = req.user;
  let view = 'member';
  if (u.is_aastec) view = 'executive';
  else if (u.role_key === 'president') view = 'president';
  else if (u.role_key === 'vice_president') view = 'vice_president';
  else if (u.role_key === 'committee_head') view = 'committee_head';
  else if (u.role_key === 'advisor') view = 'advisor';
  else if (u.role_key === 'incubator_agent') view = 'agent';
  else if (u.role_key === 'mentor') view = 'mentor';
  else if (u.role_key === 'founder' || get('SELECT 1 FROM ventures WHERE founder_id = ?', u.id)) view = 'founder';
  if (['president', 'vice_president', 'committee_head', 'advisor'].includes(view) && !u.society_id) view = 'member';
  if (view === 'committee_head' && !get('SELECT 1 FROM committees WHERE head_user_id = ?', u.id)) view = 'member';
  const build = { executive, president, vice_president: vicePresident, committee_head: committeeHead, advisor: () => ({ society_id: u.society_id }), agent, founder, mentor, member }[view];
  res.json({ view, ...build(u) });
}));

// ---------------- KPI & Society Performance Centre ----------------
function scopeIds(u, q) {
  const all_ = can(u, 'kpi.view_all');
  const sid = int(q.society_id);
  if (sid) { if (!all_ && !canViewSociety(u, sid)) throw forbidden(); return { ids: [sid], label: societyOf(sid)?.name }; }
  if (!all_) { if (!u.society_id) throw forbidden('The KPI centre is available to Society leaders and AASTEC staff.'); return { ids: [u.society_id], label: u.society_name }; }
  let ids = activeSocietyIds(); let label = 'All Rally Societies';
  if (q.country) { ids = all("SELECT s.id FROM societies s JOIN universities u ON u.id = s.university_id WHERE s.status = 'active' AND u.country = ?", q.country).map(r => r.id); label = `Rally Societies — ${q.country}`; }
  if (q.kind) { const keep = new Set(all("SELECT s.id FROM societies s JOIN universities u ON u.id = s.university_id WHERE u.kind = ?", q.kind).map(r => r.id)); ids = ids.filter(i => keep.has(i)); label += q.kind === 'aast_campus' ? ' (AAST campuses)' : ' (partner universities)'; }
  return { ids, label };
}
r.get('/kpi', h((req, res) => {
  const u = req.user; const { ids, label } = scopeIds(u, req.query);
  if (!ids.length) throw bad('No active Societies in this scope.');
  const ay = yearOptions().includes(req.query.academic_year) ? req.query.academic_year : reportingYear();
  const current = kpiValues(ids, ay); const previous = kpiValues(ids, prevAY(ay));
  const kpis = current.kpis.map(k => { const p = previous.kpis.find(x => x.key === k.key); return { ...k, previous: p?.value ?? 0, delta: p && p.value ? Math.round(100 * (k.value - p.value) / p.value) : null }; });
  const perSociety = ids.length > 1 ? ids.map(id => { const v = kpiValues([id], ay); return { id, name: societyOf(id).short_name, score: v.rallians_score, met: v.kpis.filter(k => k.status === 'met').length }; }).sort((a, b) => b.score - a.score) : null;
  const bucket = (s) => s >= 90 ? 'Fully compliant' : s >= 70 ? 'Partially compliant' : s >= 50 ? 'Needs improvement' : 'Non-compliant';
  const dist = perSociety ? ['Fully compliant', 'Partially compliant', 'Needs improvement', 'Non-compliant'].map(b => ({ label: b, n: perSociety.filter(s => bucket(s.score) === b).length }))
    : ['Fully compliant', 'Partially compliant', 'Needs improvement', 'Non-compliant'].map(b => ({ label: b, n: kpis.filter(k => ({ met: 'Fully compliant', near: 'Partially compliant', improve: 'Needs improvement', off: 'Non-compliant' })[k.status] === b).length }));
  res.json({ scope: label, academic_year: ay, years: yearOptions(), societies: ids.length, rallians_score: current.rallians_score, previous_score: previous.rallians_score, kpis,
    trend: scoreTrend(ids, ay), trend_previous: scoreTrend(ids, prevAY(ay)), distribution: dist, ranking: perSociety,
    countries: can(u, 'kpi.view_all') ? all("SELECT DISTINCT u.country FROM societies s JOIN universities u ON u.id = s.university_id WHERE s.status = 'active' ORDER BY 1").map(r => r.country) : [],
    can_enter: ids.length === 1 && (isLeadership(u, ids[0]) || can(u, 'societies.manage')) });
}));
r.get('/kpi/entries', h((req, res) => {
  const sid = int(req.query.society_id) || req.user.society_id; if (!canViewSociety(req.user, sid)) throw forbidden();
  res.json(all('SELECT k.*, u.full_name entered_by_name, d.label FROM kpi_entries k LEFT JOIN users u ON u.id = k.entered_by LEFT JOIN kpi_definitions d ON d.key = k.metric_key WHERE k.society_id = ? ORDER BY k.created_at DESC LIMIT 100', sid));
}));
r.post('/kpi/entries', h((req, res) => {
  const sid = int(req.body.society_id) || req.user.society_id;
  if (!isLeadership(req.user, sid) && !can(req.user, 'societies.manage')) throw forbidden('KPI values are reported by the President, Vice President or the Programme Manager.');
  const d = defs().find(k => k.key === req.body.metric_key); if (!d || d.unit === 'percent') throw bad('This KPI is calculated automatically.');
  const value = Number(req.body.value); if (!Number.isFinite(value) || value < 0) throw bad('Please enter a valid value.');
  const ay = clean(req.body.academic_year, 9) || academicYear();
  run('INSERT INTO kpi_entries(society_id, academic_year, metric_key, value, note, entered_by, created_at) VALUES(?,?,?,?,?,?,?)', sid, ay, d.key, value, need(clean(req.body.note, 400), 'Add a short evidence note (source of the figure).'), req.user.id, nowISO());
  audit(req.user, 'kpi', sid, 'report_value', { metric: d.key, value, academic_year: ay });
  res.json({ ok: true });
}));

export default r;
