// ===================================================================
//  Shared calendar & events
//  Society events: President only (others propose) · AASTEC-wide events:
//  authorized staff only · Trainings: Programme Managers / staff ·
//  Info sessions: Incubator Agents · Mentoring: programme workflow
// ===================================================================
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { get, all, run, nowISO } from '../db/database.js';
import { can, leads, isLeadership, supervises, inSociety, hasGrant, societyOf, presidentOf, audit, notify, notifyCap, initials } from '../lib/core.js';
import { invalidateScores } from '../lib/stats.js';
import { h, bad, forbidden, notFound, need, clean, int } from '../lib/http.js';

const r = Router();
const KINDS = ['society', 'aastec', 'training', 'info_session'];
const CATS = ['leadership', 'workshop', 'training', 'networking', 'community_service', 'career', 'social', 'competition', 'other'];
const token = () => randomBytes(12).toString('hex');

function canManage(u, e) {
  if (!e) return false;
  if (u.role_key === 'admin' || e.created_by === u.id || e.organizer_id === u.id) return true;
  if (e.kind === 'society') return leads(u, e.society_id) || (u.role_key === 'vice_president' && inSociety(u, e.society_id));
  if (e.kind === 'aastec') return can(u, 'events.aastec');
  if (e.kind === 'training') return can(u, 'events.training') && u.is_aastec;
  if (e.kind === 'info_session') return can(u, 'incubator.manage');
  return false;
}
function canSee(u, e) {
  const published = ['published', 'completed', 'closed'].includes(e.status);
  const staffView = can(u, 'portfolio.view');
  if (!published) return canManage(u, e) || (e.society_id && (isLeadership(u, e.society_id) || supervises(u, e.society_id))) || staffView;
  if (e.visibility === 'society') return inSociety(u, e.society_id) || supervises(u, e.society_id) || staffView;
  return true;
}
const visibleSql = (u) => {
  const staff = can(u, 'portfolio.view') ? 1 : 0;
  const sid = +u.society_id || 0;
  const lead = u.society_id && (isLeadership(u, u.society_id) || supervises(u, u.society_id)) ? 1 : 0;
  return `((e.status IN ('published','completed','closed') AND (e.visibility = 'all' OR e.society_id = ${sid} OR ${staff} = 1))
    OR (e.status IN ('proposed','advisor_review') AND (e.created_by = ${+u.id} OR ${staff} = 1 OR (${lead} = 1 AND e.society_id = ${sid}))))`;
};

// ---------------- calendar ----------------
r.get('/calendar', h((req, res) => {
  const u = req.user;
  const from = clean(req.query.from, 30) || new Date(Date.now() - 31 * 864e5).toISOString();
  const to = clean(req.query.to, 30) || new Date(Date.now() + 62 * 864e5).toISOString();
  const where = [visibleSql(u), 'e.start_at BETWEEN ? AND ?', "e.status NOT IN ('rejected','cancelled')"]; const p = [from, to];
  if (KINDS.includes(req.query.kind)) { where.push('e.kind = ?'); p.push(req.query.kind); }
  if (CATS.includes(req.query.category)) { where.push('e.category = ?'); p.push(req.query.category); }
  const sid = int(req.query.society_id);
  if (sid) { where.push("(e.society_id = ? OR e.kind IN ('aastec','training'))"); p.push(sid); }
  if (req.query.mine === '1') { where.push(`(e.id IN (SELECT event_id FROM event_rsvps WHERE user_id = ${+u.id} AND status = 'going') OR e.created_by = ${+u.id} OR e.organizer_id = ${+u.id})`); }
  const events = all(`SELECT e.id, e.title, e.kind, e.category, e.start_at, e.end_at, e.location, e.mode, e.status, e.society_id, s.short_name society_short,
      (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'going') going,
      (SELECT status FROM event_rsvps r WHERE r.event_id = e.id AND r.user_id = ${+u.id}) my_rsvp
    FROM events e LEFT JOIN societies s ON s.id = e.society_id WHERE ${where.join(' AND ')} ORDER BY e.start_at LIMIT 800`, ...p);
  const virtual = [];
  if (!req.query.kind || req.query.kind === 'election' || req.query.kind === 'virtual') {
    const scope = sid || u.society_id;
    const els = can(u, 'portfolio.view') && !sid ? all("SELECT e.*, s.short_name FROM elections e JOIN societies s ON s.id = e.society_id WHERE e.status NOT IN ('cancelled','closed') AND e.sandbox = 0")
      : all("SELECT e.*, s.short_name FROM elections e JOIN societies s ON s.id = e.society_id WHERE e.society_id = ? AND e.status NOT IN ('cancelled')", scope || 0);
    for (const el of els) for (const [k, label] of [['nomination_start', 'Nominations open'], ['voting_start', 'Voting opens'], ['voting_end', 'Voting closes'], ['results_at', 'Results published'], ['handover_at', 'Board handover']])
      if (el[k] && el[k] >= from && el[k] <= to) virtual.push({ id: `el-${el.id}-${k}`, title: `${label} — ${el.short_name}${el.sandbox ? ' (pilot)' : ''}`, kind: 'election', category: 'other', start_at: el[k], virtual: true, link: '#/elections' });
  }
  const leader = u.society_id && (isLeadership(u, u.society_id) || u.is_committee_head || supervises(u, u.society_id));
  if (leader && (!req.query.kind || req.query.kind === 'deadline')) {
    const day = 10; const start = new Date(from); const end = new Date(to);
    for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day, 18)); d <= end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, day, 18)))
      if (d >= start) virtual.push({ id: `dl-${d.toISOString().slice(0, 7)}`, title: 'Monthly activity report due', kind: 'deadline', category: 'other', start_at: d.toISOString(), virtual: true, link: '#/reports' });
  }
  if (!req.query.kind || req.query.kind === 'mentoring') {
    const sessions = all(`SELECT ms.*, v.name venture, m.full_name mentor FROM mentor_sessions ms LEFT JOIN ventures v ON v.id = ms.venture_id JOIN users m ON m.id = ms.mentor_id
      WHERE ms.start_at BETWEEN ? AND ? AND ms.status != 'cancelled' AND (ms.mentor_id = ? OR ms.venture_id IN (SELECT venture_id FROM venture_members WHERE user_id = ?) OR ? = 1)`, from, to, u.id, u.id, can(u, 'incubator.manage') ? 1 : 0);
    sessions.forEach(s => virtual.push({ id: `ms-${s.id}`, title: `Mentoring: ${s.topic}${s.venture ? ` — ${s.venture}` : ''}`, kind: 'mentoring', category: 'other', start_at: s.start_at, end_at: new Date(new Date(s.start_at).getTime() + s.duration_min * 6e4).toISOString(), location: s.mode === 'online' ? 'Online' : 'In person', virtual: true, link: '#/incubator' }));
  }
  res.json({ events: [...events, ...virtual].sort((a, b) => a.start_at.localeCompare(b.start_at)), rules: calendarRules(u) });
}));
function calendarRules(u) {
  return {
    society_event: !!(u.society_id && leads(u, u.society_id)),
    propose_society: !!(u.society_id && u.membership_status === 'active' && ['member', 'committee_head', 'vice_president', 'president', 'incubator_agent', 'founder'].includes(u.role_key)),
    aastec_event: can(u, 'events.aastec'), training: can(u, 'events.training'), info_session: can(u, 'incubator.agent') || can(u, 'incubator.manage'),
  };
}

r.get('/events/:id', h((req, res) => {
  const e = get('SELECT e.*, s.short_name society_short, s.name society_name, c.name committee_name, o.full_name organizer_name, cb.full_name created_by_name FROM events e LEFT JOIN societies s ON s.id = e.society_id LEFT JOIN committees c ON c.id = e.committee_id LEFT JOIN users o ON o.id = e.organizer_id LEFT JOIN users cb ON cb.id = e.created_by WHERE e.id = ?', int(req.params.id));
  if (!e || !canSee(req.user, e)) throw notFound('Event not found.');
  const manage = canManage(req.user, e);
  const counts = get(`SELECT SUM(status = 'going') going, SUM(status = 'interested') interested, SUM(checked_in_at IS NOT NULL) checked_in FROM event_rsvps WHERE event_id = ?`, e.id);
  res.json({ ...e, checkin_token: manage ? e.checkin_token : undefined, can_manage: manage, can_decide: canDecide(req.user, e), can_advise: e.status === 'advisor_review' && supervises(req.user, e.society_id),
    can_close: e.status === 'completed' && supervises(req.user, e.society_id), counts,
    my_rsvp: get('SELECT status, checked_in_at FROM event_rsvps WHERE event_id = ? AND user_id = ?', e.id, req.user.id) || null,
    attendees: manage || supervises(req.user, e.society_id) ? all('SELECT r.user_id, r.status, r.checked_in_at, r.check_method, u.full_name, u.title FROM event_rsvps r JOIN users u ON u.id = r.user_id WHERE r.event_id = ? ORDER BY r.checked_in_at IS NULL, u.full_name', e.id).map(a => ({ ...a, initials: initials(a.full_name) })) : [],
    audit: manage ? all("SELECT actor_name, action, created_at FROM audit_log WHERE entity_type = 'event' AND entity_id = ? ORDER BY id", e.id) : [] });
}));
const canDecide = (u, e) => e.status === 'proposed' && (e.kind === 'society' ? leads(u, e.society_id) : can(u, 'events.aastec'));

r.post('/events', h((req, res) => {
  const u = req.user; const b = req.body;
  const kind = KINDS.includes(b.kind) ? b.kind : 'society';
  const title = need(clean(b.title, 160), 'Event title is required.');
  const start_at = need(clean(b.start_at, 30), 'Start date and time are required.');
  const end_at = clean(b.end_at, 30) || new Date(new Date(start_at).getTime() + 2 * 36e5).toISOString();
  if (isNaN(new Date(start_at)) || new Date(end_at) < new Date(start_at)) throw bad('Please check the event dates.');
  let status = 'published', society_id = null;
  if (kind === 'society') {
    society_id = u.society_id; if (!society_id || u.membership_status !== 'active') throw forbidden('Only active Society members can create or propose Society events.');
    status = leads(u, society_id) ? 'published' : 'proposed';
  } else if (kind === 'aastec') { if (!can(u, 'events.aastec')) throw forbidden('Only authorized AASTEC staff can add AASTEC-wide events.'); }
  else if (kind === 'training') { if (!can(u, 'events.training')) throw forbidden('Training sessions are created by Programme Managers or authorized staff.'); status = u.is_aastec ? 'published' : 'proposed'; }
  else if (kind === 'info_session') { if (!can(u, 'incubator.agent') && !can(u, 'incubator.manage')) throw forbidden('Information sessions are created by Incubator Agents.'); society_id = u.society_id; }
  const budget = +b.budget || null;
  const needs_advisor = kind === 'society' && (b.external_partners || (budget && budget >= 10000)) ? 1 : 0;
  if (status === 'published' && needs_advisor) status = 'advisor_review';
  const category = CATS.includes(b.category) ? b.category : kind === 'training' ? 'training' : 'other';
  const at = nowISO();
  const id = Number(run(`INSERT INTO events(title, description, kind, category, society_id, committee_id, programme_id, organizer_id, created_by, start_at, end_at, location, mode, visibility, capacity, budget, plan, risk_note, kpi_target, status, needs_advisor, approved_by, approved_at, checkin_token, training_hours, created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, title, clean(b.description, 3000), kind, category, society_id, int(b.committee_id), int(b.programme_id), u.id, u.id, new Date(start_at).toISOString(), new Date(end_at).toISOString(),
    clean(b.location, 160), ['in_person', 'online', 'hybrid'].includes(b.mode) ? b.mode : 'in_person', b.visibility === 'society' ? 'society' : 'all', int(b.capacity), budget, clean(b.plan, 3000), clean(b.risk_note, 1000), int(b.kpi_target),
    status, needs_advisor, status !== 'proposed' ? u.id : null, status !== 'proposed' ? at : null, token(), ['training', 'workshop'].includes(category) ? (+b.training_hours || Math.max(1, Math.round((new Date(end_at) - new Date(start_at)) / 36e5))) : null, at).lastInsertRowid);
  if (status === 'proposed') {
    if (kind === 'society') { const p = presidentOf(society_id); if (p) notify(p.id, { icon: 'calendar-plus', title: 'Event proposal awaiting review', body: `${title} — proposed by ${u.full_name}`, link: '#/approvals' }); }
    else notifyCap('events.aastec', { icon: 'calendar-plus', title: 'AASTEC event proposal', body: title, link: '#/approvals' });
  }
  if (status === 'advisor_review') { const adv = societyOf(society_id)?.advisor_id; if (adv) notify(adv, { icon: 'calendar-check', title: 'Event requires your review', body: `${title} involves external partners or a significant budget.`, link: '#/approvals' }); }
  audit(u, 'event', id, status === 'proposed' ? 'propose' : 'create', { title, kind, status });
  res.json({ id, status });
}));
r.put('/events/:id', h((req, res) => {
  const e = get('SELECT * FROM events WHERE id = ?', int(req.params.id)); if (!e) throw notFound();
  if (!canManage(req.user, e)) throw forbidden(); if (['closed', 'cancelled'].includes(e.status)) throw bad('This event can no longer be edited.');
  const b = req.body; const f = {};
  for (const k of ['title', 'description', 'location', 'plan', 'risk_note']) if (b[k] !== undefined) f[k] = clean(b[k], 3000);
  for (const k of ['start_at', 'end_at']) if (b[k]) f[k] = new Date(b[k]).toISOString();
  if (b.capacity !== undefined) f.capacity = int(b.capacity);
  if (CATS.includes(b.category)) f.category = b.category;
  if (['in_person', 'online', 'hybrid'].includes(b.mode)) f.mode = b.mode;
  const k = Object.keys(f); if (k.length) run(`UPDATE events SET ${k.map(x => `${x} = ?`).join(', ')} WHERE id = ?`, ...k.map(x => f[x]), e.id);
  audit(req.user, 'event', e.id, 'update', { fields: k });
  res.json({ ok: true });
}));
r.post('/events/:id/decide', h((req, res) => {
  const e = get('SELECT * FROM events WHERE id = ?', int(req.params.id)); if (!e) throw notFound();
  if (!canDecide(req.user, e)) throw forbidden('Only the Society President (or AASTEC staff for AASTEC events) can decide on this proposal.');
  const approve = !!req.body.approve;
  const status = !approve ? 'rejected' : e.needs_advisor ? 'advisor_review' : 'published';
  run('UPDATE events SET status = ?, approved_by = ?, approved_at = ?, review_note = ? WHERE id = ?', status, req.user.id, nowISO(), clean(req.body.note, 500), e.id);
  notify(e.created_by, { icon: approve ? 'calendar-check' : 'circle-x', title: `Event proposal ${approve ? (status === 'advisor_review' ? 'approved — awaiting Faculty Advisor review' : 'approved and published') : 'declined'}`, body: `${e.title}${req.body.note ? ` — ${clean(req.body.note, 200)}` : ''}`, link: '#/calendar' });
  if (status === 'advisor_review') { const adv = societyOf(e.society_id)?.advisor_id; if (adv) notify(adv, { icon: 'calendar-check', title: 'Event requires your review', body: e.title, link: '#/approvals' }); }
  audit(req.user, 'event', e.id, approve ? 'approve' : 'reject', { status });
  res.json({ ok: true, status });
}));
r.post('/events/:id/advisor', h((req, res) => {
  const e = get('SELECT * FROM events WHERE id = ?', int(req.params.id)); if (!e) throw notFound();
  if (e.status !== 'advisor_review' || !supervises(req.user, e.society_id)) throw forbidden('This event is not awaiting your review.');
  const approve = !!req.body.approve;
  run('UPDATE events SET status = ?, advisor_by = ?, advisor_at = ?, review_note = COALESCE(?, review_note) WHERE id = ?', approve ? 'published' : 'rejected', req.user.id, nowISO(), clean(req.body.note, 500), e.id);
  notify([e.created_by, presidentOf(e.society_id)?.id], { icon: approve ? 'calendar-check' : 'circle-x', title: `Faculty Advisor ${approve ? 'approved' : 'declined'} the event`, body: e.title, link: '#/calendar' });
  audit(req.user, 'event', e.id, approve ? 'advisor_approve' : 'advisor_reject', {});
  res.json({ ok: true });
}));
r.post('/events/:id/cancel', h((req, res) => {
  const e = get('SELECT * FROM events WHERE id = ?', int(req.params.id)); if (!e) throw notFound();
  if (!canManage(req.user, e)) throw forbidden();
  run("UPDATE events SET status = 'cancelled', review_note = ? WHERE id = ?", clean(req.body.reason, 300), e.id);
  notify(all("SELECT user_id FROM event_rsvps WHERE event_id = ? AND status = 'going'", e.id).map(r => r.user_id), { icon: 'calendar', title: 'Event cancelled', body: `${e.title}${req.body.reason ? ` — ${clean(req.body.reason, 200)}` : ''}`, link: '#/calendar' });
  audit(req.user, 'event', e.id, 'cancel', {});
  res.json({ ok: true });
}));

// ---------------- RSVP & check-in ----------------
r.post('/events/:id/rsvp', h((req, res) => {
  const e = get('SELECT * FROM events WHERE id = ?', int(req.params.id));
  if (!e || !canSee(req.user, e) || e.status !== 'published') throw bad('Registration is not open for this event.');
  const status = ['going', 'interested', 'declined'].includes(req.body.status) ? req.body.status : 'going';
  if (status === 'going' && e.capacity) {
    const going = get("SELECT COUNT(*) n FROM event_rsvps WHERE event_id = ? AND status = 'going' AND user_id != ?", e.id, req.user.id).n;
    if (going >= e.capacity) throw bad('This event is fully booked.');
  }
  run(`INSERT INTO event_rsvps(event_id, user_id, status, created_at) VALUES(?,?,?,?) ON CONFLICT(event_id, user_id) DO UPDATE SET status = excluded.status`, e.id, req.user.id, status, nowISO());
  res.json({ ok: true, status });
}));
function checkIn(e, userId, method) {
  run(`INSERT INTO event_rsvps(event_id, user_id, status, checked_in_at, check_method, created_at) VALUES(?,?,?,?,?,?)
    ON CONFLICT(event_id, user_id) DO UPDATE SET status = 'going', checked_in_at = COALESCE(event_rsvps.checked_in_at, excluded.checked_in_at), check_method = COALESCE(event_rsvps.check_method, excluded.check_method)`, e.id, userId, 'going', nowISO(), method, nowISO());
  invalidateScores();
}
r.post('/checkin/:token', h((req, res) => {
  const e = get('SELECT * FROM events WHERE checkin_token = ?', String(req.params.token));
  if (!e || !['published', 'completed'].includes(e.status)) throw bad('This check-in code is not valid.');
  const start = new Date(e.start_at).getTime(), end = new Date(e.end_at || e.start_at).getTime();
  if (Date.now() < start - 2 * 36e5 || Date.now() > end + 6 * 36e5) throw bad('Check-in is only open from two hours before the event until six hours after it ends.');
  checkIn(e, req.user.id, 'qr');
  res.json({ ok: true, event: { id: e.id, title: e.title, start_at: e.start_at, location: e.location } });
}));
r.post('/events/:id/attendance', h((req, res) => {
  const e = get('SELECT * FROM events WHERE id = ?', int(req.params.id)); if (!e) throw notFound();
  if (!canManage(req.user, e) && !(e.society_id && inSociety(req.user, e.society_id) && hasGrant(req.user, 'event_support'))) throw forbidden('Only organisers or members with event support authorization can record attendance.');
  const m = /^AASTEC-M-(\d+)$/i.exec(String(req.body.member_code || '').trim());
  const uid = int(req.body.user_id) || (m && +m[1]);
  const user = uid && get('SELECT id, full_name FROM users WHERE id = ? AND is_active = 1', uid);
  if (!user) throw bad('Member not found. Check the member pass code.');
  checkIn(e, user.id, m ? 'pass' : 'manual');
  res.json({ ok: true, user });
}));
r.post('/events/:id/complete', h((req, res) => {
  const e = get('SELECT * FROM events WHERE id = ?', int(req.params.id)); if (!e) throw notFound();
  if (!canManage(req.user, e)) throw forbidden(); if (e.status !== 'published') throw bad('Only published events can be completed.');
  if (new Date(e.start_at) > new Date()) throw bad('The event has not started yet.');
  const checked = get('SELECT COUNT(*) n FROM event_rsvps WHERE event_id = ? AND checked_in_at IS NOT NULL', e.id).n;
  run("UPDATE events SET status = 'completed', attendance_count = ?, expenses = ?, outcome = ?, training_hours = COALESCE(?, training_hours) WHERE id = ?", int(req.body.attendance_count) ?? checked, +req.body.expenses || 0, need(clean(req.body.outcome, 3000), 'Please describe the outcomes.'), +req.body.training_hours || null, e.id);
  const adv = e.society_id && societyOf(e.society_id)?.advisor_id; if (adv && e.kind === 'society') notify(adv, { icon: 'clipboard-check', title: 'Activity completed — ready to close', body: e.title, link: '#/supervision' });
  audit(req.user, 'event', e.id, 'complete', { attendance: int(req.body.attendance_count) ?? checked });
  res.json({ ok: true });
}));
r.post('/events/:id/close', h((req, res) => {
  const e = get('SELECT * FROM events WHERE id = ?', int(req.params.id)); if (!e) throw notFound();
  if (e.status !== 'completed' || !supervises(req.user, e.society_id)) throw forbidden('Only the Faculty Advisor can close a completed activity.');
  run("UPDATE events SET status = 'closed', advisor_by = ?, advisor_at = ? WHERE id = ?", req.user.id, nowISO(), e.id);
  audit(req.user, 'event', e.id, 'close', {});
  res.json({ ok: true });
}));
r.get('/me/pass', (req, res) => res.json({ code: `AASTEC-M-${req.user.id}`, full_name: req.user.full_name, society: req.user.society_name, role: req.user.role_name }));

export default r;
