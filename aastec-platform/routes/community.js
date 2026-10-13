// ===================================================================
//  Community: feed, posting authorization workflow, reactions,
//  comments, polls, saves, moderation, groups and messaging
// ===================================================================
import { Router } from 'express';
import { get, all, run, tx, nowISO, json } from '../db/database.js';
import { can, leads, isLeadership, supervises, inSociety, hasGrant, societyOf, presidentOf, vpOf, usersWithCap, audit, notify, notifyCap, initials, riskCheck, settings, daysAgo, societyHealth } from '../lib/core.js';
import { invalidateScores } from '../lib/stats.js';
import { h, bad, forbidden, notFound, need, clean, int } from '../lib/http.js';

const r = Router();
const REACTIONS = ['like', 'love', 'celebrate', 'insightful'];
const CATEGORIES = ['announcement', 'event', 'opportunity', 'discussion', 'achievement'];
const isModerator = (u, sid) => can(u, 'moderation') || (sid && inSociety(u, sid) && hasGrant(u, 'community_moderation'));
const publishDue = () => run("UPDATE posts SET status = 'published', published_at = publish_at WHERE status = 'scheduled' AND publish_at <= ?", nowISO());

function visibilitySql(u) {
  // Returns a WHERE fragment restricting posts to what this user may see
  const privileged = can(u, 'portfolio.view') || u.role_key === 'admin';
  const parts = ["p.visibility = 'public'"];
  if (u.society_id) parts.push(`(p.visibility = 'society' AND p.society_id = ${+u.society_id})`);
  if (privileged) parts.push("p.visibility IN ('society','admins')");
  const groupOk = `(p.group_id IS NULL OR EXISTS (SELECT 1 FROM groups g WHERE g.id = p.group_id AND (g.visibility = 'public' OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ${+u.id}))))`;
  const blocked = `p.author_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ${+u.id})`;
  return `(${parts.join(' OR ')}) AND ${groupOk} AND ${blocked}`;
}

export function decoratePosts(rows, u) {
  if (!rows.length) return [];
  const ids = rows.map(p => p.id); const IN = `(${ids.join(',')})`;
  const reacts = all(`SELECT post_id, kind, COUNT(*) n FROM reactions WHERE post_id IN ${IN} GROUP BY post_id, kind`);
  const mine = Object.fromEntries(all(`SELECT post_id, kind FROM reactions WHERE user_id = ? AND post_id IN ${IN}`, u.id).map(x => [x.post_id, x.kind]));
  const comments = Object.fromEntries(all(`SELECT post_id, COUNT(*) n FROM comments WHERE status = 'visible' AND post_id IN ${IN} GROUP BY post_id`).map(x => [x.post_id, x.n]));
  const saved = new Set(all(`SELECT post_id FROM saved_posts WHERE user_id = ? AND post_id IN ${IN}`, u.id).map(x => x.post_id));
  const polls = all(`SELECT post_id, option_index, COUNT(*) n FROM poll_votes WHERE post_id IN ${IN} GROUP BY post_id, option_index`);
  const myVotes = Object.fromEntries(all(`SELECT post_id, option_index FROM poll_votes WHERE user_id = ? AND post_id IN ${IN}`, u.id).map(x => [x.post_id, x.option_index]));
  return rows.map(p => {
    const rc = {}; for (const x of reacts.filter(x => x.post_id === p.id)) rc[x.kind] = x.n;
    const poll = json(p.poll);
    if (poll) { poll.counts = poll.options.map((_, i) => polls.find(x => x.post_id === p.id && x.option_index === i)?.n || 0); poll.mine = myVotes[p.id] ?? null; }
    return { ...p, tags: json(p.tags, []), media: json(p.media, []), risk_checks: undefined, poll, author_initials: initials(p.author_name), reactions: rc, reaction_total: Object.values(rc).reduce((a, b) => a + b, 0),
      my_reaction: mine[p.id] || null, comments_count: comments[p.id] || 0, saved: saved.has(p.id), can_delete: p.author_id === u.id || isModerator(u, p.society_id) || (p.identity === 'society' && leads(u, p.society_id)) };
  });
}
const POST_SELECT = `SELECT p.*, u.full_name author_name, u.title author_title, u.avatar_url author_avatar, ro.key author_role, us.short_name author_society, s.name society_name, s.short_name society_short, g.name group_name
  FROM posts p JOIN users u ON u.id = p.author_id JOIN roles ro ON ro.id = u.role_id LEFT JOIN societies us ON us.id = u.society_id LEFT JOIN societies s ON s.id = p.society_id LEFT JOIN groups g ON g.id = p.group_id`;

// ---------------- feed ----------------
r.get('/feed', h((req, res) => {
  publishDue();
  const u = req.user; const where = ["p.status = 'published'", visibilitySql(u)]; const p = [];
  const scope = req.query.scope || 'all';
  if (scope === 'society') { where.push('p.society_id = ?'); p.push(int(req.query.society_id) || u.society_id || 0); }
  if (scope === 'aastec') where.push("p.identity = 'aastec'");
  if (scope === 'official') where.push("p.identity IN ('society','aastec')");
  if (scope === 'following') where.push(`(p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = ${+u.id}) OR p.identity = 'aastec')`);
  if (scope === 'saved') where.push(`p.id IN (SELECT post_id FROM saved_posts WHERE user_id = ${+u.id})`);
  if (scope === 'mine') where.push(`p.author_id = ${+u.id}`);
  if (req.query.group_id) { where.push('p.group_id = ?'); p.push(int(req.query.group_id)); }
  else if (scope !== 'mine') where.push('p.group_id IS NULL');
  if (req.query.society_id && scope !== 'society') { where.push('p.society_id = ?'); p.push(int(req.query.society_id)); }
  if (req.query.author_id) { where.push('p.author_id = ?'); p.push(int(req.query.author_id)); }
  if (CATEGORIES.includes(req.query.category)) { where.push('p.category = ?'); p.push(req.query.category); }
  if (req.query.q) { where.push('(p.body LIKE ? OR p.title LIKE ? OR p.tags LIKE ?)'); p.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`); }
  if (req.query.before) { where.push('p.published_at < ?'); p.push(req.query.before); }
  const limit = Math.min(int(req.query.limit) || 12, 40);
  const pinned = !req.query.before && scope === 'all' && !req.query.category ? all(`${POST_SELECT} WHERE p.pinned = 1 AND p.status = 'published' ORDER BY p.published_at DESC LIMIT 1`) : [];
  const rows = all(`${POST_SELECT} WHERE ${where.join(' AND ')} ${pinned.length ? `AND p.id != ${pinned[0].id}` : ''} ORDER BY p.published_at DESC LIMIT ?`, ...p, limit);
  res.json({ posts: decoratePosts([...pinned, ...rows], u), next: rows.length === limit ? rows[rows.length - 1].published_at : null });
}));
r.get('/community/highlights', (req, res) => {
  res.json(all(`SELECT s.id, s.short_name, COUNT(p.id) posts FROM societies s JOIN posts p ON p.society_id = s.id AND p.status = 'published' AND p.published_at > ? WHERE s.status = 'active' GROUP BY s.id ORDER BY (s.id = ?) DESC, posts DESC LIMIT 10`, daysAgo(14), req.user.society_id || 0));
});

// ---------------- posting workflow ----------------
function canPostOfficial(u, sid) {
  if (!inSociety(u, sid) && u.role_key !== 'admin') return false;
  return isLeadership(u, sid) || hasGrant(u, 'posting_official') || u.role_key === 'admin';
}
function buildChain(u, sid, { sensitive, scope, risk }) {
  const threshold = +settings().risk_threshold;
  const needs = sensitive || scope !== 'chapter' || risk.score >= threshold;
  if (!needs) return [];
  const steps = [];
  const asPresident = leads(u, sid);
  if (u.committee_id && !u.is_committee_head && !isLeadership(u, sid)) {
    const head = get('SELECT head_user_id FROM committees WHERE id = ?', u.committee_id)?.head_user_id;
    if (head && head !== u.id) steps.push({ label: 'Committee Head Review', role_key: 'committee_head', approver_id: head });
  }
  steps.push({ label: 'President Approval', role_key: 'president', approver_id: presidentOf(sid)?.id, auto: asPresident, note: asPresident ? 'Authored with President authority.' : null });
  if (sensitive || scope !== 'chapter') steps.push({ label: 'Faculty Advisor Approval', role_key: 'advisor', approver_id: societyOf(sid)?.advisor_id });
  if (scope === 'national') steps.push({ label: 'AASTEC Approval', role_key: 'aastec', approver_id: null });
  return steps;
}
function notifyStep(post, step) {
  const payload = { icon: 'megaphone', title: 'Post awaiting your approval', body: `${post.title || post.body.slice(0, 60)} — ${step.label}`, link: '#/approvals' };
  if (step.role_key === 'committee_head' || step.role_key === 'advisor') notify(step.approver_id, payload);
  else if (step.role_key === 'president') { const ids = [presidentOf(post.society_id)?.id]; if (societyOf(post.society_id)?.vp_delegation) ids.push(vpOf(post.society_id)?.id); notify(ids, payload); }
  else if (step.role_key === 'aastec') notifyCap('posts.approve_national', payload);
}
function advance(postId, actor) {
  const post = get('SELECT * FROM posts WHERE id = ?', postId);
  const next = get("SELECT * FROM post_approvals WHERE post_id = ? AND status = 'waiting' ORDER BY step LIMIT 1", postId);
  if (next) { run("UPDATE post_approvals SET status = 'pending' WHERE id = ?", next.id); notifyStep(post, next); return 'pending_approval'; }
  const future = post.publish_at && post.publish_at > nowISO();
  run('UPDATE posts SET status = ?, published_at = ?, updated_at = ? WHERE id = ?', future ? 'scheduled' : 'published', future ? null : nowISO(), nowISO(), postId);
  notify(post.author_id, { icon: 'circle-check', title: future ? 'Post approved and scheduled' : 'Your post is published', body: post.title || post.body.slice(0, 80), link: '#/community' });
  audit(actor, 'post', postId, future ? 'schedule' : 'publish', { title: post.title });
  return future ? 'scheduled' : 'published';
}

r.post('/posts/risk-check', (req, res) => res.json(riskCheck(req.body || {})));

r.post('/posts', h((req, res) => {
  const u = req.user; const b = req.body;
  if (u.society_id && u.membership_status !== 'active') throw forbidden('Your membership must be approved before you can post.');
  const identity = ['personal', 'society', 'aastec'].includes(b.identity) ? b.identity : 'personal';
  const body = need(clean(b.body, 6000), 'Please write something before posting.');
  const title = clean(b.title, 160);
  const category = CATEGORIES.includes(b.category) ? b.category : 'discussion';
  const scope = ['chapter', 'external', 'national'].includes(b.scope) ? b.scope : 'chapter';
  const media = (Array.isArray(b.media) ? b.media : []).filter(m => typeof m === 'string' && (m.startsWith('/uploads/') || /^https:\/\//.test(m))).slice(0, 6);
  const tags = (Array.isArray(b.tags) ? b.tags : String(b.tags || '').split(/[\s,#]+/)).map(t => clean(t, 30)?.replace(/^#/, '')).filter(Boolean).slice(0, 8);
  const poll = Array.isArray(b.poll?.options) && b.poll.options.filter(o => clean(o, 80)).length >= 2 ? { options: b.poll.options.map(o => clean(o, 80)).filter(Boolean).slice(0, 5) } : null;
  const group_id = int(b.group_id);
  if (group_id && !get("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", group_id, u.id) && !can(u, 'moderation')) throw forbidden('Join the group to post in it.');
  let society_id = u.society_id || null;
  if (identity === 'society') { society_id = int(b.society_id) || u.society_id; if (!canPostOfficial(u, society_id)) throw forbidden('Posting under the Society identity requires President authorization. Request "Official posting" from the Approvals page.'); }
  if (identity === 'aastec' && !can(u, 'posts.aastec')) throw forbidden('Only authorized AASTEC staff can publish under the AASTEC identity.');
  const risk = riskCheck({ body, title, identity, media });
  const sensitive = !!b.sensitive;
  const publish_at = clean(b.publish_at, 30);
  const future = publish_at && publish_at > nowISO();
  const visibility = ['public', 'society', 'admins'].includes(b.visibility) ? b.visibility : 'public';
  const at = nowISO();
  const result = tx(() => {
    const id = Number(run(`INSERT INTO posts(author_id, identity, society_id, group_id, category, visibility, audience, scope, title, body, tags, media, poll, sensitive, risk_score, risk_checks, status, publish_at, event_id, created_at, updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, u.id, identity, society_id, group_id, category, visibility, clean(b.audience, 30) || 'all', scope, title, body, JSON.stringify(tags), JSON.stringify(media), poll ? JSON.stringify(poll) : null,
      sensitive ? 1 : 0, risk.score, JSON.stringify(risk.checks), 'pending_approval', publish_at, int(b.event_id), at, at).lastInsertRowid);
    if (identity === 'personal' || identity === 'aastec') {
      if (identity === 'personal' && risk.score >= +settings().risk_threshold) {
        run("UPDATE posts SET status = 'flagged' WHERE id = ?", id);
        notifyCap('moderation', { icon: 'flag', title: 'Post held for moderation', body: `${u.full_name}: risk score ${risk.score}/100`, link: '#/moderation' });
        audit(u, 'post', id, 'held_for_moderation', { risk: risk.score });
        return { id, status: 'flagged' };
      }
      run('UPDATE posts SET status = ?, published_at = ? WHERE id = ?', future ? 'scheduled' : 'published', future ? null : at, id);
      if (identity === 'aastec') audit(u, 'post', id, 'publish_aastec', { title });
      return { id, status: future ? 'scheduled' : 'published' };
    }
    const steps = buildChain(u, society_id, { sensitive, scope, risk });
    steps.forEach((s, i) => run('INSERT INTO post_approvals(post_id, step, label, role_key, approver_id, status, note, decided_at) VALUES(?,?,?,?,?,?,?,?)', id, i + 1, s.label, s.role_key, s.approver_id, s.auto ? 'approved' : 'waiting', s.note || null, s.auto ? at : null));
    audit(u, 'post', id, 'submit_official', { title, scope, sensitive, steps: steps.map(s => s.label) });
    const status = advance(id, u);
    return { id, status };
  });
  invalidateScores();
  res.json({ ...result, risk });
}));

function currentStep(postId) { return get("SELECT * FROM post_approvals WHERE post_id = ? AND status = 'pending' ORDER BY step LIMIT 1", postId); }
function canDecideStep(u, post, step) {
  if (!step) return false;
  if (step.role_key === 'committee_head') return step.approver_id === u.id;
  if (step.role_key === 'president') return leads(u, post.society_id);
  if (step.role_key === 'advisor') return supervises(u, post.society_id);
  if (step.role_key === 'aastec') return can(u, 'posts.approve_national');
  return false;
}
r.get('/posts/:id', h((req, res) => {
  publishDue();
  const p = get(`${POST_SELECT} WHERE p.id = ?`, int(req.params.id)); if (!p) throw notFound('Post not found.');
  const u = req.user;
  const involved = p.author_id === u.id || isModerator(u, p.society_id) || isLeadership(u, p.society_id) || supervises(u, p.society_id) || can(u, 'posts.approve_national') || u.is_committee_head;
  if (p.status !== 'published' && !involved) throw notFound('Post not found.');
  const steps = all('SELECT pa.*, u.full_name approver_name, u.title approver_title FROM post_approvals pa LEFT JOIN users u ON u.id = pa.approver_id WHERE pa.post_id = ? ORDER BY step', p.id);
  const step = currentStep(p.id);
  res.json({ ...decoratePosts([p], u)[0], risk_checks: json(p.risk_checks, []), steps, can_decide: p.status === 'pending_approval' && canDecideStep(u, p, step),
    audit: involved ? all("SELECT actor_name, action, detail, created_at FROM audit_log WHERE entity_type = 'post' AND entity_id = ? ORDER BY id", p.id) : [] });
}));
r.post('/posts/:id/decide', h((req, res) => {
  const post = get('SELECT * FROM posts WHERE id = ?', int(req.params.id)); if (!post) throw notFound();
  if (post.status !== 'pending_approval') throw bad('This post is not awaiting approval.');
  const step = currentStep(post.id);
  if (!canDecideStep(req.user, post, step)) throw forbidden('This approval step is assigned to someone else.');
  const approve = !!req.body.approve; const note = clean(req.body.note, 500);
  if (!approve && !note) throw bad('Please add a note so the author knows what to change.');
  let status;
  tx(() => {
    run('UPDATE post_approvals SET status = ?, approver_id = COALESCE(approver_id, ?), note = ?, decided_at = ? WHERE id = ?', approve ? 'approved' : 'rejected', req.user.id, note, nowISO(), step.id);
    if (step.approver_id == null) run('UPDATE post_approvals SET approver_id = ? WHERE id = ?', req.user.id, step.id);
    audit(req.user, 'post', post.id, approve ? 'approve_step' : 'reject', { step: step.label, note });
    if (approve) status = advance(post.id, req.user);
    else { status = 'rejected'; run("UPDATE posts SET status = 'rejected', updated_at = ? WHERE id = ?", nowISO(), post.id); notify(post.author_id, { icon: 'circle-x', title: 'Post not approved', body: `${step.label}: ${note}`, link: '#/community' }); }
  });
  res.json({ ok: true, status });
}));
r.put('/posts/:id', h((req, res) => {
  const post = get('SELECT * FROM posts WHERE id = ?', int(req.params.id)); if (!post) throw notFound();
  if (post.author_id !== req.user.id || post.identity !== 'personal') throw forbidden('Only personal posts can be edited by their author.');
  const body = need(clean(req.body.body, 6000), 'Post content is required.');
  const risk = riskCheck({ body, title: post.title });
  run('UPDATE posts SET body = ?, risk_score = ?, risk_checks = ?, updated_at = ? WHERE id = ?', body, risk.score, JSON.stringify(risk.checks), nowISO(), post.id);
  res.json({ ok: true });
}));
r.delete('/posts/:id', h((req, res) => {
  const post = get('SELECT * FROM posts WHERE id = ?', int(req.params.id)); if (!post) throw notFound();
  const own = post.author_id === req.user.id;
  if (!own && !isModerator(req.user, post.society_id) && !(post.identity === 'society' && leads(req.user, post.society_id))) throw forbidden();
  run("UPDATE posts SET status = 'removed', updated_at = ? WHERE id = ?", nowISO(), post.id);
  audit(req.user, 'post', post.id, own ? 'delete_own' : 'remove', { title: post.title });
  res.json({ ok: true });
}));

// ---------------- interactions ----------------
const visiblePost = (u, id) => { const p = get(`SELECT p.* FROM posts p WHERE p.id = ? AND p.status = 'published' AND ${visibilitySql(u)}`, id); if (!p) throw notFound('Post not found.'); return p; };
r.post('/posts/:id/react', h((req, res) => {
  const p = visiblePost(req.user, int(req.params.id)); const kind = REACTIONS.includes(req.body.kind) ? req.body.kind : 'like';
  const cur = get('SELECT kind FROM reactions WHERE post_id = ? AND user_id = ?', p.id, req.user.id);
  if (cur && cur.kind === kind) run('DELETE FROM reactions WHERE post_id = ? AND user_id = ?', p.id, req.user.id);
  else run('INSERT OR REPLACE INTO reactions(post_id, user_id, kind, created_at) VALUES(?,?,?,?)', p.id, req.user.id, kind, nowISO());
  invalidateScores();
  res.json(decoratePosts([get(`${POST_SELECT} WHERE p.id = ?`, p.id)], req.user)[0]);
}));
r.get('/posts/:id/comments', h((req, res) => {
  const p = visiblePost(req.user, int(req.params.id));
  res.json(all(`SELECT c.*, u.full_name, u.title, s.short_name society_short FROM comments c JOIN users u ON u.id = c.author_id LEFT JOIN societies s ON s.id = u.society_id WHERE c.post_id = ? AND c.status = 'visible' ORDER BY c.created_at`, p.id)
    .map(c => ({ ...c, initials: initials(c.full_name), can_delete: c.author_id === req.user.id || isModerator(req.user, p.society_id) })));
}));
r.post('/posts/:id/comments', h((req, res) => {
  const p = visiblePost(req.user, int(req.params.id));
  if (req.user.society_id && req.user.membership_status !== 'active') throw forbidden('Your membership must be approved before you can comment.');
  const body = need(clean(req.body.body, 1500), 'Please write a comment.');
  const risk = riskCheck({ body });
  if (!risk.checks.find(c => c.key === 'guidelines').ok) throw bad('Please keep comments respectful and within the community guidelines.');
  const id = Number(run('INSERT INTO comments(post_id, author_id, body, created_at) VALUES(?,?,?,?)', p.id, req.user.id, body, nowISO()).lastInsertRowid);
  if (p.author_id !== req.user.id) notify(p.author_id, { icon: 'message-circle', title: `${req.user.full_name} commented on your post`, body: body.slice(0, 100), link: '#/community' });
  invalidateScores();
  res.json({ id });
}));
r.delete('/comments/:id', h((req, res) => {
  const c = get('SELECT c.*, p.society_id FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.id = ?', int(req.params.id)); if (!c) throw notFound();
  if (c.author_id !== req.user.id && !isModerator(req.user, c.society_id)) throw forbidden();
  run("UPDATE comments SET status = 'hidden' WHERE id = ?", c.id);
  if (c.author_id !== req.user.id) audit(req.user, 'comment', c.id, 'remove', {});
  res.json({ ok: true });
}));
r.post('/posts/:id/save', h((req, res) => {
  const p = visiblePost(req.user, int(req.params.id));
  if (get('SELECT 1 FROM saved_posts WHERE post_id = ? AND user_id = ?', p.id, req.user.id)) run('DELETE FROM saved_posts WHERE post_id = ? AND user_id = ?', p.id, req.user.id);
  else run('INSERT INTO saved_posts(post_id, user_id, created_at) VALUES(?,?,?)', p.id, req.user.id, nowISO());
  res.json({ saved: !!get('SELECT 1 FROM saved_posts WHERE post_id = ? AND user_id = ?', p.id, req.user.id) });
}));
r.post('/posts/:id/share', h((req, res) => { const p = visiblePost(req.user, int(req.params.id)); run('UPDATE posts SET share_count = share_count + 1 WHERE id = ?', p.id); res.json({ ok: true }); }));
r.post('/posts/:id/vote', h((req, res) => {
  const p = visiblePost(req.user, int(req.params.id)); const poll = json(p.poll); const opt = int(req.body.option);
  if (!poll || opt == null || opt < 0 || opt >= poll.options.length) throw bad('Invalid poll option.');
  run('INSERT OR REPLACE INTO poll_votes(post_id, user_id, option_index, created_at) VALUES(?,?,?,?)', p.id, req.user.id, opt, nowISO());
  res.json(decoratePosts([get(`${POST_SELECT} WHERE p.id = ?`, p.id)], req.user)[0]);
}));

// ---------------- reporting & moderation ----------------
r.post('/content-reports', h((req, res) => {
  const type = ['post', 'comment', 'message', 'user'].includes(req.body.target_type) ? req.body.target_type : null; if (!type) throw bad('Unknown content type.');
  const target_id = need(int(req.body.target_id), 'Missing content reference.');
  if (get("SELECT 1 FROM content_reports WHERE target_type = ? AND target_id = ? AND reporter_id = ? AND status = 'open'", type, target_id, req.user.id)) throw bad('You have already reported this content.');
  run('INSERT INTO content_reports(target_type, target_id, reporter_id, reason, detail, created_at) VALUES(?,?,?,?,?,?)', type, target_id, req.user.id, need(clean(req.body.reason, 80), 'Please choose a reason.'), clean(req.body.detail, 600), nowISO());
  if (type === 'post' && get("SELECT COUNT(*) n FROM content_reports WHERE target_type = 'post' AND target_id = ? AND status = 'open'", target_id).n >= 3)
    run("UPDATE posts SET status = 'flagged' WHERE id = ? AND status = 'published'", target_id);
  notifyCap('moderation', { icon: 'flag', title: 'Content reported', body: `${type} reported: ${clean(req.body.reason, 80)}`, link: '#/moderation' });
  res.json({ ok: true });
}));
r.get('/moderation', h((req, res) => {
  const u = req.user; const global = can(u, 'moderation');
  if (!global && !hasGrant(u, 'community_moderation')) throw forbidden('Moderation is available to authorized moderators.');
  const scope = global ? '' : `AND p.society_id = ${+u.society_id}`;
  const reports = all(`SELECT cr.*, ru.full_name reporter_name FROM content_reports cr LEFT JOIN users ru ON ru.id = cr.reporter_id WHERE cr.status = 'open' ORDER BY cr.created_at DESC LIMIT 100`).map(rep => {
    let target = null;
    if (rep.target_type === 'post') target = get(`SELECT p.id, p.body, p.title, p.status, p.society_id, u.full_name author, s.short_name society_short FROM posts p JOIN users u ON u.id = p.author_id LEFT JOIN societies s ON s.id = p.society_id WHERE p.id = ? ${scope}`, rep.target_id);
    else if (rep.target_type === 'comment') target = get(`SELECT c.id, c.body, c.status, p.society_id, u.full_name author, s.short_name society_short FROM comments c JOIN posts p ON p.id = c.post_id JOIN users u ON u.id = c.author_id LEFT JOIN societies s ON s.id = p.society_id WHERE c.id = ? ${scope}`, rep.target_id);
    else if (rep.target_type === 'message' && global) target = get('SELECT m.id, m.body, u.full_name author FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?', rep.target_id);
    else if (rep.target_type === 'user' && global) target = get('SELECT id, full_name author, title body FROM users WHERE id = ?', rep.target_id);
    return target ? { ...rep, target } : null;
  }).filter(Boolean);
  const flagged = all(`SELECT p.id, p.body, p.title, p.risk_score, p.created_at, u.full_name author, s.short_name society_short FROM posts p JOIN users u ON u.id = p.author_id LEFT JOIN societies s ON s.id = p.society_id WHERE p.status = 'flagged' ${scope} ORDER BY p.created_at DESC`);
  const n = (sql) => get(sql, daysAgo(30)).n;
  res.json({ reports, flagged, stats: { approved: n("SELECT COUNT(*) n FROM posts WHERE status = 'published' AND published_at > ?"), pending: n("SELECT COUNT(*) n FROM posts WHERE status IN ('pending_approval','scheduled') AND created_at > ?"),
    flagged: n("SELECT COUNT(*) n FROM posts WHERE status IN ('flagged','hidden','removed') AND created_at > ?") } });
}));
function moderatePost(u, postId, action) {
  const p = get('SELECT * FROM posts WHERE id = ?', postId); if (!p) throw notFound();
  if (!isModerator(u, p.society_id)) throw forbidden();
  const status = { approve: 'published', restore: 'published', keep: 'published', hide: 'hidden', remove: 'removed' }[action]; if (!status) throw bad('Unknown action.');
  run('UPDATE posts SET status = ?, published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?', status, nowISO(), nowISO(), p.id);
  if (status !== 'published') notify(p.author_id, { icon: 'flag', title: `Your post was ${status} by a moderator`, body: 'It did not meet the community guidelines. You may appeal through your Society President.', link: '#/community' });
  audit(u, 'post', p.id, `moderate_${action}`, {});
}
r.post('/posts/:id/moderate', h((req, res) => { moderatePost(req.user, int(req.params.id), req.body.action); res.json({ ok: true }); }));
r.post('/moderation/reports/:id', h((req, res) => {
  const rep = get('SELECT * FROM content_reports WHERE id = ?', int(req.params.id)); if (!rep) throw notFound();
  const action = req.body.action;
  if (rep.target_type === 'post' && ['hide', 'remove', 'keep'].includes(action)) moderatePost(req.user, rep.target_id, action);
  else if (rep.target_type === 'comment' && ['hide', 'remove'].includes(action)) {
    const c = get('SELECT c.*, p.society_id FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.id = ?', rep.target_id);
    if (!isModerator(req.user, c?.society_id)) throw forbidden();
    run("UPDATE comments SET status = 'hidden' WHERE id = ?", rep.target_id); audit(req.user, 'comment', rep.target_id, 'moderate_hide', {});
  } else if (!can(req.user, 'moderation')) throw forbidden();
  if (action === 'escalate') {
    const sid = rep.target_type === 'post' ? get('SELECT society_id FROM posts WHERE id = ?', rep.target_id)?.society_id : null;
    if (sid) run('INSERT INTO escalations(society_id, title, detail, severity, status, raised_by, assigned_to, created_at) VALUES(?,?,?,?,?,?,?,?)', sid, `Moderation escalation: ${rep.reason}`, rep.detail, 'medium', 'open', req.user.id, societyOf(sid)?.advisor_id, nowISO());
  }
  run('UPDATE content_reports SET status = ?, action = ?, decided_by = ?, decided_at = ? WHERE target_type = ? AND target_id = ? AND status = ?', action === 'keep' ? 'dismissed' : 'actioned', action, req.user.id, nowISO(), rep.target_type, rep.target_id, 'open');
  audit(req.user, 'content_report', rep.id, `resolve_${action}`, { target: `${rep.target_type}#${rep.target_id}` });
  res.json({ ok: true });
}));
r.get('/community/console', h((req, res) => {
  if (!can(req.user, 'moderation') && !can(req.user, 'portfolio.view')) throw forbidden();
  const n = (sql, ...p) => get(sql, ...p).n;
  const p30 = n("SELECT COUNT(*) n FROM posts WHERE status = 'published' AND published_at > ?", daysAgo(30));
  const p60 = n("SELECT COUNT(*) n FROM posts WHERE status = 'published' AND published_at BETWEEN ? AND ?", daysAgo(60), daysAgo(30));
  const active = all("SELECT id FROM societies WHERE status = 'active'").map(r => r.id);
  res.json({
    societies: active.length, countries: n("SELECT COUNT(DISTINCT u.country) n FROM societies s JOIN universities u ON u.id = s.university_id WHERE s.status = 'active'"),
    members: n("SELECT COUNT(*) n FROM users WHERE membership_status = 'active' AND society_id IS NOT NULL AND is_active = 1"),
    active_members: n('SELECT COUNT(DISTINCT author_id) n FROM posts WHERE published_at > ?', daysAgo(30)) + n('SELECT COUNT(DISTINCT user_id) n FROM event_rsvps WHERE checked_in_at > ?', daysAgo(30)),
    posts_30: p30, posts_delta: p60 ? Math.round(100 * (p30 - p60) / p60) : 0,
    flagged: n("SELECT COUNT(*) n FROM posts WHERE status = 'flagged'") + n("SELECT COUNT(*) n FROM content_reports WHERE status = 'open'"),
    compliance: Math.round(active.reduce((s, id) => s + societyHealth(id).handbook_pct, 0) / (active.length || 1)),
    events_month: n("SELECT COUNT(*) n FROM events WHERE status IN ('published','completed','closed') AND start_at BETWEEN ? AND ?", daysAgo(15), new Date(Date.now() + 15 * 864e5).toISOString()),
    categories: all("SELECT category, COUNT(*) n FROM posts WHERE status = 'published' AND published_at > ? GROUP BY category ORDER BY n DESC", daysAgo(30)),
    visibility: all("SELECT visibility, COUNT(*) n FROM posts WHERE status = 'published' GROUP BY visibility"),
  });
}));

// ---------------- groups ----------------
r.get('/groups', (req, res) => {
  const u = req.user;
  res.json(all(`SELECT g.*, s.short_name society_short, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) members,
      EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ?) is_member,
      (SELECT COUNT(*) FROM posts p WHERE p.group_id = g.id AND p.status = 'published') posts
    FROM groups g LEFT JOIN societies s ON s.id = g.society_id
    WHERE g.visibility = 'public' OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ?) OR (g.visibility = 'members' AND g.society_id = ?)
    ORDER BY is_member DESC, members DESC`, u.id, u.id, u.society_id || 0));
});
r.post('/groups', h((req, res) => {
  const u = req.user; const kind = ['interest', 'society', 'committee', 'programme', 'cohort'].includes(req.body.kind) ? req.body.kind : 'interest';
  if (kind !== 'interest' && !isLeadership(u, u.society_id) && !can(u, 'moderation')) throw forbidden('Only Society leadership or AASTEC staff can create official groups.');
  if (u.society_id && u.membership_status !== 'active') throw forbidden();
  const visibility = ['public', 'members', 'private'].includes(req.body.visibility) ? req.body.visibility : 'public';
  const id = Number(run('INSERT INTO groups(name, kind, society_id, visibility, description, created_by, created_at) VALUES(?,?,?,?,?,?,?)', need(clean(req.body.name, 80), 'Group name is required.'), kind, kind === 'interest' ? null : u.society_id, visibility, clean(req.body.description, 400), u.id, nowISO()).lastInsertRowid);
  run('INSERT INTO group_members(group_id, user_id, role, joined_at) VALUES(?,?,?,?)', id, u.id, 'admin', nowISO());
  audit(u, 'group', id, 'create', { name: req.body.name, kind });
  res.json({ id });
}));
r.post('/groups/:id/join', h((req, res) => {
  const g = get('SELECT * FROM groups WHERE id = ?', int(req.params.id)); if (!g) throw notFound();
  if (g.visibility === 'private') throw forbidden('This is a private group. Ask a group admin to add you.');
  if (g.visibility === 'members' && g.society_id !== req.user.society_id) throw forbidden('This group is for members of its Society.');
  run('INSERT OR IGNORE INTO group_members(group_id, user_id, role, joined_at) VALUES(?,?,?,?)', g.id, req.user.id, 'member', nowISO());
  res.json({ ok: true });
}));
r.post('/groups/:id/leave', (req, res) => { run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', int(req.params.id), req.user.id); res.json({ ok: true }); });

// ---------------- messaging ----------------
const member = (cid, uid) => get('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', cid, uid);
r.get('/conversations', (req, res) => {
  const u = req.user;
  const rows = all(`SELECT c.*, cm.last_read_at,
      (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) last_body,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)) unread
    FROM conversations c JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ? ORDER BY c.last_message_at DESC`, u.id, u.id);
  res.json(rows.map(c => {
    const members = all('SELECT u.id, u.full_name, u.title FROM conversation_members cm JOIN users u ON u.id = cm.user_id WHERE cm.conversation_id = ?', c.id).map(m => ({ ...m, initials: initials(m.full_name) }));
    const other = c.kind === 'direct' ? members.find(m => m.id !== u.id) : null;
    return { ...c, members, title: c.title || other?.full_name || 'Conversation', subtitle: other?.title || `${members.length} members`, initials: other?.initials || initials(c.title || 'G C') };
  }));
});
r.post('/conversations', h((req, res) => {
  const u = req.user; const ids = [...new Set((req.body.user_ids || []).map(int).filter(x => x && x !== u.id))];
  need(ids, 'Choose at least one person.');
  for (const id of ids) if (get('SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)', id, u.id, u.id, id)) throw forbidden('You cannot message this person.');
  if (ids.length === 1 && !req.body.title) {
    const ex = get(`SELECT c.id FROM conversations c WHERE c.kind = 'direct' AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = ?) AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = ?)`, u.id, ids[0]);
    if (ex) return res.json({ id: ex.id });
  }
  const at = nowISO();
  const id = Number(run('INSERT INTO conversations(kind, title, created_by, created_at, last_message_at) VALUES(?,?,?,?,?)', ids.length > 1 || req.body.title ? 'group' : 'direct', clean(req.body.title, 80), u.id, at, at).lastInsertRowid);
  for (const m of [u.id, ...ids]) run('INSERT INTO conversation_members(conversation_id, user_id, last_read_at) VALUES(?,?,?)', id, m, at);
  res.json({ id });
}));
r.get('/conversations/:id/messages', h((req, res) => {
  const cid = int(req.params.id); if (!member(cid, req.user.id)) throw notFound();
  const rows = all(`SELECT m.*, u.full_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.conversation_id = ? ${req.query.after ? 'AND m.created_at > ?' : ''} ORDER BY m.created_at LIMIT 300`, cid, ...(req.query.after ? [req.query.after] : []));
  run('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?', nowISO(), cid, req.user.id);
  res.json(rows.map(m => ({ ...m, initials: initials(m.full_name), mine: m.sender_id === req.user.id })));
}));
r.post('/conversations/:id/messages', h((req, res) => {
  const cid = int(req.params.id); if (!member(cid, req.user.id)) throw notFound();
  const body = need(clean(req.body.body, 3000), 'Message is empty.');
  const others = all('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?', cid, req.user.id).map(r => r.user_id);
  if (others.length === 1 && get('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', others[0], req.user.id)) throw forbidden('This person is not accepting messages from you.');
  const at = nowISO();
  run('INSERT INTO messages(conversation_id, sender_id, body, created_at) VALUES(?,?,?,?)', cid, req.user.id, body, at);
  run('UPDATE conversations SET last_message_at = ? WHERE id = ?', at, cid);
  run('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?', at, cid, req.user.id);
  res.json({ ok: true });
}));
r.post('/users/:id/block', h((req, res) => {
  const id = int(req.params.id); if (id === req.user.id) throw bad('You cannot block yourself.');
  if (get('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', req.user.id, id)) run('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', req.user.id, id);
  else run('INSERT INTO blocks VALUES(?,?,?)', req.user.id, id, nowISO());
  res.json({ blocked: !!get('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', req.user.id, id) });
}));

export default r;
