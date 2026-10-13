// ===================================================================
//  Unified approval inbox — every decision waiting on the current user
// ===================================================================
import { all } from '../db/database.js';
import { can, leads, GRANT_TYPES } from './core.js';

const item = (type, o) => ({ type, ...o });

export function approvalItems(u) {
  const out = [];
  const sid = u.society_id;
  const leader = sid && leads(u, sid);
  const advisorSocieties = u.role_key === 'advisor' ? all('SELECT id FROM societies WHERE advisor_id = ? OR id = ?', u.id, sid || 0).map(r => r.id) : [];
  const IN = (ids) => `(${ids.map(() => '?').join(',') || 'NULL'})`;

  if (leader) {
    for (const m of all(`SELECT id, full_name, created_at, join_note, faculty, study_year FROM users WHERE society_id = ? AND membership_status = 'pending' ORDER BY created_at`, sid))
      out.push(item('membership', { id: m.id, title: `Membership application — ${m.full_name}`, subtitle: [m.faculty, m.study_year].filter(Boolean).join(' · ') || m.join_note, by: { id: m.id, full_name: m.full_name }, at: m.created_at, step: 'President approval', actions: ['approve', 'reject'] }));
    for (const a of all(`SELECT a.*, u.full_name FROM auth_requests a JOIN users u ON u.id = a.user_id WHERE a.society_id = ? AND a.status IN ('pending','head_reviewed') ORDER BY a.created_at`, sid))
      out.push(item('authorization', { id: a.id, title: `${GRANT_TYPES[a.perm_key] || a.perm_key} — ${a.full_name}`, subtitle: a.scope_note, by: { id: a.user_id, full_name: a.full_name }, at: a.created_at,
        step: a.status === 'head_reviewed' ? 'Committee Head recommended · President approval' : 'President approval', note: a.head_review_note, actions: ['approve', 'reject'] }));
    for (const e of all(`SELECT e.id, e.title, e.start_at, e.created_by, u.full_name FROM events e JOIN users u ON u.id = e.created_by WHERE e.society_id = ? AND e.kind = 'society' AND e.status = 'proposed' ORDER BY e.start_at`, sid))
      out.push(item('event', { id: e.id, title: `Event proposal — ${e.title}`, subtitle: `Proposed for ${e.start_at.slice(0, 10)}`, by: { id: e.created_by, full_name: e.full_name }, at: e.start_at, step: 'President review', actions: ['approve', 'reject'] }));
  }
  if (u.is_committee_head) {
    const cids = all('SELECT id FROM committees WHERE head_user_id = ?', u.id).map(r => r.id);
    for (const a of all(`SELECT a.*, u.full_name FROM auth_requests a JOIN users u ON u.id = a.user_id WHERE a.committee_id IN ${IN(cids)} AND a.status = 'pending'`, ...cids))
      out.push(item('authorization_review', { id: a.id, title: `${GRANT_TYPES[a.perm_key] || a.perm_key} — ${a.full_name}`, subtitle: a.scope_note, by: { id: a.user_id, full_name: a.full_name }, at: a.created_at, step: 'Committee Head review (optional)', actions: ['recommend', 'decline'] }));
  }
  // Posting workflow — the current step is "pending"
  const postSteps = all(`SELECT pa.id step_id, pa.label, pa.role_key, pa.approver_id, p.id, p.title, p.body, p.society_id, p.created_at, p.author_id, u.full_name
    FROM post_approvals pa JOIN posts p ON p.id = pa.post_id JOIN users u ON u.id = p.author_id WHERE pa.status = 'pending' AND p.status = 'pending_approval' ORDER BY p.created_at`);
  for (const s of postSteps) {
    const mine = (s.role_key === 'committee_head' && s.approver_id === u.id)
      || (s.role_key === 'president' && leads(u, s.society_id))
      || (s.role_key === 'advisor' && advisorSocieties.includes(s.society_id))
      || (s.role_key === 'aastec' && can(u, 'posts.approve_national'));
    if (mine) out.push(item('post', { id: s.id, title: s.title || s.body.slice(0, 70), subtitle: s.body.slice(0, 140), by: { id: s.author_id, full_name: s.full_name }, at: s.created_at, step: s.label, actions: ['approve', 'reject'] }));
  }
  if (advisorSocieties.length) {
    const S = IN(advisorSocieties);
    for (const r of all(`SELECT r.id, r.title, r.report_type, r.submitted_at, r.submitted_by, u.full_name FROM society_reports r JOIN users u ON u.id = r.submitted_by WHERE r.society_id IN ${S} AND r.status = 'submitted' AND r.report_type != 'incubator_agent' ORDER BY r.submitted_at`, ...advisorSocieties))
      out.push(item('report', { id: r.id, title: r.title, subtitle: r.report_type.replace(/_/g, ' '), by: { id: r.submitted_by, full_name: r.full_name }, at: r.submitted_at, step: 'Faculty Advisor review', actions: ['approve', 'return'] }));
    for (const e of all(`SELECT e.id, e.title, e.start_at, e.created_by, u.full_name FROM events e JOIN users u ON u.id = e.created_by WHERE e.society_id IN ${S} AND e.status = 'advisor_review'`, ...advisorSocieties))
      out.push(item('event_advisor', { id: e.id, title: `Event supervision — ${e.title}`, subtitle: 'External partners, sponsors or significant budget', by: { id: e.created_by, full_name: e.full_name }, at: e.start_at, step: 'Faculty Advisor review', actions: ['approve', 'reject'] }));
    for (const el of all(`SELECT el.id, el.title, el.configured_at, el.cycle_year, s.short_name FROM elections el JOIN societies s ON s.id = el.society_id WHERE el.society_id IN ${S} AND el.status = 'pending_advisor'`, ...advisorSocieties))
      out.push(item('election', { id: el.id, title: `Election activation — ${el.title}`, subtitle: `${el.short_name} · cycle ${el.cycle_year}`, by: null, at: el.configured_at, step: 'Faculty Advisor activation approval', actions: ['approve', 'reject'] }));
  }
  if (can(u, 'events.aastec'))
    for (const e of all(`SELECT e.id, e.title, e.start_at, e.created_by, u.full_name FROM events e JOIN users u ON u.id = e.created_by WHERE e.kind IN ('aastec','training') AND e.status = 'proposed'`))
      out.push(item('event', { id: e.id, title: `AASTEC event proposal — ${e.title}`, subtitle: `Proposed for ${e.start_at.slice(0, 10)}`, by: { id: e.created_by, full_name: e.full_name }, at: e.start_at, step: 'AASTEC staff review', actions: ['approve', 'reject'] }));
  if (can(u, 'elections.validate')) {
    const scope = u.role_key === 'advisor' ? `AND el.society_id IN ${IN(advisorSocieties)}` : '';
    for (const c of all(`SELECT c.id, c.created_at, c.user_id, u.full_name, p.title pos, s.short_name FROM candidates c JOIN users u ON u.id = c.user_id JOIN election_positions p ON p.id = c.position_id JOIN elections el ON el.id = c.election_id JOIN societies s ON s.id = el.society_id
      WHERE c.status = 'nominated' AND el.status IN ('nominations','review') ${scope}`, ...(scope ? advisorSocieties : [])))
      out.push(item('candidate', { id: c.id, title: `Candidate validation — ${c.full_name}`, subtitle: `${c.pos} · ${c.short_name}`, by: { id: c.user_id, full_name: c.full_name }, at: c.created_at, step: 'Candidate review & validation', actions: ['approve', 'reject'] }));
  }
  if (can(u, 'incubator.manage')) {
    for (const a of all(`SELECT a.id, a.pitch, a.status, a.created_at, a.applicant_id, u.full_name, c.name cohort FROM applications a JOIN users u ON u.id = a.applicant_id JOIN cohorts c ON c.id = a.cohort_id WHERE a.status IN ('received','under_review','shortlisted') ORDER BY a.created_at`))
      out.push(item('application', { id: a.id, title: `Incubator application — ${a.full_name}`, subtitle: `${a.cohort} · ${a.status.replace('_', ' ')}`, by: { id: a.applicant_id, full_name: a.full_name }, at: a.created_at, step: 'Programme Manager review', actions: ['open'] }));
    for (const r of all(`SELECT r.id, r.title, r.submitted_at, r.submitted_by, u.full_name FROM society_reports r JOIN users u ON u.id = r.submitted_by WHERE r.report_type = 'incubator_agent' AND r.status = 'submitted'`))
      out.push(item('report', { id: r.id, title: r.title, subtitle: 'Incubator agent report', by: { id: r.submitted_by, full_name: r.full_name }, at: r.submitted_at, step: 'Incubator PM review', actions: ['approve', 'return'] }));
  }
  if (can(u, 'mentor.verify'))
    for (const m of all(`SELECT m.user_id, m.headline, m.kind, m.created_at, u.full_name FROM mentor_profiles m JOIN users u ON u.id = m.user_id WHERE m.status = 'pending'`))
      out.push(item('mentor', { id: m.user_id, title: `${m.kind === 'trainer' ? 'Trainer' : 'Mentor'} verification — ${m.full_name}`, subtitle: m.headline, by: { id: m.user_id, full_name: m.full_name }, at: m.created_at, step: 'Verification', actions: ['approve', 'reject'] }));
  return out;
}
