// ===================================================================
//  Society governance: overview & hierarchy, membership, committees,
//  President-approved authorizations, VP delegation, tasks, documents,
//  reports, escalations, supervision and the approval inbox
// ===================================================================
import { Router } from 'express';
import { get, all, run, tx, nowISO } from '../db/database.js';
import { GRANT_TYPES, can, leads, isLeadership, supervises, inSociety, canViewSociety, societyOf, presidentOf, vpOf, audit, notify, initials, societyHealth, grantExpiry, daysAgo, daysAhead } from '../lib/core.js';
import { approvalItems } from '../lib/approvals.js';
import { h, bad, forbidden, notFound, need, clean, int } from '../lib/http.js';

const r = Router();
const person = (id) => { if (!id) return null; const u = get('SELECT u.id, u.full_name, u.title, u.avatar_url, r.key role_key, r.name role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?', id); return u && { ...u, initials: initials(u.full_name) }; };
const mustView = (u, sid) => { if (!canViewSociety(u, sid)) throw forbidden('You can only view your own Society.'); };
const mustLead = (u, sid) => { if (!leads(u, sid)) throw forbidden('Only the Society President (or the Vice President with delegated authority) can do this.'); };

// ---------------- overview & hierarchy ----------------
export function hierarchy(sid) {
  const s = societyOf(sid);
  const committees = all(`SELECT c.*, (SELECT COUNT(*) FROM users u WHERE u.committee_id = c.id AND u.membership_status = 'active') members,
      (SELECT COUNT(*) FROM tasks t WHERE t.committee_id = c.id AND t.status != 'done') open_tasks,
      (SELECT COUNT(*) FROM tasks t WHERE t.committee_id = c.id AND t.status != 'done' AND t.due_on < date('now')) overdue
    FROM committees c WHERE c.society_id = ? ORDER BY c.id`, sid).map(c => ({ ...c, head: person(c.head_user_id) }));
  return { advisor: person(s.advisor_id), president: person(presidentOf(sid)?.id), vice_president: person(vpOf(sid)?.id), committees, delegation: !!s.vp_delegation };
}
export function electionSummary(sid) {
  const rows = all(`SELECT id, title, status, cycle_year, sandbox, nomination_start, voting_start, voting_end, handover_at FROM elections WHERE society_id = ? AND status != 'cancelled' ORDER BY (status = 'closed'), cycle_year DESC, id DESC`, sid);
  return rows.slice(0, 3);
}
r.get('/societies/:id/overview', h((req, res) => {
  const sid = int(req.params.id); mustView(req.user, sid);
  const s = get('SELECT s.*, u.name university, u.short_name uni_short, u.city, u.country, u.kind FROM societies s JOIN universities u ON u.id = s.university_id WHERE s.id = ?', sid);
  if (!s) throw notFound('Society not found.');
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const n = (sql, ...p) => get(sql, ...p).n;
  res.json({
    society: s, health: societyHealth(sid), hierarchy: hierarchy(sid), elections: electionSummary(sid),
    counts: {
      members: n("SELECT COUNT(*) n FROM users WHERE society_id = ? AND membership_status = 'active' AND is_active = 1", sid),
      new_this_month: n("SELECT COUNT(*) n FROM users WHERE society_id = ? AND membership_status = 'active' AND created_at >= ?", sid, monthStart.toISOString()),
      pending_members: n("SELECT COUNT(*) n FROM users WHERE society_id = ? AND membership_status = 'pending'", sid),
      pending_auth: n("SELECT COUNT(*) n FROM auth_requests WHERE society_id = ? AND status IN ('pending','head_reviewed')", sid),
      pending_posts: n("SELECT COUNT(*) n FROM posts WHERE society_id = ? AND status = 'pending_approval'", sid),
      proposals: n("SELECT COUNT(*) n FROM events WHERE society_id = ? AND status IN ('proposed','advisor_review')", sid),
      upcoming_month: n("SELECT COUNT(*) n FROM events WHERE (society_id = ? OR kind = 'aastec') AND status = 'published' AND start_at BETWEEN ? AND ?", sid, nowISO(), daysAhead(30)),
      open_escalations: n("SELECT COUNT(*) n FROM escalations WHERE society_id = ? AND status != 'resolved'", sid),
      reports_pending: n("SELECT COUNT(*) n FROM society_reports WHERE society_id = ? AND status = 'submitted'", sid),
    },
    upcoming: all(`SELECT id, title, start_at, location, kind, category, mode FROM events WHERE (society_id = ? OR kind = 'aastec') AND status = 'published' AND start_at > ? ORDER BY start_at LIMIT 6`, sid, nowISO()),
    escalations: all("SELECT * FROM escalations WHERE society_id = ? AND status != 'resolved' ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END", sid),
    reports: all('SELECT id, title, report_type, status, period, submitted_at FROM society_reports WHERE society_id = ? ORDER BY submitted_at DESC LIMIT 6', sid),
    chapters: all(`SELECT s2.id, s2.short_name, u.city, u.country FROM societies s2 JOIN universities u ON u.id = s2.university_id WHERE s2.status = 'active' AND s2.id != ? AND u.country = ? LIMIT 6`, sid, s.country),
  });
}));

// ---------------- membership ----------------
r.post('/members/:id/membership', h((req, res) => {
  const m = get('SELECT * FROM users WHERE id = ?', int(req.params.id)); if (!m) throw notFound();
  mustLead(req.user, m.society_id);
  const approve = req.body.decision === 'approve';
  if (m.membership_status !== 'pending' && !['suspend', 'reactivate'].includes(req.body.decision)) throw bad('This application has already been decided.');
  const status = { approve: 'active', reject: 'rejected', suspend: 'suspended', reactivate: 'active' }[req.body.decision];
  if (!status) throw bad('Unknown decision.');
  run('UPDATE users SET membership_status = ? WHERE id = ?', status, m.id);
  if (approve) {
    const onboarding = get("SELECT id FROM courses WHERE title = 'Rally Society Member Onboarding'");
    if (onboarding) run("INSERT OR IGNORE INTO enrollments(course_id, user_id, status, progress, completed_lessons, enrolled_at) VALUES(?,?,?,?,?,?)", onboarding.id, m.id, 'active', 0, '[]', nowISO());
    notify(m.id, { icon: 'party-popper', title: 'Welcome to Rally Society!', body: 'Your membership was approved. Your onboarding learning path is ready.', link: '#/learning' });
  } else notify(m.id, { icon: 'info', title: `Membership ${status}`, body: clean(req.body.note, 300) || 'Please contact your Society President for details.', link: '#/dashboard' });
  audit(req.user, 'membership', m.id, req.body.decision, { member: m.full_name, note: clean(req.body.note, 300) });
  res.json({ ok: true });
}));
r.put('/members/:id/assignment', h((req, res) => {
  const m = get('SELECT * FROM users WHERE id = ?', int(req.params.id)); if (!m) throw notFound();
  mustLead(req.user, m.society_id);
  const committee_id = int(req.body.committee_id);
  if (committee_id && !get('SELECT 1 FROM committees WHERE id = ? AND society_id = ?', committee_id, m.society_id)) throw bad('Committee not found in this Society.');
  tx(() => {
    run('UPDATE users SET committee_id = ? WHERE id = ?', committee_id, m.id);
    if (req.body.make_head && committee_id) {
      const prev = get('SELECT head_user_id FROM committees WHERE id = ?', committee_id).head_user_id;
      const headRole = get("SELECT id FROM roles WHERE key = 'committee_head'").id, memberRole = get("SELECT id FROM roles WHERE key = 'member'").id;
      if (prev && prev !== m.id && !get('SELECT 1 FROM committees WHERE head_user_id = ? AND id != ?', prev, committee_id)) run("UPDATE users SET role_id = ? WHERE id = ? AND role_id = ?", memberRole, prev, headRole);
      run('UPDATE committees SET head_user_id = ? WHERE id = ?', m.id, committee_id);
      if (get('SELECT r.key FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?', m.id).key === 'member') run('UPDATE users SET role_id = ?, title = ? WHERE id = ?', headRole, `${get('SELECT name FROM committees WHERE id = ?', committee_id).name} Committee Head`, m.id);
    }
  });
  audit(req.user, 'member', m.id, req.body.make_head ? 'appoint_committee_head' : 'assign_committee', { member: m.full_name, committee_id });
  res.json({ ok: true });
}));

// ---------------- committees ----------------
r.post('/societies/:id/committees', h((req, res) => {
  const sid = int(req.params.id); mustLead(req.user, sid);
  const id = Number(run('INSERT INTO committees(society_id, name, key, description, created_at) VALUES(?,?,?,?,?)', sid, need(clean(req.body.name, 80), 'Committee name is required.'), clean(req.body.key, 40), clean(req.body.description, 400), nowISO()).lastInsertRowid);
  audit(req.user, 'committee', id, 'create', { name: req.body.name });
  res.json({ id });
}));
r.put('/committees/:id', h((req, res) => {
  const c = get('SELECT * FROM committees WHERE id = ?', int(req.params.id)); if (!c) throw notFound();
  const isHead = c.head_user_id === req.user.id;
  if (!isLeadership(req.user, c.society_id) && !isHead) throw forbidden();
  const status = ['on_track', 'needs_support', 'on_hold'].includes(req.body.status) ? req.body.status : c.status;
  const name = leads(req.user, c.society_id) ? (clean(req.body.name, 80) || c.name) : c.name;
  run('UPDATE committees SET name = ?, description = COALESCE(?, description), status = ?, status_note = ? WHERE id = ?', name, clean(req.body.description, 400), status, clean(req.body.status_note, 200) ?? c.status_note, c.id);
  audit(req.user, 'committee', c.id, 'update', { status });
  res.json({ ok: true });
}));

// ---------------- VP delegation ----------------
r.post('/societies/:id/delegation', h((req, res) => {
  const sid = int(req.params.id);
  const isPres = req.user.role_key === 'president' && req.user.society_id === sid;
  if (!isPres && req.user.role_key !== 'admin') throw forbidden('Only the Society President can delegate substitute authority.');
  const active = req.body.active ? 1 : 0;
  run('UPDATE societies SET vp_delegation = ? WHERE id = ?', active, sid);
  const vp = vpOf(sid);
  if (vp) notify(vp.id, { icon: 'shield-check', title: active ? 'Substitute authority delegated to you' : 'Substitute authority withdrawn', body: active ? 'You can now act with President authority for this Society.' : 'President authority has returned to the President.', link: '#/dashboard' });
  const adv = societyOf(sid).advisor_id; if (adv) notify(adv, { icon: 'shield', title: `VP delegation ${active ? 'activated' : 'ended'}`, body: societyOf(sid).name, link: '#/supervision' });
  audit(req.user, 'society', sid, active ? 'delegation_on' : 'delegation_off', {});
  res.json({ ok: true, active: !!active });
}));

// ---------------- authorization requests & grants ----------------
r.get('/auth-requests', h((req, res) => {
  const sid = int(req.query.society_id) || req.user.society_id;
  const mine = req.query.mine === '1';
  if (!mine) mustView(req.user, sid);
  const rows = all(`SELECT a.*, u.full_name, u.title, c.name committee_name, d.full_name decided_by_name, hr.full_name head_review_name FROM auth_requests a JOIN users u ON u.id = a.user_id
      LEFT JOIN committees c ON c.id = a.committee_id LEFT JOIN users d ON d.id = a.decided_by LEFT JOIN users hr ON hr.id = a.head_review_by
    WHERE ${mine ? 'a.user_id = ?' : 'a.society_id = ?'} ORDER BY a.created_at DESC LIMIT 200`, mine ? req.user.id : sid);
  res.json(rows.map(x => ({ ...x, initials: initials(x.full_name), perm_label: GRANT_TYPES[x.perm_key] })));
}));
r.post('/auth-requests', h((req, res) => {
  const u = req.user;
  if (!u.society_id || u.membership_status !== 'active') throw bad('Only active Society members can request authorization.');
  const perm_key = req.body.perm_key; if (!GRANT_TYPES[perm_key]) throw bad('Please choose a permission type.');
  if (get("SELECT 1 FROM auth_requests WHERE user_id = ? AND perm_key = ? AND status IN ('pending','head_reviewed')", u.id, perm_key)) throw bad('You already have a pending request for this permission.');
  const committee_id = int(req.body.committee_id);
  const id = Number(run('INSERT INTO auth_requests(user_id, society_id, perm_key, scope_note, committee_id, justification, status, created_at) VALUES(?,?,?,?,?,?,?,?)',
    u.id, u.society_id, perm_key, clean(req.body.scope_note, 160), committee_id, need(clean(req.body.justification, 800), 'Please explain why you need this authorization.'), 'pending', nowISO()).lastInsertRowid);
  const pres = presidentOf(u.society_id);
  if (pres) notify(pres.id, { icon: 'shield-check', title: 'New authorization request', body: `${u.full_name} requested ${GRANT_TYPES[perm_key]}.`, link: '#/approvals' });
  if (committee_id) { const head = get('SELECT head_user_id FROM committees WHERE id = ?', committee_id)?.head_user_id; if (head) notify(head, { icon: 'clipboard-check', title: 'Authorization request to review', body: `${u.full_name} — ${GRANT_TYPES[perm_key]}`, link: '#/approvals' }); }
  audit(u, 'auth_request', id, 'submit', { permission: perm_key });
  res.json({ id });
}));
r.post('/auth-requests/:id/head-review', h((req, res) => {
  const a = get('SELECT * FROM auth_requests WHERE id = ?', int(req.params.id)); if (!a) throw notFound();
  if (!a.committee_id || get('SELECT head_user_id FROM committees WHERE id = ?', a.committee_id)?.head_user_id !== req.user.id) throw forbidden('Only the relevant Committee Head can review this request.');
  if (a.status !== 'pending') throw bad('This request is no longer awaiting Committee Head review.');
  const note = `${req.body.recommend ? 'Recommended' : 'Not recommended'}${req.body.note ? ` — ${clean(req.body.note, 300)}` : ''}`;
  run("UPDATE auth_requests SET status = 'head_reviewed', head_review_by = ?, head_review_at = ?, head_review_note = ? WHERE id = ?", req.user.id, nowISO(), note, a.id);
  const pres = presidentOf(a.society_id); if (pres) notify(pres.id, { icon: 'shield-check', title: 'Committee Head reviewed a request', body: note, link: '#/approvals' });
  audit(req.user, 'auth_request', a.id, 'head_review', { recommend: !!req.body.recommend });
  res.json({ ok: true });
}));
r.post('/auth-requests/:id/decide', h((req, res) => {
  const a = get('SELECT a.*, u.full_name FROM auth_requests a JOIN users u ON u.id = a.user_id WHERE a.id = ?', int(req.params.id)); if (!a) throw notFound();
  mustLead(req.user, a.society_id);
  if (!['pending', 'head_reviewed'].includes(a.status)) throw bad('This request has already been decided.');
  const approve = !!req.body.approve; const at = nowISO();
  tx(() => {
    run('UPDATE auth_requests SET status = ?, decided_by = ?, decided_at = ?, decision_note = ? WHERE id = ?', approve ? 'approved' : 'rejected', req.user.id, at, clean(req.body.note, 300), a.id);
    if (approve) run('INSERT INTO user_grants(user_id, society_id, perm_key, scope_note, request_id, granted_by, granted_at, expires_at) VALUES(?,?,?,?,?,?,?,?)', a.user_id, a.society_id, a.perm_key, a.scope_note, a.id, req.user.id, at, grantExpiry());
    if (approve && a.perm_key === 'committee_access' && a.committee_id) run('UPDATE users SET committee_id = ? WHERE id = ?', a.committee_id, a.user_id);
  });
  notify(a.user_id, { icon: approve ? 'circle-check' : 'circle-x', title: `Authorization ${approve ? 'approved' : 'declined'}`, body: `${GRANT_TYPES[a.perm_key]}${req.body.note ? ` — ${clean(req.body.note, 200)}` : ''}`, link: '#/approvals' });
  const adv = societyOf(a.society_id).advisor_id;
  if (adv && approve) notify(adv, { icon: 'eye', title: 'Authorization granted (for visibility)', body: `${a.full_name}: ${GRANT_TYPES[a.perm_key]}`, link: '#/supervision' });
  audit(req.user, 'auth_request', a.id, approve ? 'approve' : 'reject', { member: a.full_name, permission: a.perm_key });
  res.json({ ok: true });
}));
r.get('/grants', h((req, res) => {
  const sid = int(req.query.society_id) || req.user.society_id; mustView(req.user, sid);
  res.json(all(`SELECT g.*, u.full_name, b.full_name granted_by_name FROM user_grants g JOIN users u ON u.id = g.user_id LEFT JOIN users b ON b.id = g.granted_by
    WHERE g.society_id = ? AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > ?) ORDER BY g.granted_at DESC`, sid, nowISO()).map(g => ({ ...g, perm_label: GRANT_TYPES[g.perm_key] })));
}));
r.post('/grants/:id/revoke', h((req, res) => {
  const g = get('SELECT * FROM user_grants WHERE id = ?', int(req.params.id)); if (!g) throw notFound();
  mustLead(req.user, g.society_id);
  run('UPDATE user_grants SET revoked_at = ? WHERE id = ?', nowISO(), g.id);
  notify(g.user_id, { icon: 'circle-x', title: 'Authorization revoked', body: GRANT_TYPES[g.perm_key], link: '#/approvals' });
  audit(req.user, 'grant', g.id, 'revoke', { permission: g.perm_key });
  res.json({ ok: true });
}));

// ---------------- tasks & documents ----------------
const canManageCommittee = (u, cid) => { const c = get('SELECT * FROM committees WHERE id = ?', cid); return c && (c.head_user_id === u.id || isLeadership(u, c.society_id)); };
r.get('/tasks', h((req, res) => {
  const cid = int(req.query.committee_id), vid = int(req.query.venture_id);
  let where = 't.assignee_id = ?', p = [req.user.id];
  if (cid) { const c = get('SELECT society_id FROM committees WHERE id = ?', cid); if (!c) throw notFound(); mustView(req.user, c.society_id); where = 't.committee_id = ?'; p = [cid]; }
  else if (vid) { where = 't.venture_id = ?'; p = [vid]; }
  else if (req.query.society_id) { const sid = int(req.query.society_id); mustView(req.user, sid); where = 't.society_id = ?'; p = [sid]; }
  res.json(all(`SELECT t.*, u.full_name assignee_name, c.name committee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id LEFT JOIN committees c ON c.id = t.committee_id
    WHERE ${where} ORDER BY t.status = 'done', t.due_on LIMIT 200`, ...p));
}));
r.post('/tasks', h((req, res) => {
  const cid = int(req.body.committee_id), vid = int(req.body.venture_id);
  let society_id = null;
  if (cid) { if (!canManageCommittee(req.user, cid)) throw forbidden('Only the Committee Head or Society leadership can assign committee tasks.'); society_id = get('SELECT society_id FROM committees WHERE id = ?', cid).society_id; }
  else if (vid) { if (!get('SELECT 1 FROM venture_members WHERE venture_id = ? AND user_id = ?', vid, req.user.id) && !can(req.user, 'incubator.manage')) throw forbidden(); }
  else throw bad('Choose a committee or venture.');
  const id = Number(run('INSERT INTO tasks(society_id, committee_id, venture_id, title, description, assignee_id, created_by, priority, due_on, status, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    society_id, cid, vid, need(clean(req.body.title, 160), 'Task title is required.'), clean(req.body.description, 800), int(req.body.assignee_id) || req.user.id, req.user.id,
    ['high', 'medium', 'low'].includes(req.body.priority) ? req.body.priority : 'medium', clean(req.body.due_on, 10), 'not_started', nowISO()).lastInsertRowid);
  const assignee = int(req.body.assignee_id); if (assignee && assignee !== req.user.id) notify(assignee, { icon: 'list-todo', title: 'New task assigned', body: clean(req.body.title, 120), link: '#/committees' });
  res.json({ id });
}));
r.put('/tasks/:id', h((req, res) => {
  const t = get('SELECT * FROM tasks WHERE id = ?', int(req.params.id)); if (!t) throw notFound();
  const allowed = t.assignee_id === req.user.id || (t.committee_id && canManageCommittee(req.user, t.committee_id)) || (t.venture_id && get('SELECT 1 FROM venture_members WHERE venture_id = ? AND user_id = ?', t.venture_id, req.user.id));
  if (!allowed) throw forbidden();
  const status = ['not_started', 'in_progress', 'in_review', 'done'].includes(req.body.status) ? req.body.status : t.status;
  run('UPDATE tasks SET status = ?, title = COALESCE(?, title), due_on = COALESCE(?, due_on), priority = COALESCE(?, priority), completed_at = ? WHERE id = ?', status, clean(req.body.title, 160), clean(req.body.due_on, 10), req.body.priority || null, status === 'done' ? (t.completed_at || nowISO()) : null, t.id);
  res.json({ ok: true });
}));
r.get('/documents', h((req, res) => {
  const cid = int(req.query.committee_id); const sid = int(req.query.society_id) || get('SELECT society_id FROM committees WHERE id = ?', cid)?.society_id || req.user.society_id;
  mustView(req.user, sid);
  res.json(all(`SELECT d.*, u.full_name uploaded_by_name FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by WHERE d.society_id = ? ${cid ? 'AND d.committee_id = ?' : ''} ORDER BY d.created_at DESC`, sid, ...(cid ? [cid] : [])));
}));
r.post('/documents', h((req, res) => {
  const cid = int(req.body.committee_id); if (!cid || !canManageCommittee(req.user, cid)) throw forbidden();
  const sid = get('SELECT society_id FROM committees WHERE id = ?', cid).society_id;
  const id = Number(run('INSERT INTO documents(society_id, committee_id, title, doc_type, url, uploaded_by, created_at) VALUES(?,?,?,?,?,?,?)', sid, cid, need(clean(req.body.title, 160), 'Title is required.'), clean(req.body.doc_type, 40), clean(req.body.url, 400), req.user.id, nowISO()).lastInsertRowid);
  res.json({ id });
}));

// ---------------- reports ----------------
const REPORT_TYPES = { monthly_activity: 'Monthly Activity Report', event_report: 'Event Report', financial_statement: 'Financial Statement', meeting_minutes: 'Meeting Minutes', annual_report: 'Annual Report', incubator_agent: 'Incubator Agent Report' };
const canSubmitReport = (u, sid) => isLeadership(u, sid) || (u.is_committee_head && inSociety(u, sid)) || (inSociety(u, sid) && u.grants.includes('report_submission')) || (u.role_key === 'incubator_agent' && inSociety(u, sid));
r.get('/reports', h((req, res) => {
  const sid = int(req.query.society_id);
  const where = []; const p = [];
  if (sid) { mustView(req.user, sid); where.push('r.society_id = ?'); p.push(sid); }
  else if (!can(req.user, 'reports.review') && !can(req.user, 'portfolio.view')) { where.push('r.society_id = ?'); p.push(req.user.society_id || 0); }
  if (req.query.status) { where.push('r.status = ?'); p.push(req.query.status); }
  if (req.query.type) { where.push('r.report_type = ?'); p.push(req.query.type); }
  const rows = all(`SELECT r.id, r.society_id, r.report_type, r.title, r.period, r.status, r.due_on, r.submitted_at, r.reviewed_at, r.review_note, s.short_name society_short, u.full_name submitted_by_name, v.full_name reviewed_by_name
    FROM society_reports r JOIN societies s ON s.id = r.society_id LEFT JOIN users u ON u.id = r.submitted_by LEFT JOIN users v ON v.id = r.reviewed_by
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.submitted_at DESC LIMIT 300`, ...p);
  res.json({ rows, types: REPORT_TYPES, can_submit: canSubmitReport(req.user, sid || req.user.society_id), due: dueReports(sid || req.user.society_id) });
}));
export function dueReports(sid) {
  if (!sid) return [];
  const out = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i);
    const period = d.toISOString().slice(0, 7);
    const due = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 10)).toISOString().slice(0, 10);
    const rep = get("SELECT status, submitted_at FROM society_reports WHERE society_id = ? AND report_type = 'monthly_activity' AND period = ?", sid, period);
    out.push({ period, due_on: due, status: rep ? rep.status : (due < nowISO().slice(0, 10) ? 'overdue' : 'due'), late: rep ? rep.submitted_at.slice(0, 10) > due : false });
  }
  return out;
}
r.get('/reports/:id', h((req, res) => {
  const rep = get('SELECT r.*, s.short_name society_short, u.full_name submitted_by_name, v.full_name reviewed_by_name FROM society_reports r JOIN societies s ON s.id = r.society_id LEFT JOIN users u ON u.id = r.submitted_by LEFT JOIN users v ON v.id = r.reviewed_by WHERE r.id = ?', int(req.params.id));
  if (!rep) throw notFound(); mustView(req.user, rep.society_id);
  res.json({ ...rep, can_review: canReview(req.user, rep) });
}));
const canReview = (u, rep) => rep.status === 'submitted' && (rep.report_type === 'incubator_agent' ? can(u, 'incubator.manage') : (supervises(u, rep.society_id) || (can(u, 'reports.review') && u.role_key !== 'advisor')));
r.post('/reports', h((req, res) => {
  const sid = int(req.body.society_id) || req.user.society_id;
  if (!canSubmitReport(req.user, sid)) throw forbidden('You are not authorized to submit reports for this Society.');
  const type = REPORT_TYPES[req.body.report_type] ? req.body.report_type : 'monthly_activity';
  const period = clean(req.body.period, 7);
  if (type === 'monthly_activity' && get("SELECT 1 FROM society_reports WHERE society_id = ? AND report_type = 'monthly_activity' AND period = ? AND status != 'returned'", sid, period)) throw bad('A monthly report for this period has already been submitted.');
  const at = nowISO();
  const id = Number(run('INSERT INTO society_reports(society_id, report_type, title, period, body, metrics, event_id, submitted_by, status, submitted_at, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    sid, type, need(clean(req.body.title, 200), 'Report title is required.'), period, need(clean(req.body.body, 20000), 'Report content is required.'), JSON.stringify(req.body.metrics || {}), int(req.body.event_id), req.user.id, 'submitted', at, at).lastInsertRowid);
  const s = societyOf(sid);
  if (type === 'incubator_agent') notify((get("SELECT manager_id FROM programmes WHERE kind = 'incubator'") || {}).manager_id, { icon: 'file-text', title: 'Agent report submitted', body: `${req.user.full_name} — ${s.short_name}`, link: '#/reports' });
  else if (s.advisor_id) notify(s.advisor_id, { icon: 'file-text', title: 'Report submitted for review', body: `${REPORT_TYPES[type]} — ${s.short_name}`, link: '#/reports' });
  audit(req.user, 'report', id, 'submit', { type, period, society: s.short_name });
  res.json({ id });
}));
r.post('/reports/:id/review', h((req, res) => {
  const rep = get('SELECT * FROM society_reports WHERE id = ?', int(req.params.id)); if (!rep) throw notFound();
  if (!canReview(req.user, rep)) throw forbidden('Only the Faculty Advisor (or the responsible Programme Manager) can review this report.');
  const decision = req.body.decision === 'approve' ? 'approved' : 'returned';
  if (decision === 'returned' && !clean(req.body.note)) throw bad('Please add a note explaining what needs to change.');
  run('UPDATE society_reports SET status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?', decision, req.user.id, nowISO(), clean(req.body.note, 800), rep.id);
  notify(rep.submitted_by, { icon: decision === 'approved' ? 'circle-check' : 'circle-alert', title: `Report ${decision}`, body: `${rep.title}${req.body.note ? ` — ${clean(req.body.note, 200)}` : ''}`, link: '#/reports' });
  audit(req.user, 'report', rep.id, decision === 'approved' ? 'approve' : 'return', { title: rep.title });
  res.json({ ok: true });
}));

// ---------------- escalations ----------------
r.get('/escalations', h((req, res) => {
  const sid = int(req.query.society_id);
  if (sid) mustView(req.user, sid); else if (!can(req.user, 'portfolio.view')) throw forbidden();
  res.json(all(`SELECT e.*, s.short_name society_short, u.full_name raised_by_name, a.full_name assigned_to_name FROM escalations e JOIN societies s ON s.id = e.society_id LEFT JOIN users u ON u.id = e.raised_by LEFT JOIN users a ON a.id = e.assigned_to
    ${sid ? 'WHERE e.society_id = ?' : ''} ORDER BY e.status = 'resolved', CASE e.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, e.created_at DESC LIMIT 200`, ...(sid ? [sid] : [])));
}));
r.post('/escalations', h((req, res) => {
  const sid = int(req.body.society_id) || req.user.society_id;
  if (!isLeadership(req.user, sid) && !supervises(req.user, sid) && !req.user.is_committee_head && !can(req.user, 'portfolio.view')) throw forbidden();
  const s = societyOf(sid);
  const id = Number(run('INSERT INTO escalations(society_id, title, detail, severity, status, raised_by, assigned_to, created_at) VALUES(?,?,?,?,?,?,?,?)', sid, need(clean(req.body.title, 160), 'Title is required.'), clean(req.body.detail, 1500),
    ['low', 'medium', 'high'].includes(req.body.severity) ? req.body.severity : 'low', 'open', req.user.id, s.advisor_id, nowISO()).lastInsertRowid);
  if (s.advisor_id) notify(s.advisor_id, { icon: 'triangle-alert', title: 'New escalation', body: `${clean(req.body.title, 120)} — ${s.short_name}`, link: '#/supervision' });
  audit(req.user, 'escalation', id, 'raise', { severity: req.body.severity, society: s.short_name });
  res.json({ id });
}));
r.put('/escalations/:id', h((req, res) => {
  const e = get('SELECT * FROM escalations WHERE id = ?', int(req.params.id)); if (!e) throw notFound();
  if (!supervises(req.user, e.society_id) && !isLeadership(req.user, e.society_id) && !can(req.user, 'portfolio.view')) throw forbidden();
  const status = ['open', 'in_progress', 'resolved'].includes(req.body.status) ? req.body.status : e.status;
  run('UPDATE escalations SET status = ?, resolution = COALESCE(?, resolution), resolved_at = ? WHERE id = ?', status, clean(req.body.resolution, 800), status === 'resolved' ? nowISO() : null, e.id);
  audit(req.user, 'escalation', e.id, 'update', { status });
  res.json({ ok: true });
}));

// ---------------- Faculty Advisor supervision panel ----------------
r.get('/supervision', h((req, res) => {
  const sid = int(req.query.society_id) || req.user.society_id;
  if (!supervises(req.user, sid) && !can(req.user, 'portfolio.view')) throw forbidden('The supervision panel is available to Faculty Advisors and AASTEC staff.');
  const last = all(`SELECT e.id, e.title, e.start_at, (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'going') going,
      (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.checked_in_at IS NOT NULL) present,
      (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'interested') excused
    FROM events e WHERE e.society_id = ? AND e.status IN ('completed','closed') ORDER BY e.start_at DESC LIMIT 6`, sid);
  const tot = last.reduce((a, e) => ({ going: a.going + e.going, present: a.present + e.present, excused: a.excused + e.excused }), { going: 0, present: 0, excused: 0 });
  const base = tot.going + tot.excused || 1;
  res.json({
    health: societyHealth(sid), hierarchy: hierarchy(sid), elections: all(`SELECT * FROM elections WHERE society_id = ? AND status != 'closed' ORDER BY id DESC`, sid),
    reports: all(`SELECT r.id, r.title, r.report_type, r.status, r.submitted_at, u.full_name submitted_by_name FROM society_reports r LEFT JOIN users u ON u.id = r.submitted_by WHERE r.society_id = ? AND r.status = 'submitted' ORDER BY r.submitted_at`, sid),
    posts: all(`SELECT p.id, p.title, p.created_at, u.full_name author FROM posts p JOIN users u ON u.id = p.author_id JOIN post_approvals pa ON pa.post_id = p.id AND pa.status = 'pending' AND pa.role_key = 'advisor' WHERE p.society_id = ? AND p.status = 'pending_approval'`, sid),
    events_review: all(`SELECT id, title, start_at, budget FROM events WHERE society_id = ? AND status = 'advisor_review'`, sid),
    events_to_close: all(`SELECT id, title, start_at, attendance_count FROM events WHERE society_id = ? AND status = 'completed' AND start_at < ? ORDER BY start_at DESC LIMIT 8`, sid, daysAgo(2)),
    attendance: { present: Math.round(100 * tot.present / base), excused: Math.round(100 * tot.excused / base), absent: Math.max(0, 100 - Math.round(100 * tot.present / base) - Math.round(100 * tot.excused / base)), events: last.length },
    escalations: all("SELECT * FROM escalations WHERE society_id = ? ORDER BY status = 'resolved', created_at DESC LIMIT 8", sid),
    upcoming: get("SELECT COUNT(*) n FROM events WHERE society_id = ? AND status = 'published' AND start_at BETWEEN ? AND ?", sid, nowISO(), daysAhead(30)).n,
  });
}));

// ---------------- approval inbox ----------------
r.get('/approvals', (req, res) => res.json(approvalItems(req.user)));

export default r;
