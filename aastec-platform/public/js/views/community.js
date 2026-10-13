// ===================================================================
//  Community: feed, posting authorization workflow, post detail,
//  moderation console, groups and messaging
// ===================================================================
'use strict';
const REACT = { like: ['👍', 'Like'], love: ['❤️', 'Love'], celebrate: ['👏', 'Celebrate'], insightful: ['💡', 'Insightful'] };
const CATS = { announcement: ['Announcement', 'megaphone'], event: ['Event', 'calendar'], opportunity: ['Opportunity', 'briefcase'], discussion: ['Discussion', 'messages-square'], achievement: ['Achievement', 'trophy'] };
const canOfficial = () => APP.me.society_id && APP.me.membership_status === 'active' && (APP.me.leads || role('vice_president') || hasGrant('posting_official'));
const fmtBody = (t) => esc(t).replace(/(^|\s)#(\w+)/g, '$1<span class="tags">#$2</span>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener nofollow">$1</a>');

function postCard(p, { detail = false } = {}) {
  const who = p.identity === 'society' ? `<div class="row">${seal(p.society_short || '', 'xs')}<div class="who"><b>${esc(p.society_name)}</b> ${chip('Official', 'red')}<div class="s">Posted by ${esc(p.author_name)} · ${ago(p.published_at || p.created_at)} · ${ic(p.visibility === 'public' ? 'globe' : 'users', 'sm')}</div></div></div>`
    : p.identity === 'aastec' ? `<div class="row">${seal('', 'xs', true)}<div class="who"><b>AASTEC Entrepreneurship Center</b> ${chip('AASTEC', 'blue')}<div class="s">${esc(p.author_name)} · ${ago(p.published_at || p.created_at)} · ${ic('globe', 'sm')}</div></div></div>`
    : `<a class="row" href="#/profile/${p.author_id}" style="text-decoration:none">${avatar(p.author_name, p.author_id, '', p.author_avatar)}<div class="who"><b>${esc(p.author_name)}</b> ${p.author_role && p.author_role !== 'member' ? chip(cap(p.author_role), 'blue') : ''}<div class="soc">${esc(p.author_society ? 'Rally Society ' + p.author_society : (p.author_title || ''))}</div><div class="s">${ago(p.published_at || p.created_at)} · ${ic(p.visibility === 'public' ? 'globe' : 'users', 'sm')}${p.group_name ? ` · in <b>${esc(p.group_name)}</b>` : ''}</div></div></a>`;
  const top = Object.entries(p.reactions || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => REACT[k]?.[0]).join('');
  const poll = p.poll ? `<div style="padding:0 16px 10px">${p.poll.options.map((o, i) => { const tot = p.poll.counts.reduce((a, b) => a + b, 0) || 1; const pc = Math.round(100 * p.poll.counts[i] / tot); return `<div class="poll-opt ${p.poll.mine === i ? 'mine' : ''}" onclick="votePoll(${p.id},${i})">${p.poll.mine != null ? `<div class="fill" style="width:${pc}%"></div>` : ''}<span>${esc(o)}</span><span>${p.poll.mine != null ? pc + '%' : ''}</span></div>`; }).join('')}<div class="xs muted">${p.poll.counts.reduce((a, b) => a + b, 0)} votes</div></div>` : '';
  return `<div class="card post" id="post-${p.id}">${p.pinned ? `<div class="xs strong" style="padding:8px 16px 0;color:var(--gold-600)">${ic('bookmark', 'sm')} Pinned announcement</div>` : ''}
    <div class="ph"><div class="grow">${who}</div>${chip(CATS[p.category]?.[0] || cap(p.category), '', CATS[p.category]?.[1])}<button class="btn-icon tb-btn" onclick="postMenu(this,${p.id},${p.can_delete})" aria-label="More">${ic('menu', 'sm')}</button></div>
    <div class="pb">${p.title ? `<h4>${esc(p.title)}</h4>` : ''}${fmtBody(p.body)}${p.tags?.length ? `<div class="mt">${p.tags.map(t => `<span class="tags">#${esc(t)}</span>`).join(' ')}</div>` : ''}</div>
    ${p.media?.length ? `<div class="media" style="grid-template-columns:repeat(${Math.min(p.media.length, 3)},1fr)">${p.media.map(m => `<img src="${esc(m)}" alt="" loading="lazy">`).join('')}</div>` : ''}${poll}
    <div class="stats"><span>${top} ${p.reaction_total || ''}</span><span><a href="javascript:void(0)" onclick="toggleComments(${p.id})">${p.comments_count} comments</a> · ${p.share_count || 0} shares</span></div>
    <div class="pa"><div style="position:relative;flex:1;display:flex" class="react-wrap"><button class="${p.my_reaction ? 'on' : ''}" onclick="react(${p.id}, '${p.my_reaction || 'like'}')" onmouseenter="showReactPick(this,${p.id})">${p.my_reaction ? REACT[p.my_reaction][0] : ic('thumbs-up', 'sm')} ${p.my_reaction ? REACT[p.my_reaction][1] : 'Like'}</button></div>
      <button onclick="toggleComments(${p.id})">${ic('message-circle', 'sm')} Comment</button><button onclick="sharePost(${p.id})">${ic('share-2', 'sm')} Share</button><button class="${p.saved ? 'on' : ''}" onclick="savePost(${p.id},this)">${ic('bookmark', 'sm')} ${p.saved ? 'Saved' : 'Save'}</button></div>
    <div class="comments ${detail ? '' : 'hidden'}" id="cm-${p.id}"></div></div>`;
}
async function refreshPost(id) { const el = $(`#post-${id}`); if (!el) return; const p = await api(`/posts/${id}`); const open = !$(`#cm-${id}`).classList.contains('hidden'); el.outerHTML = postCard(p); if (open) toggleComments(id); }
async function react(id, kind) { await post(`/posts/${id}/react`, { kind }).catch(e => toast(e.message, 'err')); refreshPost(id); }
function showReactPick(btn, id) {
  const wrap = btn.parentElement; if ($('.react-pick', wrap)) return;
  const d = document.createElement('div'); d.className = 'react-pick'; d.innerHTML = Object.entries(REACT).map(([k, [e, l]]) => `<button title="${l}" data-k="${k}">${e}</button>`).join('');
  wrap.appendChild(d); $$('button', d).forEach(b => b.onclick = (ev) => { ev.stopPropagation(); d.remove(); react(id, b.dataset.k); });
  wrap.onmouseleave = () => setTimeout(() => d.remove(), 250);
}
async function toggleComments(id) {
  const box = $(`#cm-${id}`); if (!box) return;
  if (!box.classList.contains('hidden') && box.dataset.loaded) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden'); box.innerHTML = '<div class="small muted">Loading…</div>';
  const list = await api(`/posts/${id}/comments`); box.dataset.loaded = 1;
  box.innerHTML = list.map(c => `<div class="comment">${avatar(c.full_name, c.author_id, 'sm')}<div class="grow"><div class="bub"><a href="#/profile/${c.author_id}" class="strong small" style="color:var(--heading)">${esc(c.full_name)}</a> <span class="xs muted">${esc(c.society_short || '')}</span><div>${esc(c.body)}</div></div><div class="xs muted" style="padding:2px 8px">${ago(c.created_at)}${c.can_delete ? ` · <a href="javascript:void(0)" onclick="delComment(${c.id},${id})">Delete</a>` : ` · <a href="javascript:void(0)" onclick="reportContent('comment',${c.id})">Report</a>`}</div></div></div>`).join('')
    + `<form class="row" onsubmit="addComment(event,${id})">${avatar(APP.me.full_name, APP.me.id, 'sm', APP.me.avatar_url)}<input class="input" placeholder="Write a comment…" required><button class="btn btn-primary btn-sm">${ic('send', 'sm')}</button></form>`;
}
async function addComment(e, id) { e.preventDefault(); const inp = $('input', e.target); await guard($('button', e.target), async () => { await post(`/posts/${id}/comments`, { body: inp.value }); await refreshPost(id); toggleComments(id); }); }
async function delComment(cid, pid) { await del(`/comments/${cid}`); refreshPost(pid); }
async function savePost(id, btn) { const r = await post(`/posts/${id}/save`); btn.classList.toggle('on', r.saved); btn.innerHTML = `${ic('bookmark', 'sm')} ${r.saved ? 'Saved' : 'Save'}`; }
async function sharePost(id) { const url = `${location.origin}/portal#/post/${id}`; try { await navigator.clipboard.writeText(url); toast('Link copied — share it with your network.'); } catch { prompt('Copy this link:', url); } post(`/posts/${id}/share`).catch(() => {}); }
async function votePoll(id, opt) { await post(`/posts/${id}/vote`, { option: opt }).catch(e => toast(e.message, 'err')); refreshPost(id); }
function postMenu(btn, id, canDelete) {
  toggleDrop(btn, `<a href="#/post/${id}">${ic('eye', 'sm')} Open post</a><button onclick="sharePost(${id})">${ic('link', 'sm')} Copy link</button><button onclick="reportContent('post',${id})">${ic('flag', 'sm')} Report post</button>${canDelete ? `<div class="sep"></div><button onclick="deletePost(${id})" style="color:var(--red)">${ic('trash-2', 'sm')} Delete</button>` : ''}`);
}
async function deletePost(id) { $('.dropdown')?.remove(); if (!await confirmBox('Remove this post? This is recorded in the audit log.', { danger: true, ok: 'Remove' })) return; await del(`/posts/${id}`); toast('Post removed.'); $(`#post-${id}`)?.remove(); }
async function reportContent(type, id) {
  $('.dropdown')?.remove();
  const m = modal({ title: 'Report content', icon: 'flag', body: `<p class="small muted mb">Reports are reviewed by community moderators. Content reported by three or more members is hidden automatically pending review.</p><div class="field"><label>Reason</label><select id="rp-r">${['Harassment or hate', 'Spam or scam', 'Academic misconduct', 'Personal data exposed', 'Misuse of Society identity', 'Off-topic content', 'Other'].map(r => `<option>${r}</option>`).join('')}</select></div><div class="field"><label>Details</label><textarea id="rp-d"></textarea></div>`,
    foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger" id="rp-go">${ic('flag', 'sm')} Report</button>` });
  $('#rp-go', m).onclick = (e) => guard(e.currentTarget, async () => { await post('/content-reports', { target_type: type, target_id: id, reason: $('#rp-r', m).value, detail: $('#rp-d', m).value }); m.close(); toast('Thank you — moderators will review this.'); });
}

// ---------------- Feed ----------------
ROUTES.community = async (view, sub, arg) => {
  if (sub === 'compose') return renderComposer(view, arg);
  const scope = sub || 'all';
  const [hl, groups, upcoming] = await Promise.all([api('/community/highlights'), api('/groups'), api(`/calendar?from=${new Date().toISOString()}&to=${new Date(Date.now() + 30 * 864e5).toISOString()}`)]);
  let filter = { scope, category: '', society: '' }; let next = null;
  view.innerHTML = `<div class="feed-layout"><div>
    ${pageHead('Community Home', 'Connect. Collaborate. Create impact.', `${can('moderation') ? `<a class="btn btn-ghost" href="#/moderation">${ic('flag')} Moderation</a>` : ''}<a class="btn btn-ghost" href="#/groups">${ic('users-round')} Groups</a>`)}
    <div class="stories"><div class="story ${!filter.society ? 'active' : ''}" data-s=""><div class="ring">${avatar(APP.me.full_name, APP.me.id, 'lg', APP.me.avatar_url)}</div><span>All</span></div>
      <div class="story" data-scope="aastec"><div class="ring">${seal('', 'lg', true)}</div><span>AASTEC</span></div>${hl.map(s => `<div class="story" data-s="${s.id}"><div class="ring">${seal(s.short_name, 'lg')}</div><span class="ellipsis" style="width:66px">${esc(s.short_name)}</span></div>`).join('')}</div>
    <div class="card composer mb-l"><div class="row">${avatar(APP.me.full_name, APP.me.id, '', APP.me.avatar_url)}<button class="ta" onclick="location.hash='#/community/compose'">What's on your mind, ${esc(APP.me.full_name.split(' ')[0])}?</button></div>
      <div class="acts"><button onclick="location.hash='#/community/compose/photo'">${ic('image', 'sm')} Photo</button><button onclick="location.hash='#/calendar/new'">${ic('calendar', 'sm')} Event</button><button onclick="location.hash='#/community/compose/poll'">${ic('chart-column', 'sm')} Poll</button><button onclick="location.hash='#/community/compose/achievement'">${ic('trophy', 'sm')} Achievement</button></div></div>
    <div class="row between mb wrap"><div class="seg" id="fs">${[['all', 'All'], ['society', 'My Society'], ['official', 'Official'], ['following', 'Following'], ['saved', 'Saved'], ['mine', 'My posts']].filter(([k]) => k !== 'society' || APP.me.society_id).map(([k, l]) => `<button data-s="${k}" class="${k === scope ? 'active' : ''}">${l}</button>`).join('')}</div>
      <select class="input" id="fc" style="width:auto"><option value="">All categories</option>${Object.entries(CATS).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
    <div id="feed" class="col gap-l"></div><div class="center mt"><button class="btn btn-ghost hidden" id="more">Load more</button></div></div>
    <aside class="col">
      ${APP.me.society_id ? `<div class="card navy"><div class="row">${seal(APP.me.society_short || '')}<div><h3 style="font-size:15px">${esc(APP.me.society_name)}</h3><div class="small muted">Your Rally Society chapter</div></div></div><a class="btn btn-gold btn-sm btn-block mt" href="#/community/society">View chapter feed</a></div>` : ''}
      ${card('Posting rules', 'shield-check', `<div class="list">${[['Personal posts', 'All verified members · moderation applies', 'green'], ['Official Society posts', 'President-authorized publishers', 'red'], ['AASTEC posts', 'Authorized AASTEC staff only', 'blue']].map(([t, d, c]) => `<div class="li top"><span class="dot-st ${c}" style="margin-top:6px"></span><div><div class="small strong">${t}</div><div class="xs muted">${d}</div></div></div>`).join('')}</div>${!canOfficial() && APP.me.society_id ? `<button class="btn btn-sm btn-soft btn-block mt" onclick="requestAuthorization()">Request official posting</button>` : ''}`)}
      ${card('Upcoming events', 'calendar-days', upcoming.events.filter(e => !e.virtual).slice(0, 4).map(e => `<div class="li click" onclick="location.hash='#/calendar/${e.id}'">${dateTile(e.start_at)}<div class="grow"><div class="t ellipsis">${esc(e.title)}</div><div class="s">${esc(e.society_short || 'AASTEC')}</div></div></div>`).join('') || empty('No events', 'calendar'), { link: '#/calendar' })}
      ${card('Groups', 'users-round', groups.slice(0, 5).map(g => `<a class="li click" href="#/groups/${g.id}" style="text-decoration:none">${ic('users-round', 'sm')}<div class="grow"><div class="t ellipsis">${esc(g.name)}</div><div class="s">${g.members} members</div></div>${g.is_member ? chip('Joined', 'green') : ''}</a>`).join(''), { link: '#/groups' })}
    </aside></div>`;
  const load = async (append = false) => {
    const q = new URLSearchParams({ scope: filter.scope, limit: 10 }); if (filter.category) q.set('category', filter.category); if (filter.society) q.set('society_id', filter.society); if (append && next) q.set('before', next);
    const r = await api('/feed?' + q);
    next = r.next; const html = r.posts.map(p => postCard(p)).join('');
    if (append) $('#feed').insertAdjacentHTML('beforeend', html); else $('#feed').innerHTML = html || card('No posts yet', 'message-square', empty('Be the first to share something with the community.', 'message-square'));
    $('#more').classList.toggle('hidden', !next);
  };
  $$('#fs button').forEach(b => b.onclick = () => { $$('#fs button').forEach(x => x.classList.toggle('active', x === b)); filter.scope = b.dataset.s; filter.society = ''; load(); });
  $('#fc').onchange = (e) => { filter.category = e.target.value; load(); };
  $$('.story').forEach(s => s.onclick = () => { $$('.story').forEach(x => x.classList.toggle('active', x === s)); if (s.dataset.scope) { filter.scope = 'aastec'; filter.society = ''; } else { filter.scope = 'all'; filter.society = s.dataset.s; } load(); });
  $('#more').onclick = () => load(true);
  load();
};
ROUTES.post = async (view, id) => {
  const p = await api(`/posts/${id}`);
  const steps = p.steps || [];
  view.innerHTML = pageHead('Post', `${status(p.status)} ${p.risk_score != null ? chip(`Risk score ${p.risk_score}/100`, p.risk_score >= 60 ? 'red' : p.risk_score >= 30 ? 'amber' : 'green') : ''}`, `<a class="btn btn-ghost" href="#/community">${ic('arrow-left')} Community</a>`) + `
    <div class="grid g-side"><div>${p.status === 'published' ? postCard(p, { detail: true }) : `<div class="card"><div class="row">${avatar(p.author_name, p.author_id)}<div><b>${esc(p.author_name)}</b><div class="xs muted">${p.identity === 'society' ? esc(p.society_name) : 'Personal'} · ${fmtDT(p.created_at)}</div></div></div>${p.title ? `<h3 class="mt">${esc(p.title)}</h3>` : ''}<p class="mt" style="white-space:pre-wrap">${fmtBody(p.body)}</p>${p.media?.length ? `<div class="media mt" style="display:grid;gap:4px;grid-template-columns:repeat(${Math.min(p.media.length, 3)},1fr)">${p.media.map(m => `<img src="${esc(m)}" style="width:100%;border-radius:10px">`).join('')}</div>` : ''}</div>`}</div>
    <aside class="col">${steps.length ? card('Approval workflow', 'workflow', `<div class="vsteps">${steps.map(s => `<div class="vs ${s.status}"><div class="n">${s.status === 'approved' ? ic('check', 'sm') : s.status === 'rejected' ? ic('x', 'sm') : s.step}</div><div class="grow"><div class="row between"><b class="small">${esc(s.label)}</b>${status(s.status === 'waiting' ? 'not_started' : s.status)}</div>${s.approver_name ? `<div class="xs muted">${esc(s.approver_name)}${s.approver_title ? ' · ' + esc(s.approver_title) : ''}</div>` : `<div class="xs muted">${s.role_key === 'aastec' ? 'AASTEC national approval' : ''}</div>`}${s.note ? `<div class="xs mt" style="color:var(--blue)">“${esc(s.note)}”</div>` : ''}${s.decided_at ? `<div class="xs faint">${fmtDT(s.decided_at)}</div>` : ''}</div></div>`).join('')}</div>
      ${p.can_decide ? `<div class="row mt"><button class="btn btn-success grow" onclick="decide('post',${p.id},true,this)">${ic('check', 'sm')} Approve</button><button class="btn btn-danger" onclick="decide('post',${p.id},false,this)">Reject</button></div>` : ''}`) : ''}
      ${p.risk_checks?.length ? card('Policy & risk check', 'shield-check', `<div class="list">${p.risk_checks.map(c => `<div class="row small" style="padding:3px 0"><span style="color:${c.ok ? 'var(--green)' : 'var(--red)'}">${ic(c.ok ? 'circle-check' : 'circle-x', 'sm')}</span><span class="grow">${esc(c.label)}${c.note ? `<div class="xs muted">${esc(c.note)}</div>` : ''}</span></div>`).join('')}</div>`) : ''}
      ${p.audit?.length ? card('Audit trail', 'history', `<div class="vsteps">${p.audit.map(a => `<div class="vs approved"><div class="n" style="width:12px;height:12px;margin:6px 8px 0 8px"></div><div><div class="small strong">${esc(cap(a.action))}</div><div class="xs muted">by ${esc(a.actor_name)} · ${fmtDT(a.created_at)}</div></div></div>`).join('')}</div>`) : ''}</aside></div>`;
};

// ---------------- Compose / posting authorization workflow ----------------
async function renderComposer(view, preset) {
  const official = canOfficial(); const aastec = can('posts.aastec');
  const groups = (await api('/groups')).filter(g => g.is_member);
  const st = { identity: 'personal', media: [], poll: preset === 'poll', risk: null };
  view.innerHTML = pageHead('Create post', 'Compose, choose your audience, run the policy & risk check and follow the approval workflow', `<a class="btn btn-ghost" href="#/community">${ic('x')} Cancel</a>`, 'square-pen') + `
    <div class="grid g-12 mb-l">
      <div class="card span-12" style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center">
        <div class="row">${ic('users', 'xl')}<div><b style="color:var(--green)">Community post (normal)</b><div class="small muted">General updates, photos, event recaps and member achievements. Publishes under community rules.</div>${chip('Auto-publish', 'green')}</div></div><b class="muted">OR</b>
        <div class="row">${ic('shield-alert', 'xl')}<div><b style="color:var(--orange)">Official / sensitive post</b><div class="small muted">Announcements, external audiences, partnerships, media or brand-sensitive content.</div>${chip('Multi-level approval', 'amber')}</div></div></div></div>
    <form id="cf" class="grid g-12">
      <div class="span-4 card"><h3 class="mb">${chip('1', 'solid-navy')} Compose post</h3>
        <div class="field"><label>Post as</label><select name="identity" id="c-id"><option value="personal">Personal — ${esc(APP.me.full_name)}</option>${official ? `<option value="society">Rally Society - ${esc(APP.me.society_short)} (official)</option>` : ''}${aastec ? '<option value="aastec">AASTEC Entrepreneurship Center</option>' : ''}</select>${!official && APP.me.society_id ? `<div class="hint">Official Society posting requires President authorization. <a href="javascript:void(0)" onclick="requestAuthorization()">Request it</a>.</div>` : ''}</div>
        <div class="field"><label>Category</label><select name="category">${Object.entries(CATS).map(([k, [l]]) => `<option value="${k}" ${preset === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>Title <span class="muted" id="c-treq">(optional)</span></label><input name="title" id="c-title"></div>
        <div class="field"><label>Content *</label><textarea name="body" id="c-body" style="min-height:150px" required placeholder="Share an update, insight or achievement…"></textarea></div>
        <div class="field"><label>Media</label><input type="file" id="c-file" accept="image/png,image/jpeg,image/webp,image/gif" multiple class="hidden"><button type="button" class="btn btn-ghost btn-block" onclick="$('#c-file').click()">${ic('upload', 'sm')} Upload images (max 4 MB each)</button><div class="row wrap mt" id="c-thumbs"></div></div>
        <div class="field"><label class="row" style="gap:8px"><input type="checkbox" id="c-poll" ${st.poll ? 'checked' : ''}> Add a poll</label><div id="c-polls" class="${st.poll ? '' : 'hidden'}">${[1, 2, 3, 4].map(i => `<input class="input mb" data-opt placeholder="Option ${i}">`).join('')}</div></div>
        <div class="field"><label>Tags</label><input name="tags" placeholder="Workshop, Entrepreneurship, AASTEC"></div></div>
      <div class="span-4 col">
        <div class="card"><h3 class="mb">${chip('2', 'solid-navy')} Target audience</h3>
          ${[['public', 'all', 'All members (public)', 'Visible to all platform members'], ['society', 'chapter', 'Chapter members only', 'Your Society members'], ['public', 'university', 'University students', 'Your university community'], ['public', 'partners', 'Partners & guests', 'External partners and guests']].map(([v, a, l, d], i) => `<label class="choice row mb ${i === 0 ? 'on' : ''}" data-aud><input type="radio" name="aud" value="${v}|${a}" ${i === 0 ? 'checked' : ''}><div><b class="small">${l}</b><div class="xs muted">${d}</div></div></label>`).join('')}
          ${groups.length ? `<div class="field"><label>Or post in a group</label><select name="group_id"><option value="">—</option>${groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></div>` : ''}
          <div id="c-scope-box" class="hidden"><div class="field"><label>Approval scope</label><select name="scope" id="c-scope"><option value="chapter">Chapter — Society members and community</option><option value="external">External — university-wide, partners or guests</option><option value="national">National — national visibility or partnership</option></select></div>
          <div class="field check"><input type="checkbox" name="sensitive" id="c-sens"><label for="c-sens">Contains partnership, sponsorship, budget or media commitments</label></div></div></div>
        <div class="card"><h3 class="mb">${chip('3', 'solid-navy')} Policy & risk check</h3><div id="c-risk" class="small muted">Start writing to run the automated check.</div></div></div>
      <div class="span-4 col">
        <div class="card"><h3 class="mb">${chip('4', 'solid-navy')} Approval workflow</h3><div id="c-flow"></div></div>
        <div class="card"><h3 class="mb">${ic('calendar-clock')} Publish schedule</h3><div class="field check"><input type="checkbox" id="c-now" checked><label for="c-now">Post now (immediately after final approval)</label></div><div class="field hidden" id="c-when"><label>Publish at</label><input type="datetime-local" id="c-at"></div></div>
        <button class="btn btn-primary btn-lg btn-block" type="submit" id="c-go">${ic('send')} Publish</button>
        <p class="xs muted center">All official posts and approvals are recorded in the immutable audit trail.</p></div>
    </form>`;
  const isOfficial = () => $('#c-id').value === 'society';
  const flow = () => {
    const sc = $('#c-scope')?.value || 'chapter', sens = $('#c-sens')?.checked, risky = (st.risk?.score || 0) >= (APP.meta.settings.risk_threshold || 60);
    let steps = [];
    if ($('#c-id').value === 'personal') steps = [['Automated policy check', 'Auto-publish under community rules']];
    else if ($('#c-id').value === 'aastec') steps = [['AASTEC staff authority', 'Publishes immediately under the AASTEC identity']];
    else if (!sens && sc === 'chapter' && !risky) steps = [['Authorized publisher', 'Normal chapter post — publishes immediately']];
    else {
      if (APP.me.committee_id && !APP.me.is_committee_head && !APP.me.leads && !role('vice_president')) steps.push(['Committee Head review', 'Your Committee Head reviews first']);
      steps.push(['President approval', APP.me.leads ? 'Auto-approved — you hold President authority' : 'Final operational approval']);
      if (sens || sc !== 'chapter') steps.push(['Faculty Advisor approval', 'Required for sensitive, external or board posts']);
      if (sc === 'national') steps.push(['AASTEC approval', 'Required for national visibility and partnerships']);
    }
    $('#c-flow').innerHTML = `<div class="vsteps">${steps.map(([t, d], i) => `<div class="vs ${i === 0 ? 'pending' : ''}"><div class="n">${i + 1}</div><div><b class="small">${t}</b><div class="xs muted">${d}</div></div></div>`).join('')}</div>`;
    $('#c-go').innerHTML = `${ic('send')} ${steps.length > 1 || (isOfficial() && steps[0][0] !== 'Authorized publisher') ? 'Submit for approval' : 'Publish'}`;
  };
  let rt = null;
  const risk = () => { clearTimeout(rt); rt = setTimeout(async () => {
    const body = $('#c-body').value, title = $('#c-title').value; if (!body.trim()) { $('#c-risk').innerHTML = 'Start writing to run the automated check.'; return; }
    st.risk = await post('/posts/risk-check', { body, title, identity: $('#c-id').value, media: st.media });
    const tone = st.risk.level === 'low' ? 'green' : st.risk.level === 'medium' ? 'amber' : 'red';
    $('#c-risk').innerHTML = `<div class="list">${st.risk.checks.map(c => `<div class="row small" style="padding:3px 0;color:var(--text)"><span style="color:${c.ok ? 'var(--green)' : 'var(--red)'}">${ic(c.ok ? 'circle-check' : 'circle-x', 'sm')}</span><span class="grow">${esc(c.label)}${c.note ? `<div class="xs muted">${esc(c.note)}</div>` : ''}</span></div>`).join('')}</div>
      <div class="card surface tight mt"><div class="row between"><span class="small">Risk score <b style="color:var(--${tone === 'green' ? 'green' : tone === 'amber' ? 'amber' : 'red'})">● ${cap(st.risk.level)} risk</b></span><b>${st.risk.score}/100</b></div>${bar(st.risk.score, tone)}</div>
      ${st.risk.sensitive_hint && isOfficial() && !$('#c-sens').checked ? `<div class="banner warn small mt" style="margin-bottom:0">${ic('info', 'sm')}This looks sensitive — consider marking it so the Faculty Advisor reviews it.</div>` : ''}`;
    flow();
  }, 350); };
  $('#c-id').onchange = () => { $('#c-scope-box').classList.toggle('hidden', !isOfficial()); $('#c-treq').textContent = isOfficial() ? '(required for official posts)' : '(optional)'; flow(); risk(); };
  ['c-body', 'c-title'].forEach(x => $('#' + x).oninput = risk);
  $('#c-scope').onchange = flow; $('#c-sens').onchange = flow;
  $$('[data-aud]').forEach(l => l.onclick = () => $$('[data-aud]').forEach(x => x.classList.toggle('on', x === l)));
  $('#c-poll').onchange = (e) => $('#c-polls').classList.toggle('hidden', !e.target.checked);
  $('#c-now').onchange = (e) => $('#c-when').classList.toggle('hidden', e.target.checked);
  $('#c-file').onchange = async (e) => {
    for (const f of [...e.target.files].slice(0, 4 - st.media.length)) {
      if (f.size > 4e6) { toast(`${f.name} is larger than 4 MB.`, 'err'); continue; }
      const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
      const u = await post('/uploads', { data }).catch(er => toast(er.message, 'err')); if (u) st.media.push(u.url);
    }
    $('#c-thumbs').innerHTML = st.media.map(m => `<img src="${esc(m)}" style="width:64px;height:64px;object-fit:cover;border-radius:8px">`).join('');
  };
  if (preset === 'photo') setTimeout(() => $('#c-file').click(), 200);
  flow();
  $('#cf').onsubmit = (e) => {
    e.preventDefault(); const f = formData(e.target); const [visibility, audience] = (f.aud || 'public|all').split('|');
    const body = { identity: f.identity, category: f.category, title: f.title, body: f.body, tags: f.tags, media: st.media, visibility, audience, group_id: f.group_id || null, scope: isOfficial() ? f.scope : 'chapter', sensitive: $('#c-sens').checked,
      poll: $('#c-poll').checked ? { options: $$('[data-opt]').map(i => i.value.trim()).filter(Boolean) } : null, publish_at: $('#c-now').checked ? null : fromLocalInput($('#c-at').value) };
    if (isOfficial() && !body.title) return toast('Official posts need a title.', 'err');
    guard($('#c-go'), async () => {
      const r = await post('/posts', body);
      const msg = { published: 'Your post is published.', pending_approval: 'Submitted — your post is in the approval workflow.', flagged: 'Your post was held for moderator review because of the risk check.', scheduled: 'Your post is scheduled.' }[r.status];
      toast(msg, r.status === 'flagged' ? 'err' : 'ok'); location.hash = r.status === 'pending_approval' || r.status === 'flagged' ? `#/post/${r.id}` : '#/community';
    });
  };
}

// ---------------- Moderation console ----------------
ROUTES.moderation = async (view) => {
  const [q, c] = await Promise.all([api('/moderation'), can('moderation') || can('portfolio.view') ? api('/community/console') : Promise.resolve(null)]);
  view.innerHTML = pageHead('Community Management Console', 'Governance. Engagement. Impact.', updated(), 'flag') + (c ? `<div class="kpis">
      ${kpi({ icon: 'landmark', tone: 'navy', label: 'Total Societies', value: c.societies, meta: `Across ${c.countries} countries` })}${kpi({ icon: 'users', tone: 'blue', label: 'Active members', value: num(c.members), meta: `${num(c.active_members)} active in 30 days` })}
      ${kpi({ icon: 'file-text', tone: 'gold', label: 'Posts this month', value: c.posts_30, meta: `<span class="${c.posts_delta >= 0 ? 'up' : 'down'}">${c.posts_delta >= 0 ? '+' : ''}${c.posts_delta}%</span> vs previous 30 days` })}
      ${kpi({ icon: 'triangle-alert', tone: 'red', label: 'Flagged items', value: c.flagged, meta: 'Needs review' })}${kpi({ icon: 'shield-check', tone: 'green', label: 'Compliance rate', value: c.compliance + '%', meta: 'Handbook acknowledgement' })}${kpi({ icon: 'calendar-days', tone: 'purple', label: 'Events this month', value: c.events_month })}</div>` : '') + `
    <div class="grid g-12"><div class="span-8 col">
      ${card('Flagged & held posts', 'flag', q.flagged.length ? q.flagged.map(p => `<div class="card surface tight mb"><div class="row between"><div class="small"><b>${esc(p.author)}</b> · ${esc(p.society_short || '')} · ${ago(p.created_at)}</div>${chip(`Risk ${p.risk_score}/100`, p.risk_score >= 60 ? 'red' : 'amber')}</div><p class="small mt">${esc(p.title ? p.title + ' — ' : '')}${esc(p.body)}</p>
        <div class="row mt"><button class="btn btn-xs btn-success" onclick="moderate(${p.id},'approve',this)">Approve & publish</button><button class="btn btn-xs btn-ghost" onclick="moderate(${p.id},'hide',this)">Hide</button><button class="btn btn-xs btn-danger" onclick="moderate(${p.id},'remove',this)">Remove</button></div></div>`).join('') : empty('No flagged posts', 'shield-check'), { count: q.flagged.length || null })}
      ${card('Reported content', 'inbox', q.reports.length ? q.reports.map(r => `<div class="card surface tight mb"><div class="row between"><div class="small">${chip(cap(r.target_type), 'navy')} <b>${esc(r.reason)}</b> · reported by ${esc(r.reporter_name || 'member')} · ${ago(r.created_at)}</div></div>
        <div class="small mt"><b>${esc(r.target.author || '')}</b>${r.target.society_short ? ` · ${esc(r.target.society_short)}` : ''}: ${esc((r.target.title ? r.target.title + ' — ' : '') + (r.target.body || ''))}</div>${r.detail ? `<div class="xs muted mt">“${esc(r.detail)}”</div>` : ''}
        <div class="row mt"><button class="btn btn-xs btn-ghost" onclick="resolveReport(${r.id},'keep',this)">Keep</button><button class="btn btn-xs btn-ghost" onclick="resolveReport(${r.id},'hide',this)">Hide</button><button class="btn btn-xs btn-danger" onclick="resolveReport(${r.id},'remove',this)">Remove</button><button class="btn btn-xs btn-soft" onclick="resolveReport(${r.id},'escalate',this)">Escalate to Advisor</button></div></div>`).join('') : empty('No open reports', 'inbox'), { count: q.reports.length || null })}</div>
      <div class="span-4 col">${card('Moderation status (30 days)', 'chart-pie', `<div style="height:200px"><canvas id="c-mod"></canvas></div>`)}
        ${c ? card('Content categories', 'layers', `<div class="list">${c.categories.map(x => `<div class="li"><span class="grow small">${ic(CATS[x.category]?.[1] || 'file-text', 'sm')} ${esc(CATS[x.category]?.[0] || cap(x.category))}</span><b>${x.n}</b></div>`).join('')}</div>`) : ''}
        ${c ? card('Visibility settings', 'eye', `<div class="list">${[['public', 'Public (all members)', 'globe'], ['society', 'Society (members only)', 'users'], ['admins', 'Private (admins only)', 'lock']].map(([k, l, i]) => `<div class="li">${ic(i, 'sm')}<span class="grow small">${l}</span><b>${c.visibility.find(v => v.visibility === k)?.n || 0}</b></div>`).join('')}</div>`) : ''}
        ${card('Moderation workflow', 'workflow', `<div class="vsteps">${['Create post / comment', 'Automated validation & filters', 'Publish to scoped community', 'Member reports content', 'Moderator triage', 'Keep / hide / remove / escalate', 'Appeal & review', 'Audit record & analytics'].map((t, i) => `<div class="vs"><div class="n">${i + 1}</div><div class="small">${t}</div></div>`).join('')}</div>`)}</div></div>`;
  chart($('#c-mod'), { type: 'doughnut', data: { labels: ['Approved', 'Pending', 'Flagged'], datasets: [{ data: [q.stats.approved, q.stats.pending, q.stats.flagged], backgroundColor: ['#16A34A', '#F2B91E', '#DC2626'], borderWidth: 0 }] }, options: { cutout: '64%', plugins: { legend: { position: 'right' } } } });
};
async function moderate(id, action, btn) { await guard(btn, async () => { await post(`/posts/${id}/moderate`, { action }); toast('Moderation action recorded.'); route(); }); }
async function resolveReport(id, action, btn) { await guard(btn, async () => { await post(`/moderation/reports/${id}`, { action }); toast(action === 'escalate' ? 'Escalated to the Faculty Advisor.' : 'Report resolved.'); route(); }); }

// ---------------- Groups ----------------
ROUTES.groups = async (view, id) => {
  const groups = await api('/groups');
  if (id) {
    const g = groups.find(x => x.id === +id); if (!g) { view.innerHTML = empty('Group not found or private'); return; }
    const feed = await api(`/feed?group_id=${g.id}&limit=20`);
    view.innerHTML = pageHead(g.name, `${esc(g.description || '')} · ${g.members} members · ${cap(g.visibility)}`, `<a class="btn btn-ghost" href="#/groups">${ic('arrow-left')} Groups</a>${g.is_member ? `<button class="btn btn-ghost" onclick="groupAct(${g.id},'leave',this)">Leave</button><button class="btn btn-primary" id="gp">${ic('square-pen')} Post in group</button>` : `<button class="btn btn-primary" onclick="groupAct(${g.id},'join',this)">${ic('user-plus')} Join group</button>`}`)
      + `<div class="col gap-l" style="max-width:760px">${feed.posts.map(p => postCard(p)).join('') || card('No posts yet', 'message-square', empty('Start the conversation in this group.'))}</div>`;
    $('#gp')?.addEventListener('click', () => {
      const m = modal({ title: `Post in ${g.name}`, icon: 'square-pen', body: `<textarea class="input" id="gp-b" style="min-height:140px" placeholder="Share with the group…"></textarea>`, foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="gp-go">Post</button>` });
      $('#gp-go', m).onclick = (e) => guard(e.currentTarget, async () => { await post('/posts', { identity: 'personal', body: $('#gp-b', m).value, group_id: g.id, visibility: 'public' }); m.close(); route(); });
    });
    return;
  }
  const kinds = { society: 'Society', committee: 'Committee', programme: 'Programme', cohort: 'Cohort', interest: 'Interest' };
  view.innerHTML = pageHead('Groups', 'Society, committee, programme, incubator cohort and interest groups', `<button class="btn btn-primary" id="ng">${ic('plus')} New group</button>`, 'users-round') + `<div class="grid g-auto">${groups.map(g => `<div class="card"><div class="row between">${chip(kinds[g.kind] || cap(g.kind), g.kind === 'interest' ? 'blue' : 'navy')}${chip(cap(g.visibility), '', g.visibility === 'public' ? 'globe' : 'lock')}</div>
    <a href="#/groups/${g.id}"><h3 class="mt" style="font-size:15px">${esc(g.name)}</h3></a><p class="small muted">${esc(g.description || '')}</p><div class="row between mt"><span class="small muted">${ic('users', 'sm')} ${g.members} · ${ic('message-square', 'sm')} ${g.posts}</span>
    ${g.is_member ? `<a class="btn btn-sm btn-soft" href="#/groups/${g.id}">Open</a>` : `<button class="btn btn-sm btn-primary" onclick="groupAct(${g.id},'join',this)">Join</button>`}</div></div>`).join('')}</div>`;
  $('#ng').onclick = () => {
    const m = modal({ title: 'New group', icon: 'users-round', body: `<form id="ngf"><div class="field"><label>Name *</label><input name="name" required></div><div class="field"><label>Type</label><select name="kind"><option value="interest">Interest group</option>${APP.me.leads || can('moderation') ? '<option value="society">Society group</option><option value="committee">Committee group</option>' : ''}</select></div><div class="field"><label>Visibility</label><select name="visibility"><option value="public">Public</option><option value="members">Society members</option><option value="private">Private</option></select></div><div class="field"><label>Description</label><textarea name="description"></textarea></div></form>`,
      foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="nggo">Create</button>` });
    $('#nggo', m).onclick = (e) => guard(e.currentTarget, async () => { const r = await post('/groups', formData($('#ngf', m))); m.close(); location.hash = `#/groups/${r.id}`; });
  };
};
async function groupAct(id, act, btn) { await guard(btn, async () => { await post(`/groups/${id}/${act}`); toast(act === 'join' ? 'You joined the group.' : 'You left the group.'); route(); }); }

// ---------------- Messages ----------------
ROUTES.messages = async (view, id) => {
  const convs = await api('/conversations');
  const active = id ? +id : convs[0]?.id;
  view.innerHTML = pageHead('Messages', 'Direct and group conversations', `<button class="btn btn-primary" id="nm">${ic('square-pen')} New message</button>`, 'mail') + `<div class="card chat"><div class="convs">${convs.map(c => `<div class="conv ${c.id === active ? 'active' : ''}" onclick="location.hash='#/messages/${c.id}'">${c.kind === 'group' ? `<span class="av c2">${ic('users', 'sm')}</span>` : avatar(c.title, c.members.find(m => m.id !== APP.me.id)?.id)}<div class="grow" style="min-width:0"><div class="row between"><b class="small ellipsis">${esc(c.title)}</b><span class="xs muted">${ago(c.last_message_at)}</span></div><div class="xs muted ellipsis">${esc(c.last_body || c.subtitle)}</div></div>${c.unread ? `<span class="chip solid-navy">${c.unread}</span>` : ''}</div>`).join('') || empty('No conversations yet', 'mail')}</div>
    <div class="thread">${active ? `<div class="row between" style="padding:12px 16px;border-bottom:1px solid var(--line)"><div><b>${esc(convs.find(c => c.id === active)?.title || '')}</b><div class="xs muted">${esc(convs.find(c => c.id === active)?.members.map(m => m.full_name).join(', ') || '')}</div></div><div class="row">${convs.find(c => c.id === active)?.kind === 'direct' ? `<button class="btn btn-xs btn-ghost" onclick="blockUser(${convs.find(c => c.id === active).members.find(m => m.id !== APP.me.id)?.id})">${ic('ban', 'sm')} Block</button>` : ''}</div></div>
      <div class="msgs" id="msgs"></div><form class="send" id="sf"><input class="input" id="sm" placeholder="Type a message…" autocomplete="off"><button class="btn btn-primary">${ic('send', 'sm')}</button></form>` : `<div class="empty" style="margin:auto">${ic('mail')}<div>Select or start a conversation</div></div>`}</div></div>`;
  $('#nm').onclick = newConversation;
  if (!active) return;
  let last = null;
  const load = async () => {
    const list = await api(`/conversations/${active}/messages${last ? `?after=${encodeURIComponent(last)}` : ''}`);
    if (!list.length) return; last = list[list.length - 1].created_at;
    const box = $('#msgs'); if (!box) return;
    box.insertAdjacentHTML('beforeend', list.map(m => `<div class="msg ${m.mine ? 'mine' : ''}">${m.mine ? '' : `<div class="xs strong">${esc(m.full_name)}</div>`}${esc(m.body)}<div class="meta">${fmtTime(m.created_at)}${m.mine ? '' : ` · <a href="javascript:void(0)" style="color:inherit" onclick="reportContent('message',${m.id})">Report</a>`}</div></div>`).join(''));
    box.scrollTop = box.scrollHeight; refreshCounts();
  };
  await load(); APP.timers.push(setInterval(load, 6000));
  $('#sf').onsubmit = async (e) => { e.preventDefault(); const v = $('#sm').value.trim(); if (!v) return; $('#sm').value = ''; await post(`/conversations/${active}/messages`, { body: v }).catch(er => toast(er.message, 'err')); load(); };
};
function newConversation() {
  const m = modal({ title: 'New message', icon: 'square-pen', body: `<div class="field"><label>Search members</label><input id="nc-q" placeholder="Type a name…" autocomplete="off"></div><div id="nc-res" class="list"></div><div class="field mt"><label>Selected</label><div id="nc-sel" class="row wrap"></div></div><div class="field"><label>Group title (optional)</label><input id="nc-t"></div>`,
    foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="nc-go">Start conversation</button>` });
  const sel = new Map(); let t = null;
  const paint = () => { $('#nc-sel', m).innerHTML = [...sel.values()].map(u => `<span class="chip navy">${esc(u.full_name)} <a href="javascript:void(0)" data-rm="${u.id}">${ic('x', 'sm')}</a></span>`).join('') || '<span class="small muted">Nobody yet</span>'; $$('[data-rm]', m).forEach(a => a.onclick = () => { sel.delete(+a.dataset.rm); paint(); }); };
  paint();
  $('#nc-q', m).oninput = (e) => { clearTimeout(t); t = setTimeout(async () => { const q = e.target.value.trim(); if (q.length < 2) return; const r = await api('/search?q=' + encodeURIComponent(q)); $('#nc-res', m).innerHTML = r.members.filter(u => u.id !== APP.me.id).map(u => `<div class="li click" data-u='${esc(JSON.stringify(u))}'>${avatar(u.full_name, u.id, 'sm')}<span class="grow small">${esc(u.full_name)} <span class="muted">${esc(u.society_short || '')}</span></span>${ic('plus', 'sm')}</div>`).join(''); $$('[data-u]', m).forEach(li => li.onclick = () => { const u = JSON.parse(li.dataset.u); sel.set(u.id, u); paint(); }); }, 200); };
  $('#nc-go', m).onclick = (e) => guard(e.currentTarget, async () => { if (!sel.size) throw new Error('Choose at least one person.'); const r = await post('/conversations', { user_ids: [...sel.keys()], title: $('#nc-t', m).value }); m.close(); location.hash = `#/messages/${r.id}`; });
}
async function blockUser(id) { if (!id || !await confirmBox('Block this person? They will not be able to message you and their posts will be hidden from your feed.', { danger: true, ok: 'Block' })) return; const r = await post(`/users/${id}/block`); toast(r.blocked ? 'User blocked.' : 'User unblocked.'); }
