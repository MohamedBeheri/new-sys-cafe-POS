// ===================================================================
//  Election management
//  Setup (Programme Manager) → Faculty Advisor activation approval →
//  Nominations → Candidate review → Secret ballot → Results → Handover
//  Real elections run only inside the annual July–August window.
//  Pilot (sandbox) elections allow rehearsals and never change roles.
// ===================================================================
import { Router } from 'express';
import { randomBytes, randomInt } from 'node:crypto';
import { get, all, run, tx, nowISO, json } from '../db/database.js';
import { can, supervises, inSociety, societyOf, presidentOf, audit, notify, notifyCap, settings, initials } from '../lib/core.js';
import { h, bad, forbidden, notFound, need, clean, int } from '../lib/http.js';

const r = Router();
const FLOW = ['pending_advisor', 'approved', 'nominations', 'review', 'voting', 'tally', 'results', 'handover', 'closed'];
const NEXT = { approved: 'nominations', nominations: 'review', review: 'voting', voting: 'tally' };
const VOTER_ROLES = ['member', 'committee_head', 'vice_president', 'president', 'incubator_agent', 'founder'];

function windowFor(year) {
  const s = settings();
  const [sm, sd] = s.election_window_start.split('-').map(Number), [em, ed] = s.election_window_end.split('-').map(Number);
  return { open: new Date(Date.UTC(year, sm - 1, sd)).toISOString(), close: new Date(Date.UTC(year, em - 1, ed, 23, 59, 59)).toISOString() };
}
const inWindow = (year, at = nowISO()) => { const w = windowFor(year); return at >= w.open && at <= w.close; };
const DATE_KEYS = ['nomination_start', 'nomination_end', 'review_start', 'review_end', 'voting_start', 'voting_end', 'results_at', 'handover_at'];

export function eligibility(u, el) {
  const rules = json(el.eligibility, {});
  const onboarding = get("SELECT 1 FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ? AND c.title = 'Rally Society Member Onboarding' AND e.status = 'completed'", u.id);
  const checks = [
    { key: 'active_member', label: 'Active member of this Society', ok: u.society_id === el.society_id && u.membership_status === 'active' && VOTER_ROLES.includes(u.role_key) },
    { key: 'good_standing', label: 'Good standing (no code of conduct violations)', ok: !u.conduct_flags },
    { key: 'handbook', label: 'Rally Society Handbook acknowledged', ok: !!u.handbook_ack_version },
    { key: 'onboarding', label: 'Completed the required onboarding course', ok: !!onboarding },
  ].filter(c => c.key === 'active_member' || rules[c.key] !== false);
  return { eligible: checks.every(c => c.ok), checks };
}
function eligibleVoters(el) {
  const rules = json(el.eligibility, {});
  return get(`SELECT COUNT(*) n FROM users u JOIN roles r ON r.id = u.role_id WHERE u.society_id = ? AND u.membership_status = 'active' AND u.is_active = 1 AND r.key IN (${VOTER_ROLES.map(() => '?').join(',')})
    ${rules.good_standing === false ? '' : 'AND u.conduct_flags = 0'} ${rules.handbook === false ? '' : 'AND u.handbook_ack_version IS NOT NULL'}
    ${rules.onboarding === false ? '' : "AND EXISTS (SELECT 1 FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = u.id AND c.title = 'Rally Society Member Onboarding' AND e.status = 'completed')"}`, el.society_id, ...VOTER_ROLES).n;
}
const canSee = (u, el) => can(u, 'portfolio.view') || inSociety(u, el.society_id) || supervises(u, el.society_id);
const isPM = (u) => can(u, 'elections.configure');
// Index into the 7-step lifecycle shown in the UI (Setup, Advisor, Nominations, Review, Voting, Results, Handover); 8 = all done.
const stepOf = (status) => ({ pending_advisor: 2, approved: 3, nominations: 3, review: 4, voting: 5, tally: 5, results: 6, handover: 7, closed: 8, cancelled: 0 }[status] ?? 0);

function tally(el) {
  const positions = all('SELECT * FROM election_positions WHERE election_id = ? ORDER BY sort', el.id);
  return positions.map(p => {
    const cands = all(`SELECT c.id, c.user_id, u.full_name, c.slogan, (SELECT COUNT(*) FROM votes v WHERE v.candidate_id = c.id) votes FROM candidates c JOIN users u ON u.id = c.user_id
      WHERE c.position_id = ? AND c.status = 'validated' ORDER BY votes DESC`, p.id);
    const total = cands.reduce((s, c) => s + c.votes, 0);
    const top = cands[0];
    return { position_id: p.id, title: p.title, role_key: p.role_key, total, tie: cands.length > 1 && cands[1].votes === top?.votes,
      candidates: cands.map(c => ({ ...c, initials: initials(c.full_name), pct: total ? Math.round(100 * c.votes / total) : 0, winner: top && c.id === top.id && !(cands.length > 1 && cands[1].votes === top.votes) })) };
  });
}

// ---------------- list & overview ----------------
r.get('/elections', h((req, res) => {
  const u = req.user; const sid = int(req.query.society_id);
  const where = []; const p = [];
  if (sid) { if (!can(u, 'portfolio.view') && !inSociety(u, sid) && !supervises(u, sid)) throw forbidden(); where.push('e.society_id = ?'); p.push(sid); }
  else if (!can(u, 'portfolio.view')) { where.push('e.society_id = ?'); p.push(u.society_id || 0); }
  if (req.query.cycle) { where.push('e.cycle_year = ?'); p.push(int(req.query.cycle)); }
  const rows = all(`SELECT e.*, s.short_name society_short, s.name society_name, a.full_name advisor_name,
      (SELECT COUNT(*) FROM candidates c WHERE c.election_id = e.id AND c.status != 'withdrawn') candidates,
      (SELECT COUNT(*) FROM ballots b WHERE b.election_id = e.id) ballots
    FROM elections e JOIN societies s ON s.id = e.society_id LEFT JOIN users a ON a.id = s.advisor_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY e.status = 'closed', e.cycle_year DESC, s.short_name LIMIT 300`, ...p);
  const s = settings();
  res.json({ rows: rows.map(e => ({ ...e, step: stepOf(e.status) })), window: { start: s.election_window_start, end: s.election_window_end }, sandbox_allowed: s.election_sandbox === '1', can_configure: isPM(u),
    next_cycle: new Date().getUTCMonth() >= 8 ? new Date().getUTCFullYear() + 1 : new Date().getUTCFullYear() });
}));

r.get('/elections/:id', h((req, res) => {
  const u = req.user;
  const el = get('SELECT e.*, s.short_name society_short, s.name society_name, s.advisor_id, a.full_name advisor_name, c.full_name configured_by_name, ab.full_name advisor_by_name FROM elections e JOIN societies s ON s.id = e.society_id LEFT JOIN users a ON a.id = s.advisor_id LEFT JOIN users c ON c.id = e.configured_by LEFT JOIN users ab ON ab.id = e.advisor_by WHERE e.id = ?', int(req.params.id));
  if (!el || !canSee(u, el)) throw notFound('Election not found.');
  const positions = all('SELECT * FROM election_positions WHERE election_id = ? ORDER BY sort', el.id);
  const showAll = isPM(u) || supervises(u, el.society_id);
  const candidates = all(`SELECT c.*, u.full_name, u.title, u.faculty, u.study_year, rv.full_name reviewed_by_name FROM candidates c JOIN users u ON u.id = c.user_id LEFT JOIN users rv ON rv.id = c.reviewed_by
    WHERE c.election_id = ? ${showAll ? '' : "AND (c.status = 'validated' OR c.user_id = ?)"} ORDER BY c.position_id, u.full_name`, el.id, ...(showAll ? [] : [u.id])).map(c => ({ ...c, initials: initials(c.full_name) }));
  const ballot = get('SELECT receipt, cast_at FROM ballots WHERE election_id = ? AND voter_id = ?', el.id, u.id);
  const voters = eligibleVoters(el); const ballots = get('SELECT COUNT(*) n FROM ballots WHERE election_id = ?', el.id).n;
  const results = el.status === 'results' || el.status === 'handover' || el.status === 'closed' || (el.status === 'tally' && isPM(u)) ? tally(el) : null;
  res.json({ ...el, step: stepOf(el.status), positions, candidates, eligibility: eligibility(u, el), my_ballot: ballot || null,
    my_candidacy: candidates.filter(c => c.user_id === u.id), stats: { eligible: voters, ballots, turnout: voters ? Math.round(100 * ballots / voters) : 0, candidates: candidates.filter(c => c.status !== 'withdrawn').length, positions: positions.length },
    results, handover: all('SELECT h.*, u.full_name done_by_name FROM handover_tasks h LEFT JOIN users u ON u.id = h.done_by WHERE h.election_id = ? ORDER BY sort', el.id),
    window: windowFor(el.cycle_year), in_window: inWindow(el.cycle_year),
    can: { configure: isPM(u) && ['pending_advisor', 'approved'].includes(el.status), advisor: el.status === 'pending_advisor' && supervises(u, el.society_id), advance: isPM(u) && !!NEXT[el.status],
      validate: (isPM(u) || supervises(u, el.society_id)) && ['nominations', 'review'].includes(el.status), publish: isPM(u) && el.status === 'tally', handover: (isPM(u) || presidentOf(el.society_id)?.id === u.id) && ['results', 'handover'].includes(el.status),
      complete: isPM(u) && ['results', 'handover'].includes(el.status), cancel: isPM(u) && !['closed', 'cancelled'].includes(el.status) },
    audit: all("SELECT actor_name, action, detail, created_at FROM audit_log WHERE entity_type = 'election' AND entity_id = ? ORDER BY id DESC LIMIT 20", el.id) });
}));

// ---------------- setup (Programme Manager) ----------------
r.post('/elections', h((req, res) => {
  const u = req.user; if (!isPM(u)) throw forbidden('Only the Rally Societies Programme Manager can configure elections.');
  const b = req.body; const year = need(int(b.cycle_year), 'Choose the election cycle year.');
  const sandbox = !!b.sandbox;
  if (sandbox && settings().election_sandbox !== '1') throw bad('Pilot (sandbox) elections are disabled in Settings.');
  const dates = {}; for (const k of DATE_KEYS) dates[k] = need(clean(b[k], 30), 'Please complete every phase date.') && new Date(b[k]).toISOString();
  for (let i = 1; i < DATE_KEYS.length; i++) if (dates[DATE_KEYS[i]] < dates[DATE_KEYS[i - 1]]) throw bad('Phase dates must be in chronological order.');
  if (!sandbox) { const w = windowFor(year); for (const k of DATE_KEYS.slice(0, 7)) if (dates[k] < w.open || dates[k] > w.close) throw bad(`Elections run only inside the annual window (${w.open.slice(0, 10)} to ${w.close.slice(0, 10)}). Adjust "${k.replace(/_/g, ' ')}".`); }
  const ids = b.society_ids === 'all' ? all("SELECT id FROM societies WHERE status = 'active'").map(r => r.id) : (b.society_ids || []).map(int).filter(Boolean);
  need(ids, 'Choose at least one Society.');
  const positions = (b.positions?.length ? b.positions : ['President', 'Vice President']).map(p => clean(p, 60)).filter(Boolean);
  const created = [];
  tx(() => {
    for (const sid of ids) {
      if (!sandbox && get("SELECT 1 FROM elections WHERE society_id = ? AND cycle_year = ? AND sandbox = 0 AND status != 'cancelled'", sid, year)) continue;
      const s = societyOf(sid); const at = nowISO();
      const id = Number(run(`INSERT INTO elections(society_id, title, cycle_year, ${DATE_KEYS.join(', ')}, status, eligibility, configured_by, configured_at, sandbox, created_at) VALUES(?,?,?,${DATE_KEYS.map(() => '?').join(',')},?,?,?,?,?,?)`,
        sid, clean(b.title, 120) || (sandbox ? 'Leadership Election Rehearsal (Pilot Mode)' : `Leadership Election ${year}`), year, ...DATE_KEYS.map(k => dates[k]), 'pending_advisor',
        JSON.stringify({ good_standing: b.rule_good_standing !== false, handbook: b.rule_handbook !== false, onboarding: b.rule_onboarding !== false }), u.id, at, sandbox ? 1 : 0, at).lastInsertRowid);
      positions.forEach((t, i) => run('INSERT INTO election_positions(election_id, title, role_key, sort) VALUES(?,?,?,?)', id, t, t === 'President' ? 'president' : t === 'Vice President' ? 'vice_president' : null, i));
      ['Confirm and publish official results', 'New board acceptance and onboarding', 'Transfer of assets, accounts and social media access', 'Documentation and archive handover', 'Final report submission to Programme Manager']
        .forEach((t, i) => run('INSERT INTO handover_tasks(election_id, title, owner_label, sort) VALUES(?,?,?,?)', id, t, ['Programme Manager', 'Incoming board', 'Outgoing board', 'Outgoing board', 'Outgoing President'][i], i));
      if (s.advisor_id) notify(s.advisor_id, { icon: 'vote', title: 'Election activation approval required', body: `${s.short_name} — cycle ${year}${sandbox ? ' (pilot)' : ''}`, link: `#/elections/${id}` });
      audit(u, 'election', id, 'configure', { society: s.short_name, cycle: year, sandbox });
      created.push(id);
    }
  });
  res.json({ created: created.length, ids: created });
}));
r.put('/elections/:id', h((req, res) => {
  const el = get('SELECT * FROM elections WHERE id = ?', int(req.params.id)); if (!el) throw notFound();
  if (!isPM(req.user) || !['pending_advisor', 'approved'].includes(el.status)) throw forbidden('Dates can only be changed before nominations open.');
  const dates = {}; for (const k of DATE_KEYS) dates[k] = req.body[k] ? new Date(req.body[k]).toISOString() : el[k];
  if (!el.sandbox) { const w = windowFor(el.cycle_year); for (const k of DATE_KEYS.slice(0, 7)) if (dates[k] < w.open || dates[k] > w.close) throw bad('All phases must fall inside the July–August election window.'); }
  run(`UPDATE elections SET ${DATE_KEYS.map(k => `${k} = ?`).join(', ')} WHERE id = ?`, ...DATE_KEYS.map(k => dates[k]), el.id);
  audit(req.user, 'election', el.id, 'update_dates', {});
  res.json({ ok: true });
}));

// ---------------- Faculty Advisor activation ----------------
r.post('/elections/:id/advisor', h((req, res) => {
  const el = get('SELECT * FROM elections WHERE id = ?', int(req.params.id)); if (!el) throw notFound();
  if (el.status !== 'pending_advisor' || !supervises(req.user, el.society_id)) throw forbidden('Only the Faculty Advisor of this Society can approve activation.');
  const approve = !!req.body.approve; const note = clean(req.body.note, 500);
  if (!approve && !note) throw bad('Please describe the changes you are requesting.');
  run('UPDATE elections SET status = ?, advisor_decision = ?, advisor_by = ?, advisor_at = ?, advisor_note = ? WHERE id = ?', approve ? 'approved' : 'pending_advisor', approve ? 'approved' : 'changes_requested', req.user.id, nowISO(), note, el.id);
  notify(el.configured_by, { icon: approve ? 'circle-check' : 'circle-alert', title: approve ? 'Election activation approved' : 'Advisor requested changes', body: `${societyOf(el.society_id).short_name}${note ? ` — ${note}` : ''}`, link: `#/elections/${el.id}` });
  audit(req.user, 'election', el.id, approve ? 'advisor_approve' : 'advisor_request_changes', { note });
  res.json({ ok: true });
}));

// ---------------- phase transitions ----------------
r.post('/elections/:id/advance', h((req, res) => {
  const el = get('SELECT * FROM elections WHERE id = ?', int(req.params.id)); if (!el) throw notFound();
  if (!isPM(req.user)) throw forbidden(); const to = NEXT[el.status]; if (!to) throw bad('This election cannot be advanced from its current phase.');
  if (!el.sandbox && ['nominations', 'voting'].includes(to) && !inWindow(el.cycle_year)) throw bad('Nominations and voting can only open inside the July–August election window.');
  if (to === 'voting') {
    const missing = all("SELECT p.title FROM election_positions p WHERE p.election_id = ? AND NOT EXISTS (SELECT 1 FROM candidates c WHERE c.position_id = p.id AND c.status = 'validated')", el.id);
    if (missing.length) throw bad(`Validate at least one candidate for: ${missing.map(m => m.title).join(', ')}.`);
    run("UPDATE candidates SET status = 'rejected', review_note = 'Not validated before voting opened' WHERE election_id = ? AND status = 'nominated'", el.id);
  }
  run('UPDATE elections SET status = ? WHERE id = ?', to, el.id);
  const members = all("SELECT id FROM users WHERE society_id = ? AND membership_status = 'active'", el.society_id).map(x => x.id);
  if (to === 'nominations') notify(members, { icon: 'vote', title: 'Nominations are open', body: 'Eligible members can nominate themselves for the Society board.', link: `#/elections/${el.id}` });
  if (to === 'voting') notify(members, { icon: 'vote', title: 'Voting is open', body: 'Cast your secure ballot for the Society board.', link: `#/elections/${el.id}` });
  audit(req.user, 'election', el.id, 'advance', { to });
  res.json({ ok: true, status: to });
}));
r.post('/elections/:id/cancel', h((req, res) => {
  const el = get('SELECT * FROM elections WHERE id = ?', int(req.params.id)); if (!el) throw notFound();
  if (!isPM(req.user)) throw forbidden();
  run("UPDATE elections SET status = 'cancelled' WHERE id = ?", el.id);
  audit(req.user, 'election', el.id, 'cancel', { reason: clean(req.body.reason, 300) });
  res.json({ ok: true });
}));

// ---------------- nominations & validation ----------------
r.post('/elections/:id/nominate', h((req, res) => {
  const el = get('SELECT * FROM elections WHERE id = ?', int(req.params.id)); if (!el) throw notFound();
  if (el.status !== 'nominations') throw bad('Nominations are not open.');
  const e = eligibility(req.user, el); if (!e.eligible) throw forbidden('You do not meet the eligibility criteria for this election.');
  const pos = get('SELECT * FROM election_positions WHERE id = ? AND election_id = ?', int(req.body.position_id), el.id); if (!pos) throw bad('Choose a position.');
  if (get("SELECT 1 FROM candidates WHERE election_id = ? AND user_id = ? AND status != 'withdrawn'", el.id, req.user.id)) throw bad('You can stand for one position per election.');
  const id = Number(run('INSERT INTO candidates(election_id, position_id, user_id, slogan, manifesto, status, created_at) VALUES(?,?,?,?,?,?,?)', el.id, pos.id, req.user.id, clean(req.body.slogan, 80),
    need(clean(req.body.manifesto, 3000), 'Please describe your platform.'), 'nominated', nowISO()).lastInsertRowid);
  notify(el.configured_by, { icon: 'user-check', title: 'New candidate to validate', body: `${req.user.full_name} — ${pos.title}`, link: `#/elections/${el.id}` });
  audit(req.user, 'election', el.id, 'nominate', { position: pos.title });
  res.json({ id });
}));
r.post('/candidates/:id/review', h((req, res) => {
  const c = get('SELECT c.*, e.society_id, e.status estatus FROM candidates c JOIN elections e ON e.id = c.election_id WHERE c.id = ?', int(req.params.id)); if (!c) throw notFound();
  if (!(isPM(req.user) || (can(req.user, 'elections.validate') && supervises(req.user, c.society_id)))) throw forbidden();
  if (!['nominations', 'review'].includes(c.estatus)) throw bad('Candidates can only be reviewed before voting opens.');
  const approve = !!req.body.approve;
  run('UPDATE candidates SET status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?', approve ? 'validated' : 'rejected', req.user.id, nowISO(), clean(req.body.note, 400), c.id);
  notify(c.user_id, { icon: approve ? 'badge-check' : 'circle-x', title: approve ? 'Your candidacy was validated' : 'Your candidacy was not validated', body: clean(req.body.note, 200), link: `#/elections/${c.election_id}` });
  audit(req.user, 'election', c.election_id, approve ? 'validate_candidate' : 'reject_candidate', { candidate_id: c.id });
  res.json({ ok: true });
}));
r.post('/candidates/:id/withdraw', h((req, res) => {
  const c = get('SELECT c.*, e.status estatus FROM candidates c JOIN elections e ON e.id = c.election_id WHERE c.id = ?', int(req.params.id)); if (!c || c.user_id !== req.user.id) throw notFound();
  if (['voting', 'tally', 'results', 'handover', 'closed'].includes(c.estatus)) throw bad('You can no longer withdraw.');
  run("UPDATE candidates SET status = 'withdrawn' WHERE id = ?", c.id);
  audit(req.user, 'election', c.election_id, 'withdraw', {});
  res.json({ ok: true });
}));

// ---------------- secret ballot ----------------
r.post('/elections/:id/vote', h((req, res) => {
  const el = get('SELECT * FROM elections WHERE id = ?', int(req.params.id)); if (!el) throw notFound();
  if (el.status !== 'voting') throw bad('Voting is not open.');
  if (!el.sandbox && !inWindow(el.cycle_year)) throw bad('Voting is closed — outside the election window.');
  if (!eligibility(req.user, el).eligible) throw forbidden('You are not eligible to vote in this election.');
  if (get('SELECT 1 FROM ballots WHERE election_id = ? AND voter_id = ?', el.id, req.user.id)) throw bad('You have already voted. One member, one vote.');
  const positions = all('SELECT * FROM election_positions WHERE election_id = ?', el.id);
  const sel = req.body.selections || {};
  const choices = positions.map(p => {
    const cid = int(sel[p.id]);
    if (!cid || !get("SELECT 1 FROM candidates WHERE id = ? AND position_id = ? AND status = 'validated'", cid, p.id)) throw bad(`Please select one candidate for ${p.title}.`);
    return [p.id, cid];
  });
  const receipt = randomBytes(5).toString('hex').toUpperCase();
  tx(() => {
    run('INSERT INTO ballots(election_id, voter_id, receipt, cast_at) VALUES(?,?,?,?)', el.id, req.user.id, receipt, nowISO());
    // Random row ids and day-level timestamps keep choices unlinkable from ballots
    for (const [pid, cid] of choices) run('INSERT INTO votes(id, election_id, position_id, candidate_id, cast_day) VALUES(?,?,?,?,?)', randomInt(1, 2 ** 47), el.id, pid, cid, nowISO().slice(0, 10));
  });
  audit(req.user, 'election', el.id, 'ballot_cast', { receipt });
  res.json({ ok: true, receipt });
}));

// ---------------- results & handover ----------------
r.post('/elections/:id/publish', h((req, res) => {
  const el = get('SELECT * FROM elections WHERE id = ?', int(req.params.id)); if (!el) throw notFound();
  if (!isPM(req.user) || el.status !== 'tally') throw forbidden('Results can be published by the Programme Manager after voting closes.');
  const t = tally(el); if (t.some(p => p.tie)) throw bad('There is a tie. Resolve it according to the handbook (run-off) before publishing.');
  run("UPDATE elections SET status = 'results', results_published_at = ? WHERE id = ?", nowISO(), el.id);
  run('UPDATE handover_tasks SET done = 1, done_by = ?, done_at = ? WHERE election_id = ? AND sort = 0', req.user.id, nowISO(), el.id);
  notify(all("SELECT id FROM users WHERE society_id = ? AND membership_status = 'active'", el.society_id).map(x => x.id), { icon: 'trophy', title: 'Election results published', body: t.map(p => `${p.title}: ${p.candidates.find(c => c.winner)?.full_name}`).join(' · '), link: `#/elections/${el.id}` });
  audit(req.user, 'election', el.id, 'publish_results', { winners: t.map(p => p.candidates.find(c => c.winner)?.full_name) });
  res.json({ ok: true });
}));
r.post('/handover-tasks/:id/toggle', h((req, res) => {
  const t = get('SELECT h.*, e.society_id, e.status FROM handover_tasks h JOIN elections e ON e.id = h.election_id WHERE h.id = ?', int(req.params.id)); if (!t) throw notFound();
  if (!(isPM(req.user) || presidentOf(t.society_id)?.id === req.user.id || req.user.role_key === 'vice_president' && inSociety(req.user, t.society_id))) throw forbidden();
  if (!['results', 'handover'].includes(t.status)) throw bad('The handover checklist opens after results are published.');
  run('UPDATE handover_tasks SET done = ?, done_by = ?, done_at = ? WHERE id = ?', t.done ? 0 : 1, req.user.id, nowISO(), t.id);
  run("UPDATE elections SET status = 'handover' WHERE id = ? AND status = 'results'", t.election_id);
  audit(req.user, 'election', t.election_id, t.done ? 'handover_task_reopen' : 'handover_task_done', { task: t.title });
  res.json({ ok: true });
}));
r.post('/elections/:id/complete-handover', h((req, res) => {
  const el = get('SELECT * FROM elections WHERE id = ?', int(req.params.id)); if (!el) throw notFound();
  if (!isPM(req.user) || !['results', 'handover'].includes(el.status)) throw forbidden();
  if (get('SELECT COUNT(*) n FROM handover_tasks WHERE election_id = ? AND done = 0', el.id).n) throw bad('Complete every handover checklist item first.');
  const t = tally(el); const changes = [];
  tx(() => {
    if (!el.sandbox) {
      for (const p of t.filter(p => p.role_key)) {
        const winner = p.candidates.find(c => c.winner); if (!winner) continue;
        const role = get('SELECT id, name FROM roles WHERE key = ?', p.role_key);
        const memberRole = get("SELECT id FROM roles WHERE key = 'member'").id;
        for (const prev of all('SELECT id, full_name FROM users WHERE society_id = ? AND role_id = ? AND id != ?', el.society_id, role.id, winner.user_id)) { run("UPDATE users SET role_id = ?, title = 'Member' WHERE id = ?", memberRole, prev.id); changes.push(`${prev.full_name} → Member`); }
        run('UPDATE committees SET head_user_id = NULL WHERE head_user_id = ?', winner.user_id);
        run('UPDATE users SET role_id = ?, title = ? WHERE id = ?', role.id, role.name, winner.user_id);
        changes.push(`${winner.full_name} → ${role.name}`);
      }
      run('UPDATE user_grants SET revoked_at = ? WHERE society_id = ? AND revoked_at IS NULL', nowISO(), el.society_id);
      run('UPDATE societies SET vp_delegation = 0 WHERE id = ?', el.society_id);
    }
    run("UPDATE elections SET status = 'closed', handover_completed_at = ? WHERE id = ?", nowISO(), el.id);
  });
  notify(all("SELECT id FROM users WHERE society_id = ? AND membership_status = 'active'", el.society_id).map(x => x.id), { icon: 'crown', title: el.sandbox ? 'Pilot election closed' : 'New Society board is active', body: el.sandbox ? 'Rehearsal complete — roles were not changed.' : changes.join(' · '), link: '#/committees' });
  audit(req.user, 'election', el.id, el.sandbox ? 'complete_rehearsal' : 'complete_handover', { authority_reset: !el.sandbox, changes });
  res.json({ ok: true, changes, sandbox: !!el.sandbox });
}));

export default r;
