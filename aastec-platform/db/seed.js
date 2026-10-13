// ===================================================================
//  Database initialisation and demo seed
//  - Base data (always): roles, permission matrix, KPI catalogue,
//    handbook, settings, administrator account
//  - Demo data (SEED_DEMO != 0): AASTEC hierarchy, 53 institutions,
//    Societies, members, events, posts, courses, incubator, elections
//    All dates are generated relative to "now" so the demo stays current.
// ===================================================================
import bcrypt from 'bcryptjs';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { db, get, all, run, tx, reopenDb, DB_PATH } from './database.js';
import { audit, SETTING_DEFAULTS, ayRange, academicYear } from '../lib/core.js';
import * as C from './content.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEMO_PASSWORD = 'Demo@2026';

// ---------------- deterministic helpers ----------------
let SEED = 20261013;
const rnd = () => { SEED |= 0; SEED = SEED + 0x6D2B79F5 | 0; let t = Math.imul(SEED ^ SEED >>> 15, 1 | SEED); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const sample = (arr, n) => { const c = [...arr]; const out = []; while (c.length && out.length < n) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return out; };
const NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const dayAt = (off, h = 9, m = 0) => { const d = new Date(NOW + off * 864e5); d.setUTCHours(h, m, 0, 0); return d.toISOString(); };
const addH = (isoStr, h) => iso(new Date(isoStr).getTime() + h * 36e5);
const code = (n = 6) => randomBytes(8).toString('hex').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, n);
const J = (v) => JSON.stringify(v);
function ins(table, o) {
  const k = Object.keys(o);
  const r = run(`INSERT INTO ${table}(${k.join(',')}) VALUES(${k.map(() => '?').join(',')})`, ...k.map(x => o[x] === undefined ? null : typeof o[x] === 'boolean' ? (o[x] ? 1 : 0) : o[x]));
  return Number(r.lastInsertRowid);
}
const AUDIT_Q = [];   // seeded audit entries, inserted chronologically at the end
const logLater = (actor, type, id, action, detail, at) => AUDIT_Q.push({ actor, type, id, action, detail, at });

// ===================================================================
export function initDatabase() {
  db.exec(readFileSync(join(__dirname, 'schema.sql'), 'utf8'));
  if (get('SELECT COUNT(*) n FROM roles').n) return false;
  tx(() => {
    seedBase();
    if (process.env.SEED_DEMO !== '0') seedDemo();
  });
  return true;
}

// ---------------- base reference data ----------------
function seedBase() {
  const settings = { ...SETTING_DEFAULTS, demo_mode: process.env.SEED_DEMO === '0' ? '0' : '1', election_sandbox: process.env.SEED_DEMO === '0' ? '0' : '1' };
  for (const [k, v] of Object.entries(settings)) run('INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)', k, v);
  for (const [key, name, scope, rank, description] of C.ROLES)
    ins('roles', { key, name, scope, rank, description, permissions: J(C.ROLE_PERMS[key] || []) });
  C.KPIS.forEach(([key, label, unit, target, source, icon], i) => ins('kpi_definitions', { key, label, unit, target, source, icon, weight: 1, sort: i }));
  C.HANDBOOK.forEach(([c, title, body], i) => ins('handbook_sections', { code: c, title, body, sort: i, updated_at: iso(NOW) }));
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@aastec.demo';
  let adminPass = process.env.ADMIN_PASSWORD || DEMO_PASSWORD;
  if (!process.env.ADMIN_PASSWORD && process.env.SEED_DEMO === '0') {
    // Production install without a configured password: never fall back to the public demo password.
    adminPass = randomBytes(12).toString('base64url');
    console.log(`\n  Administrator account created: ${adminEmail}\n  One-time password: ${adminPass}\n  Sign in and change it under Edit profile → Change password.\n`);
  }
  ins('users', { full_name: 'Platform Administrator', email: adminEmail, password_hash: bcrypt.hashSync(adminPass, 10), role_id: roleId('admin'),
    title: 'Platform Administrator', handbook_ack_version: '2.0', handbook_ack_at: iso(NOW), created_at: iso(NOW) });
}
const ROLE_IDS = {};
const roleId = (k) => ROLE_IDS[k] ??= get('SELECT id FROM roles WHERE key = ?', k).id;

// ===================================================================
//  DEMO DATA
// ===================================================================
function seedDemo() {
  const HASH = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const curAY = academicYear(new Date(NOW));
  const prevAYStart = ayRange(curAY).start - 1;
  const prevAY = `${prevAYStart}/${prevAYStart + 1}`;
  const prev2AY = `${prevAYStart - 1}/${prevAYStart}`;
  const prev2Off = Math.floor((Date.UTC(prevAYStart - 1, 8, 1) - NOW) / 864e5);   // days from now to start of AY-2
  const prevOff = Math.floor((Date.UTC(prevAYStart, 8, 1) - NOW) / 864e5);
  const today = new Date(NOW);
  const lastCycle = today.getUTCMonth() >= 8 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
  const nextCycle = lastCycle + 1;

  // ---------------- people helpers ----------------
  const usedNames = new Set();
  function personName(country) {
    const pool = C.AFRICA.includes(country) ? C.NAMES.africa : C.NAMES.arab;
    for (let i = 0; i < 50; i++) {
      const n = `${pick(chance(0.5) ? pool.m : pool.f)} ${pick(pool.last)}`;
      if (!usedNames.has(n)) { usedNames.add(n); return n; }
    }
    return `${pick(pool.m)} ${pick(pool.last)} ${rint(2, 99)}`;
  }
  let userSeq = 0;
  function mkUser(o) {
    userSeq++;
    const slug = o.slug || 'aastec';
    const email = o.email || `${o.full_name.toLowerCase().replace(/^(dr|prof|eng)\.\s*/, '').replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.')}.${userSeq}@${slug}.rally.demo`;
    const created = o.created_at || dayAt(-rint(30, 700));
    const id = ins('users', {
      full_name: o.full_name, email, password_hash: HASH, role_id: roleId(o.role), university_id: o.university_id, society_id: o.society_id,
      committee_id: o.committee_id, org_unit_id: o.org_unit_id, title: o.title, membership_status: o.membership_status || 'active', join_note: o.join_note,
      faculty: o.faculty ?? (o.society_id ? pick(C.FACULTIES) : null), study_year: o.study_year ?? (o.society_id && !['advisor'].includes(o.role) ? pick(['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year']) : null),
      city: o.city, phone: null, bio: o.bio, interests: J(o.interests || sample(C.INTERESTS, rint(2, 5))), skills: J(o.skills || sample(C.SKILLS, rint(2, 4))),
      linkedin: o.linkedin, handbook_ack_version: o.ack === false ? null : '2.0', handbook_ack_at: o.ack === false ? null : addH(created, 2),
      conduct_flags: o.conduct_flags || 0, last_login_at: dayAt(-rint(0, 20), rint(6, 19)), created_at: created,
    });
    return { id, full_name: o.full_name, role: o.role, society_id: o.society_id, committee_id: o.committee_id, email };
  }

  // ---------------- institutions & societies ----------------
  const uni = []; const soc = [];
  C.AAST_CAMPUSES.forEach(([name, city]) => uni.push({ id: ins('universities', { name: `Arab Academy for Science, Technology & Maritime Transport — ${name.replace('AAST ', '')}`, short_name: name, kind: 'aast_campus', city, country: 'Egypt', created_at: dayAt(-900) }), short: name, city, country: 'Egypt', aast: true }));
  C.PARTNERS.forEach(([name, short, city, country]) => uni.push({ id: ins('universities', { name, short_name: short, kind: 'partner', city, country, created_at: dayAt(-800) }), short, city, country, aast: false }));
  const ACTIVE_PARTNERS = ['Horus Univ.', 'Ain Shams', 'Cairo Univ.', 'Alexandria Univ.', 'Mansoura', 'BUE', 'Nile Univ.', 'Pharos', 'FUE', 'KAU', 'Sharjah', 'PSUT', 'BAU', 'AUI', 'KNUST', 'UG Legon', 'UCC', 'Strathmore', 'Makerere', 'UNILAG', 'UDSM', 'UTM'];
  const DEEP = ['AAST Miami', 'AAST Sheraton', 'AAST Smart Village', 'Horus Univ.', 'Ain Shams', 'KNUST'];
  for (const u of uni) {
    const active = u.aast || ACTIVE_PARTNERS.includes(u.short);
    const s = { id: ins('societies', { university_id: u.id, name: `Rally Society - ${u.short}`, short_name: u.short, status: active ? 'active' : 'forming',
      founded_on: dayAt(-rint(400, 1400)).slice(0, 10), description: `The Rally Society chapter at ${u.short}, ${u.city}, ${u.country}.`, created_at: dayAt(-rint(400, 900)) }),
      short: u.short, slug: u.short.toLowerCase().replace(/[^a-z0-9]/g, ''), uni: u, active, deep: DEEP.includes(u.short), members: [], leaders: [], committees: {} };
    soc.push(s);
  }
  const S = (short) => soc.find(s => s.short === short);
  const MIAMI = S('AAST Miami');

  // ---------------- AASTEC hierarchy ----------------
  const unit = (name, kind, parent_id, description, sort) => ins('org_units', { name, kind, parent_id, description, sort });
  const uExec = unit('Executive Office', 'executive', null, 'Leads AASTEC-wide strategy and organisational oversight.', 0);
  const uDepP = unit('Programmes & Partnerships', 'deputy_portfolio', uExec, 'Programmes, partnerships, training and community.', 1);
  const uDepO = unit('Operations & Digital Transformation', 'deputy_portfolio', uExec, 'Operations, digital platforms, finance and compliance.', 2);
  const progAreas = [['Rally Societies Programme', 'Society network, governance, elections and KPIs.'], ['Incubation & Acceleration', 'Rally Incubator, Rally Accelerate and mentoring.'],
    ['Training & Learning', 'Learning Hub, certificates and trainer network.'], ['Events & Community', 'AASTEC-wide events and community engagement.'], ['Partnerships & Outreach', 'Sponsors, partners and university relations.']]
    .map(([n, d], i) => unit(n, 'programme_area', uDepP, d, i));
  const depts = [['Strategy & Planning'], ['Operations'], ['Digital Platforms'], ['Finance & Accounting'], ['Compliance & Risk'], ['Communications & Marketing'], ['Administration & Support']]
    .map(([n], i) => unit(n, 'department', uDepO, `${n} department.`, i));
  const staff = {};
  const mkStaff = (key, full_name, role, title, org_unit_id, email) => { staff[key] = mkUser({ full_name, role, title, org_unit_id, email, slug: 'aastec', created_at: dayAt(-rint(500, 900)) }); return staff[key]; };
  mkStaff('director', 'Dr. Karim Abdel Aziz', 'director', 'Executive Director', uExec, 'director@aastec.demo');
  mkStaff('deputy', 'Dr. Mona El Sayed', 'deputy', 'Deputy Director — Programmes & Partnerships', uDepP, 'deputy@aastec.demo');
  mkStaff('deputy2', 'Eng. Tarek Fawzy', 'deputy', 'Deputy Director — Operations & Digital Transformation', uDepO, 'deputy2@aastec.demo');
  mkStaff('pm', 'Omar Ahmed', 'programme_manager', 'Rally Societies Programme Manager', progAreas[0], 'pm@aastec.demo');
  mkStaff('ipm', 'Laila Mansour', 'programme_manager', 'Incubator Programme Manager', progAreas[1], 'incubator@aastec.demo');
  mkStaff('tpm', 'Rania Adel', 'programme_manager', 'Training & Learning Programme Manager', progAreas[2], 'training@aastec.demo');
  mkStaff('epm', 'Hany Saleh', 'programme_manager', 'Events & Community Programme Manager', progAreas[3], 'events.pm@aastec.demo');
  mkStaff('ppm', 'Khaled Ramzy', 'programme_manager', 'Partnerships & Outreach Programme Manager', progAreas[4], 'partnerships@aastec.demo');
  [['Dina Fouad', 0], ['Heba Adel', 1], ['Sherif Nabil', 2], ['Amal Hassan', 3], ['Yasser Gamal', 4], ['Noha Samy', 5], ['Mahmoud Zaki', 6]].forEach(([n, i]) =>
    mkStaff('head' + i, n, 'dept_head', `Head of ${['Strategy & Planning', 'Operations', 'Digital Platforms', 'Finance & Accounting', 'Compliance & Risk', 'Communications & Marketing', 'Administration & Support'][i]}`, depts[i], i === 2 ? 'head@aastec.demo' : undefined));
  mkStaff('staff', 'Salma Hassan', 'staff', 'Events Officer', progAreas[3], 'staff@aastec.demo');
  mkStaff('staff2', 'Ahmed Nabil', 'staff', 'Digital Content Officer', depts[5]);
  mkStaff('staff3', 'Mai Lotfy', 'staff', 'Community Moderator', depts[2]);
  mkStaff('staff4', 'Hossam Wahba', 'staff', 'Programme Officer — Societies', progAreas[0]);
  run('UPDATE org_units SET lead_user_id = ? WHERE id = ?', staff.director.id, uExec);
  run('UPDATE org_units SET lead_user_id = ? WHERE id = ?', staff.deputy.id, uDepP);
  run('UPDATE org_units SET lead_user_id = ? WHERE id = ?', staff.deputy2.id, uDepO);
  ['pm', 'ipm', 'tpm', 'epm', 'ppm'].forEach((k, i) => run('UPDATE org_units SET lead_user_id = ? WHERE id = ?', staff[k].id, progAreas[i]));
  depts.forEach((d, i) => run('UPDATE org_units SET lead_user_id = ? WHERE id = ?', staff['head' + i].id, d));
  const ADMIN = get("SELECT id, full_name FROM users WHERE email LIKE 'admin@%'");

  // ---------------- Societies: leadership, committees, members ----------------
  const MIAMI_FIXED = {
    president: ['Youssef Khaled', 'president@miami.rally.demo', 'Business Administration', '4th Year'],
    vice_president: ['Mariam Ali', 'vp@miami.rally.demo', 'Management of Technology', '4th Year'],
    advisor: ['Dr. Fatma Ali', 'advisor@miami.rally.demo', 'College of Management & Technology', null],
    heads: { operations: 'Karim Adel', marketing: 'Omar Mostafa', hr: 'Rawan Saleh', learning: 'Nour Samir', partnerships: 'Mohamed Tarek', events: 'Farida Hassan' },
    members: ['Nouran Ragab', 'Ahmed Mostafa', 'Mohamed Ashraf', 'Hana Ahmed', 'Youssef Ali', 'Salma Mohamed', 'Sara Elshamy', 'Ali Abdallah', 'Omar Hesham', 'Nouran Samir', 'Mohamed Tarek Fathy', 'Malak Hegazy', 'Ziad Kamal', 'Jana Badawy', 'Seif Shalaby'],
  };
  Object.values(MIAMI_FIXED.heads).concat(MIAMI_FIXED.members, ['Youssef Khaled', 'Mariam Ali', 'Dr. Fatma Ali']).forEach(n => usedNames.add(n));

  for (const s of soc.filter(x => x.active)) {
    const country = s.uni.country, city = s.uni.city;
    const isMiami = s === MIAMI;
    for (const [key, name, desc] of C.COMMITTEES) s.committees[key] = ins('committees', { society_id: s.id, name, key, description: desc, created_at: dayAt(-400) });
    const advName = isMiami ? MIAMI_FIXED.advisor[0] : `Dr. ${personName(country)}`;
    s.advisor = mkUser({ full_name: advName, role: 'advisor', title: 'Faculty Advisor', university_id: s.uni.id, society_id: s.id, slug: s.slug, city, email: isMiami ? MIAMI_FIXED.advisor[1] : undefined, faculty: isMiami ? MIAMI_FIXED.advisor[2] : 'Faculty of Business', study_year: '' });
    run('UPDATE societies SET advisor_id = ? WHERE id = ?', s.advisor.id, s.id);
    s.president = mkUser({ full_name: isMiami ? MIAMI_FIXED.president[0] : personName(country), role: 'president', title: 'Society President', university_id: s.uni.id, society_id: s.id, slug: s.slug, city, email: isMiami ? MIAMI_FIXED.president[1] : undefined, faculty: isMiami ? MIAMI_FIXED.president[2] : undefined, study_year: isMiami ? MIAMI_FIXED.president[3] : undefined, created_at: dayAt(-rint(420, 650)) });
    s.vp = mkUser({ full_name: isMiami ? MIAMI_FIXED.vice_president[0] : personName(country), role: 'vice_president', title: 'Vice President', university_id: s.uni.id, society_id: s.id, slug: s.slug, city, email: isMiami ? MIAMI_FIXED.vice_president[1] : undefined, faculty: isMiami ? MIAMI_FIXED.vice_president[2] : undefined, study_year: isMiami ? MIAMI_FIXED.vice_president[3] : undefined, created_at: dayAt(-rint(420, 650)) });
    s.leaders.push(s.president, s.vp);
    const headKeys = s.deep ? Object.keys(s.committees) : ['marketing', 'events'];
    s.heads = {};
    for (const k of headKeys) {
      const h = mkUser({ full_name: isMiami ? MIAMI_FIXED.heads[k] : personName(country), role: 'committee_head', title: `${C.COMMITTEES.find(c => c[0] === k)[1]} Committee Head`, university_id: s.uni.id, society_id: s.id, committee_id: s.committees[k], slug: s.slug, city, email: isMiami && k === 'marketing' ? 'committee@miami.rally.demo' : undefined, created_at: dayAt(-rint(380, 600)) });
      run('UPDATE committees SET head_user_id = ? WHERE id = ?', h.id, s.committees[k]);
      s.heads[k] = h; s.leaders.push(h);
    }
    const nMembers = isMiami ? 38 : s.deep ? rint(26, 34) : rint(6, 10);
    for (let i = 0; i < nMembers; i++) {
      const fixed = isMiami && i < MIAMI_FIXED.members.length ? MIAMI_FIXED.members[i] : null;
      const ck = pick(Object.keys(s.committees));
      const m = mkUser({ full_name: fixed || personName(country), role: 'member', title: 'Member', university_id: s.uni.id, society_id: s.id, committee_id: chance(0.7) ? s.committees[ck] : null, slug: s.slug, city,
        email: fixed === 'Nouran Ragab' ? 'member@miami.rally.demo' : undefined, ack: fixed === 'Nouran Ragab' || chance(s.deep ? 0.9 : 0.7), created_at: dayAt(fixed === 'Nouran Ragab' ? -420 : -rint(20, 650)),
        faculty: fixed === 'Nouran Ragab' ? 'Business Administration' : undefined, study_year: fixed === 'Nouran Ragab' ? '3rd Year' : undefined,
        bio: fixed === 'Nouran Ragab' ? 'Passionate about entrepreneurship, innovation and creating impactful solutions. Always eager to learn, collaborate and bring ideas to life.' : undefined,
        interests: fixed === 'Nouran Ragab' ? ['Entrepreneurship', 'Marketing', 'Innovation', 'Sustainability', 'Public Speaking'] : undefined,
        linkedin: fixed === 'Nouran Ragab' ? 'https://www.linkedin.com/in/' : undefined });
      s.members.push(m);
    }
    s.all = [...s.leaders, ...s.members];
  }
  const member = (s, name) => s.all.find(u => u.full_name === name);
  const DEMO_MEMBER = member(MIAMI, 'Nouran Ragab');

  // ---------------- mentors ----------------
  const mentors = C.MENTORS.map(([full_name, kind, headline, organisation, country, city, years, expertise, industries, status], i) => {
    const u = mkUser({ full_name, role: 'mentor', title: headline, city, slug: 'mentors', email: i === 0 ? 'mentor@aastec.demo' : undefined, bio: `${headline} at ${organisation}. Passionate about mentoring the next generation of leaders in innovation and entrepreneurship.` });
    const avail = {}; ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].forEach(d => avail[d] = ['morning', 'afternoon', 'evening'].filter(() => chance(0.45)));
    ins('mentor_profiles', { user_id: u.id, kind, headline, organisation, country, city, years_experience: years, expertise: J(expertise), industries: J(industries), availability: J(avail),
      preferences: J(sample(['AAST Miami', 'AAST Sheraton', 'Rally Leadership Programme', 'Entrepreneurship Bootcamp', 'Rally Incubator', 'KNUST'], 3)),
      socials: J({ linkedin: 'https://www.linkedin.com/', twitter: '', website: '' }), status, step: status === 'pending' ? 6 : 6,
      verified_by: status === 'verified' ? staff.ipm.id : null, verified_at: status === 'verified' ? dayAt(-rint(60, 300)) : null, created_at: dayAt(-rint(70, 320)) });
    return { ...u, expertise, industries, status };
  });
  const verifiedMentors = mentors.filter(m => m.status === 'verified');

  // ---------------- programmes & cohorts ----------------
  const prog = {};
  [['society', 'Rally Society Programme', 'pm', 'Student-led, handbook-governed Society network across AAST campuses and partner universities.', '#102D5A'],
    ['incubator', 'Rally Incubator', 'ipm', 'Student-led incubator supporting early-stage ventures from ideation to MVP with mentors and milestones.', '#F2B91E'],
    ['accelerator', 'Rally Accelerate', 'ipm', 'Accelerator for traction-stage student ventures preparing for investment and Demo Day.', '#247BC1'],
    ['training', 'AASTEC Training Academy', 'tpm', 'Capacity-building programme: courses, bootcamps, trainer network and certificates.', '#16A34A'],
    ['mentoring', 'Mentorship Network', 'ipm', 'Verified mentors and trainers supporting founders and Society leaders.', '#7C3AED'],
    ['competition', 'Entrepreneurship World Cup — National Qualifiers', 'epm', 'National qualification rounds and preparation for global entrepreneurship competitions.', '#EA580C']]
    .forEach(([kind, name, mgr, description, color]) => prog[kind] = ins('programmes', { name, kind, manager_id: staff[mgr].id, status: 'active', description, color, start_on: dayAt(-700).slice(0, 10), created_at: dayAt(-700) }));
  const cohort5 = ins('cohorts', { programme_id: prog.incubator, name: 'Rally Incubator — Cohort 5', status: 'in_progress', open_on: dayAt(-150).slice(0, 10), close_on: dayAt(-110).slice(0, 10), start_on: dayAt(-90).slice(0, 10), end_on: dayAt(90).slice(0, 10), capacity: 12, created_at: dayAt(-160) });
  const cohort6 = ins('cohorts', { programme_id: prog.incubator, name: 'Rally Incubator — Cohort 6', status: 'open_call', open_on: dayAt(-12).slice(0, 10), close_on: dayAt(21).slice(0, 10), start_on: dayAt(45).slice(0, 10), end_on: dayAt(225).slice(0, 10), capacity: 15, created_at: dayAt(-14) });
  const batch3 = ins('cohorts', { programme_id: prog.accelerator, name: 'Rally Accelerate — Batch 3', status: 'screening', open_on: dayAt(-40).slice(0, 10), close_on: dayAt(-5).slice(0, 10), start_on: dayAt(30).slice(0, 10), end_on: dayAt(150).slice(0, 10), capacity: 8, created_at: dayAt(-42) });
  ins('cohorts', { programme_id: prog.incubator, name: 'Rally Incubator — Cohort 4', status: 'completed', open_on: dayAt(-330).slice(0, 10), close_on: dayAt(-300).slice(0, 10), start_on: dayAt(-280).slice(0, 10), end_on: dayAt(-100).slice(0, 10), capacity: 10, created_at: dayAt(-335) });

  // ---------------- incubator agents ----------------
  const agents = [];
  [[MIAMI, 'Hassan Fathy', 'agent@miami.rally.demo'], [S('KNUST'), 'Emmanuel Boateng', 'agent@knust.rally.demo'], [S('Horus Univ.'), null, null], [S('AAST Sheraton'), null, null], [S('Strathmore'), null, null]].forEach(([s, n, email]) => {
    const a = mkUser({ full_name: n || personName(s.uni.country), role: 'incubator_agent', title: 'Rally Incubator Agent', university_id: s.uni.id, society_id: s.id, slug: s.slug, email, city: s.uni.city, created_at: dayAt(-rint(200, 400)) });
    a.soc = s; agents.push(a); s.agent = a; s.all.push(a);
  });

  // ---------------- ventures, founders, milestones, mentorships ----------------
  const ventureSocs = [MIAMI, MIAMI, S('AAST Sheraton'), S('Horus Univ.'), S('KNUST'), S('AAST Smart Village'), S('Ain Shams'), MIAMI, S('Strathmore'), S('AAST Sheraton'), S('KNUST'), S('Horus Univ.'), S('AAST Smart Village'), S('Ain Shams')];
  const ventures = [];
  C.VENTURES.forEach(([name, tagline, sector, stage, tags], i) => {
    const s = ventureSocs[i];
    const founder = mkUser({ full_name: i === 0 ? 'Nada Hamdy' : personName(s.uni.country), role: 'founder', title: 'Founder & CEO', university_id: s.uni.id, society_id: s.id, slug: s.slug, email: i === 0 ? 'founder@miami.rally.demo' : undefined, city: s.uni.city, created_at: dayAt(-rint(150, 400)) });
    s.all.push(founder);
    const cohort = i < 9 ? cohort5 : i < 11 ? batch3 : null;
    const scores = { problem: rint(55, 90), solution: rint(50, 85), market: rint(50, 85), team: rint(55, 90) };
    const v = ins('ventures', { name, tagline, sector, stage, society_id: s.id, university_id: s.uni.id, cohort_id: cohort, founder_id: founder.id, agent_id: s.agent?.id,
      status: cohort === cohort5 || cohort === batch3 ? 'active' : 'applicant', website: `www.${name.toLowerCase().replace(/[^a-z]/g, '')}.example`, email: `hello@${name.toLowerCase().replace(/[^a-z]/g, '')}.example`,
      founded_on: dayAt(-rint(200, 600)).slice(0, 10), team_size: rint(2, 5), color: pick(['#16A34A', '#247BC1', '#102D5A', '#EA580C', '#7C3AED', '#0891B2']), scores: J(scores), tags: J(tags),
      registration: i % 3 === 0 ? 'Private Limited — registration in progress' : null, description: `${tagline}. Founded by students of ${s.uni.short}.`, created_at: dayAt(-rint(100, 300)) });
    ins('venture_members', { venture_id: v, user_id: founder.id, role_title: 'Founder & CEO' });
    sample(s.members, rint(1, 3)).forEach((m, k) => ins('venture_members', { venture_id: v, user_id: m.id, role_title: ['COO', 'CTO', 'Head of Marketing'][k] }));
    const stageIdx = { ideation: 0, validation: 2, mvp: 3, early_traction: 5, growth: 6 }[stage];
    C.MILESTONE_TEMPLATE.forEach((t, k) => ins('milestones', { venture_id: v, title: t, status: k < stageIdx ? 'completed' : k === stageIdx ? 'in_progress' : 'pending',
      due_on: dayAt(-90 + k * 30).slice(0, 10), completed_at: k < stageIdx ? dayAt(-120 + k * 25) : null, sort: k }));
    if (cohort) {
      const ms = sample(verifiedMentors, rint(1, 2));
      ms.forEach(m => {
        ins('mentorships', { venture_id: v, mentor_id: m.id, status: 'active', match_score: rint(72, 96), assigned_by: staff.ipm.id, created_at: dayAt(-80) });
        for (let k = 0; k < rint(2, 4); k++) {
          const off = rint(-80, 25);
          ins('mentor_sessions', { venture_id: v, mentor_id: m.id, topic: pick(['Business model review', 'Pitch deck feedback', 'Go-to-market planning', 'Customer interview synthesis', 'Pricing strategy', 'Fundraising readiness', 'MVP scope']),
            start_at: dayAt(off, pick([8, 10, 13, 15])), duration_min: pick([45, 60, 90]), mode: pick(['online', 'online', 'in_person']), status: off < 0 ? 'completed' : 'scheduled',
            notes: off < 0 ? 'Agreed next steps and documented action items.' : null, rating: off < 0 ? rint(4, 5) : null, created_by: staff.ipm.id, created_at: dayAt(off - 7) });
        }
      });
      ins('applications', { cohort_id: cohort, venture_id: v, applicant_id: founder.id, status: 'selected', score: rint(72, 92), pitch: `${name}: ${tagline}.`, notes: 'Strong problem validation and committed team.', reviewed_by: staff.ipm.id, reviewed_at: dayAt(-115), created_at: dayAt(-130) });
    }
    for (let k = 0; k < rint(2, 4); k++) ins('tasks', { venture_id: v, title: pick(['Prepare investor one-pager', 'Update financial projections', 'Customer feedback analysis', 'Build pitch deck v3', 'Run pilot with partner', 'Register trademark']),
      assignee_id: founder.id, created_by: founder.id, priority: pick(['high', 'medium', 'low']), due_on: dayAt(rint(2, 30)).slice(0, 10), status: pick(['not_started', 'in_progress']), created_at: dayAt(-10) });
    ventures.push({ id: v, name, founder, s, cohort });
  });
  // Cohort 6 applications (open call)
  const appStatuses = ['received', 'received', 'under_review', 'under_review', 'under_review', 'shortlisted', 'shortlisted', 'received', 'under_review', 'rejected'];
  appStatuses.forEach((st, i) => {
    const s = pick(soc.filter(x => x.deep));
    const applicant = pick(s.members);
    const idea = pick(['Campus food delivery cooperative', 'AI study planner', 'Recycled plastic furniture', 'Freelancer invoicing tool', 'Water quality monitoring kit', 'Local tourism marketplace', 'Mental health peer support app', 'Smart parking for campuses', 'Halal travel planner', 'Student housing finder']);
    ins('applications', { cohort_id: cohort6, venture_id: i < 3 ? ventures[11 + i]?.id : null, applicant_id: applicant.id, status: st, score: st === 'received' ? null : rint(55, 88), pitch: `${idea} — founded by ${applicant.full_name} (${s.short}).`, notes: st === 'rejected' ? 'Not yet validated; encouraged to re-apply next cohort.' : null,
      reviewed_by: st === 'received' ? null : staff.ipm.id, reviewed_at: st === 'received' ? null : dayAt(-rint(1, 6)), created_at: dayAt(-rint(1, 11)) });
  });
  // Scouting leads
  const LEAD_IDEAS = ['Campus laundry booking', 'AI resume reviewer', 'Upcycled fashion', 'Peer-to-peer textbook exchange', 'Drone crop spraying', 'Solar phone kiosks', 'Smart water meter', 'Mobile clinic scheduler', 'Logistics route optimiser', 'Language exchange app', 'Micro-insurance for farmers', 'Event ticketing for students', 'Recycling rewards app', 'Coding bootcamp for teens', 'Halal food finder', 'Student micro-loans', 'VR campus tours', 'Fitness challenges app', 'Plant-based snacks', 'Freelance marketplace'];
  for (const a of agents) {
    const n = a.full_name === 'Hassan Fathy' || a.full_name === 'Emmanuel Boateng' ? 22 : rint(8, 14);
    for (let i = 0; i < n; i++) {
      const stage = i < n * 0.45 ? 'identified' : i < n * 0.7 ? 'interested' : i < n * 0.88 ? 'screened' : 'ready';
      ins('startup_leads', { agent_id: a.id, society_id: a.soc.id, name: `${pick(LEAD_IDEAS)}`, contact: personName(a.soc.uni.country), idea: 'Student idea captured through outreach and events.', stage, notes: null, created_at: dayAt(-rint(5, 160)), updated_at: dayAt(-rint(0, 5)) });
    }
  }

  // ---------------- courses ----------------
  const courseIds = {};
  C.COURSES.forEach(([title, category, level, duration_label, hours, instructor, tag, featured, summary, modules, quiz], ci) => {
    const cid = ins('courses', { title, category, level, duration_label, hours, instructor, summary, description: summary, color: ['#102D5A', '#247BC1', '#16A34A', '#7C3AED', '#EA580C', '#0891B2'][ci % 6], tag, is_published: 1, is_featured: featured,
      pass_mark: 70, rating: +(4.5 + rnd() * 0.45).toFixed(1), created_by: staff.tpm.id, created_at: dayAt(-500 + ci * 20) });
    courseIds[title] = cid;
    modules.forEach(([mt, lessons], mi) => {
      const mid = ins('course_modules', { course_id: cid, title: mt, sort: mi });
      lessons.forEach(([lt, dur, content], li) => ins('lessons', { module_id: mid, course_id: cid, title: lt, duration_min: dur, content, sort: li }));
    });
    quiz.forEach(([q, opts, ans, expl], qi) => ins('quiz_questions', { course_id: cid, question: q, options: J(opts), answer_index: ans, explanation: expl, sort: qi }));
  });
  C.LEARNING_PATHS.forEach(([title, audience, description, courses, color]) => ins('learning_paths', { title, audience, description, course_ids: J(courses.map(c => courseIds[c])), color }));
  const lessonsOf = {}; for (const l of all('SELECT id, course_id FROM lessons ORDER BY course_id, module_id, sort')) (lessonsOf[l.course_id] ??= []).push(l.id);
  function enroll(userId, title, progress, at) {
    const cid = courseIds[title]; const ls = lessonsOf[cid];
    if (get('SELECT 1 FROM enrollments WHERE course_id = ? AND user_id = ?', cid, userId)) return;
    const done = ls.slice(0, Math.round(ls.length * progress / 100));
    const completed = progress >= 100;
    const quiz_score = completed ? rint(75, 100) : null;
    ins('enrollments', { course_id: cid, user_id: userId, status: completed ? 'completed' : 'active', progress: completed ? 100 : Math.round(done.length / ls.length * 100), completed_lessons: J(done), quiz_score, quiz_attempts: completed ? 1 : 0,
      last_lesson_id: done[done.length - 1] || ls[0], enrolled_at: at, completed_at: completed ? addH(at, 24 * rint(5, 40)) : null });
    if (completed) ins('certificates', { code: `AASTEC-${new Date(at).getUTCFullYear()}-${code(6)}`, user_id: userId, course_id: cid, title, issued_at: addH(at, 24 * rint(5, 40)) });
  }
  const courseTitles = Object.keys(courseIds);
  for (const s of soc.filter(x => x.active)) {
    for (const u of s.all) {
      if (u.id === DEMO_MEMBER?.id) continue;
      if (chance(s.deep ? 0.85 : 0.6)) enroll(u.id, 'Rally Society Member Onboarding', chance(0.85) ? 100 : 50, dayAt(-rint(30, 500)));
      const extra = sample(courseTitles.filter(t => t !== 'Rally Society Member Onboarding'), rint(0, s.deep ? 4 : 2));
      extra.forEach(t => enroll(u.id, t, chance(0.4) ? 100 : pick([10, 25, 40, 60, 75, 90]), dayAt(-rint(10, 400))));
    }
  }
  if (DEMO_MEMBER) {
    enroll(DEMO_MEMBER.id, 'Rally Society Member Onboarding', 100, dayAt(-300));
    enroll(DEMO_MEMBER.id, 'Digital Marketing & Growth Hacking', 100, dayAt(-160));
    enroll(DEMO_MEMBER.id, 'Entrepreneurship Fundamentals', 72, dayAt(-40));
    enroll(DEMO_MEMBER.id, 'Design Thinking & Innovation', 45, dayAt(-25));
    enroll(DEMO_MEMBER.id, 'Financial Literacy for Entrepreneurs', 30, dayAt(-12));
    for (let d = 0; d < 7; d++) ins('learning_activity', { user_id: DEMO_MEMBER.id, day: dayAt(-d).slice(0, 10), minutes: rint(15, 50) });
  }
  ventures.forEach(v => { enroll(v.founder.id, 'Entrepreneurship Fundamentals', 100, dayAt(-200)); enroll(v.founder.id, 'Pitching & Storytelling That Converts', pick([40, 60, 100]), dayAt(-60)); });
  agents.forEach(a => enroll(a.id, 'Incubator Agent Certification', 100, dayAt(-180)));

  // ---------------- events ----------------
  const HALLS = ['Innovation Hall', 'Main Auditorium', 'Room C201', 'Conference Centre', 'Business School Hall B', 'Online (Zoom)', 'Library Seminar Room'];
  const tplCount = {};
  function eventRsvps(eventId, pool, startIso, past, cap) {
    const n = Math.min(pool.length, rint(Math.ceil(pool.length * 0.35), Math.ceil(pool.length * 0.8)), cap || 999);
    for (const u of sample(pool, n)) {
      const going = chance(0.85);
      const checked = past && going && chance(0.86);
      ins('event_rsvps', { event_id: eventId, user_id: u.id, status: going ? 'going' : 'interested', checked_in_at: checked ? addH(startIso, 0.1) : null, check_method: checked ? (chance(0.8) ? 'qr' : 'manual') : null, created_at: addH(startIso, -24 * rint(1, 10)) });
    }
  }
  for (const s of soc.filter(x => x.active)) {
    const step = s.deep ? 7 : 20;
    for (let off = prev2Off + rint(0, 6); off <= 50; off += step + rint(-2, 3)) {
      if (off < prevOff && chance(s.deep ? 0.35 : 0.5)) continue;        // thinner history two years back
      const [t, cat, hours] = pick(C.EVENT_TEMPLATES);
      tplCount[s.id + t] = (tplCount[s.id + t] || 0) + 1;
      const title = ['Tech Talk', 'Rally Hackathon', 'Executive Board Meeting'].includes(t) ? `${t} #${tplCount[s.id + t]}` : t;
      const start = dayAt(off, pick([7, 9, 11, 13, 15]));
      const dur = hours || rint(1, 3);
      const past = off < 0;
      const status = off < -30 ? (chance(0.85) ? 'closed' : 'completed') : past ? 'completed' : (off > 12 && chance(0.2) ? 'proposed' : 'published');
      const comm = cat === 'training' || cat === 'workshop' ? s.committees.learning : s.committees.events;
      const hall = pick(HALLS);
      const organizer = s.heads.events || s.president;
      const eid = ins('events', { title, description: `${title} organised by Rally Society ${s.short}. Open to all members and students interested in entrepreneurship.`, kind: 'society', category: cat,
        society_id: s.id, committee_id: comm, organizer_id: organizer.id, created_by: status === 'proposed' ? (s.heads.events || s.vp).id : s.president.id,
        start_at: start, end_at: addH(start, dur), location: hall === 'Online (Zoom)' ? hall : `${hall}, ${s.short}`, mode: hall === 'Online (Zoom)' ? 'online' : chance(0.15) ? 'hybrid' : 'in_person',
        visibility: chance(0.85) ? 'all' : 'society', capacity: rint(40, 160), budget: chance(0.4) ? rint(2, 25) * 500 : null, plan: 'Agenda, speakers, logistics and promotion plan agreed with the committee.',
        kpi_target: rint(30, 120), status, needs_advisor: chance(0.15) ? 1 : 0, approved_by: status === 'proposed' ? null : s.president.id, approved_at: status === 'proposed' ? null : addH(start, -24 * 10),
        advisor_by: status === 'closed' ? s.advisor.id : null, advisor_at: status === 'closed' ? addH(start, 24 * 6) : null,
        checkin_token: code(10).toLowerCase() + code(6).toLowerCase(), training_hours: ['training', 'workshop'].includes(cat) ? (hours || 2) : null,
        created_at: addH(start, -24 * rint(10, 25)) });
      eventRsvps(eid, s.all, start, past);
      if (past) {
        const att = get('SELECT COUNT(*) n FROM event_rsvps WHERE event_id = ? AND checked_in_at IS NOT NULL', eid).n;
        run('UPDATE events SET attendance_count = ?, expenses = ?, outcome = ? WHERE id = ?', att + rint(5, 60), chance(0.4) ? rint(1, 20) * 250 : 0, 'Delivered as planned. Attendance and feedback recorded.', eid);
      }
    }
  }
  // AASTEC-wide events, trainings and information sessions
  const everyone = soc.filter(x => x.active).flatMap(s => s.all);
  for (let off = prevOff + 3; off <= 55; off += rint(12, 18)) {
    const [t, cat] = pick(C.AASTEC_EVENTS);
    const start = dayAt(off, pick([7, 10, 12]));
    const eid = ins('events', { title: t, description: `${t} — an AASTEC-wide event open to Members, Society leaders, Faculty Advisors, mentors, trainers and staff.`, kind: 'aastec', category: cat,
      organizer_id: staff.staff.id, created_by: staff.staff.id, start_at: start, end_at: addH(start, rint(2, 6)), location: pick(['Innovation Hall, AAST Miami', 'AAST Conference Centre, Cairo', 'Online (Teams)', 'AAST Smart Village Auditorium']),
      mode: pick(['in_person', 'hybrid', 'online']), visibility: 'all', capacity: rint(150, 600), status: off < 0 ? 'completed' : 'published', approved_by: staff.epm.id, approved_at: addH(start, -24 * 20),
      checkin_token: code(10).toLowerCase() + code(6).toLowerCase(), training_hours: cat === 'training' ? 3 : null, created_at: addH(start, -24 * 25) });
    eventRsvps(eid, sample(everyone, 120), start, off < 0, 120);
  }
  for (let off = prevOff + 10; off <= 40; off += rint(20, 30)) {
    const start = dayAt(off, 12);
    const eid = ins('events', { title: pick(['Training of Trainers: Facilitation Skills', 'Bootcamp: Business Model Canvas', 'Workshop: Pitch Deck Mastery', 'Masterclass: Fundraising 101']), description: 'AASTEC training session for Society members and leaders. Certificates of attendance are issued.',
      kind: 'training', category: 'training', programme_id: prog.training, organizer_id: staff.tpm.id, created_by: staff.tpm.id, start_at: start, end_at: addH(start, 3), location: 'Online (Zoom)', mode: 'online', visibility: 'all',
      capacity: 200, status: off < 0 ? 'completed' : 'published', approved_by: staff.tpm.id, approved_at: addH(start, -24 * 14), checkin_token: code(16).toLowerCase(), training_hours: 3, created_at: addH(start, -24 * 20) });
    eventRsvps(eid, sample(everyone, 80), start, off < 0, 80);
  }
  for (const a of agents) {
    [-40, -12, 9, 23].forEach(off => {
      const start = dayAt(off, 13);
      const eid = ins('events', { title: pick(['What Makes a Startup Investable?', 'Design Thinking Workshop', 'Funding Pathways for Students', 'Rally Incubator Information Session']), description: 'Rally Incubator information session: programme offer, eligibility, timeline and support.',
        kind: 'info_session', category: 'workshop', society_id: a.soc.id, programme_id: prog.incubator, organizer_id: a.id, created_by: a.id, start_at: start, end_at: addH(start, 2), location: `Main Auditorium, ${a.soc.short}`,
        mode: 'in_person', visibility: 'all', capacity: 80, status: off < 0 ? 'completed' : 'published', approved_by: staff.ipm.id, approved_at: addH(start, -24 * 7), checkin_token: code(16).toLowerCase(), training_hours: 2, created_at: addH(start, -24 * 12) });
      eventRsvps(eid, a.soc.all, start, off < 0, 60);
    });
  }

  // ---------------- grants & authorization requests (AAST Miami focus) ----------------
  const grant = (u, s, key, scope_note, by, at) => ins('user_grants', { user_id: u.id, society_id: s.id, perm_key: key, scope_note, granted_by: by.id, granted_at: at, expires_at: `${lastCycle + 1}-08-31T23:59:59.000Z` });
  for (const s of soc.filter(x => x.active)) {
    for (const h of Object.values(s.heads)) grant(h, s, 'posting_official', 'Committee communications', s.president, dayAt(-60));
    grant(s.vp, s, 'posting_official', 'Society announcements', s.president, dayAt(-60));
  }
  const ahmed = member(MIAMI, 'Ahmed Mostafa'), sara = member(MIAMI, 'Sara Elshamy'), yAli = member(MIAMI, 'Youssef Ali');
  const reqHist = (u, key, scope, status, at, note) => {
    const id = ins('auth_requests', { user_id: u.id, society_id: MIAMI.id, perm_key: key, scope_note: scope, justification: 'Supporting Society activities this semester.', status, decided_by: MIAMI.president.id, decided_at: at, decision_note: note, created_at: addH(at, -48) });
    if (status === 'approved') ins('user_grants', { user_id: u.id, society_id: MIAMI.id, perm_key: key, scope_note: scope, request_id: id, granted_by: MIAMI.president.id, granted_at: at, expires_at: `${lastCycle + 1}-08-31T23:59:59.000Z` });
    logLater(MIAMI.president, 'auth_request', id, status === 'approved' ? 'approve' : 'reject', { member: u.full_name, permission: key }, at);
  };
  reqHist(ahmed, 'posting_official', 'Create and publish posts', 'approved', dayAt(-20), 'Approved for the Marketing campaign.');
  reqHist(sara, 'committee_access', 'Marketing & Media Committee', 'approved', dayAt(-18), null);
  reqHist(yAli, 'community_moderation', 'Community moderator', 'rejected', dayAt(-17), 'Please complete the onboarding course first.');
  const pend = [[DEMO_MEMBER, 'committee_access', 'Marketing & Media Committee', MIAMI.committees.marketing, 'head_reviewed'], [member(MIAMI, 'Mohamed Ashraf'), 'calendar_support', 'Manage event calendar', null, 'pending'],
    [member(MIAMI, 'Hana Ahmed'), 'event_support', 'Tech Week', MIAMI.committees.events, 'pending'], [member(MIAMI, 'Ali Abdallah'), 'report_submission', 'Submit activity reports', null, 'pending'],
    [member(MIAMI, 'Salma Mohamed'), 'posting_official', 'Create and publish posts', null, 'pending'], [ahmed, 'event_support', 'Rally Hackathon logistics', MIAMI.committees.events, 'pending']];
  pend.forEach(([u, key, scope, committee_id, status], i) => ins('auth_requests', { user_id: u.id, society_id: MIAMI.id, perm_key: key, scope_note: scope, committee_id, justification: 'I would like to support the Society with this responsibility.',
    status, head_review_by: status === 'head_reviewed' ? MIAMI.heads.marketing.id : null, head_review_at: status === 'head_reviewed' ? dayAt(-1) : null, head_review_note: status === 'head_reviewed' ? 'Recommended — active contributor.' : null, created_at: dayAt(-i - 1, 10 + i) }));
  for (const s of soc.filter(x => x.deep && x !== MIAMI)) sample(s.members, rint(2, 4)).forEach(u => ins('auth_requests', { user_id: u.id, society_id: s.id, perm_key: pick(Object.keys({ posting_official: 1, event_support: 1, calendar_support: 1 })), scope_note: 'Society activities', justification: 'Supporting upcoming events.', status: 'pending', created_at: dayAt(-rint(1, 6)) }));

  // Pending membership applications
  ['Adham Kamal', 'Habiba Saleh', 'Marwan Zaki'].forEach((n, i) => {
    usedNames.add(n);
    mkUser({ full_name: n, role: 'member', title: 'Member', university_id: MIAMI.uni.id, society_id: MIAMI.id, slug: MIAMI.slug, membership_status: 'pending', join_note: 'I want to join Rally Society to develop my entrepreneurial skills and contribute to events.', ack: true, created_at: dayAt(-i - 1) });
  });

  // ---------------- posts, reactions, comments ----------------
  const fill = (txt, s) => txt.replace('{event}', pick(C.EVENT_TEMPLATES)[0]).replace('{course}', pick(courseTitles)).replace('{skill}', pick(C.SKILLS).toLowerCase()).replace('{sector}', pick(['FinTech', 'HealthTech', 'EdTech', 'Agritech', 'CleanTech']))
    .replace('{date}', new Date(NOW + rint(3, 20) * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })).replace('{soc}', s?.short || '').replace('{n1}', rint(4, 12)).replace('{n2}', rint(10, 40)).replace('{n3}', rint(3, 15));
  const KINDS = ['like', 'like', 'like', 'like', 'love', 'celebrate', 'celebrate', 'insightful'];
  function addPost(o, pool) {
    const { at, ...rest } = o; o.at = at;
    const pid = ins('posts', { status: 'published', risk_score: rint(0, 15), risk_checks: '[]', created_at: at, published_at: o.status && o.status !== 'published' ? null : at, updated_at: at, ...rest, tags: J(o.tags || []), media: J(o.media || []) });
    if ((o.status || 'published') === 'published') {
      sample(pool, rint(2, Math.min(pool.length, o.identity === 'personal' ? 18 : 30))).forEach(u => run('INSERT OR IGNORE INTO reactions(post_id, user_id, kind, created_at) VALUES(?,?,?,?)', pid, u.id, pick(KINDS), addH(o.at, rint(1, 30))));
      for (let k = 0; k < rint(0, 4); k++) ins('comments', { post_id: pid, author_id: pick(pool).id, body: pick(C.COMMENTS), created_at: addH(o.at, rint(1, 48)) });
      if (chance(0.15)) run('UPDATE posts SET share_count = ? WHERE id = ?', rint(1, 12), pid);
    }
    return pid;
  }
  for (const s of soc.filter(x => x.active)) {
    const pool = s.all.concat(sample(everyone, 10));
    for (let off = prevOff - 30; off <= 0; off += s.deep ? rint(4, 8) : rint(25, 40)) {
      const [cat, body, tags] = pick(C.POST_TEMPLATES.personal);
      addPost({ author_id: pick(s.all).id, identity: 'personal', society_id: s.id, category: cat, body: fill(body, s), tags, at: dayAt(off, rint(6, 19), rint(0, 59)) }, pool);
    }
    for (let off = prevOff - 30; off <= 0; off += s.deep ? rint(8, 14) : rint(40, 60)) {
      const [cat, body, tags, title] = pick(C.POST_TEMPLATES.society);
      const ev = pick(C.EVENT_TEMPLATES)[0];
      addPost({ author_id: pick([s.president, s.vp, s.heads.marketing].filter(Boolean)).id, identity: 'society', society_id: s.id, category: cat, title: fill(title.replace('{event}', ev), s), body: fill(body.replace('{event}', ev), s), tags, visibility: 'public', at: dayAt(off, rint(7, 17)) }, pool);
    }
  }
  for (let off = prevOff; off <= 0; off += rint(10, 16)) {
    const [cat, body, tags, title] = pick(C.POST_TEMPLATES.aastec);
    addPost({ author_id: pick([staff.staff, staff.staff2, staff.pm]).id, identity: 'aastec', category: cat, title, body, tags, at: dayAt(off, 9) }, sample(everyone, 60));
  }
  // Pinned welcome + a poll
  addPost({ author_id: staff.pm.id, identity: 'aastec', category: 'announcement', title: 'Welcome to the AASTEC Digital Platform', body: 'The AASTEC Digital Platform brings every Rally Society into one community: profiles, governance, the shared calendar, elections, learning, AI tools and the incubator. Start by completing your profile and acknowledging the Rally Society Handbook.', tags: ['AASTEC', 'RallySociety'], pinned: 1, at: dayAt(-3, 8) }, sample(everyone, 80));
  const pollId = addPost({ author_id: MIAMI.heads.learning.id, identity: 'personal', society_id: MIAMI.id, category: 'discussion', body: 'Which workshop should the Learning & Training committee run next month?', poll: J({ options: ['Financial modelling', 'Pitch deck mastery', 'AI tools for founders', 'Public speaking'] }), tags: ['Poll'], at: dayAt(-2, 12) }, MIAMI.all);
  sample(MIAMI.all, 22).forEach(u => run('INSERT OR IGNORE INTO poll_votes(post_id, user_id, option_index, created_at) VALUES(?,?,?,?)', pollId, u.id, pick([0, 1, 1, 2, 2, 2, 3]), dayAt(-1)));
  // Posting workflow demonstrations (AAST Miami)
  const chain = (pid, steps) => steps.forEach(([label, role_key, approver, status, note, at], i) => ins('post_approvals', { post_id: pid, step: i + 1, label, role_key, approver_id: approver?.id, status, note, decided_at: ['approved', 'rejected'].includes(status) ? at : null }));
  const P = MIAMI.president, ADV = MIAMI.advisor, MH = MIAMI.heads.marketing;
  let pid = ins('posts', { author_id: ahmed.id, identity: 'society', society_id: MIAMI.id, category: 'event', audience: 'all', scope: 'external', title: 'Entrepreneurship 101 Workshop', body: 'Join us for an interactive workshop to explore the basics of entrepreneurship, idea validation and the business model canvas. Guest speakers from our partner incubators will share practical lessons.', tags: J(['Workshop', 'Entrepreneurship', 'AASTEC']), sensitive: 0, risk_score: 18, risk_checks: '[]', status: 'pending_approval', created_at: dayAt(-1, 9), updated_at: dayAt(-1, 9) });
  chain(pid, [['Committee Head Review', 'committee_head', MH, 'approved', 'Great content — this will add value to our members.', dayAt(-1, 10)], ['President Approval', 'president', P, 'pending'], ['Faculty Advisor Approval', 'advisor', ADV, 'waiting']]);
  logLater(ahmed, 'post', pid, 'submit', { title: 'Entrepreneurship 101 Workshop' }, dayAt(-1, 9)); logLater(MH, 'post', pid, 'approve_step', { step: 'Committee Head Review' }, dayAt(-1, 10));
  pid = ins('posts', { author_id: MIAMI.vp.id, identity: 'society', society_id: MIAMI.id, category: 'announcement', audience: 'partners', scope: 'national', sensitive: 1, title: 'Strategic partnership with TechCorp Egypt', body: 'Rally Society AAST Miami is pleased to announce a partnership with TechCorp Egypt to deliver a series of innovation bootcamps and internships for members during the coming semester.', tags: J(['Partnership', 'AASTEC']), risk_score: 28, risk_checks: '[]', status: 'pending_approval', created_at: dayAt(-3, 11), updated_at: dayAt(-3, 11) });
  chain(pid, [['President Approval', 'president', P, 'approved', 'Approved. Let us promote this across our channels.', dayAt(-2, 9)], ['Faculty Advisor Approval', 'advisor', ADV, 'pending'], ['AASTEC Approval', 'aastec', null, 'waiting']]);
  pid = ins('posts', { author_id: MIAMI.president.id, identity: 'society', society_id: MIAMI.id, category: 'opportunity', audience: 'partners', scope: 'national', sensitive: 1, title: 'Call for sponsors: Rally Hackathon', body: 'We invite industry sponsors to support the Rally Hackathon with prizes, mentors and cloud credits. Sponsorship packages are available on request.', tags: J(['Hackathon', 'Sponsorship']), risk_score: 22, risk_checks: '[]', status: 'pending_approval', created_at: dayAt(-4, 10), updated_at: dayAt(-4, 10) });
  chain(pid, [['President Approval', 'president', P, 'approved', 'Authored by the President.', dayAt(-4, 10)], ['Faculty Advisor Approval', 'advisor', ADV, 'approved', 'Content aligns with university guidelines.', dayAt(-3, 12)], ['AASTEC Approval', 'aastec', null, 'pending']]);
  pid = ins('posts', { author_id: sara.id, identity: 'society', society_id: MIAMI.id, category: 'event', scope: 'external', title: 'Instagram post — Hackathon promo', body: 'The countdown begins! Rally Hackathon brings together designers, developers and business students for 48 hours of building. Registration opens next week.', tags: J(['Hackathon']), risk_score: 10, risk_checks: '[]', status: 'pending_approval', created_at: dayAt(0, 7), updated_at: dayAt(0, 7) });
  chain(pid, [['Committee Head Review', 'committee_head', MH, 'pending'], ['President Approval', 'president', P, 'waiting'], ['Faculty Advisor Approval', 'advisor', ADV, 'waiting']]);
  ins('posts', { author_id: MIAMI.heads.events.id, identity: 'society', society_id: MIAMI.id, category: 'event', title: 'Tech Week registration opens', body: 'Registration for Tech Week opens on Monday. Follow our calendar for the full agenda.', tags: J(['TechWeek']), status: 'scheduled', publish_at: dayAt(2, 8), risk_score: 0, risk_checks: '[]', created_at: dayAt(0, 8), updated_at: dayAt(0, 8) });
  // Flagged / reported content for moderation
  const flagged = ins('posts', { author_id: pick(S('Horus Univ.').members).id, identity: 'personal', society_id: S('Horus Univ.').id, category: 'discussion', body: 'Selling exam answers for all business courses, contact me on 01012345678 — limited offer! Visit bit.ly/answers-now', tags: '[]', risk_score: 75, risk_checks: '[]', status: 'flagged', created_at: dayAt(-1, 15), updated_at: dayAt(-1, 15) });
  ins('content_reports', { target_type: 'post', target_id: flagged, reporter_id: pick(S('Horus Univ.').members).id, reason: 'Academic misconduct', detail: 'Offering exam answers.', created_at: dayAt(-1, 16) });
  const recent = all("SELECT id FROM posts WHERE status = 'published' AND identity = 'personal' ORDER BY published_at DESC LIMIT 12");
  ins('content_reports', { target_type: 'post', target_id: recent[3].id, reporter_id: DEMO_MEMBER.id, reason: 'Off-topic content', detail: 'Promotional content unrelated to entrepreneurship.', created_at: dayAt(0, 6) });
  ins('content_reports', { target_type: 'post', target_id: recent[7].id, reporter_id: pick(MIAMI.members).id, reason: 'Possible policy violation', detail: 'Uses the Society logo on a personal post.', created_at: dayAt(-1, 11) });
  const cm = get('SELECT id FROM comments ORDER BY id DESC LIMIT 1');
  ins('content_reports', { target_type: 'comment', target_id: cm.id, reporter_id: pick(MIAMI.members).id, reason: 'Spam', created_at: dayAt(0, 9) });
  // follows & saved
  for (const u of sample(everyone, 200)) sample(everyone, rint(2, 8)).forEach(v => { if (v.id !== u.id) run('INSERT OR IGNORE INTO follows VALUES(?,?,?)', u.id, v.id, dayAt(-rint(1, 200))); });
  sample(MIAMI.all, 20).forEach(u => run('INSERT OR IGNORE INTO follows VALUES(?,?,?)', u.id, DEMO_MEMBER.id, dayAt(-rint(1, 100))));

  // ---------------- groups ----------------
  const grp = (name, kind, visibility, description, members, extra = {}) => { const g = ins('groups', { name, kind, visibility, description, created_by: staff.pm.id, created_at: dayAt(-300), ...extra }); members.forEach(u => run('INSERT OR IGNORE INTO group_members(group_id, user_id, role, joined_at) VALUES(?,?,?,?)', g, u.id, 'member', dayAt(-rint(1, 250)))); return g; };
  for (const s of soc.filter(x => x.deep)) grp(`Rally Society ${s.short}`, 'society', 'members', `Members-only group for Rally Society ${s.short}.`, s.all, { society_id: s.id });
  for (const [k, cid] of Object.entries(MIAMI.committees)) grp(`${C.COMMITTEES.find(c => c[0] === k)[1]} — AAST Miami`, 'committee', 'private', 'Committee workspace group.', MIAMI.all.filter(u => u.committee_id === cid), { society_id: MIAMI.id, committee_id: cid });
  grp('Startup Founders', 'interest', 'public', 'Founders sharing lessons, resources and opportunities.', ventures.map(v => v.founder).concat(sample(everyone, 40)));
  grp('AI & Innovation', 'interest', 'public', 'Discussions on AI tools, data and innovation.', sample(everyone, 70));
  grp('Marketing Minds', 'interest', 'public', 'Marketing, branding and growth practitioners.', sample(everyone, 55));
  grp('Women in Entrepreneurship', 'interest', 'public', 'Community supporting women founders and leaders.', sample(everyone, 45));
  grp('Rally Incubator — Cohort 5', 'cohort', 'private', 'Cohort 5 founders, mentors and programme team.', ventures.filter(v => v.cohort === cohort5).map(v => v.founder).concat(verifiedMentors), { cohort_id: cohort5 });

  // ---------------- conversations ----------------
  const convo = (kind, title, members, msgs) => {
    const c = ins('conversations', { kind, title, created_by: members[0].id, created_at: dayAt(-30), last_message_at: msgs.length ? msgs[msgs.length - 1][2] : dayAt(-30) });
    members.forEach(m => ins('conversation_members', { conversation_id: c, user_id: m.id, last_read_at: dayAt(-2) }));
    msgs.forEach(([from, body, at]) => ins('messages', { conversation_id: c, sender_id: from.id, body, created_at: at }));
    return c;
  };
  convo('group', 'Marketing & Media — Internal Chat', [MH, DEMO_MEMBER, sara, ahmed, MIAMI.vp], [[ahmed, 'Hey team, please upload the raw footage from the Hackathon promo shoot.', dayAt(0, 7, 15)], [DEMO_MEMBER, 'On it! I will upload to the shared drive within the hour.', dayAt(0, 7, 16)], [MH, 'Thanks both. Draft captions are due Thursday.', dayAt(0, 8, 2)]]);
  convo('direct', null, [DEMO_MEMBER, P], [[DEMO_MEMBER, 'Hi Youssef, I submitted a request to join the Marketing committee. Is there anything else needed?', dayAt(-1, 10)], [P, 'Thanks Nouran — Omar has recommended you. I will review it today.', dayAt(-1, 12)]]);
  convo('direct', null, [P, ADV], [[P, 'Dr. Fatma, the partnership announcement with TechCorp is waiting for your approval.', dayAt(-2, 9)], [ADV, 'Thank you, I will review the content today.', dayAt(-2, 11)]]);
  convo('direct', null, [staff.pm, P], [[staff.pm, 'Reminder: the September activity report is due by the 10th.', dayAt(-6, 8)], [P, 'Noted, we are drafting it with the AI reporting assistant.', dayAt(-6, 9)]]);
  convo('direct', null, [ventures[0].founder, mentors[1]], [[ventures[0].founder, 'Thank you for the session, Dr. Amr. I updated the pricing slide as discussed.', dayAt(-3, 14)], [mentors[1], 'Great progress. Let us review the pilot results next week.', dayAt(-3, 16)]]);

  // ---------------- tasks & documents ----------------
  const MT = [['Approve campaign: Hackathon promo', 'high', 2, 'in_review'], ['Review social media calendar', 'medium', 3, 'in_progress'], ['Oversee content shoot — Tech Talk', 'high', 4, 'not_started'], ['Coordinate with design team on brand kit', 'medium', 5, 'not_started'], ['Monthly performance report', 'low', 9, 'not_started'], ['Publish event recap video', 'medium', -3, 'done'], ['Newsletter — monthly edition', 'low', -8, 'done'], ['Design event banners', 'medium', -12, 'done']];
  MT.forEach(([title, priority, due, status]) => ins('tasks', { society_id: MIAMI.id, committee_id: MIAMI.committees.marketing, title, assignee_id: (status === 'in_review' ? MH : pick([MH, DEMO_MEMBER, sara, ahmed])).id, created_by: MH.id, priority, due_on: dayAt(due).slice(0, 10), status, created_at: dayAt(due - 10), completed_at: status === 'done' ? dayAt(due) : null }));
  for (const s of soc.filter(x => x.deep)) for (const [k, cid] of Object.entries(s.committees)) {
    if (s === MIAMI && k === 'marketing') continue;
    for (let i = 0; i < rint(2, 5); i++) {
      const due = rint(-15, 20); const st = due < -2 ? 'done' : pick(['not_started', 'in_progress', 'in_progress', 'in_review']);
      ins('tasks', { society_id: s.id, committee_id: cid, title: pick(['Book venue for workshop', 'Confirm speakers', 'Collect attendance evidence', 'Prepare sponsor deck', 'Onboard new members', 'Draft training plan', 'Update committee tracker', 'Prepare monthly KPI summary']), assignee_id: (s.heads[k] || s.president).id, created_by: s.vp.id, priority: pick(['high', 'medium', 'low']), due_on: dayAt(due).slice(0, 10), status: st, created_at: dayAt(due - 12), completed_at: st === 'done' ? dayAt(due) : null });
    }
  }
  [['Content Strategy — Q4', 'Strategy', MH], ['Brand Guidelines', 'Guidelines', MIAMI.vp], ['Social Media Calendar', 'Calendar', DEMO_MEMBER], ['Event Coverage Checklist', 'Checklist', ahmed]].forEach(([title, doc_type, by], i) =>
    ins('documents', { society_id: MIAMI.id, committee_id: MIAMI.committees.marketing, title, doc_type, url: '#', uploaded_by: by.id, created_at: dayAt(-5 - i * 7) }));

  // ---------------- society reports ----------------
  const monthsBack = (n) => { const d = new Date(NOW); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 7); };
  const dueOf = (period) => { const [y, m] = period.split('-').map(Number); return new Date(Date.UTC(y, m, 10)).toISOString().slice(0, 10); };
  for (const s of soc.filter(x => x.active)) {
    for (let i = 14; i >= 1; i--) {
      const period = monthsBack(i);
      if (!s.deep && (chance(0.3) || (i === 1 && chance(0.6)))) continue;
      const ev = get(`SELECT COUNT(*) n, COALESCE(SUM(training_hours),0) h FROM events WHERE society_id = ? AND substr(start_at,1,7) = ? AND status IN ('completed','closed')`, s.id, period);
      const submitted = addH(dueOf(period) + 'T08:00:00.000Z', -24 * rint(0, 8));
      const status = i === 1 ? 'submitted' : (s === S('AAST Sheraton') && i === 2) ? 'returned' : 'approved';
      const rid = ins('society_reports', { society_id: s.id, report_type: 'monthly_activity', title: `Monthly Activity Report — ${new Date(period + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`, period,
        body: `During this month Rally Society ${s.short} delivered ${ev.n} activities with ${ev.h} training hours. Committees progressed on their plans and member engagement remained steady.`, metrics: J({ events: ev.n, training_hours: ev.h }),
        submitted_by: s.president.id, status, due_on: dueOf(period), submitted_at: submitted, reviewed_by: status === 'submitted' ? null : s.advisor.id, reviewed_at: status === 'submitted' ? null : addH(submitted, 72),
        review_note: status === 'returned' ? 'Please attach attendance evidence for the Startup Weekend.' : status === 'approved' ? 'Reviewed — thank you.' : null, created_at: submitted });
      if (i <= 2) logLater(s.president, 'report', rid, 'submit', { period }, submitted);
    }
    if (s.deep) {
      for (const q of [3, 6, 9, 12]) ins('society_reports', { society_id: s.id, report_type: 'financial_statement', title: `Financial Statement — ${monthsBack(q)}`, period: monthsBack(q), body: 'Income, expenses and sponsorship received for the quarter, with receipts attached.', submitted_by: s.president.id, status: 'approved', submitted_at: dayAt(-q * 30 + 10), reviewed_by: s.advisor.id, reviewed_at: dayAt(-q * 30 + 13), created_at: dayAt(-q * 30 + 10) });
      const evs = all(`SELECT id, title, start_at FROM events WHERE society_id = ? AND status IN ('completed','closed') ORDER BY start_at DESC LIMIT 3`, s.id);
      evs.forEach((e, k) => ins('society_reports', { society_id: s.id, report_type: 'event_report', title: `Event Report — ${e.title}`, period: e.start_at.slice(0, 7), event_id: e.id, body: 'Objectives met. Attendance, outcomes, expenses and photos attached.', submitted_by: (s.heads.events || s.president).id, status: k === 0 ? 'submitted' : 'approved', submitted_at: addH(e.start_at, 72), reviewed_by: k === 0 ? null : s.advisor.id, reviewed_at: k === 0 ? null : addH(e.start_at, 120), created_at: addH(e.start_at, 72) }));
    }
  }
  agents.forEach(a => ins('society_reports', { society_id: a.soc.id, report_type: 'incubator_agent', title: `Monthly Agent Report — ${monthsBack(1)}`, period: monthsBack(1), body: 'Funnel movement, sessions held, teams supported and support requested.', submitted_by: a.id, status: 'submitted', submitted_at: dayAt(-6), created_at: dayAt(-6) }));

  // ---------------- escalations ----------------
  [[MIAMI, 'Late report submission — Learning & Training', 'Committee summary for the monthly report was submitted after the deadline.', 'low', 'resolved'],
    [MIAMI, 'Sponsor payment delay — Rally Hackathon', 'Sponsor has not transferred the agreed prize contribution.', 'medium', 'open'],
    [S('Horus Univ.'), 'Member conduct complaint', 'Complaint received regarding academic misconduct in the community feed.', 'high', 'open'],
    [S('AAST Sheraton'), 'Event budget overrun', 'Startup Weekend expenses exceeded the approved budget by 18%.', 'medium', 'in_progress'],
    [S('KNUST'), 'Venue cancellation', 'The auditorium booking for the info session was cancelled by the facility.', 'low', 'resolved']]
    .forEach(([s, title, detail, severity, status]) => ins('escalations', { society_id: s.id, title, detail, severity, status, raised_by: s.president.id, assigned_to: s.advisor.id, resolution: status === 'resolved' ? 'Resolved with the committee and documented.' : null, created_at: dayAt(-rint(2, 20)), resolved_at: status === 'resolved' ? dayAt(-1) : null }));

  // ---------------- KPI manual entries (snapshots over time) ----------------
  const MANUAL = C.KPIS.filter(k => k[4] === 'manual');
  const EXTERNAL = { online_posts: 0.55, training_count: 0.45, training_hours: 0.4 };
  for (const s of soc.filter(x => x.active)) {
    const f = s.deep ? 0.85 + rnd() * 0.4 : 0.3 + rnd() * 0.45;
    const enter = (ay, key, value, at) => ins('kpi_entries', { society_id: s.id, academic_year: ay, metric_key: key, value: Math.round(value), note: 'Reported by Society leadership', entered_by: s.president.id, created_at: at });
    const yr = (ayLabel, factor, quarters) => {
      const st = +ayLabel.slice(0, 4);
      const snaps = quarters ? [[0.25, Date.UTC(st, 10, 28)], [0.5, Date.UTC(st + 1, 1, 26)], [0.75, Date.UTC(st + 1, 4, 28)], [1, Date.UTC(st + 1, 7, 25)]] : [[1, Date.UTC(st + 1, 7, 25)]];
      for (const [frac, ms] of snaps) {
        if (ms > NOW) continue;
        for (const [key, , , target] of MANUAL) enter(ayLabel, key, target * factor * frac * (0.85 + rnd() * 0.3), iso(ms));
        for (const [key, share] of Object.entries(EXTERNAL)) enter(ayLabel, key, C.KPIS.find(k => k[0] === key)[3] * share * factor * frac, iso(ms));
      }
    };
    yr(prev2AY, f * 0.82, false);
    yr(prevAY, f, true);
    for (const [key, , , target] of MANUAL) enter(curAY, key, target * f * 0.12, dayAt(-5));
  }

  // ---------------- elections ----------------
  const cy = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 8)).toISOString();
  function election(s, year, o) {
    const eid = ins('elections', { society_id: s.id, title: o.title || `Leadership Election ${year}`, cycle_year: year,
      nomination_start: o.dates?.[0] || cy(year, 7, 6), nomination_end: o.dates?.[1] || cy(year, 7, 15), review_start: o.dates?.[2] || cy(year, 7, 16), review_end: o.dates?.[3] || cy(year, 7, 22),
      voting_start: o.dates?.[4] || cy(year, 7, 23), voting_end: o.dates?.[5] || cy(year, 7, 30), results_at: o.dates?.[6] || cy(year, 8, 1), handover_at: o.dates?.[7] || cy(year, 8, 6),
      status: o.status, eligibility: J({ active_member: true, good_standing: true, handbook: true, onboarding: true }), configured_by: staff.pm.id, configured_at: o.configured_at || cy(year, 5, 20),
      advisor_decision: o.advisor ? 'approved' : null, advisor_by: o.advisor ? s.advisor.id : null, advisor_at: o.advisor || null, advisor_note: o.advisor ? 'Eligibility list reviewed. Approved for go-live.' : null,
      sandbox: o.sandbox ? 1 : 0, results_published_at: o.results || null, handover_completed_at: o.handover || null, created_at: o.configured_at || cy(year, 5, 20) });
    const pos = { president: ins('election_positions', { election_id: eid, title: 'President', role_key: 'president', sort: 0 }), vice_president: ins('election_positions', { election_id: eid, title: 'Vice President', role_key: 'vice_president', sort: 1 }) };
    ['Confirm and publish official results', 'New board acceptance and onboarding', 'Transfer of assets, accounts and social media access', 'Documentation and archive handover', 'Final report submission to Programme Manager']
      .forEach((t, i) => ins('handover_tasks', { election_id: eid, title: t, owner_label: ['Programme Manager', 'Incoming board', 'Outgoing board', 'Outgoing board', 'Outgoing President'][i], done: o.handover ? 1 : 0, done_by: o.handover ? s.president.id : null, done_at: o.handover || null, sort: i }));
    return { eid, pos };
  }
  for (const s of soc.filter(x => x.deep)) {
    const { eid, pos } = election(s, lastCycle, { status: 'closed', advisor: cy(lastCycle, 6, 2), results: cy(lastCycle, 8, 1), handover: cy(lastCycle, 8, 8) });
    const rivals = sample(s.members, 2);
    const cands = [[pos.president, s.president, 'Vision · Unity · Impact', true], [pos.president, rivals[0], 'Growth · Integrity · Action', false], [pos.vice_president, s.vp, 'Support · Connect · Lead', true], [pos.vice_president, rivals[1], 'Empower · Serve · Inspire', false]];
    const voters = sample(s.all, Math.round(s.all.length * 0.72));
    const cIds = cands.map(([p, u, slogan, win]) => ({ p, win, id: ins('candidates', { election_id: eid, position_id: p, user_id: u.id, slogan, manifesto: `${u.full_name} commits to strengthening committees, growing partnerships and increasing member engagement.`, status: 'validated', reviewed_by: staff.pm.id, reviewed_at: cy(lastCycle, 7, 18), created_at: cy(lastCycle, 7, 8) }) }));
    voters.forEach(v => {
      ins('ballots', { election_id: eid, voter_id: v.id, receipt: code(10), cast_at: cy(lastCycle, 7, rint(23, 30)) });
      for (const p of [pos.president, pos.vice_president]) { const opts = cIds.filter(c => c.p === p); const c = chance(0.62) ? opts.find(x => x.win) : opts.find(x => !x.win); ins('votes', { election_id: eid, position_id: p, candidate_id: c.id, cast_day: cy(lastCycle, 7, 25).slice(0, 10) }); }
    });
    logLater(staff.pm, 'election', eid, 'configure', { society: s.short, cycle: lastCycle }, cy(lastCycle, 5, 20));
    logLater(s.advisor, 'election', eid, 'advisor_approve', { society: s.short }, cy(lastCycle, 6, 2));
    logLater(staff.pm, 'election', eid, 'publish_results', { society: s.short }, cy(lastCycle, 8, 1));
    logLater(staff.pm, 'election', eid, 'complete_handover', { society: s.short }, cy(lastCycle, 8, 8));
  }
  for (const [short, approved] of [['AAST Miami', false], ['Horus Univ.', false], ['Ain Shams', false], ['AAST Sheraton', true], ['AAST Smart Village', true], ['KNUST', true]]) {
    const s = S(short);
    const { eid } = election(s, nextCycle, { status: approved ? 'approved' : 'pending_advisor', advisor: approved ? dayAt(-2) : null, configured_at: dayAt(-6) });
    logLater(staff.pm, 'election', eid, 'configure', { society: short, cycle: nextCycle }, dayAt(-6));
    if (approved) logLater(s.advisor, 'election', eid, 'advisor_approve', { society: short }, dayAt(-2));
  }
  // Rehearsal election in pilot (sandbox) mode — demonstrates nominations, secure voting and results
  {
    const { eid, pos } = election(MIAMI, nextCycle, { title: 'Leadership Election Rehearsal (Pilot Mode)', status: 'voting', sandbox: true, advisor: dayAt(-12), configured_at: dayAt(-14),
      dates: [dayAt(-11), dayAt(-7), dayAt(-6), dayAt(-3), dayAt(-2), dayAt(5, 20), dayAt(6), dayAt(9)] });
    const H = MIAMI.heads;
    const cands = [[pos.president, H.operations, 'Execution · Excellence · Impact'], [pos.president, H.events, 'Vision · Unity · Impact'], [pos.vice_president, H.hr, 'Support · Connect · Lead'], [pos.vice_president, H.partnerships, 'Empower · Serve · Inspire']]
      .map(([p, u, slogan]) => ({ p, id: ins('candidates', { election_id: eid, position_id: p, user_id: u.id, slogan, manifesto: `${u.full_name} will focus on stronger committees, transparent reporting and more partnerships for members.`, status: 'validated', reviewed_by: staff.pm.id, reviewed_at: dayAt(-4), created_at: dayAt(-9) }) }));
    sample(MIAMI.all.filter(u => u.id !== DEMO_MEMBER.id && u.id !== MIAMI.president.id), 16).forEach(v => {
      ins('ballots', { election_id: eid, voter_id: v.id, receipt: code(10), cast_at: dayAt(-rint(0, 2), rint(7, 18)) });
      for (const p of [pos.president, pos.vice_president]) ins('votes', { election_id: eid, position_id: p, candidate_id: pick(cands.filter(c => c.p === p)).id, cast_day: dayAt(-1).slice(0, 10) });
    });
    logLater(staff.pm, 'election', eid, 'configure', { society: 'AAST Miami', sandbox: true }, dayAt(-14));
    logLater(MIAMI.advisor, 'election', eid, 'advisor_approve', { society: 'AAST Miami' }, dayAt(-12));
    logLater(staff.pm, 'election', eid, 'advance', { to: 'voting' }, dayAt(-2));
  }

  // ---------------- notifications for demo accounts ----------------
  const N = (u, icon, title, body, link, off, read = 0) => ins('notifications', { user_id: u.id, type: 'system', icon, title, body, link, is_read: read, created_at: dayAt(off, rint(6, 18)) });
  N(DEMO_MEMBER, 'vote', 'Voting is open', 'The Leadership Election Rehearsal is open for voting.', '#/elections', 0);
  N(DEMO_MEMBER, 'user-check', 'Your request was reviewed by the Committee Head', 'Marketing & Media committee access — awaiting President approval.', '#/approvals', -1);
  N(DEMO_MEMBER, 'calendar', 'Reminder: Tech Talk tomorrow', 'You are registered. Remember to check in with the event QR code.', '#/calendar', -1, 1);
  N(P, 'shield-check', '6 authorization requests need your approval', 'Members are waiting for President approval.', '#/approvals', 0);
  N(P, 'megaphone', 'Official post awaiting your approval', '"Entrepreneurship 101 Workshop" passed Committee Head review.', '#/approvals', -1);
  N(P, 'user-plus', '3 new membership applications', 'Review and approve new members.', '#/members', -1);
  N(ADV, 'vote', 'Election activation approval required', `Leadership Election ${nextCycle} requires your activation approval.`, '#/elections', -1);
  N(ADV, 'file-text', 'Monthly report submitted', 'The monthly activity report is ready for your review.', '#/reports', -2);
  N(ADV, 'megaphone', 'Partnership post awaiting your approval', 'Strategic partnership with TechCorp Egypt.', '#/approvals', -2);
  N(staff.pm, 'vote', 'Advisor approvals pending', '3 Societies are waiting for Faculty Advisor activation approval.', '#/elections', -1);
  N(staff.pm, 'megaphone', 'National post awaiting AASTEC approval', '"Call for sponsors: Rally Hackathon" requires AASTEC approval.', '#/approvals', -1);
  N(staff.ipm, 'badge-check', 'Mentor verification pending', 'Eng. Walid Kamel submitted a trainer registration.', '#/mentors', -2);
  N(MH, 'clipboard-check', 'Post awaiting your review', 'Instagram post — Hackathon promo by Sara Elshamy.', '#/approvals', 0);
  N(staff.director, 'chart-column', 'Quarterly portfolio summary is ready', 'Review KPI performance across all Societies.', '#/kpi', -3);
  N(ventures[0].founder, 'calendar-clock', 'Mentor session scheduled', 'Your next mentor session is confirmed.', '#/incubator', -1);

  // ---------------- audit trail ----------------
  logLater(ADMIN, 'platform', null, 'initialise', { societies: soc.length }, dayAt(-700));
  logLater(MIAMI.president, 'society', MIAMI.id, 'delegation_off', {}, dayAt(-90));
  AUDIT_Q.sort((a, b) => a.at.localeCompare(b.at)).forEach(e => audit(e.actor, e.type, e.id, e.action, e.detail, e.at));
}

// ---------------- CLI: `npm run seed` / `npm run reset` ----------------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--reset')) {
    db.close();
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) if (existsSync(f)) rmSync(f);
    reopenDb();
  }
  const t = Date.now();
  const created = initDatabase();
  console.log(created ? `Database initialised and seeded in ${Date.now() - t} ms → ${DB_PATH}` : 'Database already initialised (use --reset to rebuild).');
}
