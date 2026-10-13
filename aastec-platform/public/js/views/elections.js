// ===================================================================
//  Election Management Centre and secure voting
// ===================================================================
'use strict';
const LIFECYCLE = [['Setup', 'by Programme Manager', 'configured_at', 'settings'], ['Faculty Advisor', 'Approval', 'advisor_at', 'user-check'], ['Nominations', 'Open', 'nomination_start', 'users'], ['Candidate review', '& Validation', 'review_start', 'search'], ['Voting', 'Open', 'voting_start', 'vote'], ['Results', 'Published', 'results_at', 'chart-column'], ['Handover', 'to New Board', 'handover_at', 'handshake']];
const NEXT_LABEL = { approved: 'Open nominations', nominations: 'Close nominations → candidate review', review: 'Open voting', voting: 'Close voting → count' };
function lifecycle(el) {
  return `<div class="stepper" style="grid-template-columns:repeat(7,1fr)">${LIFECYCLE.map(([t, w, k, i], idx) => { const n = idx + 1; const cls = el.step > n || el.status === 'closed' ? 'done' : el.step === n ? 'now' : '';
    return `<div class="st ${cls}"><div class="num">${cls === 'done' ? ic('check', 'sm') : n}</div><div class="lbl">${ic(i, 'sm')} ${t}</div><div class="who">${w}</div><div class="when">${el[k] ? fmtDate(el[k], { day: 'numeric', month: 'short' }) : '—'}${cls === 'now' ? '<br>In progress' : cls === 'done' ? '' : '<br>Upcoming'}</div></div>`; }).join('')}</div>`;
}

ROUTES.elections = async (view, id) => {
  if (id) return electionDetail(view, id);
  const sid = isAastec() ? (+APP.ctx || '') : '';
  const d = await api(`/elections${sid ? `?society_id=${sid}` : ''}`);
  const rows = d.rows; const cycle = d.next_cycle;
  const current = rows.filter(e => e.cycle_year === cycle && !e.sandbox);
  const focus = rows.find(e => !['closed', 'cancelled'].includes(e.status) && !e.sandbox) || rows[0];
  const ay = `${cycle - 1} – ${cycle}`;
  view.innerHTML = pageHead('Election Management Center', 'Secure. Transparent. Governed by policy.', `${updated()}${d.can_configure ? `<button class="btn btn-primary" id="cfg">${ic('settings')} Configure election cycle</button>` : ''}`) + `
    <div class="kpis">${kpi({ icon: 'calendar-range', tone: 'red', label: 'Election window', value: 'July – August only', valCls: 'text red', meta: 'Short period · plan early' })}
      ${kpi({ icon: 'clock', tone: 'gold', label: 'Election status', value: focus ? STATUS[focus.status]?.[0] : 'Not configured', valCls: 'text', meta: focus ? `${esc(focus.society_short)} · cycle ${focus.cycle_year}` : 'Awaiting setup' })}
      ${kpi({ icon: 'calendar-check', tone: 'green', label: 'Academic year', value: ay, valCls: 'text', meta: 'Active' })}
      ${kpi({ icon: 'users', tone: 'navy', label: 'Societies in next cycle', value: current.length, meta: `${current.filter(e => e.status === 'pending_advisor').length} awaiting Advisor approval` })}</div>
    ${focus ? `<div class="card mb-l"><div class="card-h"><h3>${ic('workflow')} Election lifecycle — ${esc(focus.title)} (${esc(focus.society_short)})</h3><a class="link" href="#/elections/${focus.id}">Open ${ic('arrow-right', 'sm')}</a></div>${lifecycle(focus)}</div>` : ''}
    <div class="banner danger">${ic('circle-alert', 'lg')}<div class="grow"><b>Elections are opened only for a short period from July to August by the Rally Societies Programme Manager.</b><div class="small">Each campus or partner university election requires approval by its Faculty Advisor before going live.</div></div><a class="btn btn-sm btn-ghost" href="#/handbook">View policy in handbook</a></div>
    ${d.sandbox_allowed ? `<div class="banner gold">${ic('flag', 'lg')}<div><b>Pilot mode is enabled.</b> Rehearsal elections (marked “pilot”) may run outside the July–August window for training. They never change Society roles. Disable pilot mode in Settings before go-live.</div></div>` : ''}
    <div class="grid g-12 mb-l">
      <div class="span-8">${card('Faculty Advisor approval — required for go-live', 'user-check', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Campus / partner university</th><th>Election</th><th>Faculty Advisor</th><th>Phase</th><th></th></tr></thead><tbody>
        ${rows.filter(e => e.status !== 'closed' || e.cycle_year === cycle).map(e => `<tr class="click" onclick="location.hash='#/elections/${e.id}'"><td><div class="row">${seal(e.society_short, 'xs')}<b class="small">${esc(e.society_short)}</b></div></td><td class="small">${esc(e.title)}${e.sandbox ? ' ' + chip('Pilot', 'gold') : ''}<div class="xs muted">Cycle ${e.cycle_year} · ${e.candidates} candidates · ${e.ballots} ballots</div></td><td class="small">${esc(e.advisor_name || '—')}</td><td>${status(e.status)}</td><td>${ic('chevron-right', 'sm')}</td></tr>`).join('') || `<tr><td colspan="5">${empty('No elections configured yet', 'vote')}</td></tr>`}</tbody></table></div>
        <p class="xs muted mt">All approvals are required before elections go live.</p>`)}</div>
      <div class="span-4 col">${card('Eligibility criteria', 'list-checks', `<div class="list">${['Active member for at least one semester', 'Good standing (no code of conduct violations)', 'Rally Society Handbook acknowledged', 'Completed the required onboarding course'].map(t => `<div class="row small" style="padding:4px 0"><span style="color:var(--green)">${ic('circle-check', 'sm')}</span>${t}</div>`).join('')}</div>`)}
        ${card('Key election rules', 'book-open', `<div class="list">${['Elections open only during July–August.', 'Short election window set by the Programme Manager.', 'Faculty Advisor approval required before go-live.', 'One member, one vote — secret ballot.', 'Transparent process with a full audit trail.'].map(t => `<div class="row small" style="padding:4px 0"><span style="color:var(--green)">${ic('circle-check', 'sm')}</span>${t}</div>`).join('')}</div><a class="btn btn-sm btn-ghost mt" href="#/handbook">Read full handbook ${ic('arrow-right', 'sm')}</a>`)}</div></div>
    ${card('Election history', 'history', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Society</th><th>Election</th><th>Cycle</th><th>Voting</th><th>Turnout</th><th>Status</th></tr></thead><tbody>${rows.filter(e => e.status === 'closed').map(e => `<tr class="click" onclick="location.hash='#/elections/${e.id}'"><td class="small strong">${esc(e.society_short)}</td><td class="small">${esc(e.title)}</td><td class="small">${e.cycle_year}</td><td class="small muted">${fmtDate(e.voting_start, { day: 'numeric', month: 'short' })} – ${fmtDate(e.voting_end, { day: 'numeric', month: 'short' })}</td><td class="small">${e.ballots} ballots</td><td>${status(e.status)}</td></tr>`).join('') || `<tr><td colspan="6">${empty('No completed elections yet')}</td></tr>`}</tbody></table></div>`)}`;
  $('#cfg')?.addEventListener('click', () => configureElection(cycle, d.sandbox_allowed));
};

function configureElection(cycle, sandboxAllowed) {
  const y = cycle; const iso = (m, d, h = 9) => toLocalInput(new Date(y, m - 1, d, h).toISOString());
  const dates = [['nomination_start', 'Nominations open', iso(7, 6)], ['nomination_end', 'Nominations close', iso(7, 15, 18)], ['review_start', 'Candidate review starts', iso(7, 16)], ['review_end', 'Candidate review ends', iso(7, 22, 18)], ['voting_start', 'Voting opens', iso(7, 23)], ['voting_end', 'Voting closes', iso(7, 30, 20)], ['results_at', 'Results published', iso(8, 1, 12)], ['handover_at', 'Board handover', iso(8, 6, 12)]];
  const socs = APP.meta.societies.filter(s => s.status === 'active');
  const m = modal({ title: 'Configure election cycle', icon: 'settings', size: 'wide', body: `<div class="banner info small">${ic('info', 'sm')}<div>Real elections must fall inside the July–August window of the cycle year. Faculty Advisors are notified to approve activation for their Society.</div></div>
    <form id="ecf" class="grid-form"><div class="field"><label>Cycle year</label><input type="number" name="cycle_year" value="${y}" min="${y - 1}" max="${y + 2}"></div><div class="field"><label>Title</label><input name="title" placeholder="Leadership Election ${y}"></div>
      <div class="field full"><label>Societies</label><select id="ec-scope"><option value="all">All active Societies (${socs.length})</option><option value="pick">Choose Societies…</option></select><select id="ec-socs" multiple class="hidden" style="height:140px;margin-top:6px">${socs.map(s => `<option value="${s.id}">${esc(s.short_name)}</option>`).join('')}</select></div>
      ${dates.map(([k, l, v]) => `<div class="field"><label>${l}</label><input type="datetime-local" name="${k}" value="${v}" required></div>`).join('')}
      <div class="field full"><label>Positions (comma separated)</label><input name="positions" value="President, Vice President"></div>
      <div class="field full"><label>Eligibility rules</label><div class="row wrap"><label class="row small"><input type="checkbox" id="r-gs" checked> Good standing</label><label class="row small"><input type="checkbox" id="r-hb" checked> Handbook acknowledged</label><label class="row small"><input type="checkbox" id="r-ob" checked> Onboarding completed</label></div></div>
      ${sandboxAllowed ? `<div class="field full check"><input type="checkbox" id="ec-sb"><label for="ec-sb">Pilot rehearsal (sandbox) — may run outside the window and never changes roles</label></div>` : ''}</form>`,
    foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="ec-go">${ic('check', 'sm')} Configure & request Advisor approval</button>` });
  $('#ec-scope', m).onchange = (e) => $('#ec-socs', m).classList.toggle('hidden', e.target.value === 'all');
  $('#ec-go', m).onclick = (e) => guard(e.currentTarget, async () => {
    const f = formData($('#ecf', m)); for (const [k] of dates) f[k] = fromLocalInput(f[k]);
    f.society_ids = $('#ec-scope', m).value === 'all' ? 'all' : [...$('#ec-socs', m).selectedOptions].map(o => +o.value);
    f.positions = f.positions.split(',').map(s => s.trim()).filter(Boolean); f.sandbox = $('#ec-sb', m)?.checked || false;
    f.rule_good_standing = $('#r-gs', m).checked; f.rule_handbook = $('#r-hb', m).checked; f.rule_onboarding = $('#r-ob', m).checked;
    const r = await post('/elections', f); m.close(); toast(`${r.created} election(s) configured — Faculty Advisors notified.`); route();
  });
}

async function electionDetail(view, id) {
  const e = await api(`/elections/${id}`);
  const s = e.stats; const C = e.can;
  const candBy = (pid) => e.candidates.filter(c => c.position_id === pid && c.status === 'validated');
  view.innerHTML = pageHead(e.title, `Rally Society ${esc(e.society_short)} · cycle ${e.cycle_year} ${e.sandbox ? chip('Pilot rehearsal', 'gold') : ''} ${status(e.status)}`,
    `<a class="btn btn-ghost" href="#/elections">${ic('arrow-left')} Election Centre</a>${C.advance ? `<button class="btn btn-primary" id="adv">${ic('arrow-right')} ${NEXT_LABEL[e.status]}</button>` : ''}${C.publish ? `<button class="btn btn-gold" id="pub">${ic('trophy')} Publish results</button>` : ''}${C.cancel ? `<button class="btn btn-ghost" id="cnc">Cancel</button>` : ''}`) + `
    <div class="card mb-l">${lifecycle(e)}</div>
    ${!e.sandbox && !e.in_window && ['approved', 'review'].includes(e.status) ? `<div class="banner warn">${ic('calendar-range', 'lg')}<div>The election window for cycle ${e.cycle_year} is <b>${fmtDate(e.window.open)} – ${fmtDate(e.window.close)}</b>. Nominations and voting can only open inside this window.</div></div>` : ''}
    <div class="grid g-12"><div class="span-8 col" id="el-main"></div><div class="span-4 col">
      ${card('Key election stats', 'chart-column', `<div class="grid g2">${[['users', 'Eligible voters', s.eligible], ['user-check', 'Candidates', s.candidates], ['list', 'Positions', s.positions], ['vote', 'Turnout', s.turnout + '%']].map(([i, l, v]) => `<div class="card surface tight"><div class="row">${ic(i)}<div><b style="font-family:var(--display);font-size:20px">${v}</b><div class="xs muted">${l}</div></div></div></div>`).join('')}</div>`)}
      ${card('Faculty Advisor approval', 'user-check', `<div class="row">${avatar(e.advisor_name || 'FA', e.advisor_id || 1)}<div class="grow"><b class="small">${esc(e.advisor_name || 'Faculty Advisor')}</b><div class="xs muted">${e.advisor_decision ? `${cap(e.advisor_decision)} · ${fmtDT(e.advisor_at)}` : 'Awaiting decision'}</div></div>${e.advisor_decision === 'approved' ? chip('Approved', 'green') : chip('Pending', 'amber')}</div>${e.advisor_note ? `<div class="xs mt" style="color:var(--blue)">“${esc(e.advisor_note)}”</div>` : ''}
        ${C.advisor ? `<div class="row mt"><button class="btn btn-success btn-sm grow" onclick="decide('election',${e.id},true,this)">${ic('check', 'sm')} Approve & activate</button><button class="btn btn-ghost btn-sm" onclick="decide('election',${e.id},false,this)">Request changes</button></div>` : ''}
        <div class="xs muted mt">Setup by ${esc(e.configured_by_name || 'Programme Manager')} · ${fmtDate(e.configured_at)}</div>`)}
      ${card('Your eligibility', 'shield-check', `${e.eligibility.checks.map(c => `<div class="row small" style="padding:3px 0"><span style="color:${c.ok ? 'var(--green)' : 'var(--red)'}">${ic(c.ok ? 'circle-check' : 'circle-x', 'sm')}</span>${esc(c.label)}</div>`).join('')}<div class="mt">${e.eligibility.eligible ? chip('You are eligible', 'green') : chip('Not eligible', '')}</div>`)}
      ${card('Audit log (recent activity)', 'history', e.audit.length ? `<div class="list">${e.audit.map(a => `<div class="li"><div class="grow"><div class="small">${esc(cap(a.action))}</div><div class="xs muted">${esc(a.actor_name)} · ${fmtDT(a.created_at)}</div></div></div>`).join('')}</div>` : empty('No activity yet', 'history'))}</div></div>`;
  const main = $('#el-main');
  // Phase-specific panel
  if (e.status === 'voting') main.innerHTML = ballotPanel(e, candBy);
  else if (e.results) main.innerHTML = resultsPanel(e);
  else if (e.status === 'nominations' || e.status === 'review') main.innerHTML = nominationsPanel(e);
  else main.innerHTML = card('Election setup', 'settings', `<div class="grid g2">${[['Nominations', e.nomination_start, e.nomination_end], ['Candidate review', e.review_start, e.review_end], ['Voting', e.voting_start, e.voting_end], ['Results & handover', e.results_at, e.handover_at]].map(([l, a, b]) => `<div class="card surface tight"><div class="small strong">${l}</div><div class="xs muted">${fmtDT(a)} → ${fmtDT(b)}</div></div>`).join('')}</div>
    <p class="small muted mt">Positions: ${e.positions.map(p => chip(p.title, 'navy')).join(' ')}</p>${e.status === 'pending_advisor' ? `<div class="banner warn mt">${ic('clock')}<div>Waiting for the Faculty Advisor's activation approval.</div></div>` : ''}`);
  if (['results', 'handover', 'closed'].includes(e.status)) main.insertAdjacentHTML('beforeend', handoverPanel(e));
  // wiring
  $('#adv')?.addEventListener('click', async (ev) => { if (!await confirmBox(`${NEXT_LABEL[e.status]}? Members are notified.`, { ok: 'Continue' })) return; guard(ev.currentTarget, async () => { const r = await post(`/elections/${e.id}/advance`); toast(`Election moved to: ${STATUS[r.status]?.[0]}.`); route(); }); });
  $('#pub')?.addEventListener('click', (ev) => guard(ev.currentTarget, async () => { await post(`/elections/${e.id}/publish`); toast('Results published to all members.'); route(); }));
  $('#cnc')?.addEventListener('click', async () => { const r = await askNote({ title: 'Cancel election', label: 'Reason', required: true, danger: true, ok: 'Cancel election' }); if (r === null) return; await post(`/elections/${e.id}/cancel`, { reason: r }); toast('Election cancelled.'); route(); });
  $('#nom-f')?.addEventListener('submit', (ev) => { ev.preventDefault(); guard($('button', ev.target), async () => { await post(`/elections/${e.id}/nominate`, formData(ev.target)); toast('Nomination submitted for validation.'); route(); }); });
  $('#ballot-go')?.addEventListener('click', () => submitBallot(e));
  $$('.cand[data-c]').forEach(c => c.onclick = () => { $$(`.cand[data-p="${c.dataset.p}"]`).forEach(x => x.classList.toggle('on', x === c)); updateBallotProgress(e); });
  $$('[data-platform]').forEach(a => a.onclick = (ev) => { ev.stopPropagation(); const c = e.candidates.find(x => x.id === +a.dataset.platform); modal({ title: `${c.full_name} — platform`, icon: 'user', body: `<p class="small muted">${esc(c.slogan || '')}</p><p class="mt" style="white-space:pre-wrap">${esc(c.manifesto || '')}</p>` }); });
  $('#ho-done')?.addEventListener('click', async (ev) => { if (!await confirmBox(e.sandbox ? 'Close this pilot rehearsal? Roles will not change.' : 'Complete the handover? Previous authorities expire, winners receive their new roles and all Society authorizations are reset.', { ok: 'Complete handover' })) return; guard(ev.currentTarget, async () => { const r = await post(`/elections/${e.id}/complete-handover`); toast(r.sandbox ? 'Pilot closed — roles unchanged.' : 'New board activated.'); APP.me = await api('/me'); route(); }); });
}
function nominationsPanel(e) {
  const mine = e.my_candidacy.find(c => c.status !== 'withdrawn');
  const canNom = e.status === 'nominations' && e.eligibility.eligible && !mine;
  return `${canNom ? card('Nominate yourself', 'user-plus', `<form id="nom-f" class="grid-form"><div class="field"><label>Position</label><select name="position_id">${e.positions.map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join('')}</select></div><div class="field"><label>Slogan</label><input name="slogan" placeholder="e.g. Vision · Unity · Impact"></div><div class="field full"><label>Platform / manifesto *</label><textarea name="manifesto" required placeholder="Your priorities for the Society"></textarea></div><div class="full"><button class="btn btn-primary">${ic('send', 'sm')} Submit nomination</button></div></form>`) : ''}
    ${mine ? `<div class="banner info">${ic('user-check')}<div>Your nomination for <b>${esc(e.positions.find(p => p.id === mine.position_id)?.title)}</b> is ${status(mine.status)}${mine.status === 'nominated' ? ' — <a href="javascript:void(0)" onclick="withdrawCandidacy(' + mine.id + ')">withdraw</a>' : ''}</div></div>` : ''}
    ${card('Candidates', 'users', e.positions.map(p => `<div class="section-title">${esc(p.title)}</div>${e.candidates.filter(c => c.position_id === p.id && c.status !== 'withdrawn').map(c => `<div class="li top">${avatar(c.full_name, c.user_id)}<div class="grow"><div class="t">${esc(c.full_name)} ${status(c.status === 'nominated' ? 'pending' : c.status === 'validated' ? 'approved' : 'rejected')}</div><div class="s">${esc(c.slogan || '')}</div><div class="small mt">${esc(c.manifesto || '')}</div>${c.review_note ? `<div class="xs muted">Review: ${esc(c.review_note)}</div>` : ''}</div>
      ${e.can.validate && c.status === 'nominated' ? `<div class="row"><button class="btn btn-xs btn-success" onclick="decide('candidate',${c.id},true,this)">Validate</button><button class="btn btn-xs btn-danger" onclick="decide('candidate',${c.id},false,this)">Reject</button></div>` : ''}</div>`).join('') || '<p class="small muted">No candidates yet.</p>'}`).join(''))}`;
}
async function withdrawCandidacy(id) { if (!await confirmBox('Withdraw your nomination?', { danger: true, ok: 'Withdraw' })) return; await post(`/candidates/${id}/withdraw`); toast('Nomination withdrawn.'); route(); }
function ballotPanel(e, candBy) {
  if (e.my_ballot) return `<div class="card center" style="padding:30px"><div class="ico tone-green" style="width:60px;height:60px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--green-50);color:var(--green)">${ic('lock', 'xl')}</div><h2 class="mt">Your ballot has been cast</h2>
    <p class="muted">Receipt <b>${esc(e.my_ballot.receipt)}</b> · ${fmtDT(e.my_ballot.cast_at)}</p><p class="small mt">Your vote is anonymous, secure and cannot be traced back to you. AASTEC is committed to transparency and fairness.</p><p class="small muted">Results release: ${fmtDT(e.results_at)}</p></div>`;
  if (!e.eligibility.eligible) return card('Voting is open', 'vote', `<div class="banner warn">${ic('circle-alert')}<div>You are not eligible to vote in this election. See the eligibility criteria on the right.</div></div>`);
  return `<div class="card"><div class="row gap-l"><div class="ico tone-purple" style="width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--purple-50);color:var(--purple)">${ic('vote', 'xl')}</div><div><h2>Election Voting</h2><div class="muted">AASTEC Rally Society · ${esc(e.title)}</div></div></div>
    <div class="banner info mt">${ic('circle-check')}<div class="grow"><b>You are eligible to vote</b><div class="small">Active member of Rally Society ${esc(e.society_short)} · Good standing</div></div></div>
    <div class="row between"><b>VOTE FOR YOUR LEADERS</b><span class="small muted">Select one candidate for each position</span></div>
    <div class="grid g2 mt">${e.positions.map(p => `<div class="ballot-pos"><div class="ph">${esc(p.title.toUpperCase())}</div><div class="grid" style="grid-template-columns:repeat(${Math.max(1, candBy(p.id).length)},1fr);gap:4px;padding:8px">${candBy(p.id).map(c => `<div class="cand" data-c="${c.id}" data-p="${p.id}">${avatar(c.full_name, c.user_id, 'lg')}<b class="small">${esc(c.full_name)}</b><span class="xs" style="color:var(--blue)">${esc(c.slogan || '')}</span><a class="xs" href="javascript:void(0)" data-platform="${c.id}">View platform</a></div>`).join('')}</div></div>`).join('')}</div>
    <div class="grid g3 mt"><div class="card surface tight"><div class="xs strong mb">VOTING INSTRUCTIONS</div>${['Review candidates and platforms', 'Select one per position', 'Review & confirm your choices', 'Submit your secure ballot'].map(t => `<div class="row xs" style="padding:2px 0">${ic('circle-check', 'sm')}${t}</div>`).join('')}</div>
      <div class="card surface tight"><div class="xs strong mb">HANDBOOK RULES</div>${['One member, one vote', 'No campaigning inside the ballot', 'No recording or sharing', 'Respect & fair conduct'].map(t => `<div class="row xs" style="padding:2px 0">${ic('shield-check', 'sm')}${t}</div>`).join('')}</div>
      <div class="card surface tight center"><div class="xs strong mb">SUPERVISED BY</div>${seal(e.society_short, 'lg')}<div class="xs mt">${esc(e.advisor_name || 'Faculty Advisor')}<br>& AASTEC representative</div></div></div>
    <div class="mt"><div class="row between small"><b>VOTING PROGRESS</b><span id="bp-l">0%</span></div><div class="bar thick blue mt"><span id="bp" style="width:0"></span></div><div class="xs muted mt" id="bp-s">Step 1 of ${e.positions.length + 1}</div></div>
    <button class="btn btn-primary btn-lg btn-block mt" id="ballot-go">${ic('lock')} REVIEW & SUBMIT SECURE BALLOT</button>
    <p class="xs muted center mt">${ic('lock', 'sm')} Your vote is encrypted and anonymous. Results release: ${fmtDT(e.results_at)}</p></div>`;
}
function updateBallotProgress(e) { const n = $$('.cand.on').length; const p = Math.round(100 * n / e.positions.length); $('#bp').style.width = p + '%'; $('#bp-l').textContent = p + '%'; $('#bp-s').textContent = `Step ${n + 1} of ${e.positions.length + 1}`; }
async function submitBallot(e) {
  const sel = {}; $$('.cand.on').forEach(c => sel[c.dataset.p] = +c.dataset.c);
  const missing = e.positions.filter(p => !sel[p.id]); if (missing.length) return toast(`Please select a candidate for ${missing.map(p => p.title).join(', ')}.`, 'err');
  const summary = e.positions.map(p => `<div class="li"><span class="grow small">${esc(p.title)}</span><b>${esc(e.candidates.find(c => c.id === sel[p.id]).full_name)}</b></div>`).join('');
  const m = modal({ title: 'Confirm your ballot', icon: 'lock', body: `<div class="list">${summary}</div><div class="banner info small mt">${ic('shield-check', 'sm')}Once submitted, your ballot cannot be changed. Your choice is stored separately from your identity.</div>`, foot: `<button class="btn btn-ghost" data-close>Go back</button><button class="btn btn-primary" id="bc-go">${ic('send', 'sm')} Submit secure ballot</button>` });
  $('#bc-go', m).onclick = (ev) => guard(ev.currentTarget, async () => { const r = await post(`/elections/${e.id}/vote`, { selections: sel }); m.close(); toast(`Ballot cast — receipt ${r.receipt}`); route(); });
}
function resultsPanel(e) {
  return card(e.status === 'tally' ? 'Results preview (not yet published)' : 'Official results', 'trophy', `<div class="grid g2">${e.results.map(p => `<div class="card surface"><div class="section-title">${esc(p.title)}</div>${p.candidates.map(c => `<div class="mb"><div class="row between small"><span class="row">${avatar(c.full_name, c.user_id, 'xs')}<b>${esc(c.full_name)}</b>${c.winner ? chip('Elected', 'solid-gold', 'crown') : ''}</span><span>${c.votes} votes · ${c.pct}%</span></div>${bar(c.pct, c.winner ? 'gold' : '', 'thick')}</div>`).join('')}${p.tie ? `<div class="banner warn small">${ic('triangle-alert', 'sm')}Tie — a run-off is required by the handbook.</div>` : ''}<div class="xs muted">${p.total} valid votes</div></div>`).join('')}</div>
    <div class="row small muted mt">${ic('users', 'sm')} Turnout ${e.stats.turnout}% (${e.stats.ballots} of ${e.stats.eligible} eligible voters)</div>`);
}
function handoverPanel(e) {
  const done = e.handover.filter(t => t.done).length;
  return card('Handover checklist (post-election)', 'handshake', `<div class="row gap-l mb">${ring(pct(done, e.handover.length), { size: 80, stroke: 8, color: 'var(--green)' })}<div class="small muted">${e.sandbox ? 'Pilot rehearsal — completing the handover does not change any roles.' : 'When every item is complete, the Programme Manager activates the new board: previous authorities expire and the new hierarchy takes effect.'}</div></div>
    <div class="list">${e.handover.map(t => `<div class="li"><input type="checkbox" ${t.done ? 'checked' : ''} ${e.can.handover && e.status !== 'closed' ? `onchange="toggleHandover(${t.id})"` : 'disabled'}><div class="grow"><div class="small ${t.done ? '' : 'strong'}">${esc(t.title)}</div><div class="xs muted">${esc(t.owner_label)}${t.done_by_name ? ` · done by ${esc(t.done_by_name)} ${fmtDate(t.done_at)}` : ''}</div></div>${t.done ? chip('Done', 'green') : chip('Open', '')}</div>`).join('')}</div>
    ${e.can.complete && e.status !== 'closed' ? `<button class="btn btn-primary mt" id="ho-done" ${done < e.handover.length ? 'disabled title="Complete every checklist item first"' : ''}>${ic('crown', 'sm')} Complete handover & activate new board</button>` : ''}
    ${e.handover_completed_at ? `<div class="banner info mt">${ic('circle-check')}<div>Handover completed ${fmtDT(e.handover_completed_at)}.</div></div>` : ''}`, { cls: 'mt' });
}
async function toggleHandover(id) { await post(`/handover-tasks/${id}/toggle`).catch(e => toast(e.message, 'err')); route(); }
