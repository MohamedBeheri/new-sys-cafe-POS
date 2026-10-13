// ===================================================================
//  Shared calendar & events: month/list views, event details, RSVP,
//  QR check-in, attendance, proposals and the activity workflow
// ===================================================================
'use strict';
const KIND = { society: ['Society event', 'green'], aastec: ['AASTEC-wide event', 'blue'], training: ['Training session', 'purple'], info_session: ['Incubator info session', 'gold'], mentoring: ['Mentoring session', 'blue'], election: ['Election milestone', 'red'], deadline: ['Report deadline', 'amber'] };
const ECATS = { leadership: 'Leadership', workshop: 'Workshops', training: 'Training', networking: 'Networking', community_service: 'Community Service', career: 'Career', social: 'Social', competition: 'Competition', other: 'Other' };
let CAL = { month: null, mode: 'month', category: '', kind: '', society: '', mine: false };

ROUTES.calendar = async (view, param) => {
  if (!CAL.month) { const d = new Date(); CAL.month = new Date(d.getFullYear(), d.getMonth(), 1); }
  const m = CAL.month;
  const from = new Date(m.getFullYear(), m.getMonth(), 1 - ((m.getDay() + 6) % 7));
  const to = new Date(from.getTime() + 42 * 864e5);
  const q = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  if (CAL.category) q.set('category', CAL.category); if (CAL.kind) q.set('kind', CAL.kind); if (CAL.society) q.set('society_id', CAL.society); if (CAL.mine) q.set('mine', '1');
  const d = await api('/calendar?' + q);
  const R = d.rules; const canAdd = R.society_event || R.propose_society || R.aastec_event || R.training || R.info_session;
  view.innerHTML = pageHead('Shared Calendar & Events', 'One calendar for every Society, AASTEC programme, training and mentoring session', canAdd ? `<button class="btn btn-primary" id="add-ev">${ic('calendar-plus')} ${R.society_event || R.aastec_event || R.training || R.info_session ? 'Add event' : 'Propose event'}</button>` : '', 'calendar-days')
    + `<div class="banner info">${ic('info')}<div>This calendar is accessible to Members, Vice Presidents, Presidents, Faculty Advisors, Mentors, Trainers and AASTEC Staff.</div></div>
    <div class="toolbar"><button class="btn btn-icon btn-ghost" id="prev">${ic('chevron-left')}</button><b style="min-width:130px;text-align:center;font-family:var(--display);color:var(--heading)">${m.toLocaleDateString(LOC, { month: 'long', year: 'numeric' })}</b><button class="btn btn-icon btn-ghost" id="next">${ic('chevron-right')}</button><button class="btn btn-sm btn-ghost" id="today">Today</button>
      <div class="seg"><button data-m="month" class="${CAL.mode === 'month' ? 'active' : ''}">Month</button><button data-m="list" class="${CAL.mode === 'list' ? 'active' : ''}">List</button></div>
      <select class="input" id="f-cat"><option value="">All categories</option>${Object.entries(ECATS).map(([k, v]) => `<option value="${k}" ${CAL.category === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select class="input" id="f-kind"><option value="">All event types</option>${Object.entries(KIND).filter(([k]) => !['mentoring'].includes(k)).map(([k, [v]]) => `<option value="${k}" ${CAL.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      ${isAastec() ? `<select class="input" id="f-soc"><option value="">All Societies</option>${APP.meta.societies.filter(s => s.status === 'active').map(s => `<option value="${s.id}" ${+CAL.society === s.id ? 'selected' : ''}>${esc(s.short_name)}</option>`).join('')}</select>` : ''}
      <button class="btn btn-sm ${CAL.mine ? 'btn-primary' : 'btn-ghost'}" id="f-mine">${ic('user-check', 'sm')} My events</button></div>
    <div class="grid g-12"><div class="span-8" id="cal-main"></div><div class="span-4 col">
      ${card('Upcoming agenda', 'list', `<div id="agenda"></div>`)}
      ${card('Calendar permissions', 'shield-check', `<div class="list">${[['eye', 'All users can view', 'The calendar is visible to every role.'], ['users', 'Add Society events', 'Only Society Presidents add, edit or delete events for their Society. Members submit proposals.'], ['landmark', 'Add AASTEC-wide events', 'Only AASTEC staff add, edit or delete AASTEC-wide events.'], ['graduation-cap', 'Trainings & mentoring', 'Created by Programme Managers and approved programme workflows.']].map(([i, t, x]) => `<div class="li top">${ic(i, 'sm')}<div><div class="small strong">${t}</div><div class="xs muted">${x}</div></div></div>`).join('')}</div>`)}
    </div></div>
    <div class="card mt"><div class="row wrap gap-l small">${Object.entries(KIND).map(([k, [l]]) => `<span class="row gap-s"><span class="ev ${k}" style="display:inline-block;width:14px;height:12px;padding:0;margin:0"></span>${l}</span>`).join('')}<span class="row gap-s"><span class="ev society proposed" style="display:inline-block;width:14px;height:12px;padding:0;margin:0"></span>Proposal (pending)</span></div></div>`;
  const evs = d.events;
  const dayKey = (s) => { const x = new Date(s); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
  if (CAL.mode === 'month') {
    const byDay = {}; evs.forEach(e => (byDay[dayKey(e.start_at)] ??= []).push(e));
    let html = '<div class="cal">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => `<div class="dow">${x}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i); const k = dayKey(day); const list = byDay[k] || [];
      const isToday = k === dayKey(new Date());
      html += `<div class="day ${day.getMonth() !== m.getMonth() ? 'out' : ''} ${isToday ? 'today' : ''}" data-day="${day.toISOString()}"><div class="dn">${day.getDate()}</div>${list.slice(0, 3).map(e => `<span class="ev ${e.kind} ${e.status || ''}" data-ev="${e.virtual ? '' : e.id}" data-link="${e.link || ''}" title="${esc(e.title)}">${e.virtual ? '' : fmtTime(e.start_at) + ' '}${esc(e.title)}</span>`).join('')}${list.length > 3 ? `<span class="xs muted">+${list.length - 3} more</span>` : ''}</div>`;
    }
    $('#cal-main').innerHTML = html + '</div>';
    $$('.day').forEach(c => c.onclick = (e) => { if (e.target.closest('.ev')) return; if (canAdd) openCreateEvent(R, c.dataset.day); });
  } else {
    const groups = {}; evs.filter(e => new Date(e.start_at) >= new Date(m) && new Date(e.start_at) < new Date(m.getFullYear(), m.getMonth() + 1, 1)).forEach(e => (groups[new Date(e.start_at).toDateString()] ??= []).push(e));
    $('#cal-main').innerHTML = card('Events this month', 'list', Object.entries(groups).map(([day, list]) => `<div class="section-title">${new Date(day).toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long' })}</div>${list.map(e => `<div class="li click" data-ev="${e.virtual ? '' : e.id}" data-link="${e.link || ''}"><span class="ev ${e.kind}" style="width:6px;padding:0;height:36px;margin:0"></span><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${e.virtual ? 'All day' : `${fmtTime(e.start_at)}–${fmtTime(e.end_at)}`} · ${esc(e.location || '')} ${e.society_short ? '· ' + esc(e.society_short) : ''}</div></div>${chip(KIND[e.kind]?.[0] || e.kind, KIND[e.kind]?.[1])}${e.status && e.status !== 'published' ? status(e.status) : ''}</div>`).join('')}`).join('') || empty('No events this month', 'calendar'));
  }
  const up = evs.filter(e => new Date(e.start_at) >= new Date(new Date().toDateString())).slice(0, 8);
  $('#agenda').innerHTML = up.length ? up.map(e => `<div class="li click" data-ev="${e.virtual ? '' : e.id}" data-link="${e.link || ''}">${dateTile(e.start_at)}<div class="grow"><div class="t ellipsis">${esc(e.title)}</div><div class="s">${e.virtual ? KIND[e.kind]?.[0] : fmtTime(e.start_at) + ' · ' + esc(e.society_short || 'AASTEC')}</div></div>${e.my_rsvp === 'going' ? chip('Going', 'green') : ''}</div>`).join('') : empty('Nothing upcoming in this range', 'calendar');
  $$('[data-ev]').forEach(el => el.onclick = (e) => { e.stopPropagation(); if (el.dataset.ev) openEvent(+el.dataset.ev); else if (el.dataset.link) location.hash = el.dataset.link; });
  const nav = (dm) => { CAL.month = new Date(m.getFullYear(), m.getMonth() + dm, 1); route(); };
  $('#prev').onclick = () => nav(-1); $('#next').onclick = () => nav(1); $('#today').onclick = () => { CAL.month = null; route(); };
  $$('.seg [data-m]').forEach(b => b.onclick = () => { CAL.mode = b.dataset.m; route(); });
  $('#f-cat').onchange = (e) => { CAL.category = e.target.value; route(); }; $('#f-kind').onchange = (e) => { CAL.kind = e.target.value; route(); };
  $('#f-soc')?.addEventListener('change', (e) => { CAL.society = e.target.value; route(); }); $('#f-mine').onclick = () => { CAL.mine = !CAL.mine; route(); };
  $('#add-ev')?.addEventListener('click', () => openCreateEvent(R));
  if (param === 'new' && canAdd) openCreateEvent(R); else if (param && /^\d+$/.test(param)) openEvent(+param);
};

function openCreateEvent(R, dayIso) {
  const kinds = [R.society_event || R.propose_society ? ['society', R.society_event ? 'Society event' : 'Society event (proposal)'] : null, R.aastec_event ? ['aastec', 'AASTEC-wide event'] : null, R.training ? ['training', 'Training session'] : null, R.info_session ? ['info_session', 'Incubator information session'] : null].filter(Boolean);
  const start = dayIso ? new Date(new Date(dayIso).setHours(10, 0, 0, 0)) : new Date(Date.now() + 7 * 864e5);
  if (!dayIso) start.setHours(10, 0, 0, 0);
  const m = modal({ title: R.society_event || !R.propose_society ? 'Add event' : 'Propose an event', icon: 'calendar-plus', size: 'wide', body: `
    ${!R.society_event && R.propose_society ? `<div class="banner info small">${ic('info', 'sm')}<div>Society events you create are submitted as <b>proposals</b>. The Society President reviews them; events with external partners or a budget of 10,000 or more also need Faculty Advisor review.</div></div>` : ''}
    <form id="evf" class="grid-form"><div class="field"><label>Event type</label><select name="kind" id="ev-k">${kinds.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
      <div class="field"><label>Category</label><select name="category">${Object.entries(ECATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field full"><label>Title *</label><input name="title" required></div>
      <div class="field"><label>Starts *</label><input type="datetime-local" name="start_at" value="${toLocalInput(start.toISOString())}" required></div><div class="field"><label>Ends</label><input type="datetime-local" name="end_at" value="${toLocalInput(new Date(start.getTime() + 2 * 36e5).toISOString())}"></div>
      <div class="field"><label>Location</label><input name="location" placeholder="e.g. Innovation Hall, AAST Miami"></div><div class="field"><label>Mode</label><select name="mode"><option value="in_person">In person</option><option value="online">Online</option><option value="hybrid">Hybrid</option></select></div>
      <div class="field"><label>Visibility</label><select name="visibility"><option value="all">All platform users</option><option value="society">Society members only</option></select></div><div class="field"><label>Capacity</label><input type="number" name="capacity" min="1" placeholder="Unlimited"></div>
      <div class="full" id="ev-soc"><div class="grid-form"><div class="field"><label>Committee</label><select name="committee_id"><option value="">—</option>${APP.meta.committees.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Budget (EGP)</label><input type="number" name="budget" min="0"></div>
        <div class="field"><label>Attendance KPI target</label><input type="number" name="kpi_target" min="0"></div><div class="field"><label>Training hours (workshops/trainings)</label><input type="number" name="training_hours" min="0" step="0.5"></div>
        <div class="field full"><label>Plan (agenda, speakers, logistics)</label><textarea name="plan" style="min-height:70px"></textarea></div><div class="field full"><label>Risks & mitigation</label><input name="risk_note"></div>
        <div class="field full check"><input type="checkbox" name="external_partners" id="ev-ext" value="1"><label for="ev-ext">Involves external partners or sponsors (requires Faculty Advisor review)</label></div></div></div>
      <div class="field full"><label>Description</label><textarea name="description"></textarea></div></form>`,
    foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="ev-go">${ic('check', 'sm')} ${R.society_event || !R.propose_society ? 'Create event' : 'Submit proposal'}</button>`, onClose: () => { if (location.hash.endsWith('/new')) history.replaceState(null, '', '#/calendar'); } });
  const sync = () => $('#ev-soc', m).classList.toggle('hidden', $('#ev-k', m).value !== 'society'); $('#ev-k', m).onchange = sync; sync();
  $('#ev-go', m).onclick = (e) => guard(e.currentTarget, async () => {
    const f = formData($('#evf', m)); f.start_at = fromLocalInput(f.start_at); f.end_at = fromLocalInput(f.end_at); f.external_partners = $('#ev-ext', m).checked;
    const r = await post('/events', f); m.close();
    toast({ published: 'Event published to the calendar.', proposed: 'Proposal submitted to your Society President.', advisor_review: 'Event created — awaiting Faculty Advisor review.' }[r.status] || 'Saved.');
    location.hash = `#/calendar/${r.id}`; route();
  });
}

async function openEvent(id) {
  const e = await api(`/events/${id}`);
  const past = new Date(e.start_at) < new Date();
  const checkinUrl = e.checkin_token ? `${location.origin}/checkin/${e.checkin_token}` : '';
  const body = `<div class="row wrap mb">${chip(KIND[e.kind]?.[0] || e.kind, KIND[e.kind]?.[1])}${status(e.status)}${e.category ? chip(ECATS[e.category] || e.category, '') : ''}${e.visibility === 'society' ? chip('Members only', '', 'lock') : chip('Open to all', 'green')}</div>
    <div class="grid g2"><div class="col">
      <div class="row">${ic('calendar')}<span>${new Date(e.start_at).toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
      <div class="row">${ic('clock')}<span>${fmtTime(e.start_at)} – ${fmtTime(e.end_at)}</span></div><div class="row">${ic('map-pin')}<span>${esc(e.location || cap(e.mode))}</span></div>
      <div class="row">${ic('users')}<span>${e.counts.going || 0} going${e.capacity ? ` of ${e.capacity}` : ''} · ${e.counts.interested || 0} interested${e.counts.checked_in ? ` · ${e.counts.checked_in} checked in` : ''}</span></div>
      <div class="row">${ic('building-2')}<span>Organised by ${esc(e.society_name || 'AASTEC Administration')}${e.committee_name ? ` · ${esc(e.committee_name)}` : ''}</span></div>
      ${e.description ? `<p class="mt">${esc(e.description)}</p>` : ''}${e.plan && e.can_manage ? `<div class="card surface tight mt"><div class="xs strong">Plan</div><div class="small">${esc(e.plan)}</div>${e.budget ? `<div class="xs muted mt">Budget: ${num(e.budget)} EGP</div>` : ''}${e.risk_note ? `<div class="xs muted">Risks: ${esc(e.risk_note)}</div>` : ''}</div>` : ''}
      ${e.outcome ? `<div class="banner info mt">${ic('clipboard-check')}<div><b>Outcome</b><div class="small">${esc(e.outcome)}</div><div class="xs muted">Attendance ${e.attendance_count ?? '—'} · Expenses ${num(e.expenses || 0)} EGP</div></div></div>` : ''}
      ${e.review_note ? `<div class="xs muted">Review note: ${esc(e.review_note)}</div>` : ''}</div>
    <div class="col">${e.status === 'published' && !past ? `<div class="card surface tight"><div class="small strong mb">Your RSVP</div><div class="seg">${['going', 'interested', 'declined'].map(s => `<button class="${e.my_rsvp?.status === s ? 'active' : ''}" onclick="rsvp(${e.id},'${s}',this)">${{ going: 'Going', interested: 'Interested', declined: 'Not going' }[s]}</button>`).join('')}</div>${e.my_rsvp?.checked_in_at ? `<div class="small mt" style="color:var(--green)">${ic('circle-check', 'sm')} Checked in ${fmtTime(e.my_rsvp.checked_in_at)}</div>` : ''}</div>` : e.my_rsvp?.checked_in_at ? `<div class="banner info small">${ic('circle-check', 'sm')}You attended this event.</div>` : ''}
      ${e.can_manage && checkinUrl && ['published', 'completed'].includes(e.status) ? `<div class="card navy center"><div class="small strong mb">Event check-in QR</div><div class="qr-box">${qrImg(checkinUrl, 5)}</div><div class="xs mt" style="color:var(--gold);word-break:break-all">${esc(checkinUrl)}</div><button class="btn btn-sm btn-gold mt" onclick="navigator.clipboard.writeText('${checkinUrl}').then(()=>toast('Check-in link copied.'))">${ic('copy', 'sm')} Copy link</button></div>` : ''}</div></div>
    ${e.can_manage || e.attendees.length ? `<div class="section-title mt-l">Attendance (${e.attendees.filter(a => a.checked_in_at).length} / ${e.attendees.filter(a => a.status === 'going').length})</div>
      ${e.can_manage && ['published', 'completed'].includes(e.status) ? `<form class="row mb" id="att-f"><input class="input" id="att-code" placeholder="Scan or type a member pass code (AASTEC-M-123)"><button class="btn btn-primary btn-sm">${ic('scan-line', 'sm')} Check in</button>${'BarcodeDetector' in window ? `<button type="button" class="btn btn-ghost btn-sm" id="att-cam">${ic('qr-code', 'sm')} Scan</button>` : ''}</form>` : ''}
      <div class="tbl-wrap" style="max-height:260px;overflow-y:auto"><table class="tbl"><tbody>${e.attendees.map(a => `<tr><td><div class="row">${avatar(a.full_name, a.user_id, 'xs')}<span class="small">${esc(a.full_name)}</span></div></td><td>${status(a.status === 'interested' ? 'interested_rsvp' : a.status)}</td><td class="small">${a.checked_in_at ? `<span style="color:var(--green)">${ic('circle-check', 'sm')} ${fmtTime(a.checked_in_at)}</span> <span class="xs muted">${esc(a.check_method || '')}</span>` : e.can_manage && ['published', 'completed'].includes(e.status) ? `<button class="btn btn-xs btn-soft" onclick="markAttendance(${e.id},${a.user_id},this)">Mark present</button>` : '—'}</td></tr>`).join('') || `<tr><td>${empty('No RSVPs yet', 'users')}</td></tr>`}</tbody></table></div>` : ''}`;
  const foot = [
    e.can_decide ? `<button class="btn btn-danger" onclick="decide('event',${e.id},false,this)">Decline proposal</button><button class="btn btn-success" onclick="decide('event',${e.id},true,this)">${ic('check', 'sm')} Approve & publish</button>` : '',
    e.can_advise ? `<button class="btn btn-danger" onclick="decide('event_advisor',${e.id},false,this)">Decline</button><button class="btn btn-success" onclick="decide('event_advisor',${e.id},true,this)">${ic('check', 'sm')} Approve (Advisor)</button>` : '',
    e.can_manage && e.status === 'published' && past ? `<button class="btn btn-primary" onclick="completeEvent(${e.id},${e.counts.checked_in || 0})">${ic('clipboard-check', 'sm')} Record outcome</button>` : '',
    e.can_close ? `<button class="btn btn-primary" onclick="closeEvent(${e.id},this)">${ic('circle-check', 'sm')} Close activity</button>` : '',
    e.can_manage && ['published', 'proposed', 'advisor_review'].includes(e.status) ? `<button class="btn btn-ghost" onclick="cancelEvent(${e.id})">Cancel event</button>` : '',
    `<button class="btn btn-ghost" onclick="navigator.clipboard.writeText('${location.origin}/portal#/calendar/${e.id}').then(()=>toast('Event link copied.'))">${ic('share-2', 'sm')} Share</button>`,
  ].join('');
  const md = modal({ title: e.title, icon: 'calendar', size: 'wide', body, foot, onClose: () => { if (/#\/calendar\/\d+/.test(location.hash)) history.replaceState(null, '', '#/calendar'); } });
  $('#att-f', md)?.addEventListener('submit', async (ev) => { ev.preventDefault(); const code = $('#att-code', md).value.trim(); if (!code) return; await guard($('button', ev.target), async () => { const r = await post(`/events/${e.id}/attendance`, { member_code: code }); toast(`${r.user.full_name} checked in.`); md.close(); openEvent(e.id); }); });
  $('#att-cam', md)?.addEventListener('click', () => scanPass(md, e.id));
}
async function rsvp(id, s, btn) { await guard(btn, async () => { await post(`/events/${id}/rsvp`, { status: s }); toast(s === 'going' ? 'See you there! Remember to check in with the QR code.' : 'RSVP updated.'); $('.modal-bg')?.close?.(); openEvent(id); }); }
async function markAttendance(eid, uid, btn) { await guard(btn, async () => { await post(`/events/${eid}/attendance`, { user_id: uid }); btn.outerHTML = `<span style="color:var(--green)">${ic('circle-check', 'sm')} Present</span>`; }); }
async function cancelEvent(id) { const reason = await askNote({ title: 'Cancel event', label: 'Reason (sent to registered attendees)', ok: 'Cancel event', danger: true }); if (reason === null) return; await post(`/events/${id}/cancel`, { reason }); $('.modal-bg')?.close?.(); toast('Event cancelled and attendees notified.'); route(); }
function completeEvent(id, checked) {
  $('.modal-bg')?.close?.();
  const m = modal({ title: 'Record event outcome', icon: 'clipboard-check', body: `<p class="small muted mb">After execution, record attendance, expenses and outcomes. The Faculty Advisor then closes the activity and dashboards update automatically.</p><form id="cef" class="grid-form"><div class="field"><label>Attendance</label><input type="number" name="attendance_count" value="${checked}" min="0"><div class="hint">${checked} checked in via the platform</div></div><div class="field"><label>Expenses (EGP)</label><input type="number" name="expenses" min="0" value="0"></div><div class="field"><label>Training hours</label><input type="number" name="training_hours" step="0.5" min="0"></div><div class="field full"><label>Outcomes & evidence *</label><textarea name="outcome" required placeholder="What was delivered, key results, feedback and links to photos or materials"></textarea></div></form>`,
    foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="ce-go">Submit outcome</button>` });
  $('#ce-go', m).onclick = (e) => guard(e.currentTarget, async () => { await post(`/events/${id}/complete`, formData($('#cef', m))); m.close(); toast('Outcome recorded. The Faculty Advisor has been notified.'); route(); });
}
async function scanPass(md, eventId) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).catch(() => null);
  if (!stream) return toast('Camera unavailable — type the member code instead.', 'err');
  const v = document.createElement('video'); v.srcObject = stream; v.setAttribute('playsinline', ''); v.style.cssText = 'width:100%;border-radius:10px;margin-top:8px'; await v.play();
  $('#att-f', md).after(v); const det = new BarcodeDetector({ formats: ['qr_code'] });
  const stop = () => { stream.getTracks().forEach(t => t.stop()); v.remove(); };
  const loop = async () => { if (!v.isConnected) return stop(); const codes = await det.detect(v).catch(() => []); if (codes[0]) { stop(); $('#att-code', md).value = codes[0].rawValue; $('#att-f', md).requestSubmit(); } else requestAnimationFrame(loop); };
  loop();
}

// QR self check-in: /checkin/:token → #/checkin/:token
ROUTES.checkin = async (view, tok) => {
  try {
    const r = await post(`/checkin/${tok}`);
    view.innerHTML = `<div class="card center" style="max-width:520px;margin:40px auto;padding:36px"><div class="ico tone-green" style="width:64px;height:64px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--green-50);color:var(--green)">${ic('circle-check', 'xl')}</div>
      <h2 class="mt">You're checked in!</h2><p class="muted">${esc(r.event.title)}</p><p class="small muted">${fmtDT(r.event.start_at)} · ${esc(r.event.location || '')}</p><p class="small mt">Your attendance counts toward your activity score and your Society's KPIs.</p><a class="btn btn-primary mt" href="#/calendar">Open calendar</a></div>`;
  } catch (e) { view.innerHTML = `<div class="card center" style="max-width:520px;margin:40px auto;padding:36px">${ic('circle-alert', 'xl')}<h2 class="mt">Check-in unavailable</h2><p class="muted">${esc(e.message)}</p><a class="btn btn-ghost mt" href="#/calendar">Back to calendar</a></div>`; }
};
