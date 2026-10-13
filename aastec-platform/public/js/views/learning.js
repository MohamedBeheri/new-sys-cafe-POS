// ===================================================================
//  Learning & AI: hub, catalogue, course player, quizzes, certificates,
//  AI Learning Coach, AI tools and course authoring
// ===================================================================
'use strict';
const CAT_ICON = { Entrepreneurship: 'rocket', Leadership: 'crown', Finance: 'wallet', Marketing: 'megaphone', Technology: 'shield', 'AI & Data': 'brain-circuit', Innovation: 'lightbulb', Governance: 'landmark', Incubation: 'sprout' };
const courseCard = (c) => `<div class="card course-card" onclick="location.hash='#/course/${c.id}'"><div class="cover" style="background:linear-gradient(135deg, ${c.color || '#102D5A'}, #0A1F40)">${c.tag ? `<span class="tag">${esc(c.tag)}</span>` : ''}<h4>${esc(c.title)}</h4></div>
  <div class="body"><div class="small muted">${esc(c.instructor || '')}</div><div class="row xs muted">${ic('star', 'sm')} ${c.rating || '4.7'} · ${esc(c.level)} · ${ic('clock', 'sm')} ${esc(c.duration_label || '')}</div>
  ${c.my_status ? `<div class="mt">${bar(c.my_status === 'completed' ? 100 : c.my_progress, c.my_status === 'completed' ? 'green' : 'gold', 'thin')}<div class="xs muted mt">${c.my_status === 'completed' ? 'Completed' : `${c.my_progress}% complete`}</div></div>` : `<div class="xs muted mt">${num(c.learners)} learners${c.lessons ? ` · ${c.lessons} lessons` : ''}</div>`}</div></div>`;
const aiChip = () => chip(APP.meta.ai.enabled ? 'Claude AI' : 'Offline assistant', APP.meta.ai.enabled ? 'solid-gold' : '', 'sparkles');
const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_(.+?)_/g, '<i>$1</i>');

// ---------------- Learning Hub ----------------
ROUTES.learning = async (view, tab) => {
  if (tab === 'catalogue') return catalogue(view);
  const d = await api('/learning/hub');
  const p = d.my_path;
  view.innerHTML = pageHead('Learning & Training Hub', 'Grow your skills. Earn certificates. Lead the future.', `${can('learning.manage') ? `<a class="btn btn-ghost" href="#/course-edit/new">${ic('plus')} New course</a>` : ''}<a class="btn btn-ghost" href="#/learning/catalogue">${ic('book-open')} Course catalogue</a><a class="btn btn-primary" href="#/certificates">${ic('award')} My certificates</a>`, 'graduation-cap') + `
    <div class="grid g-12 mb-l"><div class="span-8"><div class="kpis" style="margin:0">
      ${kpi({ icon: 'users', tone: 'navy', label: 'Active learners', value: num(d.stats.learners), meta: 'Last 90 days' })}${kpi({ icon: 'book-open-check', tone: 'gold', label: 'Course completions', value: num(d.stats.completions) })}
      ${kpi({ icon: 'award', tone: 'blue', label: 'Certificates earned', value: num(d.stats.certificates), meta: 'Last 30 days' })}${kpi({ icon: 'clock', tone: 'green', label: 'Mentoring hours', value: num(d.stats.mentoring_hours) })}</div></div>
      <div class="span-4"><div class="card navy" style="height:100%"><div class="row between"><h3>${ic('bot')} AI Learning Assistant</h3>${aiChip()}</div><p class="small muted mt">Hi ${esc(APP.me.full_name.split(' ')[0])}! Ready to accelerate your learning journey?</p><a class="btn btn-gold mt" href="#/coach">${ic('sparkles', 'sm')} Ask AI Assistant</a></div></div></div>
    <div class="card mb-l"><div class="card-h"><h3>${ic('star')} Featured courses</h3><a class="link" href="#/learning/catalogue">View all ${ic('arrow-right', 'sm')}</a></div><div class="grid g-auto">${d.featured.map(courseCard).join('')}</div></div>
    <div class="grid g-12 mb-l">
      <div class="span-5">${card(`My personalised learning path — ${p?.title || ''}`, 'git-branch', p ? `${p.courses.map(c => `<a class="li click" href="#/course/${c.id}" style="text-decoration:none"><span class="ico tone-${['blue', 'gold', 'navy', 'green', 'purple'][c.id % 5]}" style="width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center">${ic(CAT_ICON[c.category] || 'book-open', 'sm')}</span><span class="grow small strong">${esc(c.title)}</span><div style="width:110px">${bar(c.status === 'completed' ? 100 : c.progress, 'green', 'thin')}</div><span class="xs">${c.status === 'completed' ? '100' : c.progress}%</span></a>`).join('')}` : empty('No path assigned'), { link: '#/coach', linkText: 'Coach' })}</div>
      <div class="span-3"><div class="card center" style="height:100%;background:var(--gold-50)"><div class="small strong">${ic('target', 'sm')} Keep going, ${esc(APP.me.full_name.split(' ')[0])}!</div><div class="xs muted mb">You're on track to achieve your goals.</div><div class="row mt" style="justify-content:center">${ring(p?.progress || 0, { size: 120, stroke: 11, color: 'var(--gold)', sub: 'Progress' })}</div><div class="small mt">${p?.completed || 0} of ${p?.courses.length || 0} courses completed</div><div class="row mt" style="justify-content:center">${chip(`${d.streak}-day streak`, 'gold', 'flame')}</div></div></div>
      <div class="span-4">${card('Upcoming workshops', 'presentation', d.workshops.length ? `<div class="list">${d.workshops.map(w => `<div class="li click" onclick="location.hash='#/calendar/${w.id}'">${dateTile(w.start_at)}<div class="grow"><div class="t">${esc(w.title)}</div><div class="s">${fmtTime(w.start_at)} · ${esc(w.location || cap(w.mode))}</div></div><span class="xs muted">+${w.going}</span></div>`).join('')}</div>` : empty('No upcoming workshops', 'presentation'), { link: '#/calendar' })}</div></div>
    <div class="grid g-12 mb-l">
      <div class="span-8">${card('Explore training categories', 'layers', `<div class="row wrap">${d.categories.map(c => `<a class="card surface tight row" href="#/learning/catalogue" onclick="LCAT='${esc(c.category)}'" style="text-decoration:none;min-width:170px">${ic(CAT_ICON[c.category] || 'book-open')}<div><div class="small strong">${esc(c.category)}</div><div class="xs muted">${c.n} course${c.n > 1 ? 's' : ''}</div></div></a>`).join('')}</div>`)}</div>
      <div class="span-4">${card('Continue learning', 'circle-play', d.continue.length ? d.continue.map(c => `<div class="li"><span class="dot-st" style="background:${c.color}"></span><div class="grow"><div class="small strong ellipsis">${esc(c.title)}</div>${bar(c.progress, 'gold', 'thin')}</div><a class="btn btn-xs btn-primary" href="#/course/${c.course_id}/${c.last_lesson_id || ''}">Continue</a></div>`).join('') : empty('Enroll in a course to start', 'book-open'))}</div></div>
    <div class="grid g3">
      ${card('Earned certificates', 'award', d.certificates.length ? `<div class="grid g2">${d.certificates.map(c => `<div class="cert-thumb" onclick="showCertificate('${c.code}')">${wordmark('on-light')}<b>${esc(c.title)}</b><div class="xs">Certificate of Completion</div></div>`).join('')}</div>` : empty('Complete a course to earn a certificate', 'award'), { link: '#/certificates' })}
      ${card('From the learning community', 'users', `<div class="list">${d.activity.map(a => `<a class="li click" href="#/profile/${a.user_id}" style="text-decoration:none">${avatar(a.full_name, a.user_id, 'sm')}<div class="grow small"><b>${esc(a.full_name)}</b> completed <b>${esc(a.title)}</b><div class="xs muted">${ago(a.issued_at)}</div></div></a>`).join('')}</div>
        <div class="banner gold small mt" style="margin:8px 0 0">${ic('lightbulb', 'sm')}“Learning is the key to entrepreneurial success.” — AASTEC Community</div>`)}
      ${card('Society chapter learning activity', 'trophy', `<div class="grid g3">${d.societies.map(s => `<a class="center" href="#/society/${s.id}" style="text-decoration:none">${seal(s.short_name, 'lg')}<div class="small strong mt">${esc(s.short_name)}</div><div class="xs muted">${s.learners} learners</div><div class="xs muted">${s.completions} completions</div></a>`).join('')}</div>`)}
    </div>`;
};
let LCAT = '';
async function catalogue(view) {
  const courses = await api(`/courses${can('learning.manage') ? '?all=1' : ''}`);
  const cats = [...new Set(courses.map(c => c.category))];
  view.innerHTML = pageHead('Course catalogue', 'Entrepreneurship, leadership, governance, AI, digital skills and incubation', `<a class="btn btn-ghost" href="#/learning">${ic('arrow-left')} Learning Hub</a>${can('learning.manage') ? `<a class="btn btn-primary" href="#/course-edit/new">${ic('plus')} New course</a>` : ''}`) + `
    <div class="toolbar"><input class="input" id="cq" placeholder="Search courses"><div class="seg" id="cc"><button data-c="" class="active">All</button>${cats.map(c => `<button data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div></div><div class="grid g-auto" id="cg"></div>`;
  const draw = () => { const q = $('#cq').value.toLowerCase(); $('#cg').innerHTML = courses.filter(c => (!LCAT || c.category === LCAT) && (!q || c.title.toLowerCase().includes(q))).map(c => courseCard(c) + (c.is_published ? '' : '')).join('') || empty('No courses match'); };
  $$('#cc button').forEach(b => { b.classList.toggle('active', b.dataset.c === LCAT); b.onclick = () => { LCAT = b.dataset.c; $$('#cc button').forEach(x => x.classList.toggle('active', x === b)); draw(); }; });
  $('#cq').oninput = draw; draw();
}

// ---------------- Course page & player ----------------
ROUTES.course = async (view, id, lessonId) => {
  const c = await api(`/courses/${id}`);
  const e = c.enrollment; const lessons = c.modules.flatMap(m => m.lessons);
  const done = lessons.filter(l => l.done).length;
  const head = `<div class="small muted mb"><a href="#/learning/catalogue">All courses</a> › ${esc(c.category)} › ${esc(c.title)}</div>
    <div class="card mb-l"><div class="row gap-l top wrap"><div style="width:220px;height:124px;border-radius:12px;background:linear-gradient(135deg, ${c.color}, #0A1F40);color:#fff;padding:14px;display:flex;flex-direction:column;justify-content:flex-end;flex-shrink:0"><b style="font-family:var(--display)">${esc(c.title)}</b><span class="xs" style="color:var(--gold)">AASTEC</span></div>
      <div class="grow"><h2 style="font-size:22px">${esc(c.title)} ${e ? chip(e.status === 'completed' ? 'Completed' : 'Enrolled', 'green') : ''}</h2><p class="muted">${esc(c.summary || '')}</p>
        <div class="row wrap mt small"><span>${ic('user', 'sm')} ${esc(c.instructor)}</span><span>${ic('layers', 'sm')} ${esc(c.level)}</span><span>${ic('clock', 'sm')} ${esc(c.duration_label || '')}</span><span>${ic('users', 'sm')} ${num(c.learners)} enrolled</span><span>${ic('globe', 'sm')} English</span></div></div>
      <div class="col">${e ? `<a class="btn btn-primary" href="#/course/${c.id}/${e.last_lesson_id || lessons[0]?.id}">${ic('circle-play', 'sm')} Continue learning</a>` : `<button class="btn btn-primary" id="enr">${ic('plus', 'sm')} Enroll — free</button>`}<button class="btn btn-ghost" onclick="navigator.clipboard.writeText(location.href).then(()=>toast('Course link copied.'))">${ic('share-2', 'sm')} Share</button>${c.can_manage ? `<a class="btn btn-ghost" href="#/course-edit/${c.id}">${ic('pencil', 'sm')} Edit course</a>` : ''}</div></div></div>`;
  const outline = `<div class="card"><div class="card-h"><h3>Course content</h3></div><div class="small muted">Overall progress</div>${bar(e ? e.progress : 0, 'gold')}<div class="xs muted mt mb">${done} / ${lessons.length} lessons</div>
    ${c.modules.map((m, i) => `<div class="mt"><div class="small strong">${ic('circle-play', 'sm')} Module ${i + 1}: ${esc(m.title)}</div><div class="xs muted mb">${m.lessons.filter(l => l.done).length} / ${m.lessons.length} lessons</div>
      ${m.lessons.map((l, j) => `<div class="lesson ${l.done ? 'done' : ''} ${+lessonId === l.id ? 'active' : ''}" onclick="${e ? `location.hash='#/course/${c.id}/${l.id}'` : "toast('Enroll to open lessons.','err')"}"><span class="ck">${l.done ? ic('check', 'sm') : ''}</span><span class="grow">${i + 1}.${j + 1} ${esc(l.title)}</span><span class="xs muted">${l.duration_min}:00</span></div>`).join('')}</div>`).join('')}
    ${c.quiz_questions ? `<div class="lesson mt" onclick="${e ? `openQuiz(${c.id})` : ''}"><span class="ck">${e?.quiz_score >= c.pass_mark ? ic('check', 'sm') : ''}</span><span class="grow strong">Final assessment (${c.quiz_questions} questions)</span>${e?.quiz_score != null ? `<span class="xs">${e.quiz_score}%</span>` : ''}</div>` : ''}</div>`;
  const criteria = card('Certificate criteria', 'award', `<p class="xs muted mb">Complete all requirements to earn your certificate.</p>${[[`Complete all ${c.modules.length} modules`, `${c.modules.filter(m => m.lessons.every(l => l.done)).length}/${c.modules.length}`, c.modules.every(m => m.lessons.every(l => l.done))], [`Complete all lessons`, `${pct(done, lessons.length)}%`, done === lessons.length], [`Score ${c.pass_mark}%+ on the final assessment`, e?.quiz_score != null ? `${e.quiz_score}%` : '—', (e?.quiz_score ?? 0) >= c.pass_mark]].map(([t, v, ok]) => `<div class="row small" style="padding:4px 0"><span style="color:${ok ? 'var(--green)' : 'var(--faint)'}">${ic(ok ? 'circle-check' : 'circle-dot', 'sm')}</span><span class="grow">${t}</span><b>${v}</b></div>`).join('')}
    ${c.certificate ? `<button class="btn btn-gold btn-block mt" onclick="showCertificate('${c.certificate.code}')">${ic('award', 'sm')} View certificate</button>` : ''}`);
  if (!e || !lessonId) {
    view.innerHTML = head + `<div class="grid g-12"><div class="span-4">${outline}</div><div class="span-5">${card('About this course', 'info', `<p>${esc(c.description || c.summary || '')}</p><div class="section-title mt">What you will learn</div>${c.modules.map(m => `<div class="row small" style="padding:3px 0"><span style="color:var(--green)">${ic('circle-check', 'sm')}</span>${esc(m.title)}</div>`).join('')}`)}
      ${c.peers.length ? card('Recent graduates', 'users', `<div class="list">${c.peers.map(p => `<a class="li" href="#/profile/${p.id}">${avatar(p.full_name, p.id, 'sm')}<span class="grow small">${esc(p.full_name)} <span class="muted">${esc(p.society_short || '')}</span></span><span class="xs muted">${ago(p.completed_at)}</span></a>`).join('')}</div>`, { cls: 'mt' }) : ''}</div><div class="span-3">${criteria}</div></div>`;
    $('#enr')?.addEventListener('click', (ev) => guard(ev.currentTarget, async () => { const r = await post(`/courses/${c.id}/enroll`); toast('Enrolled — enjoy the course!'); location.hash = `#/course/${c.id}/${r.first_lesson}`; }));
    return;
  }
  const l = await api(`/lessons/${lessonId}`);
  view.innerHTML = head + `<div class="grid g-12"><div class="span-3">${outline}</div>
    <div class="span-6 col"><div class="card"><div class="row between mb"><h3>${l.position}. ${esc(l.title)}</h3><div class="row">${l.prev_id ? `<a class="btn btn-sm btn-ghost" href="#/course/${c.id}/${l.prev_id}">${ic('arrow-left', 'sm')} Previous</a>` : ''}${l.next_id ? `<a class="btn btn-sm btn-ghost" href="#/course/${c.id}/${l.next_id}">Next ${ic('arrow-right', 'sm')}</a>` : ''}</div></div>
      <div class="player"><div class="k">Lesson ${l.position} of ${l.total} · ${esc(l.module_title)}</div><h2>${esc(l.title)}</h2><div class="small" style="opacity:.8">${esc(c.instructor)} · ${l.duration_min} min</div></div>
      ${l.video_url ? `<div class="mt"><a class="btn btn-sm btn-blue" href="${esc(l.video_url)}" target="_blank" rel="noopener">${ic('video', 'sm')} Watch lesson video</a></div>` : ''}
      <div class="tabs mt"><button class="active">Overview</button></div><div style="line-height:1.8;font-size:14.5px">${esc(l.content || '').replace(/\n/g, '<br>')}</div>
      <div class="row between mt-l">${l.done ? chip('Lesson completed', 'green', 'circle-check') : `<button class="btn btn-success" id="mk">${ic('check', 'sm')} Mark lesson complete</button>`}${l.next_id ? `<a class="btn btn-primary" href="#/course/${c.id}/${l.next_id}">Next lesson ${ic('arrow-right', 'sm')}</a>` : c.quiz_questions ? `<button class="btn btn-gold" onclick="openQuiz(${c.id})">${ic('clipboard-check', 'sm')} Take final assessment</button>` : ''}</div></div></div>
    <div class="span-3 col"><div class="card"><div class="row between"><h3 style="font-size:15px">${ic('sparkles')} AI Course Copilot</h3>${aiChip()}</div><p class="xs muted mb">I'm your AI study assistant. How can I help you learn today?</p>
      ${[['summarize', 'file-text', 'Summarise this lesson', 'Get a quick summary of key points'], ['quiz', 'clipboard-check', 'Generate practice quiz', 'Test your understanding'], ['explain', 'lightbulb', 'Explain this concept', 'Step-by-step with the AI coach'], ['plan', 'calendar-check', 'Build a study plan', 'Create a personal plan'], ['mentor', 'heart-handshake', 'Ask a mentor', 'Get guidance from course mentors']].map(([k, i, t, s]) => `<button class="li click" style="width:100%;text-align:left" data-ai="${k}">${ic(i, 'sm')}<div class="grow"><div class="small strong">${t}</div><div class="xs muted">${s}</div></div></button>`).join('')}
      <div id="ai-out" class="mt"></div></div>${criteria}</div></div>`;
  $('#mk')?.addEventListener('click', (ev) => guard(ev.currentTarget, async () => { const r = await post(`/lessons/${l.id}/complete`); if (r.certificate) { toast('Course completed — certificate issued!'); showCertificate(r.certificate); } else toast('Lesson completed.'); route(); }));
  $$('[data-ai]').forEach(b => b.onclick = () => guard(b, async () => {
    const k = b.dataset.ai;
    if (k === 'explain') { PENDING_COACH = `Explain the concept "${l.title}" from the course ${c.title} step by step.`; location.hash = '#/coach'; return; }
    if (k === 'plan') { PENDING_COACH = `Build me a two-week study plan to finish ${c.title}. I have completed ${done} of ${lessons.length} lessons.`; location.hash = '#/coach'; return; }
    if (k === 'mentor') { location.hash = '#/mentors'; return; }
    const r = await post(`/ai/${k}`, { lesson_id: l.id });
    $('#ai-out').innerHTML = `<div class="ai-out">${md(r.text)}</div><div class="xs muted mt">${r.mode === 'claude' ? `Generated by ${esc(APP.meta.ai.model || 'Claude')}` : 'Offline assistant'}${r.notice ? ' · ' + esc(r.notice) : ''}</div>`;
  }));
};
async function openQuiz(cid) {
  const qs = await api(`/courses/${cid}/quiz`);
  const m = modal({ title: 'Final assessment', icon: 'clipboard-check', size: 'wide', body: `<form id="qz">${qs.map((q, i) => `<div class="card surface tight mb" data-q="${q.id}"><div class="strong small mb">${i + 1}. ${esc(q.question)}</div>${q.options.map((o, k) => `<label class="row small" style="padding:4px 0;cursor:pointer"><input type="radio" name="q${q.id}" value="${k}"> ${esc(o)}</label>`).join('')}<div class="fb xs mt"></div></div>`).join('')}</form><div id="qz-res"></div>`,
    foot: `<button class="btn btn-ghost" data-close>Close</button><button class="btn btn-primary" id="qz-go">${ic('send', 'sm')} Submit answers</button>` });
  $('#qz-go', m).onclick = (ev) => guard(ev.currentTarget, async () => {
    const answers = {}; qs.forEach(q => { const v = $(`input[name=q${q.id}]:checked`, m); if (v) answers[q.id] = +v.value; });
    if (Object.keys(answers).length < qs.length) throw new Error('Please answer every question.');
    const r = await post(`/courses/${cid}/quiz`, { answers });
    r.review.forEach(x => { const box = $(`[data-q="${x.id}"]`, m); box.style.borderLeft = `4px solid ${x.correct ? 'var(--green)' : 'var(--red)'}`; $('.fb', box).innerHTML = x.correct ? `<span style="color:var(--green)">Correct.</span> ${esc(x.explanation || '')}` : `<span style="color:var(--red)">Incorrect.</span> ${esc(x.explanation || '')}`; });
    $('#qz-res', m).innerHTML = `<div class="banner ${r.passed ? 'info' : 'warn'}">${ic(r.passed ? 'trophy' : 'refresh-cw', 'lg')}<div><b>Score ${r.score}% — ${r.passed ? 'passed' : `pass mark ${r.pass_mark}%`}</b><div class="small">${r.certificate ? 'Your certificate has been issued!' : r.passed && r.lessons_remaining > 0 ? `Complete the remaining ${r.lessons_remaining} lesson(s) to receive your certificate.` : r.passed ? '' : 'Review the lessons and try again.'}</div></div>${r.certificate ? `<button class="btn btn-gold" onclick="showCertificate('${r.certificate}')">View certificate</button>` : ''}</div>`;
    $('#qz-go', m).remove();
  });
}

// ---------------- Certificates ----------------
ROUTES.certificates = async (view) => {
  const list = await api('/certificates');
  view.innerHTML = pageHead('My certificates', 'Verified credentials saved to your profile — print them or add them to LinkedIn', `<a class="btn btn-ghost" href="#/learning">${ic('graduation-cap')} Learning Hub</a>`, 'award')
    + (list.length ? `<div class="grid g-auto">${list.map(c => `<div class="card"><div class="cert-thumb" onclick="showCertificate('${c.code}')" style="padding:22px 12px">${wordmark('on-light')}<b style="font-size:14px">${esc(c.title)}</b><div class="xs">Certificate of Completion</div></div>
      <div class="row between mt"><div><div class="small strong">${fmtDate(c.issued_at)}</div><div class="xs muted">${esc(c.code)}</div></div><button class="btn btn-sm btn-primary" onclick="showCertificate('${c.code}')">View</button></div></div>`).join('')}</div>` : card('No certificates yet', 'award', empty('Complete a course and pass its assessment to earn your first certificate.', 'award')));
};
async function showCertificate(code) {
  const { certificate: c } = await api(`/public/verify/${code}`);
  const url = `${location.origin}/verify/${c.code}`; const d = new Date(c.issued_at);
  const li = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(c.title)}&organizationName=${encodeURIComponent('AAST Entrepreneurship Center (AASTEC)')}&issueYear=${d.getFullYear()}&issueMonth=${d.getMonth() + 1}&certUrl=${encodeURIComponent(url)}&certId=${encodeURIComponent(c.code)}`;
  modal({ title: 'Certificate', icon: 'award', size: 'xl', body: `<div class="cert" id="cert-print"><div class="row" style="justify-content:space-between"><img src="/img/logo-full.png" style="width:110px" alt="AASTEC"><div class="qr-box" style="padding:4px">${qrImg(url, 3)}</div></div>
      <h1>CERTIFICATE OF COMPLETION</h1><div style="font-size:16px">This is to certify that</div><div class="name">${esc(c.full_name)}</div><div style="font-size:16px">has successfully completed</div><div class="course">${esc(c.title)}</div>
      <div style="font-size:14px;color:#55607a">${esc(c.category || '')}${c.hours ? ` · ${c.hours} learning hours` : ''}${c.society ? ` · ${esc(c.society)}` : ''}</div>
      <div class="row mt-l" style="justify-content:space-around;margin-top:34px"><div><div style="border-top:1px solid #1b2a44;padding-top:4px;width:200px;font-size:13px">Executive Director<br><small>AAST Entrepreneurship Center</small></div></div><div style="font-size:13px">Issued ${fmtDate(c.issued_at, { day: 'numeric', month: 'long', year: 'numeric' })}<br><small>Verification code: <b>${esc(c.code)}</b></small></div><div><div style="border-top:1px solid #1b2a44;padding-top:4px;width:200px;font-size:13px">Training & Learning<br><small>Programme Manager</small></div></div></div></div>`,
    foot: `<button class="btn btn-ghost" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Verification link copied.'))">${ic('link', 'sm')} Copy verification link</button><a class="btn btn-blue" href="${li}" target="_blank" rel="noopener">${ic('external-link', 'sm')} Add to LinkedIn</a><button class="btn btn-primary" onclick="printCertificate()">${ic('printer', 'sm')} Print / save PDF</button>` });
}
function printCertificate() {
  const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to print the certificate.', 'err');
  w.document.write(`<!doctype html><html><head><title>Certificate</title><link rel="stylesheet" href="/css/app.css"><style>@page{size:A4 landscape;margin:10mm}body{background:#fff}.cert{margin:0}</style></head><body>${$('#cert-print').outerHTML}<script>setTimeout(()=>{print();},500)<\/script></body></html>`); w.document.close();
}

// ---------------- AI Learning Coach ----------------
let COACH_HISTORY = []; let PENDING_COACH = null;
async function coachAsk(text) {
  const box = $('#coach-chat'); if (!box || !text.trim()) return;
  COACH_HISTORY.push({ role: 'user', content: text });
  box.insertAdjacentHTML('beforeend', `<div class="bubble user">${esc(text)}</div><div class="bubble bot" id="typing">…</div>`); box.scrollTop = box.scrollHeight;
  try { const r = await post('/ai/coach', { messages: COACH_HISTORY }); COACH_HISTORY.push({ role: 'assistant', content: r.text }); $('#typing').outerHTML = `<div class="bubble bot">${md(r.text)}</div>`; }
  catch (e) { $('#typing').outerHTML = `<div class="bubble bot" style="color:var(--red)">${esc(e.message)}</div>`; COACH_HISTORY.pop(); }
  box.scrollTop = box.scrollHeight;
}
ROUTES.coach = async (view) => {
  const d = await api('/learning/coach');
  const first = APP.me.full_name.split(' ')[0];
  view.innerHTML = pageHead('AI Learning Coach', 'Your personalised AI-powered roadmap to grow, lead and make impact', `${aiChip()}<a class="btn btn-ghost" href="#/learning">${ic('graduation-cap')} Learning Hub</a>`, 'sparkles') + `
    <div class="grid g-12 mb-l"><div class="span-8 col">
      <div class="card"><div class="row gap-l wrap"><div class="ico tone-navy" style="width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center">${ic('bot', 'xl')}</div><div class="grow" style="min-width:220px"><b>${esc(first)}, your learning journey is on track!</b><div class="small muted">You're ${d.progress}% of the way to your role targets.</div>${bar(d.progress, 'gold', 'thick')}</div>
        <div class="row gap-l"><div class="center"><div class="xs muted">Current level</div><b>${d.level}</b></div><div class="center"><div class="xs muted">Skills mastered</div><b>${d.mastered} / ${d.total}</b></div><div class="center"><div class="xs muted">Learning streak</div><b style="color:var(--orange)">${d.streak} days ${ic('flame', 'sm')}</b></div></div></div></div>
      <div class="grid g2">${card('Your skills radar', 'radar', '<div style="height:300px"><canvas id="c-radar"></canvas></div>', { actions: chip('AI', 'blue') })}
        ${card('Recommended pathway for you', 'git-branch', `<div class="stepper" style="grid-template-columns:repeat(4,1fr)">${['Learn', 'Build', 'Lead', 'Impact'].map((t, i) => { const at = Math.min(3, Math.floor(d.progress / 30)); return `<div class="st ${i < at ? 'done' : i === at ? 'now' : ''}"><div class="num">${i + 1}</div><div class="lbl">${t}</div></div>`; }).join('')}</div>
          <div class="section-title mt-l">Next courses for you</div>${d.recommendations.map(c => `<div class="li"><div class="grow"><div class="small strong">${esc(c.title)}</div><div class="xs muted">${esc(c.category)} · ${ic('star', 'sm')} ${c.rating} · ${c.hours}h</div></div><a class="btn btn-xs btn-ghost" href="#/course/${c.id}">Start</a></div>`).join('')}`)}</div>
      <div class="grid g2">${card('AI action plan (this week)', 'list-checks', `<div class="list">${d.plan.map(p => `<div class="li">${ic(p.kind === 'course' ? 'book-open' : p.kind === 'event' ? 'calendar' : 'sparkles', 'sm')}<span class="grow small">${esc(p.action)}</span>${p.at ? `<span class="xs muted">${fmtDate(p.at, { day: 'numeric', month: 'short' })}</span>` : ''}</div>`).join('')}</div>`)}
        ${card('Communities you should join', 'users-round', d.groups.length ? `<div class="grid g2">${d.groups.map(g => `<div class="card surface tight center"><div class="small strong">${esc(g.name)}</div><div class="xs muted">${g.members} members</div><button class="btn btn-xs btn-ghost mt" onclick="groupAct(${g.id},'join',this)">Join</button></div>`).join('')}</div>` : empty("You've joined the suggested communities", 'users-round'))}</div></div>
      <div class="span-4 col"><div class="card navy"><h3>${ic('sparkles')} Ask your AI Learning Coach</h3><p class="small muted mb">Get personalised advice, resources and feedback.</p>
        ${['How can I improve my leadership skills?', 'Suggest courses to improve my pitching.', 'How do I validate my startup idea?', 'How can I prepare for an investor pitch?'].map(q => `<button class="prompt-chip" data-q="${esc(q)}">${ic('sparkles', 'sm')} ${q}</button>`).join('')}
        <div class="chat-ai mt" id="coach-chat" style="background:var(--card);border-radius:10px;padding:10px;color:var(--text);min-height:120px">${COACH_HISTORY.map(m => `<div class="bubble ${m.role === 'user' ? 'user' : 'bot'}">${m.role === 'user' ? esc(m.content) : md(m.content)}</div>`).join('') || '<div class="xs muted">Your conversation appears here.</div>'}</div>
        <form class="row mt" id="coach-f"><input class="input" id="coach-in" placeholder="Type your question…" autocomplete="off"><button class="btn btn-gold">${ic('send', 'sm')}</button></form></div>
      ${card('AI skill gap insights', 'target', d.gaps.slice(0, 4).map(g => `<div class="row mb"><span class="grow small">${esc(g.skill)}</span><div style="width:120px">${bar(g.gap * 2, 'amber', 'thin')}</div><b class="small">${g.gap}% gap</b></div>`).join('') || '<p class="small muted">You meet every target for your role. Excellent!</p>')}
      ${d.mentor ? card('Smart mentor match', 'heart-handshake', `<div class="row">${avatar(d.mentor.full_name, d.mentor.id)}<div class="grow"><div class="small strong">${esc(d.mentor.full_name)}</div><div class="xs muted">${esc(d.mentor.headline || '')}</div><div class="row wrap mt">${d.mentor.expertise.slice(0, 3).map(x => chip(x, 'navy')).join('')}</div></div></div><button class="btn btn-sm btn-primary btn-block mt" onclick="startChat(${d.mentor.id})">${ic('mail', 'sm')} Connect</button>`) : ''}</div></div>`;
  chart($('#c-radar'), { type: 'radar', data: { labels: d.radar.map(r => r.skill), datasets: [{ label: 'Your level', data: d.radar.map(r => r.level), borderColor: '#102D5A', backgroundColor: 'rgba(16,45,90,.18)', pointBackgroundColor: '#102D5A' }, { label: 'Recommended level', data: d.radar.map(r => r.target), borderColor: '#F2B91E', backgroundColor: 'rgba(242,185,30,.12)', borderDash: [4, 4], pointBackgroundColor: '#F2B91E' }] }, options: { scales: { r: { min: 0, max: 100, ticks: { display: false } } }, plugins: { legend: { position: 'bottom' } } } });
  $$('[data-q]').forEach(b => b.onclick = () => coachAsk(b.dataset.q));
  $('#coach-f').onsubmit = (e) => { e.preventDefault(); const v = $('#coach-in').value; $('#coach-in').value = ''; coachAsk(v); };
  const box = $('#coach-chat'); box.scrollTop = box.scrollHeight;
  if (PENDING_COACH) { const q = PENDING_COACH; PENDING_COACH = null; coachAsk(q); }
};

// ---------------- AI Pitch Assistant ----------------
function openPitchAssistant(ventureId) {
  const m = modal({ title: 'AI Pitch Assistant', icon: 'sparkles', size: 'wide', body: `<p class="small muted mb">Paste your pitch (problem, solution, market, traction, business model, team and ask). The assistant reviews it and suggests improvements. ${aiChip()}</p>
    <textarea class="input" id="pa-t" style="min-height:200px" placeholder="We help … who struggle with … Our solution …"></textarea><div id="pa-out" class="mt"></div>`,
    foot: `<button class="btn btn-ghost" data-close>Close</button><button class="btn btn-gold" id="pa-go">${ic('sparkles', 'sm')} Analyse my pitch</button>` });
  $('#pa-go', m).onclick = (e) => guard(e.currentTarget, async () => { const r = await post('/ai/pitch', { pitch: $('#pa-t', m).value, venture_id: ventureId }); $('#pa-out', m).innerHTML = `<div class="ai-out">${md(r.text)}</div>${r.notice ? `<div class="xs muted mt">${esc(r.notice)}</div>` : ''}`; });
}

// ---------------- Course authoring ----------------
ROUTES['course-edit'] = async (view, id) => {
  if (!can('learning.manage')) { location.hash = '#/learning'; return; }
  const isNew = id === 'new';
  const c = isNew ? { title: '', category: 'Entrepreneurship', level: 'Beginner', pass_mark: 70, color: '#102D5A', modules: [], is_published: 0 } : await api(`/courses/${id}`);
  const qs = isNew ? [] : await api(`/courses/${id}/questions`);
  view.innerHTML = pageHead(isNew ? 'New course' : `Edit: ${esc(c.title)}`, 'Course details, modules, lessons and the final assessment', `<a class="btn btn-ghost" href="${isNew ? '#/learning' : `#/course/${id}`}">${ic('arrow-left')} Back</a>`) + `
    <div class="grid g-12"><div class="span-5">${card('Course details', 'book-open', `<form id="cef" class="grid-form">
      <div class="field full"><label>Title *</label><input name="title" value="${esc(c.title)}" required></div>
      <div class="field"><label>Category</label><input name="category" value="${esc(c.category)}" list="cats"><datalist id="cats">${Object.keys(CAT_ICON).map(k => `<option>${k}</option>`).join('')}</datalist></div><div class="field"><label>Level</label><select name="level">${['Beginner', 'Intermediate', 'Advanced'].map(l => `<option ${l === c.level ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Duration label</label><input name="duration_label" value="${esc(c.duration_label || '')}" placeholder="4 weeks"></div><div class="field"><label>Learning hours</label><input type="number" name="hours" value="${c.hours || 0}" step="0.5"></div>
      <div class="field"><label>Instructor</label><input name="instructor" value="${esc(c.instructor || APP.me.full_name)}"></div><div class="field"><label>Pass mark %</label><input type="number" name="pass_mark" value="${c.pass_mark}" min="0" max="100"></div>
      <div class="field"><label>Tag</label><select name="tag"><option value="">—</option>${['New', 'Popular', 'Bestseller', 'Trending'].map(t => `<option ${t === c.tag ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="field"><label>Cover colour</label><input type="color" name="color" value="${esc(c.color || '#102D5A')}" style="height:40px"></div>
      <div class="field full"><label>Summary</label><textarea name="summary" style="min-height:70px">${esc(c.summary || '')}</textarea></div>
      <div class="field check"><input type="checkbox" id="ce-pub" ${c.is_published ? 'checked' : ''}><label for="ce-pub">Published</label></div><div class="field check"><input type="checkbox" id="ce-feat" ${c.is_featured ? 'checked' : ''}><label for="ce-feat">Featured</label></div>
      <div class="full"><button class="btn btn-primary" type="submit">${ic('check', 'sm')} ${isNew ? 'Create course' : 'Save details'}</button></div></form>`)}</div>
      <div class="span-7 col">${isNew ? card('Next steps', 'info', '<p class="small muted">Create the course first, then add modules, lessons and assessment questions.</p>') : `
        ${card('Modules & lessons', 'layers', `${c.modules.map((m, i) => `<div class="card surface tight mb"><div class="row between"><b class="small">Module ${i + 1}: ${esc(m.title)}</b><div class="row"><button class="btn btn-xs btn-ghost" onclick="lessonForm(${m.id})">${ic('plus', 'sm')} Lesson</button><button class="btn btn-xs btn-danger" onclick="delModule(${m.id})">${ic('trash-2', 'sm')}</button></div></div>
          ${m.lessons.map((l, j) => `<div class="li"><span class="grow small">${i + 1}.${j + 1} ${esc(l.title)} <span class="muted">· ${l.duration_min} min</span></span><button class="btn btn-xs btn-ghost" onclick="lessonForm(${m.id}, ${l.id})">${ic('pencil', 'sm')}</button><button class="btn btn-xs btn-danger" onclick="delLesson(${l.id})">${ic('trash-2', 'sm')}</button></div>`).join('')}</div>`).join('')}
          <form class="row" id="nmf"><input class="input" name="title" placeholder="New module title" required><button class="btn btn-primary btn-sm">${ic('plus', 'sm')} Add module</button></form>`)}
        ${card(`Final assessment (${qs.length} questions)`, 'clipboard-check', `${qs.map((q, i) => `<div class="li top"><div class="grow"><div class="small strong">${i + 1}. ${esc(q.question)}</div><div class="xs muted">${q.options.map((o, k) => k === q.answer_index ? `<b style="color:var(--green)">${esc(o)}</b>` : esc(o)).join(' · ')}</div></div><button class="btn btn-xs btn-danger" onclick="delQuestion(${q.id})">${ic('trash-2', 'sm')}</button></div>`).join('')}
          <button class="btn btn-sm btn-soft mt" onclick="questionForm(${id})">${ic('plus', 'sm')} Add question</button>`)}`}</div></div>`;
  $('#cef').onsubmit = (e) => { e.preventDefault(); const f = formData(e.target); f.is_published = $('#ce-pub').checked; f.is_featured = $('#ce-feat').checked;
    guard($('button[type=submit]', e.target), async () => { if (isNew) { const r = await post('/courses', f); toast('Course created.'); location.hash = `#/course-edit/${r.id}`; } else { await put(`/courses/${id}`, f); toast('Course saved.'); route(); } }); };
  $('#nmf')?.addEventListener('submit', (e) => { e.preventDefault(); guard($('button', e.target), async () => { await post(`/courses/${id}/modules`, formData(e.target)); route(); }); });
  const lessonById = (lid) => c.modules.flatMap(m => m.lessons).find(l => l.id === lid);
  window.lessonForm = async (mid, lid) => {
    const l = lid ? await api(`/lessons/${lid}`) : { title: '', duration_min: 10, content: '', video_url: '' };
    const m = modal({ title: lid ? 'Edit lesson' : 'New lesson', icon: 'book-open', size: 'wide', body: `<form id="lf2" class="grid-form"><div class="field"><label>Title *</label><input name="title" value="${esc(l.title)}" required></div><div class="field"><label>Duration (minutes)</label><input type="number" name="duration_min" value="${l.duration_min}"></div><div class="field full"><label>Video URL (optional)</label><input name="video_url" value="${esc(l.video_url || '')}"></div><div class="field full"><label>Lesson content</label><textarea name="content" style="min-height:220px">${esc(l.content || '')}</textarea></div></form>`,
      foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="lf-go">Save lesson</button>` });
    $('#lf-go', m).onclick = (e) => guard(e.currentTarget, async () => { const f = formData($('#lf2', m)); if (lid) await put(`/lessons/${lid}`, f); else await post(`/modules/${mid}/lessons`, f); m.close(); route(); });
  };
  window.delModule = async (mid) => { if (await confirmBox('Delete this module and its lessons?', { danger: true, ok: 'Delete' })) { await del(`/modules/${mid}`); route(); } };
  window.delLesson = async (lid) => { if (await confirmBox(`Delete lesson “${lessonById(lid)?.title}”?`, { danger: true, ok: 'Delete' })) { await del(`/lessons/${lid}`); route(); } };
  window.delQuestion = async (qid) => { await del(`/questions/${qid}`); route(); };
  window.questionForm = (cid) => {
    const m = modal({ title: 'New question', icon: 'clipboard-check', body: `<form id="qf"><div class="field"><label>Question *</label><input name="question" required></div>${[0, 1, 2, 3].map(i => `<div class="field row"><input type="radio" name="answer_index" value="${i}" ${i === 0 ? 'checked' : ''} title="Correct answer"><input class="input" data-o placeholder="Option ${i + 1}"></div>`).join('')}<div class="field"><label>Explanation</label><input name="explanation"></div><p class="xs muted">Select the radio button next to the correct answer.</p></form>`,
      foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="qf-go">Add question</button>` });
    $('#qf-go', m).onclick = (e) => guard(e.currentTarget, async () => { const f = formData($('#qf', m)); f.options = $$('[data-o]', m).map(i => i.value.trim()); const ans = +f.answer_index; const filled = f.options.map((o, i) => [o, i]).filter(([o]) => o); f.answer_index = filled.findIndex(([, i]) => i === ans); f.options = filled.map(([o]) => o); await post(`/courses/${cid}/questions`, f); m.close(); route(); });
  };
};
