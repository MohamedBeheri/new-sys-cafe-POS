// ===================================================================
//  Role-based dashboards — every major role has its own view
// ===================================================================
'use strict';

// Society hierarchy (org chart): Advisor → President → VP → Committee Heads → teams
function orgChart(h, { compact = false } = {}) {
  const cs = h.committees || [];
  return `<div class="org">
    <div class="node advisor" title="${esc(h.advisor?.full_name || '')}">Faculty Advisor<small>${esc(h.advisor?.full_name || 'Supervision & Guidance')}</small></div><div class="vline"></div>
    <div class="node president" title="${esc(h.president?.full_name || '')}">President<small>${esc(h.president?.full_name || 'Overall Leadership')}</small></div><div class="vline"></div>
    <div class="node vp" title="${esc(h.vice_president?.full_name || '')}">Vice President<small>${esc(h.vice_president?.full_name || 'Deputy Leadership')}</small></div><div class="vline"></div>
    <div class="branch" style="grid-template-columns:repeat(${Math.max(cs.length, 1)},minmax(0,1fr))">${cs.map(c => `<div>
      <div class="node head" title="${esc(c.head?.full_name || 'Vacant')}">${esc(c.name.replace(' & ', ' & '))}<small>${esc(c.head ? c.head.full_name.split(' ')[0] : 'Vacant')}</small></div>
      ${compact ? '' : `<div class="node member">${c.members} member${c.members === 1 ? '' : 's'}</div>`}</div>`).join('')}</div>
    <div class="legend"><span><i style="background:var(--navy)"></i>Supervision</span><span><i style="background:var(--rally)"></i>Executive Leadership</span><span><i style="background:var(--gold)"></i>Committee Leadership</span><span><i style="background:var(--line)"></i>Team Members</span></div>
  </div>`;
}
const approvalRow = (it) => `<tr><td><div class="row">${it.by ? avatar(it.by.full_name, it.by.id, 'sm') : `<span class="av sm c1">${ic('vote', 'sm')}</span>`}<div><div class="strong small">${esc(it.by?.full_name || it.title)}</div><div class="xs muted">${esc(it.subtitle || '')}</div></div></div></td>
  <td class="small">${esc(it.title.split(' — ')[0])}</td><td class="small muted nowrap">${fmtDate(it.at)}</td>
  <td class="nowrap">${it.actions.includes('open') ? `<button class="btn btn-xs btn-soft" onclick="openApproval('${it.type}',${it.id})">Open</button>` : `<button class="btn btn-xs btn-success" title="Approve" onclick="decide('${it.type}',${it.id},true,this)">${ic('check', 'sm')}</button> <button class="btn btn-xs btn-danger" title="Reject" onclick="decide('${it.type}',${it.id},false,this)">${ic('x', 'sm')}</button>`}</td></tr>`;
const eventRow = (e) => `<div class="li click" onclick="location.hash='#/calendar/${e.id}'">${dateTile(e.start_at)}<div class="grow"><div class="t ellipsis">${esc(e.title)}</div><div class="s">${fmtTime(e.start_at)} · ${esc(e.location || cap(e.mode || ''))}</div></div>${e.kind === 'aastec' ? chip('AASTEC', 'blue') : e.my_rsvp ? status(e.my_rsvp) : ''}</div>`;
const electionCard = (els) => {
  const el = els?.find(e => !['closed', 'cancelled'].includes(e.status) && !e.sandbox) || els?.[0];
  return `<div class="row top"><div class="ico tone-red" style="width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--red-50);color:var(--red)">${ic('calendar-range', 'lg')}</div>
    <div class="grow"><div class="muted small">Election window</div><div style="font-family:var(--display);font-weight:800;font-size:20px;color:var(--red)">July – August</div></div></div>
    <div class="list mt">${[['Opened by the Rally Societies Programme Manager', true], ['Requires Faculty Advisor approval (each campus / partner university)', true], ['Short period — plan early', true]].map(([t]) => `<div class="li" style="padding:6px 0">${ic('circle-check', 'sm')}<span class="small">${t}</span></div>`).join('')}</div>
    ${el ? `<div class="card surface tight mt"><div class="row between"><div><div class="strong small">${esc(el.title)}</div><div class="xs muted">Cycle ${el.cycle_year}</div></div>${status(el.status)}</div></div><a class="link mt" href="#/elections/${el.id}">Open Election Centre ${ic('arrow-right', 'sm')}</a>` : ''}`;
};
const calendarRules = () => `<div class="list">${[['All users can view the calendar.', 'eye'], ['Only the Society President can add Society events.', 'crown'], ['Only AASTEC staff can add AASTEC-wide events.', 'landmark'], ['Members submit event proposals for approval.', 'calendar-plus']]
  .map(([t, i]) => `<div class="li" style="padding:7px 0">${ic(i, 'sm')}<span class="small">${t}</span></div>`).join('')}</div>
  <div class="legend"><span><i style="background:var(--blue)"></i>AASTEC events (staff only)</span><span><i style="background:var(--green)"></i>Society events (President only)</span></div>`;

ROUTES.dashboard = async (view) => {
  const d = await api('/dashboard');
  const fn = { executive: dashExecutive, president: dashPresident, vice_president: dashVP, committee_head: dashCommittee, advisor: dashAdvisor, agent: dashAgent, founder: dashFounder, mentor: dashMentor }[d.view] || dashMember;
  await fn(view, d);
};

// ---------------- Executive / AASTEC staff ----------------
function dashExecutive(view, d) {
  const me = APP.me; const k = d.kpis;
  const titles = { director: ['AASTEC Executive Portfolio', 'Strategic portfolio and impact across all Rally Societies and programmes'], deputy: ['Deputy Director Dashboard', 'Portfolio supervision and cross-functional coordination'],
    dept_head: ['Department Operations Dashboard', 'Teams, service delivery, compliance and department KPIs'], programme_manager: ['Programme Management Dashboard', 'Programmes, cohorts, participants, applications and outcomes'],
    staff: ['Operational Execution View', 'AASTEC-wide events, content and assigned operations'], admin: ['Platform Administration', 'Users, roles, settings and platform health'] }[me.role_key] || ['Dashboard', ''];
  view.innerHTML = pageHead(titles[0], titles[1], `${updated()}<a class="btn btn-ghost" href="#/leadership">${ic('network')} Leadership Centre</a><a class="btn btn-primary" href="#/kpi">${ic('chart-column')} KPI Centre</a>`) + `
    <div class="banner info">${ic('info', 'lg')}<div><b>AASTEC staff manage AASTEC-wide programmes and events.</b> Society Presidents manage only their own Societies. Faculty Advisors supervise.</div></div>
    <div class="kpis">
      ${kpi({ icon: 'layers', tone: 'navy', label: 'Active programmes', value: k.programmes, meta: 'Across AASTEC', link: '#/programmes' })}
      ${kpi({ icon: 'landmark', tone: 'gold', label: 'Rally Societies', value: k.societies, meta: `${k.societies_total} chapters · ${k.countries} countries`, link: '#/societies' })}
      ${kpi({ icon: 'users', tone: 'blue', label: 'Active members', value: num(k.members), meta: `<span class="up">+${k.members_new}</span> in 30 days` })}
      ${kpi({ icon: 'calendar-days', tone: 'green', label: 'Upcoming events', value: k.events_upcoming, meta: 'Next 30 days', link: '#/calendar' })}
      ${kpi({ icon: 'clipboard-check', tone: 'orange', label: 'Approval queue', value: k.approvals, meta: `${k.my_approvals} need your action`, link: '#/approvals' })}
      ${kpi({ icon: 'gauge', tone: 'purple', label: 'Rallians Score', value: `${d.rallians_score}<small style="font-size:13px" class="muted">/100</small>`, meta: `Reporting year ${d.reporting_year}`, link: '#/kpi' })}
    </div>
    <div class="grid g-12 mb-l">
      <div class="span-8">${card('Activity trend — last 12 months', 'chart-column', '<div style="height:260px"><canvas id="c-trend"></canvas></div>')}</div>
      <div class="span-4">${card('Members by country', 'globe', '<div style="height:260px"><canvas id="c-country"></canvas></div>')}</div>
    </div>
    <div class="grid g-12 mb-l">
      <div class="span-7">${card('Society health ranking', 'trophy', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Society</th><th>President</th><th style="width:150px">Health</th><th class="num">Members</th><th class="num">Events (60d)</th></tr></thead><tbody>
        ${d.ranking.map((s, i) => `<tr class="click" onclick="location.hash='#/society/${s.id}'"><td class="strong">${i + 1}</td><td><div class="row">${seal(s.short_name, 'xs')}<div><div class="strong">${esc(s.short_name)}</div><div class="xs muted">${esc(s.country)}</div></div></div></td><td class="small">${esc(s.president || '—')}</td>
          <td><div class="row"><div class="grow">${bar(s.score, s.score >= 85 ? 'green' : s.score >= 70 ? 'blue' : s.score >= 50 ? 'amber' : 'red')}</div><b class="small">${s.score}</b></div><div class="xs muted">${s.label}</div></td><td class="num">${s.members}</td><td class="num">${s.events60}</td></tr>`).join('')}</tbody></table></div>`, { link: '#/societies' })}</div>
      <div class="span-5">${card('Societies needing attention', 'triangle-alert', d.at_risk.length ? `<div class="list">${d.at_risk.map(s => `<div class="li click" onclick="location.hash='#/society/${s.id}'">${seal(s.short_name, 'xs')}<div class="grow"><div class="t">${esc(s.short_name)}</div><div class="s">Health ${s.score}/100 · ${s.missing_reports} missing report(s) · handbook ${s.handbook_pct}%</div></div>${status(s.score < 50 ? 'off' : 'improve')}</div>`).join('')}</div>` : empty('All Societies are healthy', 'shield-check'))}</div>
    </div>
    <div class="grid g-12 mb-l">
      <div class="span-4">${card('Approval queue (all roles)', 'inbox', `<div class="list">${d.queue.map(q => `<a class="li click" href="${q.link}" style="text-decoration:none">${ic(q.icon, 'sm')}<span class="grow small">${esc(q.label)}</span><b>${q.count}</b></a>`).join('')}</div>`, { link: '#/approvals', linkText: 'My approvals' })}</div>
      <div class="span-4">${card('Programmes', 'layers', `<div class="list">${d.programmes.map(p => `<a class="li click" href="#/programme/${p.id}" style="text-decoration:none"><span class="dot-st" style="background:${p.color}"></span><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.manager_name || '')} · ${p.open_cohorts} open cohort(s)</div></div>${status(p.status)}</a>`).join('')}</div>`, { link: '#/programmes' })}</div>
      <div class="span-4">${card('KPI highlights', 'target', `<div class="section-title">Strongest</div>${d.kpi_top.map(x => `<div class="row mb"><span class="grow small">${esc(x.label)}</span><div style="width:90px">${bar(Math.min(100, x.achievement), 'green', 'thin')}</div><b class="small">${x.achievement}%</b></div>`).join('')}
        <div class="section-title mt">Needs focus</div>${d.kpi_low.map(x => `<div class="row mb"><span class="grow small">${esc(x.label)}</span><div style="width:90px">${bar(x.achievement, 'amber', 'thin')}</div><b class="small">${x.achievement}%</b></div>`).join('')}`, { link: '#/kpi' })}</div>
    </div>
    <div class="grid g2">
      ${card('Recent governance activity', 'history', `<div class="list">${d.activity.map(a => `<div class="li">${avatar(a.actor_name, a.actor_name.length, 'sm')}<div class="grow"><div class="small"><b>${esc(a.actor_name)}</b> · ${esc(cap(a.action))} <span class="muted">${esc(a.entity_type)}</span></div><div class="xs muted">${ago(a.created_at)}</div></div></div>`).join('')}</div>`, can('audit.view') ? { link: '#/audit' } : {})}
      ${card('Election cycle status', 'vote', `<p class="small muted mb">Elections run only in the July–August window. Each Society needs Faculty Advisor activation approval.</p><div class="grid g2">${d.elections.map(e => `<div class="card surface tight"><div class="row between">${status(e.status)}<b style="font-size:20px;font-family:var(--display)">${e.n}</b></div></div>`).join('') || empty('No cycle configured yet', 'vote')}</div>`, { link: '#/elections', linkText: 'Election Centre' })}
    </div>`;
  chart($('#c-trend'), { type: 'bar', data: { labels: d.trend.map(t => fmtMonth(t.month)), datasets: [{ label: 'Society events', data: d.trend.map(t => t.society), backgroundColor: PALETTE[0], borderRadius: 4 }, { label: 'AASTEC events & trainings', data: d.trend.map(t => t.aastec), backgroundColor: PALETTE[1], borderRadius: 4 }] }, options: { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true } } } });
  chart($('#c-country'), { type: 'doughnut', data: { labels: d.countries.map(c => c.country), datasets: [{ data: d.countries.map(c => c.n), backgroundColor: PALETTE, borderWidth: 0 }] }, options: { cutout: '62%', plugins: { legend: { position: 'right' } } } });
}

// ---------------- President ----------------
async function dashPresident(view, d) {
  const h = d.health; const el = d.elections.find(e => !['closed', 'cancelled'].includes(e.status) && !e.sandbox);
  view.innerHTML = pageHead('Society President Dashboard', `Overview of ${esc(d.society.name)} — performance and governance`, `${updated()}<button class="btn btn-ghost" id="deleg">${ic('shield-check')} ${d.delegation ? 'End VP delegation' : 'Delegate to VP'}</button><a class="btn btn-primary" href="#/calendar/new">${ic('calendar-plus')} Create Society event</a>`) + `
    <div class="kpis">
      ${kpi({ icon: 'shield-check', tone: 'green', label: 'Chapter health', value: h.label, valCls: h.score >= 70 ? 'text green' : 'text gold', meta: `${bar(h.score, 'green', 'thin')}<div class="mt" style="margin-top:4px">${h.score}% Healthy & active</div>` })}
      ${kpi({ icon: 'book-open-check', tone: 'gold', label: 'Handbook compliance', value: h.handbook_pct + '%', valCls: 'gold', meta: bar(h.handbook_pct, 'gold', 'thin') })}
      ${kpi({ icon: 'users', tone: 'navy', label: 'Total members', value: d.counts.members, meta: `<span class="up">+${d.counts.new_this_month} this month</span>`, link: '#/members' })}
      ${kpi({ icon: 'clipboard-check', tone: 'orange', label: 'Pending approvals', value: d.counts.approvals, meta: 'Needs your action', link: '#/approvals' })}
      ${kpi({ icon: 'calendar-days', tone: 'blue', label: 'Upcoming events', value: d.counts.upcoming_month, meta: 'Next 30 days', link: '#/calendar' })}
      ${kpi({ icon: 'vote', tone: 'red', label: 'Election status', value: el ? STATUS[el.status]?.[0] || cap(el.status) : 'No cycle', valCls: 'text', meta: el ? `Opens ${fmtDate(el.nomination_start, { day: 'numeric', month: 'short' })}` : 'July – August window', link: '#/elections' })}
    </div>
    <div class="grid g-12 mb-l">
      <div class="span-6">${card('Society hierarchy', 'network', orgChart(d.hierarchy), { actions: chip('Post-election structure', 'solid-navy') })}</div>
      <div class="span-6">${card('Member authorization requests', 'shield-check', d.requests.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Member</th><th>Requested permission</th><th>Requested on</th><th>Action</th></tr></thead><tbody>
        ${d.requests.map(r => `<tr><td><div class="row">${avatar(r.full_name, r.id, 'sm')}<span class="strong small">${esc(r.full_name)}</span></div></td><td class="small">${esc(APP.meta.grant_types[r.perm_key])}${r.scope_note ? `<div class="xs muted">${esc(r.scope_note)}</div>` : ''}${r.status === 'head_reviewed' ? chip('Head recommended', 'blue') : ''}</td><td class="small muted">${fmtDate(r.created_at)}</td>
          <td class="nowrap"><button class="btn btn-xs btn-success" onclick="decide('authorization',${r.id},true,this)">${ic('check', 'sm')}</button> <button class="btn btn-xs btn-danger" onclick="decide('authorization',${r.id},false,this)">${ic('x', 'sm')}</button></td></tr>`).join('')}</tbody></table></div>` : empty('No pending requests', 'shield-check'), { link: '#/approvals', count: d.requests.length || null })}</div>
    </div>
    <div class="grid g3 mb-l">
      ${card('Election window', 'calendar-range', electionCard(d.elections))}
      ${card('Calendar rules', 'calendar', calendarRules())}
      ${card('Chapters & universities', 'globe', `<div class="grid g2">${d.chapters.map(c => `<a class="card surface tight center" href="#/society/${c.id}" style="text-decoration:none">${seal(c.short_name)}<div class="small strong mt">${esc(c.short_name)}</div><div class="xs muted">${esc(c.city)}, ${esc(c.country)}</div></a>`).join('')}</div>`, { link: '#/societies', linkText: 'View map' })}
    </div>
    <div class="grid g2">
      ${card('Upcoming events', 'calendar-days', d.upcoming.length ? `<div class="list">${d.upcoming.map(eventRow).join('')}</div>` : empty('No upcoming events', 'calendar'), { link: '#/calendar' })}
      ${card('Governance & reporting', 'file-text', `<div class="section-title">Monthly reports</div><div class="list">${d.reports_due.map(r => `<div class="li"><span class="grow small">${fmtMonth(r.period)} activity report <span class="muted">· due ${fmtDate(r.due_on)}</span></span>${status(r.status)}</div>`).join('')}</div>
        <div class="section-title mt">Open escalations</div>${d.escalations.length ? `<div class="list">${d.escalations.map(e => `<div class="li"><span class="dot-st ${e.severity === 'high' ? 'red' : e.severity === 'medium' ? 'amber' : 'green'}"></span><span class="grow small">${esc(e.title)}</span>${status(e.status)}</div>`).join('')}</div>` : '<div class="small muted">No open escalations.</div>'}`, { link: '#/reports' })}
    </div>`;
  $('#deleg').onclick = async (e) => {
    const on = !d.delegation;
    if (!await confirmBox(on ? 'Delegate substitute President authority to the Vice President? The Faculty Advisor is notified and the action is recorded in the audit log.' : 'End the Vice President delegation?', { ok: on ? 'Delegate authority' : 'End delegation' })) return;
    await guard(e.currentTarget, async () => { await post(`/societies/${APP.me.society_id}/delegation`, { active: on }); toast(on ? 'Authority delegated to the Vice President.' : 'Delegation ended.'); route(); });
  };
}

// ---------------- Vice President ----------------
function dashVP(view, d) {
  const cs = d.hierarchy.committees;
  view.innerHTML = pageHead('Vice President Dashboard', 'Deputy Leader • Supporting the President • Empowering Committees', updated()) + `
    <div class="banner navy">${ic('shield', 'xl')}<div class="grow"><h4>Deputy Leadership</h4><div class="small" style="opacity:.85">You act for the President when needed and ensure continuity, strategy and execution across the Society.</div></div>
      <div class="row" style="border-left:1px solid rgba(255,255,255,.2);padding-left:16px">${ic('circle-check')}<div><b>Substitute authority</b><div class="small" style="opacity:.85">${d.delegation ? 'Active — you can act with full President authority.' : 'Not delegated — the President holds authority.'}</div></div></div>
      <div class="card" style="background:transparent;border-color:rgba(255,255,255,.25);color:#fff;padding:8px 12px;box-shadow:none"><b class="small">You are next in line.</b><div class="xs" style="opacity:.85">President › Vice President › Committee Heads</div></div></div>
    <div class="kpis">
      ${kpi({ icon: 'star', tone: 'navy', label: 'Leadership role', value: 'Vice President', valCls: 'text', meta: '<span style="color:var(--purple);font-weight:600">Deputy Leader</span>' })}
      ${kpi({ icon: 'users', tone: 'blue', label: 'Total members', value: d.counts.members, meta: `<span class="up">+${d.counts.new_this_month} this month</span>` })}
      ${kpi({ icon: 'users-round', tone: 'gold', label: 'Committees supported', value: cs.length, meta: 'All active committees' })}
      ${kpi({ icon: 'clipboard-check', tone: 'orange', label: 'Approvals', value: d.approvals.length, meta: d.delegation ? 'Delegated authority' : 'Visible to you', link: '#/approvals' })}
      ${kpi({ icon: 'user-check', tone: 'purple', label: 'Member requests', value: d.counts.pending_society, meta: 'Awaiting decision' })}
      ${kpi({ icon: 'shield-check', tone: 'green', label: 'Substitute authority', value: d.delegation ? 'Active' : 'Standby', valCls: d.delegation ? 'text green' : 'text', meta: d.delegation ? 'Full authority granted' : 'Through delegation only' })}
    </div>
    <div class="grid g-12 mb-l">
      <div class="span-4">${card('Post-election leadership hierarchy', 'network', orgChart(d.hierarchy, { compact: true }))}</div>
      <div class="span-5">${card('Committee coordination hub', 'users-round', `<div class="list">${cs.map(c => `<div class="li click" onclick="location.hash='#/committees/${c.id}'">${avatar(c.name, c.id, 'sm')}<div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.status_note || `${c.open_tasks} open task(s)${c.overdue ? ` · ${c.overdue} overdue` : ''}`)}</div></div>${status(c.status)}</div>`).join('')}</div>`, { link: '#/committees' })}</div>
      <div class="span-3">${card("Today's agenda", 'calendar-clock', d.agenda.length ? `<div class="list">${d.agenda.map(a => `<div class="li"><div style="width:62px" class="small strong">${fmtTime(a.at)}<div class="xs muted">${fmtDate(a.at, { day: 'numeric', month: 'short' })}</div></div><div class="grow"><div class="small strong">${esc(a.title)}</div><div class="xs muted">${a.type === 'task' ? 'Task due' : esc(a.location || '')}</div></div></div>`).join('')}</div>` : empty('Nothing scheduled in the next 3 days', 'calendar'), { link: '#/calendar', linkText: 'Full calendar' })}</div>
    </div>
    <div class="grid g4">
      ${card('Approvals & requests', 'clipboard-check', d.approvals.length ? `<div class="list">${d.approvals.map(a => `<div class="li"><div class="grow"><div class="small strong">${esc(a.title)}</div><div class="xs muted">${esc(a.step)}</div></div></div>`).join('')}</div>` : empty('Nothing pending', 'clipboard-check'), { link: '#/approvals' })}
      ${card('Pending issues & escalations', 'triangle-alert', d.escalations.length ? `<div class="list">${d.escalations.map(e => `<div class="li"><div class="grow small strong">${esc(e.title)}</div>${chip(cap(e.severity), e.severity === 'high' ? 'red' : e.severity === 'medium' ? 'amber' : 'green')}</div>`).join('')}</div>` : empty('No escalations', 'shield-check'))}
      ${card('Handover readiness', 'list-checks', `<div class="row gap-l">${ring(d.readiness.pct, { size: 96, stroke: 10, color: 'var(--green)', sub: 'Ready' })}<div class="list grow">${d.readiness.items.map(i => `<div class="row small" style="padding:3px 0">${ic(i.ok ? 'circle-check' : 'circle-dot', 'sm')}<span class="${i.ok ? '' : 'muted'}">${esc(i.label)}</span></div>`).join('')}</div></div>`)}
      ${card('Leadership pipeline', 'crown', `<div class="list"><div class="li">${ic('crown', 'sm')}<span class="grow small">Committee Heads</span><b>${d.pipeline.heads} active</b></div><div class="li">${ic('trending-up', 'sm')}<span class="grow small">Emerging leaders (top 25%)</span><b>${d.pipeline.emerging}</b></div></div>
        <div class="section-title mt">Top contributors</div>${d.pipeline.top.map(t => `<a class="row mb" href="#/profile/${t.id}">${avatar(t.full_name, t.id, 'sm')}<span class="grow small">${esc(t.full_name)}</span><span class="small muted">${t.score} pts</span></a>`).join('')}`)}
    </div>`;
}

// ---------------- Committee Head ----------------
function dashCommittee(view, d) {
  const s = d.stats; const c = d.committee;
  view.innerHTML = pageHead('Committee Head Workspace', `${esc(c.name)} Committee ${chip('Active', 'purple')}`, `<div class="row">${ic('crown')}<div><div class="xs muted">Your role in the hierarchy</div><b class="small">Committee Head</b> <span class="xs" style="color:var(--green)">You lead this committee</span></div></div>${updated()}`) + `
    <div class="grid g-12 mb-l"><div class="span-8"><div class="kpis" style="margin:0">
      ${kpi({ icon: 'target', tone: 'navy', label: 'KPI contribution', value: s.contribution + '%', meta: bar(s.contribution, 'green', 'thin') + '<div style="margin-top:4px">Target 80%</div>' })}
      ${kpi({ icon: 'clipboard-check', tone: 'gold', label: 'Content delivered', value: `${s.delivered} / ${s.deliverables}`, meta: bar(pct(s.delivered, s.deliverables), 'gold', 'thin') + `<div style="margin-top:4px">${s.deliverables - s.delivered} pending</div>` })}
      ${kpi({ icon: 'users', tone: 'green', label: 'Member engagement', value: s.engagement + '%', meta: 'Active in the last 30 days' })}
      ${kpi({ icon: 'calendar-check', tone: 'blue', label: 'Event support', value: s.events_supported, meta: 'Events supported recently' })}
    </div></div>
    <div class="span-4">${card('Your authority & responsibilities', 'shield-check', `<div class="list">${['Lead and manage the committee', 'Review committee content before President approval', 'Assign tasks and set deadlines', 'Monitor performance and KPI achievement', 'Represent the committee in leadership meetings', 'Ensure compliance with the Rally Society Handbook', 'Report progress to the Vice President and President'].map(t => `<div class="row small" style="padding:3px 0">${ic('circle-check', 'sm')}${t}</div>`).join('')}</div>
      <div class="banner gold mt small" style="margin-bottom:0">${ic('info', 'sm')}You have decision authority for all committee matters within handbook guidelines.</div>`)}</div></div>
    <div class="grid g-12 mb-l">
      <div class="span-3">${card('Society hierarchy', 'network', `<div class="org"><div class="node advisor">Faculty Advisor<small>${esc(d.hierarchy.advisor?.full_name || '')}</small></div><div class="vline"></div><div class="node president">President<small>${esc(d.hierarchy.president?.full_name || '')}</small></div><div class="vline"></div>
        <div class="node vp">Vice President<small>${esc(d.hierarchy.vice_president?.full_name || '')}</small></div><div class="vline"></div><div class="node head">${esc(c.name)}<small>Committee Head (You)</small></div><div class="vline"></div>
        <div class="row wrap" style="justify-content:center;gap:6px">${d.members.slice(0, 6).map(m => `<a href="#/profile/${m.id}" class="center" style="width:52px">${avatar(m.full_name, m.id, 'sm')}<div class="xs muted ellipsis">${esc(m.full_name.split(' ')[0])}</div></a>`).join('')}</div></div>`, { link: `#/committees/${c.id}`, linkText: 'Full team' })}</div>
      <div class="span-5">${card('My assigned tasks', 'list-todo', d.tasks.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Task</th><th>Priority</th><th>Due</th><th>Status</th></tr></thead><tbody>${d.tasks.map(t => `<tr><td class="small strong">${esc(t.title)}<div class="xs muted">${esc(t.assignee_name || '')}</div></td><td>${chip(cap(t.priority), PRIORITY[t.priority])}</td><td class="small nowrap">${fmtDate(t.due_on, { day: 'numeric', month: 'short' })}</td><td>${status(t.status)}</td></tr>`).join('')}</tbody></table></div>` : empty('No open tasks', 'list-todo'), { link: `#/committees/${c.id}`, count: d.tasks.length || null })}</div>
      <div class="span-4">${card('Event duties', 'calendar-check', d.duties.length ? `<div class="list">${d.duties.map(e => `<div class="li click" onclick="location.hash='#/calendar/${e.id}'"><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${fmtDT(e.start_at)}</div></div>${status(e.status)}</div>`).join('')}</div>` : empty('No event duties', 'calendar'), { link: '#/calendar', linkText: 'All events' })}</div>
    </div>
    <div class="grid g-12 mb-l">
      <div class="span-5">${card('Content & deliverable deadlines', 'clock', d.deadlines.length ? `<div class="list">${d.deadlines.map(t => `<div class="li"><div class="grow"><div class="t">${esc(t.title)}</div><div class="s">Due ${fmtDate(t.due_on)}</div></div>${status(t.status)}</div>`).join('')}</div>` : empty('No deadlines in the next two weeks', 'clock'))}</div>
      <div class="span-3">${card('Attendance overview', 'activity', `<div class="grid g2"><div class="card surface tight"><div class="xs muted">Events this month</div><b style="font-size:22px;font-family:var(--display)">${s.attended} / ${s.events_month * (d.members.length + 1) || 0}</b><div class="xs muted">check-ins</div></div><div class="card surface tight"><div class="xs muted">Attendance rate</div><b style="font-size:22px;font-family:var(--display);color:var(--green)">${s.attendance}%</b>${bar(s.attendance, 'green', 'thin')}</div></div>`)}</div>
      <div class="span-4">${card('Internal chat', 'messages-square', d.chat ? `<div class="small strong mb">${esc(d.chat.title)}</div>${d.chat.messages.map(m => `<div class="row top mb">${avatar(m.full_name, m.full_name.length, 'xs')}<div class="grow"><div class="xs"><b>${esc(m.full_name)}</b> <span class="muted">${fmtTime(m.created_at)}</span></div><div class="small">${esc(m.body)}</div></div></div>`).join('')}<a class="btn btn-sm btn-soft btn-block" href="#/messages/${d.chat.id}">Open chat</a>` : empty('No committee chat yet', 'messages-square'))}</div>
    </div>
    <div class="grid g-12">
      <div class="span-5">${card('Committee documents', 'folder', d.documents.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Document</th><th>Type</th><th>Updated</th><th>Uploaded by</th></tr></thead><tbody>${d.documents.map(x => `<tr><td class="small strong">${ic('file-text', 'sm')} ${esc(x.title)}</td><td class="small">${esc(x.doc_type || '')}</td><td class="small muted">${fmtDate(x.created_at)}</td><td class="small">${esc(x.uploaded_by_name || '')}</td></tr>`).join('')}</tbody></table></div>` : empty('No documents', 'folder'))}</div>
      <div class="span-4">${card('Handbook compliance', 'book-open-check', `<div class="list">${d.compliance.map(x => `<div class="li"><span class="grow small">${ic(x.ok ? 'circle-check' : 'circle-alert', 'sm')} ${esc(x.label)}</span>${chip(x.ok ? 'Compliant' : (x.note || 'Action needed'), x.ok ? 'green' : 'amber')}</div>`).join('')}</div>`, { link: '#/handbook', linkText: 'View handbook' })}</div>
      <div class="span-3">${card('Quick actions', 'zap', `<div class="grid g2">${[['list-todo', 'Assign task', `#/committees/${c.id}`], ['megaphone', 'Create announcement', '#/community/compose'], ['upload', 'Upload document', `#/committees/${c.id}`], ['calendar-plus', 'Propose meeting', '#/calendar/new']].map(([i, t, l], k) => `<a class="card surface tight center" href="${l}" style="text-decoration:none"><div class="ico tone-${['gold', 'blue', 'green', 'purple'][k]}" style="width:36px;height:36px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:4px">${ic(i)}</div><div class="xs strong">${t}</div></a>`).join('')}</div>`)}</div>
    </div>`;
}

// ---------------- Faculty Advisor ----------------
async function dashAdvisor(view) { await renderSupervision(view, APP.me.society_id, true); }

// ---------------- Member ----------------
function memberBanners(d) {
  let h = '';
  if (d.profile.membership_status === 'pending') h += `<div class="banner warn">${ic('clock', 'lg')}<div><b>Your membership is awaiting approval.</b> Your Society President reviews new applications. Meanwhile you can explore the community, the calendar and the Learning Hub.</div></div>`;
  if (!d.handbook_ack) h += `<div class="banner gold">${ic('book-open', 'lg')}<div class="grow"><b>Please acknowledge the Rally Society Handbook.</b> It is required for election eligibility and official duties.</div><a class="btn btn-primary btn-sm" href="#/handbook">Review handbook</a></div>`;
  for (const e of d.elections || []) {
    if (e.status === 'voting' && e.eligible && !e.voted) h += `<div class="banner navy">${ic('vote', 'xl')}<div class="grow"><h4>Voting is open${e.sandbox ? ' — pilot rehearsal' : ''}</h4><div class="small" style="opacity:.85">${esc(e.title)} · closes ${fmtDT(e.voting_end)}. Your vote is anonymous and secure.</div></div><a class="btn btn-gold" href="#/elections/${e.id}">Cast your ballot</a></div>`;
    else if (e.status === 'nominations' && e.eligible) h += `<div class="banner info">${ic('vote', 'lg')}<div class="grow"><b>Nominations are open.</b> ${esc(e.title)} — stand for the Society board until ${fmtDate(e.nomination_end)}.</div><a class="btn btn-primary btn-sm" href="#/elections/${e.id}">Nominate yourself</a></div>`;
  }
  return h;
}
function profileCard(p) {
  return `<div class="card"><div class="row top gap-l">${avatar(p.full_name, APP.me.id, 'lg', APP.me.avatar_url)}<div class="grow"><h3 style="font-size:18px">${esc(p.full_name)} ${chip(APP.me.role_name, 'blue', 'user')}</h3>
    <div class="small muted mt">${ic('landmark', 'sm')} ${esc(p.university || '')}</div><div class="small muted">${ic('shield', 'sm')} ${esc(p.society ? p.society : 'AASTEC')}</div>${p.faculty ? `<div class="small muted">${ic('graduation-cap', 'sm')} ${esc(p.faculty)}${p.study_year ? ' · ' + esc(p.study_year) : ''}</div>` : ''}</div></div>
    <div class="card surface tight mt"><div class="row between"><div class="small strong">${ic('zap', 'sm')} Activity score</div>${chip(p.level, p.level === 'Excellent' ? 'green' : 'blue')}</div>
      <div class="row between"><b style="font-family:var(--display);font-size:30px;color:var(--heading)">${num(p.score)}</b><span class="small muted">Top ${p.top}% of members</span></div>${bar(100 - p.top + 1, 'green')}</div>
    <div class="row wrap mt">${p.badges.slice(0, 5).map(b => `<span class="chip gold" title="${esc(b.desc)}">${ic(b.icon, 'sm')}${esc(b.name)}</span>`).join('')}</div>
    <div class="row mt"><a class="btn btn-sm btn-ghost" href="#/profile/${APP.me.id}">${ic('user', 'sm')} Profile</a><a class="btn btn-sm btn-ghost" href="#/calendar">${ic('calendar', 'sm')} Calendar</a><a class="btn btn-sm btn-primary" href="#/learning">${ic('book-open', 'sm')} Learn</a></div></div>`;
}
const passCard = (code, name) => `<div class="card navy"><div class="row top gap-l"><div class="qr-box">${qrImg(code, 4)}</div><div class="grow"><h3 style="font-size:16px">Event check-in pass</h3><p class="small muted">Show this QR code to the organiser at check-in, or scan the event's QR code with your phone.</p>
  <div class="mt"><b>${esc(name)}</b><div class="small" style="color:var(--gold)">Member ID: ${esc(code)}</div></div></div></div></div>`;
function dashMember(view, d) {
  const p = d.profile;
  view.innerHTML = pageHead(`Welcome back, ${esc(p.full_name.split(' ')[0])}`, `${esc(p.society ? p.society : 'AASTEC Digital Platform')} · Connect. Collaborate. Create impact.`, `<a class="btn btn-ghost" href="#/community">${ic('messages-square')} Community</a><a class="btn btn-primary" href="#/calendar">${ic('calendar-days')} Calendar</a>`) + memberBanners(d) + `
    <div class="grid g3 mb-l">${profileCard(p)}
      ${card('My learning', 'graduation-cap', `${d.learning.length ? d.learning.map(l => `<a class="li click" href="#/course/${l.course_id}" style="text-decoration:none"><span class="dot-st" style="background:${l.color}"></span><div class="grow"><div class="t ellipsis">${esc(l.title)}</div>${bar(l.progress, 'gold', 'thin')}</div><b class="small">${l.progress}%</b></a>`).join('') : empty('Start a course from the Learning Hub', 'graduation-cap')}
        <div class="grid g2 mt"><div class="card surface tight"><div class="xs muted">Certificates</div><b style="font-size:22px;font-family:var(--display)">${d.certificates}</b></div><div class="card surface tight"><div class="xs muted">Learning streak</div><b style="font-size:22px;font-family:var(--display);color:var(--orange)">${d.streak} ${ic('flame')}</b></div></div>`, { link: '#/learning', linkText: 'Learning Hub' })}
      <div class="col">${passCard(d.pass, p.full_name)}${card('My events', 'calendar-check', d.my_events.length ? `<div class="list">${d.my_events.map(eventRow).join('')}</div>` : empty('You have no upcoming RSVPs', 'calendar'))}</div>
    </div>
    <div class="grid g3">
      ${card('Suggested events', 'calendar-plus', d.suggested.length ? `<div class="list">${d.suggested.map(eventRow).join('')}</div>` : empty('No suggestions right now', 'calendar'), { link: '#/calendar' })}
      ${card('Announcements', 'megaphone', d.announcements.length ? `<div class="list">${d.announcements.map(a => `<a class="li click" href="#/post/${a.id}" style="text-decoration:none">${a.identity === 'aastec' ? seal('', 'xs', true) : seal(a.society_short || '', 'xs')}<div class="grow"><div class="t ellipsis">${esc(a.title || a.body)}</div><div class="s">${ago(a.published_at)}</div></div></a>`).join('')}</div>` : empty('No announcements', 'megaphone'), { link: '#/community' })}
      ${card('My authorizations', 'key-round', `${d.grants.map(g => `<div class="li">${ic('badge-check', 'sm')}<span class="grow small strong">${esc(APP.meta.grant_types[g.perm_key])}</span><span class="xs muted">until ${fmtDate(g.expires_at)}</span></div>`).join('')}
        ${d.requests.map(r => `<div class="li"><span class="grow small">${esc(APP.meta.grant_types[r.perm_key])}<div class="xs muted">${fmtDate(r.created_at)}</div></span>${status(r.status)}</div>`).join('') || (d.grants.length ? '' : '<p class="small muted">Request authorization when you take on official duties such as event support or official posting.</p>')}
        ${APP.me.society_id ? `<button class="btn btn-sm btn-primary mt" onclick="requestAuthorization()">${ic('key-round', 'sm')} Request authorization</button>` : ''}`)}
    </div>`;
}

// ---------------- Incubator Agent ----------------
function dashAgent(view, d) {
  const colors = ['var(--navy)', 'var(--gold)', 'var(--green)', '#7fc99a'];
  const apps = Object.fromEntries(d.applications.map(a => [a.status, a.n]));
  view.innerHTML = pageHead('Rally Incubator Agent Dashboard', `${esc(d.profile.university || '')}`, `<a class="btn btn-ghost" href="#/incubator">${ic('funnel')} Scouting funnel</a><button class="btn btn-gold" onclick="newLead()">${ic('plus')} Log a startup lead</button>`) + `
    <div class="banner navy">${ic('star', 'xl')}<div><h4>You are a Rally Incubator Agent!</h4><div class="small" style="opacity:.85">Champion entrepreneurship. Support founders. Build the future.</div></div></div>
    <div class="grid g-12 mb-l">
      <div class="span-3"><div class="card navy"><div class="row gap-l">${avatar(d.profile.full_name, APP.me.id, 'lg')}<div><h3>Hello, ${esc(d.profile.full_name.split(' ')[0])}!</h3><div class="small muted">Rally Incubator Agent</div><div class="small muted">${esc(d.profile.society || '')}</div></div></div>
        <div class="row mt">${chip('Active Agent', 'green')}${chip('AY ' + d.profile.academic_year, 'solid-gold')}</div><div class="section-title mt" style="color:#fff">Your impact this semester</div>
        ${[['search', 'Startups identified', d.impact.startups], ['users', 'Teams supported', d.impact.teams], ['calendar', 'Events organised', d.impact.events], ['user-check', 'Students reached', d.impact.reached]].map(([i, l, v]) => `<div class="row" style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.1)">${ic(i, 'sm')}<span class="grow small">${l}</span><b>${v}</b></div>`).join('')}</div></div>
      <div class="span-4">${card('Local startup scouting funnel', 'funnel', `<div class="funnel">${d.funnel.map((f, i) => `<div class="lvl" style="width:${100 - i * 17}%;background:${colors[i]};${i === 1 ? 'color:var(--navy)' : ''}"><b>${f.n}</b><small>${esc(f.label)}</small></div>`).join('')}</div>`, { link: '#/incubator', linkText: 'Manage leads' })}</div>
      <div class="span-3">${card('Incubator applications', 'file-check', `<div class="grid g2" style="gap:8px">${[['received', 'Received'], ['under_review', 'Under review'], ['shortlisted', 'Shortlisted'], ['selected', 'Selected']].map(([k, l], i) => `<div class="card surface tight center"><b style="font-family:var(--display);font-size:22px;color:${['var(--green)', 'var(--navy)', 'var(--gold-600)', 'var(--blue)'][i]}">${apps[k] || 0}</b><div class="xs muted">${l}</div></div>`).join('')}</div>`)}</div>
      <div class="span-2">${card('Quick actions', 'zap', `<div class="list">${[['rocket', 'Log a new startup lead', 'newLead()'], ['megaphone', 'Promote info session', "location.hash='#/calendar/new'"], ['user-plus', 'Refer a mentor', "location.hash='#/mentors'"], ['file-text', 'Submit monthly report', "location.hash='#/reports'"], ['circle-help', 'Request support', "location.hash='#/messages'"]].map(([i, t, a]) => `<button class="li click small strong" style="width:100%" onclick="${a}">${ic(i, 'sm')}<span class="grow" style="text-align:left">${t}</span>${ic('chevron-right', 'sm')}</button>`).join('')}</div>`)}</div>
    </div>
    <div class="grid g-12 mb-l">
      <div class="span-3">${card('Teams supported', 'users', '<div style="height:200px"><canvas id="c-stage"></canvas></div>')}</div>
      <div class="span-4">${card('Mentor matching', 'handshake', `<div class="grid g4" style="gap:8px">${[['Mentors engaged', d.matching.mentors], ['Mentorship sessions', d.matching.sessions], ['Teams matched', d.matching.teams], ['Avg. rating', d.matching.rating + '/5']].map(([l, v]) => `<div class="center"><b style="font-family:var(--display);font-size:20px;color:var(--heading)">${v}</b><div class="xs muted">${l}</div></div>`).join('')}</div>
        <div class="section-title mt">Recent matches</div>${d.matching.recent.map(m => `<div class="li">${avatar(m.mentor, m.mentor.length, 'sm')}<div class="grow"><div class="small strong">${esc(m.mentor)}</div><div class="xs muted">${esc(m.headline || '')}</div></div>${ic('arrow-right', 'sm')}<span class="small strong">${esc(m.venture)}</span>${chip('Active', 'green')}</div>`).join('') || '<p class="small muted">No matches yet.</p>'}`)}</div>
      <div class="span-3">${card('Upcoming information sessions', 'presentation', d.sessions.length ? `<div class="list">${d.sessions.map(eventRow).join('')}</div>` : empty('Schedule your next info session', 'presentation'), { link: '#/calendar' })}</div>
      <div class="span-2">${card('Reports due', 'file-text', d.reports.length ? `<div class="list">${d.reports.map(r => `<div class="li"><span class="grow small">${fmtMonth(r.period)}</span>${status(r.status)}</div>`).join('')}</div>` : empty('No reports yet', 'file-text'))}</div>
    </div>
    <div class="grid g-12">
      <div class="span-3">${card('Training completion', 'graduation-cap', `<div class="row gap-l">${ring(d.training.pct, { size: 100, stroke: 10, color: 'var(--green)', sub: 'Completed' })}<div><b style="font-size:20px;font-family:var(--display)">${d.training.done} / ${d.training.total}</b><div class="xs muted">Agent path courses</div></div></div>`, { link: '#/learning', linkText: 'My training' })}</div>
      <div class="span-9">${card('Cross-university agent network', 'network', `<div class="row wrap" style="justify-content:space-around;gap:16px">${d.network.map(a => `<a class="center" href="#/profile/${a.id}" style="width:120px;text-decoration:none">${seal(a.society_short || '', 'lg')}<div class="small strong mt">${esc(a.society_short || '')}</div><div class="xs muted">${esc(a.full_name)}</div>${a.me ? chip('You', 'solid-gold') : chip('Active', 'green')}</a>`).join('')}</div>`)}</div>
    </div>`;
  chart($('#c-stage'), { type: 'doughnut', data: { labels: d.stages.map(s => cap(s.stage)), datasets: [{ data: d.stages.map(s => s.n), backgroundColor: [PALETTE[0], PALETTE[1], PALETTE[3], '#7fc99a'], borderWidth: 0 }] }, options: { cutout: '60%', plugins: { legend: { position: 'bottom' } } } });
}

// ---------------- Founder ----------------
function dashFounder(view, d) {
  const v = d.venture;
  if (!v) { dashMember(view, d); $('.page-head .actions').insertAdjacentHTML('afterbegin', `<button class="btn btn-gold" onclick="newVenture()">${ic('rocket')} Register your venture</button>`); return; }
  const t = v.traction; const ms = d.milestones; const done = ms.filter(m => m.status === 'completed').length;
  const certDone = d.certificates_path.filter(c => c.status === 'completed').length;
  view.innerHTML = pageHead('Founder & Startup Team Workspace', `${esc(v.cohort_name || 'Rally Incubator')} · Rally Society ${esc(v.society_short || '')}`, `<a class="btn btn-ghost" href="#/venture/${v.id}">${ic('pencil')} Edit venture</a><a class="btn btn-primary" href="#/incubator">${ic('rocket')} Incubator</a>`) + `
    <div class="grid g-12 mb-l">
      <div class="span-9"><div class="card"><div class="grid" style="grid-template-columns:minmax(0,1.6fr) minmax(0,.8fr) minmax(0,1.2fr);gap:18px;align-items:center">
        <div class="row gap-l top"><div style="width:96px;height:96px;border-radius:50%;background:${v.color};display:flex;align-items:center;justify-content:center;color:#fff;font-family:var(--display);font-weight:800;font-size:24px;flex-shrink:0">${esc(v.name.split(' ').map(w => w[0]).join('').slice(0, 2))}</div>
          <div><h2 style="font-size:22px">${esc(v.name)} ${status(v.status)}</h2><div class="muted">${esc(v.tagline || '')}</div><div class="small muted mt">${ic('map-pin', 'sm')} ${esc(v.society_short || '')} · ${ic('calendar', 'sm')} Founded ${fmtDate(v.founded_on, { month: 'short', year: 'numeric' })} · ${ic('users', 'sm')} Team of ${d.team.length}</div>
          <div class="row wrap mt">${v.tags.map(x => chip(x, 'green')).join('')}</div></div></div>
        <div style="border-left:1px solid var(--line);padding-left:16px"><div class="small strong" style="color:var(--rally)">${ic('rocket', 'sm')} Venture stage</div><div style="font-family:var(--display);font-weight:800;font-size:22px;color:var(--heading);margin:6px 0">${cap(v.stage)}</div><div class="xs muted">Milestones ${t.milestone_pct}% complete</div></div>
        <div class="row gap-l" style="border-left:1px solid var(--line);padding-left:16px">${ring(t.score, { size: 104, stroke: 11, color: 'var(--gold)', label: t.score, sub: '/100' })}<div class="grow">${[['Problem validation', 'problem'], ['Solution fit', 'solution'], ['Market potential', 'market'], ['Team execution', 'team']].map(([l, k]) => `<div class="row xs" style="padding:2px 0"><span class="grow muted">${l}</span><b>${t.scores[k] ?? '—'}/100</b></div>`).join('')}<div class="xs strong mt" style="color:var(--gold-600)">Traction score</div></div></div>
      </div></div></div>
      <div class="span-3">${card('Startup profile', 'building-2', `<div class="list">${[['file-pen-line', 'Incorporation', v.registration || 'Not registered yet'], ['layers', 'Sector', v.sector], ['globe', 'Website', v.website], ['mail', 'Email', v.email]].map(([i, l, x]) => `<div class="li" style="padding:6px 0">${ic(i, 'sm')}<div><div class="xs muted">${l}</div><div class="small strong">${esc(x || '—')}</div></div></div>`).join('')}</div><a class="btn btn-sm btn-block mt" style="background:var(--rally);color:#fff" href="#/venture/${v.id}">View full profile ${ic('arrow-right', 'sm')}</a>`)}</div>
    </div>
    <div class="grid g4 mb-l">
      ${card('Founder & team', 'users', `<div class="list">${d.team.map(m => `<a class="li click" href="#/profile/${m.id}" style="text-decoration:none">${avatar(m.full_name, m.id, 'sm')}<span class="grow small strong">${esc(m.full_name)}</span>${chip(m.role_title, 'solid-navy')}</a>`).join('')}</div>`, { link: `#/venture/${v.id}` })}
      ${card('Milestone checklist', 'list-checks', `<div class="list">${ms.map(m => `<div class="li" style="padding:6px 0">${ic(m.status === 'completed' ? 'circle-check' : m.status === 'in_progress' ? 'circle-dot' : 'circle-minus', 'sm')}<span class="grow small">${esc(m.title)}</span>${status(m.status)}</div>`).join('')}</div><div class="small muted mt">Overall progress</div>${bar(pct(done, ms.length), 'green')}`, { link: `#/venture/${v.id}` })}
      ${card('Mentor sessions', 'calendar-clock', d.sessions.length ? d.sessions.map(s => `<div class="li">${avatar(s.mentor_name, s.mentor_id, 'sm')}<div class="grow"><div class="small strong">${esc(s.mentor_name)}</div><div class="xs muted">${esc(s.topic)}</div><div class="xs muted">${fmtDT(s.start_at)}</div></div>${status(s.status)}</div>`).join('') : empty('No sessions yet', 'calendar-clock'), { link: `#/venture/${v.id}`, linkText: 'Schedule' })}
      ${card('My tasks', 'list-todo', d.tasks.length ? d.tasks.map(x => `<div class="li"><span class="grow small">${esc(x.title)}</span><span class="xs" style="color:var(--red)">${fmtDate(x.due_on, { day: 'numeric', month: 'short' })}</span></div>`).join('') : empty('No open tasks', 'list-todo'), { link: `#/venture/${v.id}` })}
    </div>
    <div class="grid g4">
      ${card('Upcoming incubator sessions', 'presentation', d.incubator_events.length ? `<div class="list">${d.incubator_events.map(eventRow).join('')}</div>` : empty('No sessions scheduled', 'presentation'), { link: '#/calendar' })}
      ${card('Certificate progress', 'award', `<div class="row gap-l">${ring(pct(certDone, d.certificates_path.length), { size: 90, stroke: 9, color: 'var(--green)', label: `${certDone}/${d.certificates_path.length}` })}<div class="list grow">${d.certificates_path.map(c => `<div class="row xs" style="padding:2px 0"><span class="grow">${esc(c.title)}</span>${c.status === 'completed' ? ic('circle-check', 'sm') : `<span class="muted">${c.progress}%</span>`}</div>`).join('')}</div></div>`, { link: '#/learning' })}
      ${card('Recent activity', 'history', d.activity.length ? d.activity.map(a => `<div class="li"><div class="grow small">${esc(cap(a.action))} ${a.detail && JSON.parse(a.detail).milestone ? '— ' + esc(JSON.parse(a.detail).milestone) : ''}<div class="xs muted">${esc(a.actor_name)} · ${ago(a.created_at)}</div></div></div>`).join('') : empty('No recent activity', 'history'))}
      <div class="card navy"><div class="card-h"><h3>${ic('sparkles')} AI Pitch Assistant ${chip('Beta', 'red')}</h3></div><p class="small muted">Get AI-powered suggestions to strengthen your pitch deck.</p>
        <div class="list mt">${['Improve the problem statement', 'Market size insights', 'Investor-ready financials'].map(x => `<div class="row small" style="padding:5px 0">${ic('circle-check', 'sm')}${x}</div>`).join('')}</div>
        <button class="btn btn-gold btn-block mt" onclick="openPitchAssistant(${v.id})">${ic('sparkles')} Analyse my pitch</button></div>
    </div>`;
}

// ---------------- Mentor ----------------
function dashMentor(view, d) {
  const p = d.profile; const st = d.stats;
  view.innerHTML = pageHead('Mentor & Trainer Workspace', 'Guide founders, support Society leaders and deliver training', `<a class="btn btn-ghost" href="#/mentor-register">${ic('pencil')} ${p ? 'Edit registration' : 'Complete registration'}</a><a class="btn btn-primary" href="#/incubator">${ic('rocket')} Incubator</a>`) + `
    ${!p || p.status !== 'verified' ? `<div class="banner warn">${ic('badge-check', 'lg')}<div class="grow"><b>${!p ? 'Complete your mentor registration' : p.status === 'pending' ? 'Your registration is awaiting verification' : 'Finish your registration'}</b> — verified mentors appear in the AASTEC mentor directory and can be matched with founders.</div><a class="btn btn-sm btn-primary" href="#/mentor-register">Open registration</a></div>` : ''}
    <div class="kpis">
      ${kpi({ icon: 'badge-check', tone: 'green', label: 'Verification', value: p ? STATUS[p.status]?.[0] : 'Not started', valCls: 'text' })}
      ${kpi({ icon: 'rocket', tone: 'navy', label: 'Mentees (ventures)', value: d.mentees.length })}
      ${kpi({ icon: 'calendar-check', tone: 'blue', label: 'Sessions completed', value: st.completed })}
      ${kpi({ icon: 'star', tone: 'gold', label: 'Average rating', value: (+st.rating || 0).toFixed(1) + ' / 5' })}
      ${kpi({ icon: 'clock', tone: 'purple', label: 'Hours mentored', value: Math.round(st.minutes / 60) })}
      ${kpi({ icon: 'inbox', tone: 'orange', label: 'Requests to confirm', value: d.requested })}
    </div>
    <div class="grid g2 mb-l">
      ${card('My mentees', 'rocket', d.mentees.length ? `<div class="list">${d.mentees.map(v => `<a class="li click" href="#/venture/${v.id}" style="text-decoration:none"><span class="av sm" style="background:${v.color}">${esc(v.name[0])}</span><div class="grow"><div class="t">${esc(v.name)}</div><div class="s">${esc(v.tagline || '')} · ${esc(v.society_short || '')}</div></div>${chip(cap(v.stage), 'navy')}</a>`).join('')}</div>` : empty('No ventures matched yet', 'rocket'))}
      ${card('Upcoming sessions', 'calendar-clock', d.upcoming.length ? `<div class="list">${d.upcoming.map(s => `<div class="li">${dateTile(s.start_at)}<div class="grow"><div class="t">${esc(s.topic)}</div><div class="s">${esc(s.venture || '')} · ${fmtTime(s.start_at)} · ${cap(s.mode)}</div></div>${s.status === 'requested' ? `<button class="btn btn-xs btn-success" onclick="sessionAction(${s.id},'scheduled',this)">Confirm</button>` : `<button class="btn btn-xs btn-soft" onclick="sessionAction(${s.id},'completed',this)">Mark done</button>`}</div>`).join('')}</div>` : empty('No upcoming sessions', 'calendar-clock'))}
    </div>
    <div class="grid g2">
      ${card('Expertise', 'brain', p ? `<div class="row wrap">${p.expertise.map(x => chip(x, 'navy')).join('')}</div><div class="section-title mt">Industries</div><div class="row wrap">${p.industries.map(x => chip(x, 'gold')).join('')}</div>` : empty('Add your expertise in the registration portal', 'brain'))}
      ${card('Upcoming events', 'calendar-days', d.upcoming_events.length ? `<div class="list">${d.upcoming_events.map(eventRow).join('')}</div>` : empty('No upcoming events', 'calendar'), { link: '#/calendar' })}
    </div>`;
}
async function sessionAction(id, st, btn) { await guard(btn, async () => { await put(`/mentor-sessions/${id}`, { status: st }); toast(st === 'completed' ? 'Session marked as completed.' : 'Session confirmed.'); route(); }); }
