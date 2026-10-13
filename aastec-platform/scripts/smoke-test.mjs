// ===================================================================
//  Smoke test — signs in as every demo role and exercises the API.
//  Usage: start the server, then `BASE=http://localhost:4800 npm run smoke`
// ===================================================================
const BASE = process.env.BASE || 'http://localhost:4800';
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo@2026';
let failures = 0, checks = 0;

async function call(token, method, path, body) {
  const t = Date.now();
  const res = await fetch(BASE + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, ms: Date.now() - t };
}
function expect(label, cond, extra = '') { checks++; if (!cond) { failures++; console.log(`  ✗ ${label} ${extra}`); } }
async function login(email) { const r = await call(null, 'POST', '/login', { email, password: PASSWORD }); if (!r.data.token) throw new Error(`login failed for ${email}: ${JSON.stringify(r.data)}`); return r.data.token; }

const READS = ['/me', '/meta', '/dashboard', '/approvals', '/notifications', '/counts', '/feed', '/feed?scope=official', '/community/highlights', '/groups', '/conversations', '/calendar',
  '/elections', '/courses', '/learning/hub', '/learning/coach', '/learning/paths', '/certificates', '/programmes', '/mentors', '/ventures', '/handbook', '/network', '/search?q=rally', '/me/pass', '/reports', '/mentor-profile'];
const ROLE_READS = {
  'director@aastec.demo': ['/leadership', '/kpi', '/audit', '/audit/verify', '/incubator/overview', '/community/console', '/moderation', '/escalations', '/applications', '/users?limit=20'],
  'pm@aastec.demo': ['/kpi', '/incubator/overview', '/moderation', '/applications', '/elections?cycle=' + (new Date().getUTCMonth() >= 8 ? new Date().getUTCFullYear() + 1 : new Date().getUTCFullYear())],
  'president@miami.rally.demo': ['/kpi', '/auth-requests', '/grants', '/escalations?society_id=1', '/kpi/entries'],
  'advisor@miami.rally.demo': ['/supervision', '/kpi'],
  'agent@miami.rally.demo': ['/leads'],
  'admin@aastec.demo': ['/roles', '/settings', '/admin/users?q=a'],
};

const accounts = (await call(null, 'GET', '/public/demo-accounts')).data.accounts;
expect('demo accounts listed', accounts?.length >= 10);
for (const r of ['/public/overview', '/public/register-options', '/health']) { const x = await call(null, 'GET', r); expect(`public ${r}`, x.status === 200, x.status); }

for (const a of accounts) {
  const token = await login(a.email);
  const times = [];
  for (const path of [...READS, ...(ROLE_READS[a.email] || [])]) {
    const r = await call(token, 'GET', path);
    times.push([path, r.ms]);
    expect(`${a.label} GET ${path}`, r.status === 200, `→ ${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
  }
  const slow = times.filter(([, ms]) => ms > 400).map(([p, ms]) => `${p} ${ms}ms`);
  const dash = await call(token, 'GET', '/dashboard');
  console.log(`${a.label.padEnd(20)} view=${String(dash.data.view).padEnd(15)} approvals=${(await call(token, 'GET', '/approvals')).data.length}${slow.length ? '  slow: ' + slow.join(', ') : ''}`);
}

// ---------------- workflows ----------------
console.log('\nWorkflows');
const member = await login('member@miami.rally.demo');
const pres = await login('president@miami.rally.demo');
const adv = await login('advisor@miami.rally.demo');
const pm = await login('pm@aastec.demo');
const head = await login('committee@miami.rally.demo');

// personal post → published; risky post → flagged
let r = await call(member, 'POST', '/posts', { identity: 'personal', body: 'Excited to share our customer discovery results from this week with the community.', category: 'discussion' });
expect('personal post published', r.data.status === 'published', JSON.stringify(r.data));
r = await call(member, 'POST', '/posts', { identity: 'personal', body: 'Call 01012345678 now, you idiot — scam deals at bit.ly/xyz', category: 'discussion' });
expect('risky post held for moderation', r.data.status === 'flagged', JSON.stringify(r.data));
// member cannot post as society
r = await call(member, 'POST', '/posts', { identity: 'society', title: 'Test', body: 'Official announcement', scope: 'chapter' });
expect('member blocked from society identity', r.status === 403);
// president approves pending official post at the President step
const items = (await call(pres, 'GET', '/approvals')).data;
const postItem = items.find(i => i.type === 'post');
expect('president has a post to approve', !!postItem);
if (postItem) { r = await call(pres, 'POST', `/posts/${postItem.id}/decide`, { approve: true }); expect('president approves step → advances to advisor', r.data.status === 'pending_approval', JSON.stringify(r.data)); }
// advisor approves → published (external scope chain ends at advisor)
const advItems = (await call(adv, 'GET', '/approvals')).data;
const advPost = advItems.find(i => i.type === 'post' && i.id === postItem?.id);
if (advPost) { r = await call(adv, 'POST', `/posts/${advPost.id}/decide`, { approve: true }); expect('advisor approval publishes post', r.data.status === 'published', JSON.stringify(r.data)); }
// authorization request flow: president decides
const auth = items.find(i => i.type === 'authorization');
if (auth) { r = await call(pres, 'POST', `/auth-requests/${auth.id}/decide`, { approve: true, note: 'Approved' }); expect('president approves authorization', r.data.ok); }
// committee head cannot decide authorization (President only)
const another = items.find(i => i.type === 'authorization' && i.id !== auth?.id);
if (another) { r = await call(head, 'POST', `/auth-requests/${another.id}/decide`, { approve: true }); expect('committee head blocked from final approval', r.status === 403); }
// membership approval
const mem = items.find(i => i.type === 'membership');
if (mem) { r = await call(pres, 'POST', `/members/${mem.id}/membership`, { decision: 'approve' }); expect('membership approved', r.data.ok); }
// event: member proposes, president approves
r = await call(member, 'POST', '/events', { kind: 'society', title: 'Smoke Test Workshop', start_at: new Date(Date.now() + 9 * 864e5).toISOString(), category: 'workshop' });
expect('member event becomes proposal', r.data.status === 'proposed', JSON.stringify(r.data));
const evId = r.data.id;
r = await call(pres, 'POST', `/events/${evId}/decide`, { approve: true }); expect('president publishes event', r.data.status === 'published', JSON.stringify(r.data));
r = await call(member, 'POST', `/events/${evId}/rsvp`, { status: 'going' }); expect('member RSVPs', r.data.ok);
r = await call(member, 'POST', '/events', { kind: 'aastec', title: 'Not allowed', start_at: new Date(Date.now() + 9 * 864e5).toISOString() }); expect('member blocked from AASTEC events', r.status === 403);
// elections: vote in pilot election
const els = (await call(member, 'GET', '/elections')).data.rows;
const voting = els.find(e => e.status === 'voting');
expect('member sees voting election', !!voting);
if (voting) {
  const det = (await call(member, 'GET', `/elections/${voting.id}`)).data;
  expect('member eligible', det.eligibility.eligible, JSON.stringify(det.eligibility));
  const sel = {}; for (const p of det.positions) sel[p.id] = det.candidates.find(c => c.position_id === p.id && c.status === 'validated').id;
  r = await call(member, 'POST', `/elections/${voting.id}/vote`, { selections: sel }); expect('ballot cast with receipt', !!r.data.receipt, JSON.stringify(r.data));
  r = await call(member, 'POST', `/elections/${voting.id}/vote`, { selections: sel }); expect('double vote rejected', r.status === 400);
  r = await call(pm, 'POST', `/elections/${voting.id}/advance`, {}); expect('PM closes voting → tally', r.data.status === 'tally', JSON.stringify(r.data));
  const t = (await call(pm, 'GET', `/elections/${voting.id}`)).data;
  expect('PM sees tally', Array.isArray(t.results), JSON.stringify(t.results)?.slice(0, 100));
  if (!t.results?.some(p => p.tie)) { r = await call(pm, 'POST', `/elections/${voting.id}/publish`, {}); expect('results published', r.data.ok, JSON.stringify(r.data)); }
}
// advisor approves a pending election activation
const pendingEl = (await call(adv, 'GET', '/approvals')).data.find(i => i.type === 'election');
if (pendingEl) { r = await call(adv, 'POST', `/elections/${pendingEl.id}/advisor`, { approve: true }); expect('advisor approves election activation', r.data.ok); }
// real election outside the window cannot open nominations
const approved = (await call(pm, 'GET', '/elections')).data.rows.find(e => e.status === 'approved' && !e.sandbox);
if (approved) { r = await call(pm, 'POST', `/elections/${approved.id}/advance`, {}); expect('window rule enforced', r.status === 400 || r.data.status === 'nominations', JSON.stringify(r.data)); }
// learning: enroll, complete lessons, quiz, certificate
const course = (await call(member, 'GET', '/courses')).data.find(c => c.title === 'Event Management & Reporting');
await call(member, 'POST', `/courses/${course.id}/enroll`);
const cd = (await call(member, 'GET', `/courses/${course.id}`)).data;
for (const m of cd.modules) for (const l of m.lessons) await call(member, 'POST', `/lessons/${l.id}/complete`);
const quiz = (await call(member, 'GET', `/courses/${course.id}/quiz`)).data;
r = await call(member, 'POST', `/courses/${course.id}/quiz`, { answers: Object.fromEntries(quiz.map(q => [q.id, q.options.findIndex(o => /Check-ins|Faculty Advisor/.test(o))])) });
expect('quiz passed and certificate issued', r.data.passed && !!r.data.certificate, JSON.stringify(r.data).slice(0, 200));
if (r.data.certificate) { const v = await call(null, 'GET', `/public/verify/${r.data.certificate}`); expect('certificate publicly verifiable', v.data.valid); }
// AI tools (offline mode when no key)
r = await call(member, 'POST', '/ai/coach', { messages: [{ role: 'user', content: 'How can I improve my pitching?' }] }); expect('AI coach answers', !!r.data.text, JSON.stringify(r.data).slice(0, 120));
r = await call(member, 'POST', '/ai/handbook', { question: 'Who approves authorization requests?' }); expect('handbook assistant answers', /4\.\d/.test(r.data.text || ''), r.data.text?.slice(0, 120));
r = await call(pres, 'POST', '/ai/report', {}); expect('AI report draft', !!r.data.text);
// KPI entry & audit chain
r = await call(pres, 'POST', '/kpi/entries', { metric_key: 'partners', value: 12, note: 'Signed MoUs' }); expect('president reports KPI', r.data.ok, JSON.stringify(r.data));
const dir = await login('director@aastec.demo');
r = await call(dir, 'GET', '/audit/verify'); expect('audit chain intact', r.data.ok, JSON.stringify(r.data));
// RBAC: member cannot reach admin/audit
r = await call(member, 'GET', '/audit'); expect('member blocked from audit', r.status === 403);
r = await call(member, 'GET', '/supervision'); expect('member blocked from supervision', r.status === 403);

console.log(`\n${checks - failures}/${checks} checks passed${failures ? ` — ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
