// ===================================================================
//  Member engagement: activity score, percentile, level and badges
// ===================================================================
import { get, all } from '../db/database.js';

let CACHE = { at: 0, map: new Map() };
export function activityScores() {
  if (Date.now() - CACHE.at < 60e3) return CACHE.map;
  const m = new Map();
  const add = (rows, w) => rows.forEach(r => m.set(r.uid, (m.get(r.uid) || 0) + (r.n || 0) * w));
  add(all("SELECT author_id uid, COUNT(*) n FROM posts WHERE status = 'published' GROUP BY author_id"), 10);
  add(all('SELECT author_id uid, COUNT(*) n FROM comments GROUP BY author_id'), 3);
  add(all('SELECT p.author_id uid, COUNT(*) n FROM reactions r JOIN posts p ON p.id = r.post_id GROUP BY p.author_id'), 1);
  add(all('SELECT user_id uid, COUNT(*) n FROM event_rsvps WHERE checked_in_at IS NOT NULL GROUP BY user_id'), 15);
  add(all("SELECT user_id uid, COUNT(*) n FROM enrollments WHERE status = 'completed' GROUP BY user_id"), 40);
  add(all('SELECT user_id uid, SUM(json_array_length(completed_lessons)) n FROM enrollments GROUP BY user_id'), 4);
  add(all('SELECT user_id uid, COUNT(*) n FROM certificates WHERE revoked = 0 GROUP BY user_id'), 20);
  CACHE = { at: Date.now(), map: m };
  return m;
}
export const invalidateScores = () => { CACHE.at = 0; };
export function scoreOf(uid) {
  const map = activityScores();
  const score = Math.round(map.get(uid) || 0);
  const values = [...map.values()];
  const below = values.filter(v => v < score).length;
  const pct = values.length ? Math.round(100 * below / values.length) : 0;
  const level = score >= 800 ? 'Excellent' : score >= 500 ? 'Very Good' : score >= 250 ? 'Good' : 'Rising';
  return { score, percentile: pct, top: Math.max(1, 100 - pct), level };
}

export function badgesOf(uid) {
  const n = (sql) => get(sql, uid).n;
  const posts = n("SELECT COUNT(*) n FROM posts WHERE author_id = ? AND status = 'published'");
  const checkins = n('SELECT COUNT(*) n FROM event_rsvps WHERE user_id = ? AND checked_in_at IS NOT NULL');
  const done = n("SELECT COUNT(*) n FROM enrollments WHERE user_id = ? AND status = 'completed'");
  const certs = n('SELECT COUNT(*) n FROM certificates WHERE user_id = ? AND revoked = 0');
  const role = get('SELECT r.key FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?', uid)?.key;
  const founder = n('SELECT COUNT(*) n FROM venture_members WHERE user_id = ?');
  const s = scoreOf(uid);
  const b = [];
  if (posts >= 1) b.push(['First Post', 'message-square', 'Published a first community post']);
  if (posts >= 10) b.push(['Community Voice', 'megaphone', '10+ community posts']);
  if (checkins >= 5) b.push(['Event Regular', 'calendar-check', 'Checked in to 5+ events']);
  if (checkins >= 15) b.push(['Event Champion', 'trophy', 'Checked in to 15+ events']);
  if (done >= 3) b.push(['Lifelong Learner', 'graduation-cap', 'Completed 3+ courses']);
  if (certs >= 1) b.push(['Certified', 'award', 'Earned an AASTEC certificate']);
  if (s.top <= 10) b.push(['Top Contributor', 'star', 'Top 10% activity score']);
  if (['president', 'vice_president', 'committee_head'].includes(role)) b.push(['Society Leader', 'crown', 'Holds a Society leadership role']);
  if (founder) b.push(['Founder', 'rocket', 'Member of a startup team']);
  if (role === 'mentor') b.push(['Mentor', 'heart-handshake', 'Verified mentor or trainer']);
  return { badges: b.map(([name, icon, desc]) => ({ name, icon, desc })), counts: { posts, checkins, completed: done, certificates: certs } };
}
