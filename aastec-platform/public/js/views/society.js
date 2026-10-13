// ===================================================================
//  Society governance views: members, committees, approvals, reports,
//  supervision, handbook, network, Society overview and profiles
// ===================================================================
'use strict';
const TYPE_ICON = { membership: 'user-plus', authorization: 'shield-check', authorization_review: 'clipboard-check', post: 'megaphone', event: 'calendar-plus', event_advisor: 'calendar-check', report: 'file-text', election: 'vote', candidate: 'user-check', application: 'rocket', mentor: 'badge-check' };
const TYPE_LABEL = { membership: 'Membership', authorization: 'Authorization', authorization_review: 'Committee review', post: 'Official post', event: 'Event proposal', event_advisor: 'Event supervision', report: 'Report', election: 'Election activation', candidate: 'Candidate', application: 'Incubator application', mentor: 'Mentor verification' };

// ---------------- approval actions (shared) ----------------
async function decide(type, id, approve, btn) {
  const needsNote = !approve && ['post', 'report', 'election'].includes(type);
  let note = '';
  if (!approve) { note = await askNote({ title: type === 'report' ? 'Return report for changes' : type === 'election' ? 'Request changes' : 'Decline', label: needsNote ? 'Reason (shared with the requester)' : 'Note (optional)', required: needsNote, ok: 'Submit', danger: true }); if (note === null) return; }
  const map = {
    membership: () => post(`/members/${id}/membership`, { decision: approve ? 'approve' : 'reject', note }),
    authorization: () => post(`/auth-requests/${id}/decide`, { approve, note }),
    authorization_review: () => post(`/auth-requests/${id}/head-review`, { recommend: approve, note }),
    post: () => post(`/posts/${id}/decide`, { approve, note }),
    event: () => post(`/events/${id}/decide`, { approve, note }),
    event_advisor: () => post(`/events/${id}/advisor`, { approve, note }),
    report: () => post(`/reports/${id}/review`, { decision: approve ? 'approve' : 'return', note }),
    election: () => post(`/elections/${id}/advisor`, { approve, note }),
    candidate: () => post(`/candidates/${id}/review`, { approve, note }),
    mentor: () => post(`/mentors/${id}/verify`, { approve, note }),
  };
  await guard(btn, async () => { await map[type](); toast(approve ? (type === 'authorization_review' ? 'Recommendation sent to the President.' : 'Approved.') : 'Decision recorded.'); refreshCounts(); route(); });
}
function openApproval(type, id) {
  const go = { post: `#/post/${id}`, event: `#/calendar/${id}`, event_advisor: `#/calendar/${id}`, report: `#/reports/${id}`, election: `#/elections/${id}`, application: '#/incubator/applications', mentor: '#/mentors', membership: '#/members/pending' }[type];
  if (go) location.hash = go;
}
async function requestAuthorization() {
  const gt = APP.meta.grant_types;
  const m = modal({ title: 'Request authorization', icon: 'key-round', body: `<p class="small muted mb">Requests go to your Society President, who is the final approver. Committee-related requests may first be reviewed by the Committee Head.</p>
    <form id="ar"><div class="field"><label>Permission *</label><select name="perm_key" required>${Object.entries(gt).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
    <div class="field"><label>Committee (if relevant)</label><select name="committee_id"><option value="">—</option>${APP.meta.committees.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Scope</label><input name="scope_note" placeholder="e.g. Marketing campaign, Tech Week 2026"></div>
    <div class="field"><label>Justification *</label><textarea name="justification" required placeholder="Explain the duty and why you need this authorization"></textarea></div></form>`,
    foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="ar-go">${ic('send', 'sm')} Submit request</button>` });
  $('#ar-go', m).onclick = (e) => guard(e.currentTarget, async () => { const f = formData($('#ar', m)); if (!f.justification) throw new Error('Please add a justification.'); await post('/auth-requests', f); m.close(); toast('Request submitted to your Society President.'); route(); });
}

// ---------------- Approvals ----------------
ROUTES.approvals = async (view, tab = 'inbox') => {
  const [items, mine] = await Promise.all([api('/approvals'), APP.me.society_id ? api('/auth-requests?mine=1') : Promise.resolve([])]);
  const groups = {}; items.forEach(i => (groups[i.type] ??= []).push(i));
  const leads = APP.me.leads;
  view.innerHTML = pageHead('Approvals', leads ? 'President-approved access, official posts, events and memberships' : 'Decisions waiting on you and your own requests', `${APP.me.society_id ? `<button class="btn btn-primary" onclick="requestAuthorization()">${ic('key-round')} Request authorization</button>` : ''}`)
    + (role('president') ? `<div class="banner danger">${ic('shield-check', 'xl')}<div><b>PRESIDENT IS THE FINAL APPROVER</b><div class="small">All authorization requests are reviewed and approved by the Society President.</div></div></div>` : '')
    + `<div class="tabs"><button data-t="inbox" class="${tab === 'inbox' ? 'active' : ''}">${ic('inbox', 'sm')} Needs my action ${items.length ? `<span class="count">${items.length}</span>` : ''}</button><button data-t="mine" class="${tab === 'mine' ? 'active' : ''}">${ic('user', 'sm')} My requests</button><button data-t="matrix" class="${tab === 'matrix' ? 'active' : ''}">${ic('shield', 'sm')} Permission matrix & workflow</button></div><div id="ap-body"></div>`;
  $$('.tabs button', view).forEach(b => b.onclick = () => { location.hash = `#/approvals/${b.dataset.t}`; });
  const body = $('#ap-body');
  if (tab === 'mine') {
    body.innerHTML = card('My authorization requests', 'key-round', mine.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Permission</th><th>Scope</th><th>Submitted</th><th>Committee Head</th><th>Decision</th><th>Status</th></tr></thead><tbody>${mine.map(r => `<tr><td class="strong">${esc(r.perm_label)}</td><td class="small">${esc(r.scope_note || '')}</td><td class="small muted">${fmtDate(r.created_at)}</td><td class="small">${esc(r.head_review_note || '—')}</td><td class="small">${r.decided_by_name ? `${esc(r.decided_by_name)}${r.decision_note ? `<div class="xs muted">${esc(r.decision_note)}</div>` : ''}` : '—'}</td><td>${status(r.status)}</td></tr>`).join('')}</tbody></table></div>` : empty('You have not requested any authorization yet', 'key-round'));
    return;
  }
  if (tab === 'matrix') {
    const rows = [['Posting permissions', true, true, true], ['Committee access', false, true, true], ['Event support', false, true, true], ['Calendar support', false, true, true], ['Community moderation', false, true, true], ['Report submission', true, true, true]];
    body.innerHTML = `<div class="grid g2">${card('Permission matrix', 'shield', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Permission type</th><th class="center">Member</th><th class="center">Committee Head</th><th class="center" style="color:var(--red)">President<div class="xs">(final approver)</div></th><th class="center">Faculty Advisor<div class="xs">(view only)</div></th></tr></thead><tbody>
      ${rows.map(([l, m, h]) => `<tr><td class="strong small">${l}</td><td class="center">${m ? `<span style="color:var(--green)">${ic('circle-check', 'sm')}</span>` : '—'}</td><td class="center">${h ? `<span style="color:var(--green)">${ic('circle-check', 'sm')}</span>` : '—'}</td><td class="center" style="color:var(--gold-600)">${ic('circle-check', 'sm')}</td><td class="center" style="color:var(--blue)">${ic('eye', 'sm')}</td></tr>`).join('')}</tbody></table></div>
      <p class="xs muted mt">Member = may request · Committee Head = may review / recommend · President = approves or rejects · Advisor = visibility for oversight.</p>`)}
      ${card('Authorization workflow', 'workflow', `<div class="vsteps">${[['Request submitted', 'Member submits an authorization request', 'Completed', 'approved'], ['Reviewed (if required)', 'Committee Head reviews committee or event-related requests', 'Optional', ''], ['President approval (final step)', 'President approves or rejects. The President is the final approver.', 'Required', 'pending'], ['Faculty Advisor visibility', 'Approved requests are visible to the Faculty Advisor for oversight', 'Optional', '']]
        .map(([t, d, c, st], i) => `<div class="vs ${st}"><div class="n">${i + 1}</div><div class="grow"><div class="row between"><b class="small">${t}</b>${chip(c, c === 'Required' ? 'blue' : c === 'Completed' ? 'green' : 'amber')}</div><div class="xs muted">${d}</div></div></div>`).join('')}</div>
        <div class="banner info small" style="margin:8px 0 0">${ic('shield-check', 'sm')}Only the Society President can approve or reject requests. No authorization is granted without President approval.</div>`)}</div>`;
    return;
  }
  if (!items.length) { body.innerHTML = card('All clear', 'circle-check', empty('Nothing is waiting for your decision.', 'circle-check')); return; }
  body.innerHTML = Object.entries(groups).map(([type, list]) => card(`${TYPE_LABEL[type] || cap(type)} (${list.length})`, TYPE_ICON[type] || 'inbox', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Request</th><th>Requested by</th><th>Step</th><th>Date</th><th></th></tr></thead><tbody>
    ${list.map(i => `<tr><td><div class="strong small">${esc(i.title)}</div><div class="xs muted">${esc(i.subtitle || '')}</div>${i.note ? `<div class="xs" style="color:var(--blue)">${esc(i.note)}</div>` : ''}</td><td>${i.by ? `<a class="row" href="#/profile/${i.by.id}">${avatar(i.by.full_name, i.by.id, 'sm')}<span class="small">${esc(i.by.full_name)}</span></a>` : '—'}</td><td>${chip(i.step, 'navy')}</td><td class="small muted nowrap">${fmtDate(i.at)}</td>
      <td class="nowrap right">${['post', 'event', 'event_advisor', 'report', 'election'].includes(i.type) ? `<button class="btn btn-xs btn-ghost" onclick="openApproval('${i.type}',${i.id})">${ic('eye', 'sm')} View</button> ` : ''}${i.actions.includes('open') ? `<button class="btn btn-xs btn-primary" onclick="openApproval('${i.type}',${i.id})">Open</button>` : `<button class="btn btn-xs btn-success" onclick="decide('${i.type}',${i.id},true,this)">${ic('check', 'sm')} ${i.actions[0] === 'recommend' ? 'Recommend' : 'Approve'}</button> <button class="btn btn-xs btn-danger" onclick="decide('${i.type}',${i.id},false,this)">${ic('x', 'sm')} ${i.actions[1] === 'return' ? 'Return' : i.actions[1] === 'decline' ? 'Not recommended' : 'Reject'}</button>`}</td></tr>`).join('')}</tbody></table></div>`)).join('<div class="mt"></div>');
};

// ---------------- Members ----------------
ROUTES.members = async (view, tab = 'active') => {
  const sid = ctxSociety(); const leads = APP.me.leads && APP.me.society_id === sid; const privileged = leads || role('advisor') || isAastec();
  const [members, pending, grants] = await Promise.all([api(`/users?society_id=${sid}&limit=500`), privileged ? api(`/users?society_id=${sid}&status=pending&limit=200`) : [], privileged ? api(`/grants?society_id=${sid}`) : []]);
  const committees = await api(`/societies/${sid}/overview`).then(o => o.hierarchy.committees).catch(() => APP.meta.committees);
  view.innerHTML = pageHead('Members', `Rally Society ${esc(societyName(sid))} · ${members.length} active members`, privileged ? `<button class="btn btn-ghost" onclick="exportMembers()">${ic('download')} Export CSV</button>` : '')
    + `<div class="tabs"><button data-t="active" class="${tab === 'active' ? 'active' : ''}">${ic('users', 'sm')} Members</button>${privileged ? `<button data-t="pending" class="${tab === 'pending' ? 'active' : ''}">${ic('user-plus', 'sm')} Applications ${pending.length ? `<span class="count">${pending.length}</span>` : ''}</button><button data-t="grants" class="${tab === 'grants' ? 'active' : ''}">${ic('key-round', 'sm')} Active authorizations</button>` : ''}</div><div id="mb"></div>`;
  $$('.tabs button', view).forEach(b => b.onclick = () => location.hash = `#/members/${b.dataset.t}`);
  window.exportMembers = () => { const rows = [['Name', 'Role', 'Committee', 'Email', 'Faculty', 'Year', 'Handbook', 'Score', 'Joined'], ...members.map(m => [m.full_name, m.role_name, m.committee_name || '', m.email || '', m.faculty || '', m.study_year || '', m.handbook_ack_version ? 'Yes' : 'No', m.score, m.created_at.slice(0, 10)])]; downloadCSV(`members-${societyName(sid)}.csv`, rows); };
  const box = $('#mb');
  if (tab === 'pending') {
    box.innerHTML = card('Membership applications', 'user-plus', pending.length ? `<div class="list">${pending.map(m => `<div class="li">${avatar(m.full_name, m.id)}<div class="grow"><div class="t">${esc(m.full_name)}</div><div class="s">${esc([m.faculty, m.study_year].filter(Boolean).join(' · '))} · applied ${ago(m.created_at)}</div></div>${leads ? `<button class="btn btn-sm btn-success" onclick="decide('membership',${m.id},true,this)">${ic('check', 'sm')} Approve</button><button class="btn btn-sm btn-danger" onclick="decide('membership',${m.id},false,this)">Reject</button>` : status('pending')}</div>`).join('')}</div>` : empty('No pending applications', 'user-plus'));
    return;
  }
  if (tab === 'grants') {
    box.innerHTML = card('Active authorizations', 'key-round', grants.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Member</th><th>Authorization</th><th>Scope</th><th>Granted by</th><th>Expires</th><th></th></tr></thead><tbody>${grants.map(g => `<tr><td class="strong small">${esc(g.full_name)}</td><td>${chip(g.perm_label, 'navy')}</td><td class="small">${esc(g.scope_note || '')}</td><td class="small">${esc(g.granted_by_name || '')}<div class="xs muted">${fmtDate(g.granted_at)}</div></td><td class="small">${fmtDate(g.expires_at)}</td><td>${leads ? `<button class="btn btn-xs btn-danger" onclick="revokeGrant(${g.id},this)">Revoke</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('No active authorizations', 'key-round'));
    return;
  }
  box.innerHTML = `<div class="toolbar"><input class="input" id="mq" placeholder="Search name or faculty"><select class="input" id="mc"><option value="">All committees</option>${committees.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><select class="input" id="mr"><option value="">All roles</option>${['president', 'vice_president', 'committee_head', 'member', 'incubator_agent', 'founder'].map(r => `<option value="${r}">${cap(r)}</option>`).join('')}</select><span class="grow"></span><span class="small muted" id="mcount"></span></div>
    <div class="card pad0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Member</th><th>Role</th><th>Committee</th><th>Faculty / year</th><th>Handbook</th><th class="num">Activity</th><th>Joined</th><th></th></tr></thead><tbody id="mt"></tbody></table></div></div>`;
  const draw = () => {
    const q = $('#mq').value.toLowerCase(), c = +$('#mc').value, r = $('#mr').value;
    const list = members.filter(m => (!q || m.full_name.toLowerCase().includes(q) || (m.faculty || '').toLowerCase().includes(q)) && (!c || m.committee_id === c) && (!r || m.role_key === r));
    $('#mcount').textContent = `${list.length} shown`;
    $('#mt').innerHTML = list.map(m => `<tr><td><a class="row" href="#/profile/${m.id}">${avatar(m.full_name, m.id, 'sm', m.avatar_url)}<div><div class="strong small">${esc(m.full_name)}</div><div class="xs muted">${esc(m.email || m.title || '')}</div></div></a></td>
      <td>${chip(m.role_name, { president: 'red', vice_president: 'navy', committee_head: 'gold', incubator_agent: 'blue', founder: 'green' }[m.role_key] || '')}</td><td class="small">${esc(m.committee_name || '—')}</td><td class="small muted">${esc([m.faculty, m.study_year].filter(Boolean).join(' · ') || '—')}</td>
      <td>${m.handbook_ack_version ? `<span style="color:var(--green)">${ic('circle-check', 'sm')}</span>` : `<span style="color:var(--amber)">${ic('circle-alert', 'sm')}</span>`}</td><td class="num strong">${num(m.score)}</td><td class="small muted">${fmtDate(m.created_at, { month: 'short', year: 'numeric' })}</td>
      <td class="nowrap right"><button class="btn btn-xs btn-ghost" title="Message" onclick="startChat(${m.id})">${ic('mail', 'sm')}</button>${leads && m.id !== APP.me.id && !['president', 'vice_president'].includes(m.role_key) ? ` <button class="btn btn-xs btn-ghost" title="Assign committee" onclick="assignMember(${m.id}, '${esc(m.full_name)}')">${ic('users-round', 'sm')}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="8">${empty('No members match')}</td></tr>`;
  };
  ['mq', 'mc', 'mr'].forEach(id => $('#' + id).oninput = draw); draw();
  window.assignMember = (id, name) => {
    const m = modal({ title: `Assign ${name}`, icon: 'users-round', body: `<div class="field"><label>Committee</label><select id="as-c"><option value="">No committee</option>${committees.map(c => `<option value="${c.id}">${esc(c.name)}${c.head ? ` — head: ${esc(c.head.full_name)}` : ' — head vacant'}</option>`).join('')}</select></div><div class="field check"><input type="checkbox" id="as-h"><label for="as-h">Appoint as Committee Head (replaces the current head)</label></div>`,
      foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="as-go">Save</button>` });
    $('#as-go', m).onclick = (e) => guard(e.currentTarget, async () => { await put(`/members/${id}/assignment`, { committee_id: $('#as-c', m).value || null, make_head: $('#as-h', m).checked }); m.close(); toast('Assignment saved.'); route(); });
  };
};
async function revokeGrant(id, btn) { if (!await confirmBox('Revoke this authorization? The member is notified.', { danger: true, ok: 'Revoke' })) return; await guard(btn, async () => { await post(`/grants/${id}/revoke`); toast('Authorization revoked.'); route(); }); }
function downloadCSV(name, rows) {
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function startChat(userId) { const r = await post('/conversations', { user_ids: [userId] }).catch(e => toast(e.message, 'err')); if (r) location.hash = `#/messages/${r.id}`; }

// ---------------- Committees ----------------
ROUTES.committees = async (view, id) => {
  const sid = ctxSociety();
  const ov = await api(`/societies/${sid}/overview`);
  const h = ov.hierarchy;
  if (!id) {
    view.innerHTML = pageHead('Committees & Hierarchy', `Rally Society ${esc(ov.society.short_name)} — structure, committees and execution`, APP.me.leads && APP.me.society_id === sid ? `<button class="btn btn-primary" id="nc">${ic('plus')} New committee</button>` : '') + `
      <div class="grid g-12"><div class="span-5">${card('Society hierarchy', 'network', orgChart(h))}</div>
      <div class="span-7"><div class="grid g2">${h.committees.map(c => `<a class="card" href="#/committees/${c.id}" style="text-decoration:none"><div class="row between"><h3 style="font-size:15px">${esc(c.name)}</h3>${status(c.status)}</div>
        <div class="row mt">${c.head ? `${avatar(c.head.full_name, c.head.id, 'sm')}<div><div class="small strong">${esc(c.head.full_name)}</div><div class="xs muted">Committee Head</div></div>` : chip('Head vacant', 'amber')}</div>
        <div class="row mt small muted">${ic('users', 'sm')} ${c.members} members · ${ic('list-todo', 'sm')} ${c.open_tasks} open tasks${c.overdue ? ` · <span style="color:var(--red)">${c.overdue} overdue</span>` : ''}</div>${c.status_note ? `<div class="xs mt" style="color:var(--blue)">${esc(c.status_note)}</div>` : ''}</a>`).join('')}</div></div></div>`;
    $('#nc')?.addEventListener('click', () => {
      const m = modal({ title: 'New committee', icon: 'users-round', body: `<form id="ncf"><div class="field"><label>Name *</label><input name="name" required></div><div class="field"><label>Mandate</label><textarea name="description"></textarea></div></form>`, foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="ncgo">Create</button>` });
      $('#ncgo', m).onclick = (e) => guard(e.currentTarget, async () => { await post(`/societies/${sid}/committees`, formData($('#ncf', m))); m.close(); toast('Committee created.'); route(); });
    });
    return;
  }
  const c = h.committees.find(x => x.id === +id); if (!c) { view.innerHTML = empty('Committee not found'); return; }
  const [tasks, docs, members] = await Promise.all([api(`/tasks?committee_id=${c.id}`), api(`/documents?committee_id=${c.id}`), api(`/users?committee_id=${c.id}&limit=200`)]);
  const manage = c.head_user_id === APP.me.id || APP.me.leads || role('vice_president');
  const cols = [['not_started', 'Not started'], ['in_progress', 'In progress'], ['in_review', 'In review'], ['done', 'Done']];
  view.innerHTML = pageHead(c.name, `${esc(c.description || 'Committee workspace')} · ${status(c.status)}`, `<a class="btn btn-ghost" href="#/committees">${ic('arrow-left')} All committees</a>${manage ? `<button class="btn btn-ghost" id="cst">${ic('flag')} Update status</button><button class="btn btn-primary" id="nt">${ic('plus')} New task</button>` : ''}`) + `
    <div class="grid g-12 mb-l"><div class="span-9"><div class="grid g4">${cols.map(([k, l]) => `<div class="card surface tight"><div class="row between mb"><b class="small">${l}</b>${chip(String(tasks.filter(t => t.status === k).length), '')}</div>
      ${tasks.filter(t => t.status === k).map(t => `<div class="card tight mb" style="padding:10px"><div class="small strong">${esc(t.title)}</div><div class="row between mt"><span class="xs muted">${esc(t.assignee_name || '')}</span>${chip(cap(t.priority), PRIORITY[t.priority])}</div>
        <div class="row between mt"><span class="xs ${t.due_on && t.due_on < todayISO() && t.status !== 'done' ? '' : 'muted'}" style="${t.due_on && t.due_on < todayISO() && t.status !== 'done' ? 'color:var(--red)' : ''}">${t.due_on ? 'Due ' + fmtDate(t.due_on, { day: 'numeric', month: 'short' }) : ''}</span>
        ${(manage || t.assignee_id === APP.me.id) ? `<select class="input" style="width:auto;padding:2px 6px;font-size:11px" onchange="moveTask(${t.id}, this.value)">${cols.map(([v, n]) => `<option value="${v}" ${v === t.status ? 'selected' : ''}>${n}</option>`).join('')}</select>` : ''}</div></div>`).join('') || '<div class="xs muted center">—</div>'}</div>`).join('')}</div></div>
    <div class="span-3">${card('Team', 'users', `<div class="list">${c.head ? `<div class="li">${avatar(c.head.full_name, c.head.id, 'sm')}<div class="grow"><div class="small strong">${esc(c.head.full_name)}</div><div class="xs muted">Committee Head</div></div></div>` : ''}${members.filter(m => m.id !== c.head_user_id).map(m => `<a class="li click" href="#/profile/${m.id}" style="text-decoration:none">${avatar(m.full_name, m.id, 'sm')}<span class="grow small">${esc(m.full_name)}</span></a>`).join('')}</div>`)}
      ${card('Documents', 'folder', `${docs.map(d => `<div class="li">${ic('file-text', 'sm')}<div class="grow"><div class="small strong">${esc(d.title)}</div><div class="xs muted">${esc(d.doc_type || '')} · ${fmtDate(d.created_at)}</div></div></div>`).join('') || '<p class="small muted">No documents yet.</p>'}${manage ? `<button class="btn btn-sm btn-soft btn-block mt" id="nd">${ic('upload', 'sm')} Add document link</button>` : ''}`, { cls: 'mt' })}</div></div>`;
  window.moveTask = (tid, st) => put(`/tasks/${tid}`, { status: st }).then(() => { toast('Task updated.'); route(); }).catch(e => toast(e.message, 'err'));
  $('#nt')?.addEventListener('click', () => {
    const m = modal({ title: 'New committee task', icon: 'list-todo', body: `<form id="ntf" class="grid-form"><div class="field full"><label>Task *</label><input name="title" required></div><div class="field"><label>Assignee</label><select name="assignee_id">${[c.head, ...members].filter(Boolean).map(u => `<option value="${u.id}">${esc(u.full_name)}</option>`).join('')}</select></div>
      <div class="field"><label>Priority</label><select name="priority"><option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option></select></div><div class="field"><label>Due date</label><input type="date" name="due_on"></div><div class="field full"><label>Details</label><textarea name="description"></textarea></div></form>`,
      foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="ntgo">Create task</button>` });
    $('#ntgo', m).onclick = (e) => guard(e.currentTarget, async () => { await post('/tasks', { ...formData($('#ntf', m)), committee_id: c.id }); m.close(); toast('Task assigned.'); route(); });
  });
  $('#nd')?.addEventListener('click', () => {
    const m = modal({ title: 'Add document', icon: 'folder', body: `<form id="ndf"><div class="field"><label>Title *</label><input name="title" required></div><div class="field"><label>Type</label><select name="doc_type"><option>Strategy</option><option>Guidelines</option><option>Calendar</option><option>Checklist</option><option>Minutes</option><option>Report</option></select></div><div class="field"><label>Link (shared drive URL)</label><input name="url" placeholder="https://"></div></form>`,
      foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="ndgo">Add</button>` });
    $('#ndgo', m).onclick = (e) => guard(e.currentTarget, async () => { await post('/documents', { ...formData($('#ndf', m)), committee_id: c.id }); m.close(); toast('Document added.'); route(); });
  });
  $('#cst')?.addEventListener('click', () => {
    const m = modal({ title: 'Committee status', icon: 'flag', body: `<div class="field"><label>Status</label><select id="cs-s">${['on_track', 'needs_support', 'on_hold'].map(s => `<option value="${s}" ${s === c.status ? 'selected' : ''}>${STATUS[s][0]}</option>`).join('')}</select></div><div class="field"><label>Status note</label><input id="cs-n" value="${esc(c.status_note || '')}" placeholder="e.g. Campaign launch this week"></div>`,
      foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="csgo">Save</button>` });
    $('#csgo', m).onclick = (e) => guard(e.currentTarget, async () => { await put(`/committees/${c.id}`, { status: $('#cs-s', m).value, status_note: $('#cs-n', m).value }); m.close(); route(); });
  });
};

// ---------------- Reports ----------------
ROUTES.reports = async (view, id) => {
  const sid = isAastec() ? (+APP.ctx || '') : APP.me.society_id;
  const d = await api(`/reports${sid ? `?society_id=${sid}` : ''}`);
  view.innerHTML = pageHead('Reports & Compliance', sid ? `Rally Society ${esc(societyName(sid))} — monthly reports, event reports and financial statements` : 'All Society reports across the network', d.can_submit ? `<button class="btn btn-primary" id="nr">${ic('file-plus')} Submit report</button>` : '') + `
    ${d.due.length ? `<div class="grid g3 mb-l">${d.due.map(r => `<div class="card tight"><div class="row between"><div><div class="small strong">${fmtMonth(r.period)} activity report</div><div class="xs muted">Due ${fmtDate(r.due_on)} (10th of following month)</div></div>${status(r.status)}</div>${r.late ? '<div class="xs mt" style="color:var(--amber)">Submitted late</div>' : ''}</div>`).join('')}</div>` : ''}
    <div class="toolbar"><select class="input" id="rs"><option value="">All statuses</option><option value="submitted">Submitted</option><option value="approved">Approved</option><option value="returned">Returned</option></select><select class="input" id="rt"><option value="">All types</option>${Object.entries(d.types).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><input class="input" id="rq" placeholder="Search"></div>
    <div class="card pad0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Report</th>${sid ? '' : '<th>Society</th>'}<th>Type</th><th>Period</th><th>Submitted</th><th>Reviewer</th><th>Status</th></tr></thead><tbody id="rtb"></tbody></table></div></div>`;
  const draw = () => {
    const s = $('#rs').value, t = $('#rt').value, q = $('#rq').value.toLowerCase();
    $('#rtb').innerHTML = d.rows.filter(r => (!s || r.status === s) && (!t || r.report_type === t) && (!q || r.title.toLowerCase().includes(q))).map(r => `<tr class="click" onclick="location.hash='#/reports/${r.id}'"><td class="strong small">${esc(r.title)}</td>${sid ? '' : `<td class="small">${esc(r.society_short)}</td>`}<td class="small">${esc(d.types[r.report_type])}</td><td class="small">${esc(r.period || '')}</td>
      <td class="small">${esc(r.submitted_by_name || '')}<div class="xs muted">${fmtDate(r.submitted_at)}</div></td><td class="small">${esc(r.reviewed_by_name || '—')}</td><td>${status(r.status)}</td></tr>`).join('') || `<tr><td colspan="7">${empty('No reports')}</td></tr>`;
  };
  ['rs', 'rt', 'rq'].forEach(x => $('#' + x).oninput = draw); draw();
  $('#nr')?.addEventListener('click', () => submitReport(sid || APP.me.society_id, d.types));
  if (id) openReport(id);
};
async function openReport(id) {
  const r = await api(`/reports/${id}`);
  const m = modal({ title: r.title, icon: 'file-text', size: 'wide', body: `<div class="row wrap mb">${status(r.status)}${chip(r.society_short, 'navy')}${r.period ? chip(r.period, '') : ''}<span class="small muted">Submitted by ${esc(r.submitted_by_name || '')} · ${fmtDT(r.submitted_at)}</span></div>
    <div class="ai-out" style="max-height:420px;overflow-y:auto">${esc(r.body)}</div>${r.review_note ? `<div class="banner ${r.status === 'returned' ? 'warn' : 'info'} mt">${ic('message-square')}<div><b>${esc(r.reviewed_by_name || 'Reviewer')}</b>: ${esc(r.review_note)}</div></div>` : ''}`,
    foot: `<button class="btn btn-ghost" onclick="window.print()">${ic('printer', 'sm')} Print</button>${r.can_review ? `<button class="btn btn-danger" id="rr-ret">Return for changes</button><button class="btn btn-success" id="rr-ok">${ic('check', 'sm')} Approve</button>` : '<button class="btn btn-primary" data-close>Close</button>'}`, onClose: () => { if (location.hash.startsWith('#/reports/')) history.replaceState(null, '', '#/reports'); } });
  $('#rr-ok', m)?.addEventListener('click', (e) => { m.close(); decide('report', r.id, true, e.currentTarget); });
  $('#rr-ret', m)?.addEventListener('click', (e) => { m.close(); decide('report', r.id, false, e.currentTarget); });
}
function submitReport(sid, types) {
  const lastMonth = new Date(); lastMonth.setDate(1); lastMonth.setMonth(lastMonth.getMonth() - 1);
  const m = modal({ title: 'Submit report', icon: 'file-plus', size: 'wide', body: `<form id="srf" class="grid-form"><div class="field"><label>Report type</label><select name="report_type" id="sr-t">${Object.entries(types).filter(([k]) => k !== 'incubator_agent' || role('incubator_agent')).map(([k, v]) => `<option value="${k}" ${role('incubator_agent') && k === 'incubator_agent' ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="field"><label>Period</label><input type="month" name="period" id="sr-p" value="${lastMonth.toISOString().slice(0, 7)}"></div><div class="field full"><label>Title *</label><input name="title" id="sr-title" required></div>
    <div class="field full"><label class="row between">Report content * <button type="button" class="btn btn-xs btn-blue" id="sr-ai">${ic('sparkles', 'sm')} Draft from recorded data (AI)</button></label><textarea name="body" id="sr-b" style="min-height:260px" required></textarea><div class="hint">The AI reporting assistant drafts only from recorded platform data. Review and edit before submitting.</div></div></form>`,
    foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="sr-go">${ic('send', 'sm')} Submit for review</button>` });
  const setTitle = () => { const t = $('#sr-t', m).value; $('#sr-title', m).value = `${types[t]} — ${new Date($('#sr-p', m).value + '-01').toLocaleDateString(LOC, { month: 'long', year: 'numeric' })}`; };
  $('#sr-t', m).onchange = setTitle; $('#sr-p', m).onchange = setTitle; setTitle();
  $('#sr-ai', m).onclick = (e) => guard(e.currentTarget, async () => { const r = await post('/ai/report', { society_id: sid, period: $('#sr-p', m).value }); $('#sr-b', m).value = r.text.replace(/\*\*/g, ''); toast(r.mode === 'claude' ? 'Draft generated by the AI assistant.' : 'Draft generated (offline assistant).'); });
  $('#sr-go', m).onclick = (e) => guard(e.currentTarget, async () => { await post('/reports', { ...formData($('#srf', m)), society_id: sid }); m.close(); toast('Report submitted for review.'); route(); });
}

// ---------------- Supervision (Faculty Advisor) ----------------
ROUTES.supervision = async (view) => renderSupervision(view, ctxSociety(), false);
async function renderSupervision(view, sid, asDashboard) {
  const [d, appr] = await Promise.all([api(`/supervision?society_id=${sid}`), api('/approvals')]);
  const h = d.health; const risk = h.score >= 70 ? ['Low risk', 'var(--green)'] : h.score >= 40 ? ['Medium risk', 'var(--amber)'] : ['High risk', 'var(--red)'];
  const open = d.escalations.filter(e => e.status !== 'resolved');
  view.innerHTML = pageHead('Faculty Advisor Supervision Panel', `Rally Society ${esc(societyName(sid))} — Independent Student Leadership with Supervised Governance`, updated(), 'shield-check') + `
    <div class="banner info">${ic('shield-check', 'lg')}<div><b>The Rally Society operates independently and is student-led.</b> All activities are supervised to ensure compliance and best practices. The President remains the operational authority.</div></div>
    <div class="kpis">
      ${kpi({ icon: 'shield-check', tone: 'navy', label: 'Compliance overview', value: h.label, valCls: 'text green', meta: `${bar(h.score, 'green', 'thin')}<div style="margin-top:4px">${h.score}% healthy & compliant</div>` })}
      ${kpi({ icon: 'clipboard-check', tone: 'gold', label: 'Pending approvals', value: appr.length, meta: 'Requires your action', link: '#/approvals' })}
      ${kpi({ icon: 'vote', tone: 'navy', label: 'Active elections', value: d.elections.length, meta: 'Needs supervision', link: '#/elections' })}
      ${kpi({ icon: 'file-text', tone: 'purple', label: 'Reports pending review', value: d.reports.length, meta: 'Awaiting your review', link: '#/reports' })}
      ${kpi({ icon: 'calendar-days', tone: 'blue', label: 'Upcoming events', value: d.upcoming, meta: 'Next 30 days', link: '#/calendar' })}
      ${kpi({ icon: 'triangle-alert', tone: 'red', label: 'Escalations', value: open.length, meta: open.length ? 'Requires attention' : 'None open' })}
    </div>
    <div class="grid g-12 mb-l">
      <div class="span-4">${card('Elections supervision', 'vote', d.elections.length ? d.elections.map(el => `<div class="card surface tight mb"><div class="row between"><b class="small">${esc(el.title)}</b>${status(el.status)}</div>
        <div class="list mt">${[['Nomination period', el.nomination_start, el.nomination_end], ['Candidate review', el.review_start, el.review_end], ['Voting period', el.voting_start, el.voting_end]].map(([l, a, b]) => `<div class="row xs" style="padding:3px 0"><span class="dot-st ${new Date(b) < new Date() ? 'green' : 'gold'}"></span><span class="grow">${l}</span><span class="muted">${fmtDate(a, { day: 'numeric', month: 'short' })} – ${fmtDate(b, { day: 'numeric', month: 'short' })}</span></div>`).join('')}</div>
        ${el.status === 'pending_advisor' && role('advisor') ? `<div class="banner gold small mt" style="margin-bottom:8px">${ic('vote', 'sm')}<div><b>Election opening approval</b><div class="xs">Approve to activate this election for the July–August window.</div></div></div><div class="row"><button class="btn btn-sm btn-success" onclick="decide('election',${el.id},true,this)">${ic('check', 'sm')} Approve & activate</button><button class="btn btn-sm btn-ghost" onclick="decide('election',${el.id},false,this)">${ic('refresh-cw', 'sm')} Request changes</button></div>` : `<a class="link mt" href="#/elections/${el.id}">Open ${ic('arrow-right', 'sm')}</a>`}</div>`).join('') : empty('No active elections', 'vote'))}</div>
      <div class="span-4">${card('Post-election hierarchy', 'network', orgChart(d.hierarchy, { compact: true }))}</div>
      <div class="span-4">${card('Activity & post review', 'eye', (d.reports.length + d.posts.length + d.events_review.length) ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Type</th><th>Title</th><th>By</th><th></th></tr></thead><tbody>
        ${d.reports.map(r => `<tr><td class="small">Report</td><td class="small strong">${esc(r.title)}</td><td class="small">${esc(r.submitted_by_name || '')}</td><td><button class="btn btn-xs btn-primary" onclick="location.hash='#/reports/${r.id}'">${ic('eye', 'sm')}</button></td></tr>`).join('')}
        ${d.posts.map(p => `<tr><td class="small">Post</td><td class="small strong">${esc(p.title || '')}</td><td class="small">${esc(p.author)}</td><td><button class="btn btn-xs btn-primary" onclick="location.hash='#/post/${p.id}'">${ic('eye', 'sm')}</button></td></tr>`).join('')}
        ${d.events_review.map(e => `<tr><td class="small">Event</td><td class="small strong">${esc(e.title)}</td><td class="small">${e.budget ? num(e.budget) + ' EGP' : ''}</td><td><button class="btn btn-xs btn-primary" onclick="location.hash='#/calendar/${e.id}'">${ic('eye', 'sm')}</button></td></tr>`).join('')}</tbody></table></div>` : empty('Nothing awaiting review', 'eye'))}</div>
    </div>
    <div class="grid g4">
      ${card('Attendance monitoring', 'activity', `<div style="height:170px"><canvas id="c-att"></canvas></div><div class="xs muted center mt">Based on the last ${d.attendance.events} activities</div>`)}
      ${card('Escalation controls', 'triangle-alert', open.length ? open.map(e => `<div class="card surface tight mb"><div class="row between"><b class="small">${esc(e.title)}</b>${chip(cap(e.severity), e.severity === 'high' ? 'red' : e.severity === 'medium' ? 'amber' : 'green')}</div><div class="xs muted">${esc(e.detail || '')}</div><div class="row mt"><button class="btn btn-xs btn-soft" onclick="updateEscalation(${e.id},'in_progress',this)">In progress</button><button class="btn btn-xs btn-success" onclick="updateEscalation(${e.id},'resolved',this)">Resolve</button></div></div>`).join('') : empty('No open escalations', 'shield-check'))}
      ${card('Activities to close', 'clipboard-check', d.events_to_close.length ? `<div class="list">${d.events_to_close.map(e => `<div class="li"><div class="grow"><div class="small strong">${esc(e.title)}</div><div class="xs muted">${fmtDate(e.start_at)} · ${e.attendance_count || 0} attendees</div></div>${role('advisor') ? `<button class="btn btn-xs btn-primary" onclick="closeEvent(${e.id},this)">Close</button>` : ''}</div>`).join('')}</div>` : empty('All activities closed', 'circle-check'))}
      ${card('Chapter risk indicator', 'gauge', `<div class="center">${ring(h.score, { size: 130, stroke: 14, color: risk[1], label: h.score, sub: risk[0] })}</div><div class="list mt">${[['Low risk', '70–100', 'green'], ['Medium risk', '40–69', 'amber'], ['High risk', '0–39', 'red']].map(([l, r, c]) => `<div class="row xs" style="padding:2px 0"><span class="dot-st ${c}"></span><span class="grow">${l}</span><span class="muted">${r}</span></div>`).join('')}</div>`)}
    </div>`;
  chart($('#c-att'), { type: 'doughnut', data: { labels: ['Present', 'Excused', 'Absent'], datasets: [{ data: [d.attendance.present, d.attendance.excused, d.attendance.absent], backgroundColor: ['#16A34A', '#F2B91E', '#DC2626'], borderWidth: 0 }] }, options: { cutout: '64%', plugins: { legend: { position: 'right' } } } });
}
async function updateEscalation(id, st, btn) { let resolution = null; if (st === 'resolved') { resolution = await askNote({ title: 'Resolve escalation', label: 'Resolution', required: true, ok: 'Resolve' }); if (resolution === null) return; } await guard(btn, async () => { await put(`/escalations/${id}`, { status: st, resolution }); toast('Escalation updated.'); route(); }); }
async function closeEvent(id, btn) { await guard(btn, async () => { await post(`/events/${id}/close`); toast('Activity closed. Dashboards updated.'); route(); }); }

// ---------------- Handbook & Governance ----------------
ROUTES.handbook = async (view) => {
  const d = await api('/handbook');
  const acked = d.ack?.handbook_ack_version === d.version;
  view.innerHTML = pageHead('Handbook & Governance', `Rally Society Handbook · Version ${esc(d.version)}`, `<button class="btn btn-ghost" onclick="window.print()">${ic('printer')} Print</button>`, 'book-open') + `
    ${acked ? `<div class="banner info">${ic('circle-check', 'lg')}<div>You acknowledged version ${esc(d.version)} on ${fmtDate(d.ack.handbook_ack_at)}.</div></div>` : `<div class="banner gold">${ic('book-open', 'lg')}<div class="grow"><b>Please read and acknowledge the handbook.</b> Acknowledgement is required for election eligibility and official duties.</div><button class="btn btn-primary" id="hb-ack">${ic('check')} I acknowledge</button></div>`}
    <div class="grid g-side"><div class="col">
      <div class="toolbar" style="margin:0"><input class="input grow" id="hb-q" placeholder="Search the handbook…"></div>
      <div id="hb-list" class="col"></div></div>
      <aside class="col">
        <div class="card navy"><div class="card-h"><h3>${ic('sparkles')} Ask the handbook</h3>${chip(APP.meta.ai.enabled ? 'AI' : 'Offline', 'solid-gold')}</div><p class="small muted">Answers come only from the official handbook sections.</p>
          <textarea class="input mt" id="hb-ask" placeholder="e.g. Who approves official posts?" style="min-height:70px"></textarea><button class="btn btn-gold btn-block mt" id="hb-go">${ic('send', 'sm')} Ask</button><div id="hb-ans" class="mt"></div></div>
        ${card('Authority model', 'crown', `<div class="list">${[['Faculty Advisor', 'Views Society work, guides, comments, receives alerts and approves election activation only.', 'navy'], ['President', 'Final operational authority; creates Society events; grants member permissions; approves publishers.', 'red'], ['Vice President', 'Coordinates committees; substitute authority only through delegation.', 'purple'], ['Committee Heads', 'Manage committee tasks, members, deliverables and reports.', 'gold'], ['Members', 'Post personally, attend, learn and request authorization for official duties.', '']]
          .map(([r, t, c]) => `<div class="li top">${chip(r, c)}<span class="xs muted grow">${t}</span></div>`).join('')}</div>`)}
        ${card('Posting identities', 'megaphone', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Identity</th><th>Who can publish</th></tr></thead><tbody><tr><td class="small strong">Personal</td><td class="xs">All verified users — moderation applies</td></tr><tr><td class="small strong">Rally Society - University</td><td class="xs">President-authorized publishers; approval for sensitive scope</td></tr><tr><td class="small strong">AASTEC</td><td class="xs">Authorized AASTEC staff only</td></tr></tbody></table></div>`)}
      </aside></div>`;
  const draw = (q = '') => { $('#hb-list').innerHTML = d.sections.filter(s => !q || `${s.code} ${s.title} ${s.body}`.toLowerCase().includes(q.toLowerCase())).map(s => `<div class="card" id="sec-${s.id}"><div class="row between"><h3 style="font-size:15px">${chip('Section ' + s.code, 'navy')} ${esc(s.title)}</h3>${can('settings.manage') ? `<button class="btn btn-xs btn-ghost" onclick="editSection(${s.id})">${ic('pencil', 'sm')}</button>` : ''}</div><p class="mt" style="line-height:1.7">${esc(s.body)}</p></div>`).join('') || empty('No matching sections'); };
  draw(); $('#hb-q').oninput = (e) => draw(e.target.value);
  $('#hb-ack')?.addEventListener('click', (e) => guard(e.currentTarget, async () => { await post('/handbook/ack'); APP.me.handbook_ack_version = d.version; toast('Thank you — acknowledgement recorded.'); route(); }));
  $('#hb-go').onclick = (e) => guard(e.currentTarget, async () => { const q = $('#hb-ask').value.trim(); if (!q) return; const r = await post('/ai/handbook', { question: q }); $('#hb-ans').innerHTML = `<div class="ai-out" style="color:var(--text)">${esc(r.text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</div>`; });
  window.editSection = (id) => { const s = d.sections.find(x => x.id === id); const m = modal({ title: `Edit section ${s.code}`, icon: 'pencil', size: 'wide', body: `<div class="field"><label>Title</label><input id="es-t" value="${esc(s.title)}"></div><div class="field"><label>Content</label><textarea id="es-b" style="min-height:220px">${esc(s.body)}</textarea></div>`, foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="es-go">Save</button>` });
    $('#es-go', m).onclick = (e) => guard(e.currentTarget, async () => { await put(`/handbook/${id}`, { title: $('#es-t', m).value, body: $('#es-b', m).value }); m.close(); toast('Section updated (recorded in the audit log).'); route(); }); };
};

// ---------------- Societies & universities ----------------
ROUTES.societies = async (view) => {
  const rows = await api('/network');
  const countries = [...new Set(rows.map(r => r.country))].sort();
  const active = rows.filter(r => r.status === 'active');
  view.innerHTML = pageHead('Societies & Universities', `${rows.filter(r => r.kind === 'aast_campus').length} AAST campuses · ${rows.filter(r => r.kind === 'partner').length} partner universities · ${countries.length} countries`, can('societies.manage') ? `<button class="btn btn-primary" id="nu">${ic('plus')} Add university</button>` : '', 'landmark') + `
    <div class="kpis">${kpi({ icon: 'landmark', tone: 'navy', label: 'AAST campuses', value: rows.filter(r => r.kind === 'aast_campus').length })}${kpi({ icon: 'school', tone: 'gold', label: 'Partner universities', value: rows.filter(r => r.kind === 'partner').length })}${kpi({ icon: 'globe', tone: 'blue', label: 'Countries', value: countries.length })}${kpi({ icon: 'shield-check', tone: 'green', label: 'Active Societies', value: active.length, meta: `${rows.length - active.length} forming` })}${kpi({ icon: 'users', tone: 'purple', label: 'Active members', value: num(active.reduce((s, r) => s + r.members, 0)) })}</div>
    <div class="toolbar"><input class="input" id="nq" placeholder="Search university or city"><select class="input" id="nc"><option value="">All countries</option>${countries.map(c => `<option>${esc(c)}</option>`).join('')}</select><select class="input" id="nk"><option value="">All types</option><option value="aast_campus">AAST campuses</option><option value="partner">Partner universities</option></select><select class="input" id="ns"><option value="">All statuses</option><option value="active">Active</option><option value="forming">Forming</option></select></div>
    <div class="grid g-auto" id="ngrid"></div>`;
  const draw = () => {
    const q = $('#nq').value.toLowerCase(), c = $('#nc').value, k = $('#nk').value, s = $('#ns').value;
    $('#ngrid').innerHTML = rows.filter(r => (!q || `${r.university} ${r.city} ${r.short_name}`.toLowerCase().includes(q)) && (!c || r.country === c) && (!k || r.kind === k) && (!s || r.status === s)).map(r => `<a class="card" href="#/society/${r.id}" style="text-decoration:none"><div class="row top">${seal(r.short_name, 'lg')}<div class="grow"><div class="strong" style="color:var(--heading)">${esc(r.name)}</div><div class="xs muted">${esc(r.university)}</div><div class="xs muted">${ic('map-pin', 'sm')} ${esc(r.city)}, ${esc(r.country)}</div></div></div>
      <div class="row between mt">${status(r.status)}${r.kind === 'aast_campus' ? chip('AAST campus', 'navy') : chip('Partner', 'gold')}</div>
      ${r.health ? `<div class="mt"><div class="row between xs"><span class="muted">Health · ${r.health.label}</span><b>${r.health.score}</b></div>${bar(r.health.score, r.health.score >= 70 ? 'green' : r.health.score >= 50 ? 'amber' : 'red', 'thin')}</div><div class="row between xs mt muted"><span>${ic('users', 'sm')} ${r.members} members</span><span>${esc(r.president || '')}</span></div>` : '<div class="xs muted mt">Chapter in formation — no members yet.</div>'}</a>`).join('') || empty('No Societies match');
  };
  ['nq', 'nc', 'nk', 'ns'].forEach(x => $('#' + x).oninput = draw); draw();
  $('#nu')?.addEventListener('click', () => {
    const m = modal({ title: 'Add university or campus', icon: 'school', body: `<form id="nuf" class="grid-form"><div class="field full"><label>Name *</label><input name="name" required></div><div class="field"><label>Short name</label><input name="short_name"></div><div class="field"><label>Type</label><select name="kind"><option value="partner">Partner university</option><option value="aast_campus">AAST campus</option></select></div><div class="field"><label>City</label><input name="city"></div><div class="field"><label>Country</label><input name="country"></div><p class="full small muted">A Rally Society chapter (status: forming) with the six standard committees is created automatically.</p></form>`,
      foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="nugo">Add</button>` });
    $('#nugo', m).onclick = (e) => guard(e.currentTarget, async () => { await post('/universities', formData($('#nuf', m))); m.close(); APP.meta = await api('/meta'); toast('University added with a forming Society.'); route(); });
  });
};
ROUTES.society = async (view, id) => {
  let ov;
  // Only members, supervisors and AASTEC staff can open the governance view; everyone else gets the public profile.
  if (can('portfolio.view') || +id === APP.me.society_id || (role('advisor') && APP.meta.societies.find(s => s.id === +id)?.advisor_id === APP.me.id)) ov = await api(`/societies/${id}/overview`).catch(() => null);
  if (!ov) {
    const s = (await api('/network')).find(x => x.id === +id);
    view.innerHTML = pageHead(s?.name || 'Society', `${esc(s?.university || '')}`, `<a class="btn btn-ghost" href="#/societies">${ic('arrow-left')} All chapters</a>`) + `<div class="card"><div class="row gap-l">${seal(s?.short_name || '', 'lg')}<div><div class="strong">${esc(s?.city || '')}, ${esc(s?.country || '')}</div><div class="small muted">President: ${esc(s?.president || '—')} · ${s?.members || 0} members</div></div></div><p class="small muted mt">Detailed governance data is available to this Society's members, its Faculty Advisor and AASTEC staff.</p></div>`;
    return;
  }
  const s = ov.society, h = ov.health, c = ov.counts;
  view.innerHTML = pageHead(s.name, `${esc(s.university)} · ${esc(s.city)}, ${esc(s.country)}`, `<a class="btn btn-ghost" href="#/societies">${ic('arrow-left')} All chapters</a>${can('societies.manage') ? `<button class="btn btn-ghost" id="mng">${ic('settings')} Manage chapter</button>` : ''}${isAastec() ? `<button class="btn btn-primary" id="setctx">${ic('landmark')} Work in this Society</button>` : ''}`) + `
    <div class="kpis">${kpi({ icon: 'shield-check', tone: 'green', label: 'Chapter health', value: h.label, valCls: 'text', meta: bar(h.score, 'green', 'thin') })}${kpi({ icon: 'book-open-check', tone: 'gold', label: 'Handbook compliance', value: h.handbook_pct + '%' })}${kpi({ icon: 'users', tone: 'navy', label: 'Members', value: c.members, meta: `+${c.new_this_month} this month` })}
      ${kpi({ icon: 'calendar-days', tone: 'blue', label: 'Upcoming events', value: c.upcoming_month })}${kpi({ icon: 'file-text', tone: 'purple', label: 'Reports pending', value: c.reports_pending })}${kpi({ icon: 'triangle-alert', tone: 'red', label: 'Escalations', value: c.open_escalations })}</div>
    <div class="grid g-12"><div class="span-6">${card('Society hierarchy', 'network', orgChart(ov.hierarchy))}</div>
      <div class="span-6"><div class="col">${card('Upcoming events', 'calendar-days', ov.upcoming.length ? `<div class="list">${ov.upcoming.map(eventRow).join('')}</div>` : empty('No upcoming events', 'calendar'))}
      ${card('Elections', 'vote', ov.elections.length ? `<div class="list">${ov.elections.map(e => `<a class="li click" href="#/elections/${e.id}" style="text-decoration:none"><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">Cycle ${e.cycle_year}${e.sandbox ? ' · pilot' : ''}</div></div>${status(e.status)}</a>`).join('')}</div>` : empty('No elections', 'vote'))}
      ${card('Recent reports', 'file-text', ov.reports.length ? `<div class="list">${ov.reports.map(r => `<div class="li"><span class="grow small">${esc(r.title)}</span>${status(r.status)}</div>`).join('')}</div>` : empty('No reports', 'file-text'))}</div></div></div>`;
  $('#mng')?.addEventListener('click', async () => {
    const advisors = await api('/users?role=advisor&limit=500');
    const m = modal({ title: `Manage ${s.short_name}`, icon: 'settings', body: `<form id="mf"><div class="field"><label>Chapter status</label><select name="status">${[['forming', 'Forming'], ['active', 'Active'], ['probation', 'Probation'], ['suspended', 'Suspended']].map(([k, l]) => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Faculty Advisor</label><select name="advisor_id"><option value="">— Not assigned —</option>${advisors.map(a => `<option value="${a.id}" ${s.advisor_id === a.id ? 'selected' : ''}>${esc(a.full_name)}${a.society_short ? ' · ' + esc(a.society_short) : ''}</option>`).join('')}</select><div class="hint">Create the advisor's account under Users &amp; Roles first if it is not listed.</div></div>
      <div class="field"><label>Description</label><textarea name="description">${esc(s.description || '')}</textarea></div></form>`,
      foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="mgo">${ic('check', 'sm')} Save</button>` });
    $('#mgo', m).onclick = (e) => guard(e.currentTarget, async () => { const f = formData($('#mf', m)); await put(`/societies/${s.id}`, { ...f, advisor_id: f.advisor_id || null }); m.close(); APP.meta = await api('/meta'); toast('Chapter updated.'); route(); });
  });
  $('#setctx')?.addEventListener('click', () => { APP.ctx = String(s.id); localStorage.setItem('aastec_ctx', APP.ctx); updateCtx(); toast(`Context set to ${s.short_name}.`); location.hash = '#/members'; });
};

// ---------------- Profiles ----------------
ROUTES.profile = async (view, id) => {
  const p = await api(`/users/${id || APP.me.id}`);
  view.innerHTML = pageHead('Member Profile', '', `<a class="btn btn-ghost" href="javascript:history.back()">${ic('arrow-left')} Back</a>`) + `
    <div class="card mb-l"><div class="grid" style="grid-template-columns:minmax(0,1fr) 260px;gap:18px;align-items:center">
      <div class="row gap-l top">${avatar(p.full_name, p.id, 'xl', p.avatar_url)}<div><h2 style="font-size:26px">${esc(p.full_name)} ${chip(p.role_name, 'blue', 'user')}</h2>
        <div class="col gap-s mt small muted">${p.university_name ? `<span>${ic('landmark', 'sm')} ${esc(p.university_name)}</span>` : ''}${p.society_name ? `<span>${ic('shield', 'sm')} ${esc(p.society_name)}${p.committee_name ? ' · ' + esc(p.committee_name) : ''}</span>` : ''}${p.faculty ? `<span>${ic('graduation-cap', 'sm')} ${esc(p.faculty)}${p.study_year ? ' · ' + esc(p.study_year) : ''}</span>` : ''}${p.city ? `<span>${ic('map-pin', 'sm')} ${esc(p.city)}</span>` : ''}</div>
        <div class="row small mt"><b>${p.followers}</b> followers · <b>${p.following}</b> following</div></div></div>
      <div style="border-left:1px solid var(--line);padding-left:18px"><div class="strong">${ic('zap', 'sm')} Activity score</div><div style="font-family:var(--display);font-weight:800;font-size:34px;color:var(--heading)">${num(p.score.score)}</div><div style="color:var(--green);font-weight:700">${p.score.level}</div><div class="small muted">Top ${p.score.top}% of members</div>${bar(100 - p.score.top + 1, 'green')}</div></div>
      <div class="row wrap mt-l">${p.is_self ? `<a class="btn btn-primary" href="#/me">${ic('pencil', 'sm')} Edit profile</a>` : `<button class="btn btn-ghost" onclick="startChat(${p.id})">${ic('mail', 'sm')} Message</button><button class="btn btn-primary" id="fol">${ic(p.is_following ? 'user-check' : 'user-plus', 'sm')} ${p.is_following ? 'Following' : 'Follow'}</button>`}<a class="btn btn-ghost" href="#/calendar">${ic('calendar', 'sm')} Calendar</a><a class="btn btn-ghost" href="#/learning">${ic('book-open', 'sm')} Learn</a>${p.linkedin ? `<a class="btn btn-ghost" href="${esc(p.linkedin)}" target="_blank" rel="noopener">${ic('external-link', 'sm')} LinkedIn</a>` : ''}</div></div>
    <div class="grid g2 mb-l">${card('Bio', 'user', `<p>${esc(p.bio || 'No bio yet.')}</p>`)}${card('Interests & skills', 'sparkles', `<div class="row wrap">${p.interests.map(x => chip(x, 'gold')).join('') || '<span class="small muted">No interests listed.</span>'}</div><div class="section-title mt">Skills</div><div class="row wrap">${p.skills.map(x => chip(x, 'navy')).join('') || '<span class="small muted">No skills listed.</span>'}</div>`)}</div>
    <div class="grid g3">${card('Achievements & badges', 'trophy', `<div class="grid g2">${p.badges.map(b => `<div class="card surface tight center"><div class="ico tone-gold" style="width:38px;height:38px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center">${ic(b.icon)}</div><div class="small strong mt">${esc(b.name)}</div><div class="xs muted">${esc(b.desc)}</div></div>`).join('') || empty('No badges yet', 'trophy')}</div>
      <div class="row between small muted mt"><span>${p.counts.posts} posts</span><span>${p.counts.checkins} events</span><span>${p.counts.completed} courses</span></div>`)}
      ${card('Digital portfolio — certificates', 'award', p.certificates.length ? `<div class="list">${p.certificates.map(c => `<a class="li click" href="/verify/${c.code}" target="_blank" style="text-decoration:none">${ic('award')}<div class="grow"><div class="t">${esc(c.title)}</div><div class="s">${esc(c.category || '')} · ${fmtDate(c.issued_at)} · ${esc(c.code)}</div></div>${ic('external-link', 'sm')}</a>`).join('')}</div>` : empty('No certificates yet', 'award'))}
      ${card(p.venture ? 'Startup' : 'Recent posts', p.venture ? 'rocket' : 'message-square', p.venture ? `<a href="#/venture/${p.venture.id}" class="strong">${esc(p.venture.name)}</a><div class="small muted">${esc(p.venture.tagline || '')}</div><div class="row mt">${chip(p.venture.role_title, 'navy')}${chip(cap(p.venture.stage), 'gold')}</div>` : (p.posts.length ? `<div class="list">${p.posts.map(x => `<a class="li click" href="#/post/${x.id}" style="text-decoration:none"><div class="grow"><div class="small ellipsis">${esc(x.title || x.body)}</div><div class="xs muted">${ago(x.published_at)} · ${x.reactions} reactions</div></div></a>`).join('')}</div>` : empty('No posts yet', 'message-square')))}</div>`;
  $('#fol')?.addEventListener('click', (e) => guard(e.currentTarget, async () => { await post(`/users/${p.id}/follow`); route(); }));
};
ROUTES.me = async (view) => {
  const p = await api(`/users/${APP.me.id}`);
  view.innerHTML = pageHead('Edit profile', 'Your public profile across the AASTEC community') + `<div class="grid g-side"><div class="card"><form id="pf" class="grid-form">
    <div class="field full row gap-l">${avatar(p.full_name, p.id, 'lg', p.avatar_url)}<div><input type="file" id="pf-av" accept="image/png,image/jpeg,image/webp" class="hidden"><button type="button" class="btn btn-sm btn-ghost" onclick="$('#pf-av').click()">${ic('upload', 'sm')} Upload photo</button><div class="hint">PNG, JPEG or WebP up to 4 MB</div><input type="hidden" name="avatar_url" id="pf-avu" value="${esc(p.avatar_url || '')}"></div></div>
    <div class="field"><label>Full name</label><input name="full_name" value="${esc(p.full_name)}"></div><div class="field"><label>Headline / title</label><input name="title" value="${esc(p.title || '')}"></div>
    <div class="field"><label>Faculty / major</label><input name="faculty" value="${esc(p.faculty || '')}"></div><div class="field"><label>Study year</label><input name="study_year" value="${esc(p.study_year || '')}"></div>
    <div class="field"><label>City</label><input name="city" value="${esc(p.city || '')}"></div><div class="field"><label>Phone (private)</label><input name="phone" value="${esc(p.phone || '')}"></div>
    <div class="field full"><label>LinkedIn URL</label><input name="linkedin" value="${esc(p.linkedin || '')}" placeholder="https://www.linkedin.com/in/…"></div>
    <div class="field full"><label>Bio</label><textarea name="bio">${esc(p.bio || '')}</textarea></div>
    <div class="field full"><label>Interests (comma separated)</label><input name="interests" value="${esc(p.interests.join(', '))}"></div><div class="field full"><label>Skills (comma separated)</label><input name="skills" value="${esc(p.skills.join(', '))}"></div>
    <div class="full"><button class="btn btn-primary" type="submit">${ic('check', 'sm')} Save profile</button></div></form></div>
    <div class="card"><h3 class="mb">${ic('lock')} Change password</h3><form id="pw"><div class="field"><label>Current password</label><input type="password" name="current" required></div><div class="field"><label>New password</label><input type="password" name="password" minlength="8" required></div><button class="btn btn-ghost" type="submit">Update password</button></form></div></div>`;
  $('#pf-av').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; if (f.size > 4e6) return toast('Image must be 4 MB or smaller.', 'err'); const r = new FileReader(); r.onload = async () => { const u = await post('/uploads', { data: r.result }).catch(er => toast(er.message, 'err')); if (u) { $('#pf-avu').value = u.url; toast('Photo uploaded — save to apply.'); } }; r.readAsDataURL(f); };
  $('#pf').onsubmit = (e) => { e.preventDefault(); const f = formData(e.target); f.interests = f.interests.split(',').map(s => s.trim()).filter(Boolean); f.skills = f.skills.split(',').map(s => s.trim()).filter(Boolean); guard($('button[type=submit]', e.target), async () => { await put('/me/profile', f); APP.me = await api('/me'); toast('Profile saved.'); renderShell(); paintBadges(); location.hash = `#/profile/${APP.me.id}`; }); };
  $('#pw').onsubmit = (e) => { e.preventDefault(); guard($('button[type=submit]', e.target), async () => { await put('/me/password', formData(e.target)); e.target.reset(); toast('Password updated.'); }); };
};
