// ===================================================================
//  KPI engine — Society reporting template
//  Auto KPIs are computed from recorded platform activity; manual KPIs
//  (and externally reported additions to auto counts, e.g. Instagram
//  posts or off-platform trainings) come from dated snapshots in
//  kpi_entries, so any point in time can be reconstructed.
// ===================================================================
import { get, all } from '../db/database.js';
import { ayRange, academicYear, prevAY } from './core.js';

export const defs = () => all('SELECT * FROM kpi_definitions ORDER BY sort');
export const activeSocietyIds = () => all("SELECT id FROM societies WHERE status = 'active'").map(r => r.id);

// Reporting year: the current academic year, or the previous one during the first 3 months
export function reportingYear(d = new Date()) {
  const ay = academicYear(d);
  const started = new Date(ayRange(ay).from);
  return (d - started) / 864e5 < 90 ? prevAY(ay) : ay;
}
export function yearOptions() {
  const cur = academicYear();
  return [cur, prevAY(cur), prevAY(prevAY(cur))];
}

const IN = (ids) => `(${ids.map(() => '?').join(',') || 'NULL'})`;

// Short-lived memo: KPI views fan out into many aggregate queries
const MEMO = new Map();
export function kpiValues(societyIds, ay, asOf = null) {
  const ids = societyIds?.length ? societyIds : activeSocietyIds();
  const key = `${ids.join(',')}|${ay}|${asOf || ''}`;
  const hit = MEMO.get(key);
  if (hit && Date.now() - hit.at < 60e3) return hit.v;
  const v = computeKpis(ids, ay, asOf);
  if (MEMO.size > 2000) MEMO.clear();
  MEMO.set(key, { at: Date.now(), v });
  return v;
}
function computeKpis(ids, ay, asOf) {
  const { from, to } = ayRange(ay);
  const end = asOf && asOf < to ? asOf : to;
  const S = IN(ids);
  const done = `status IN ('completed','closed')`;
  const v = {};
  v.online_posts = get(`SELECT COUNT(*) n FROM posts WHERE society_id IN ${S} AND status = 'published' AND published_at BETWEEN ? AND ?`, ...ids, from, end).n;
  v.events_hosted = get(`SELECT COUNT(*) n FROM events WHERE society_id IN ${S} AND kind IN ('society','info_session') AND ${done} AND start_at BETWEEN ? AND ?`, ...ids, from, end).n;
  const tr = get(`SELECT COUNT(*) n, COALESCE(SUM(training_hours),0) h FROM events WHERE society_id IN ${S} AND (category IN ('training','workshop') OR kind = 'training') AND ${done} AND start_at BETWEEN ? AND ?`, ...ids, from, end);
  v.training_count = tr.n; v.training_hours = Math.round(tr.h);
  const att = get(`SELECT COUNT(*) going, SUM(CASE WHEN r.checked_in_at IS NOT NULL THEN 1 ELSE 0 END) present
    FROM event_rsvps r JOIN events e ON e.id = r.event_id WHERE e.society_id IN ${S} AND e.${done} AND e.start_at BETWEEN ? AND ? AND r.status = 'going'`, ...ids, from, end);
  v.attendance_compliance = att.going ? Math.round(100 * att.present / att.going) : 0;
  const re = get(`SELECT COUNT(*) users, SUM(CASE WHEN c >= 2 THEN 1 ELSE 0 END) repeaters FROM (
      SELECT r.user_id, COUNT(*) c FROM event_rsvps r JOIN events e ON e.id = r.event_id
      WHERE e.society_id IN ${S} AND r.checked_in_at IS NOT NULL AND e.start_at BETWEEN ? AND ? GROUP BY r.user_id)`, ...ids, from, end);
  v.reattendance = re.users ? Math.round(100 * re.repeaters / re.users) : 0;
  v.reports_submitted = get(`SELECT COUNT(*) n FROM society_reports WHERE society_id IN ${S} AND submitted_at BETWEEN ? AND ?`, ...ids, from, end).n;
  v.startups_supported = get(`SELECT COUNT(*) n FROM ventures WHERE society_id IN ${S} AND created_at <= ?`, ...ids, end).n;
  const hb = get(`SELECT COUNT(*) m, SUM(CASE WHEN handbook_ack_version IS NOT NULL THEN 1 ELSE 0 END) a FROM users WHERE society_id IN ${S} AND membership_status = 'active' AND is_active = 1`, ...ids);
  v.handbook_compliance = hb.m ? Math.round(100 * hb.a / hb.m) : 0;
  // latest dated snapshot per society & metric
  const snaps = all(`SELECT k.society_id, k.metric_key, k.value FROM kpi_entries k
    WHERE k.society_id IN ${S} AND k.academic_year = ? AND k.created_at <= ?
      AND k.id = (SELECT k2.id FROM kpi_entries k2 WHERE k2.society_id = k.society_id AND k2.metric_key = k.metric_key AND k2.academic_year = k.academic_year AND k2.created_at <= ? ORDER BY k2.created_at DESC, k2.id DESC LIMIT 1)`, ...ids, ay, end, end);
  const reported = {};
  for (const r of snaps) reported[r.metric_key] = (reported[r.metric_key] || 0) + r.value;
  const out = [];
  for (const d of defs()) {
    const platform = d.source === 'auto' ? (v[d.key] ?? 0) : 0;
    const external = d.unit === 'percent' ? 0 : (reported[d.key] || 0);
    const value = d.source === 'auto' ? platform + external : external;
    const target = d.unit === 'percent' ? d.target : d.target * ids.length;
    const achievement = target ? Math.min(150, Math.round(100 * value / target)) : 0;
    out.push({ key: d.key, label: d.label, unit: d.unit, icon: d.icon, source: d.source, value, platform, external, target, achievement, status: statusOf(achievement) });
  }
  const score = Math.round(out.reduce((s, k) => s + Math.min(100, k.achievement), 0) / out.length);
  return { kpis: out, rallians_score: score, societies: ids.length, academic_year: ay, as_of: end };
}
export const statusOf = (a) => a >= 100 ? 'met' : a >= 80 ? 'near' : a >= 50 ? 'improve' : 'off';

// Year-to-date Rallians score at each month end of the academic year
export function scoreTrend(ids, ay) {
  const st = ayRange(ay).start; const pts = [];
  for (let i = 0; i < 12; i++) {
    const end = new Date(Date.UTC(st, 8 + i + 1, 0, 23, 59, 59));
    if (end.getTime() > Date.now() + 31 * 864e5) break;
    pts.push({ month: end.toISOString().slice(0, 7), score: kpiValues(ids, ay, end.toISOString()).rallians_score });
  }
  return pts;
}
