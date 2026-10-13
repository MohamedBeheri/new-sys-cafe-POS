-- ===================================================================
--  AASTEC Digital Platform — database schema (SQLite via node:sqlite)
--  Families: Identity & Organisation · Society Governance · Community
--            Calendar & Events · Elections · Learning & AI
--            Programmes & Incubator · KPIs · Notifications & Audit
-- ===================================================================

-- ---------------- Identity & organisation ----------------
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL,                 -- aastec | society | programme | platform
  rank INTEGER DEFAULT 0,
  description TEXT,
  permissions TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS universities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  kind TEXT NOT NULL DEFAULT 'partner', -- aast_campus | partner
  city TEXT,
  country TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS societies (
  id INTEGER PRIMARY KEY,
  university_id INTEGER NOT NULL REFERENCES universities(id),
  name TEXT NOT NULL,                  -- Rally Society - <University/Campus>
  short_name TEXT,
  status TEXT DEFAULT 'active',        -- active | forming | probation | suspended
  founded_on TEXT,
  advisor_id INTEGER,
  vp_delegation INTEGER DEFAULT 0,     -- President delegated substitute authority to the VP
  description TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS org_units (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,                  -- executive | deputy_portfolio | programme_area | department
  parent_id INTEGER REFERENCES org_units(id),
  lead_user_id INTEGER,
  description TEXT,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS committees (
  id INTEGER PRIMARY KEY,
  society_id INTEGER NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT,
  head_user_id INTEGER,
  description TEXT,
  status TEXT DEFAULT 'on_track',      -- on_track | needs_support | on_hold
  status_note TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  university_id INTEGER REFERENCES universities(id),
  society_id INTEGER REFERENCES societies(id),
  committee_id INTEGER REFERENCES committees(id) ON DELETE SET NULL,
  org_unit_id INTEGER REFERENCES org_units(id),
  title TEXT,
  membership_status TEXT DEFAULT 'active', -- pending | active | suspended | alumni | rejected
  join_note TEXT,
  faculty TEXT, study_year TEXT, city TEXT, phone TEXT,
  bio TEXT,
  interests TEXT DEFAULT '[]',
  skills TEXT DEFAULT '[]',
  linkedin TEXT,
  avatar_url TEXT,
  handbook_ack_version TEXT,
  handbook_ack_at TEXT,
  conduct_flags INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_users_society ON users(society_id);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER NOT NULL, followee_id INTEGER NOT NULL, created_at TEXT,
  PRIMARY KEY (follower_id, followee_id)
);

-- ---------------- Society governance ----------------
CREATE TABLE IF NOT EXISTS auth_requests (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  society_id INTEGER NOT NULL REFERENCES societies(id),
  perm_key TEXT NOT NULL,              -- posting_official | event_support | committee_access | calendar_support | community_moderation | report_submission
  scope_note TEXT,
  committee_id INTEGER,
  justification TEXT,
  status TEXT DEFAULT 'pending',       -- pending | head_reviewed | approved | rejected
  head_review_by INTEGER, head_review_at TEXT, head_review_note TEXT,
  decided_by INTEGER, decided_at TEXT, decision_note TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS user_grants (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  society_id INTEGER,
  perm_key TEXT NOT NULL,
  scope_note TEXT,
  request_id INTEGER,
  granted_by INTEGER,
  granted_at TEXT,
  expires_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  society_id INTEGER, committee_id INTEGER, venture_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id INTEGER,
  created_by INTEGER,
  priority TEXT DEFAULT 'medium',      -- high | medium | low
  due_on TEXT,
  status TEXT DEFAULT 'not_started',   -- not_started | in_progress | in_review | done
  created_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  society_id INTEGER, committee_id INTEGER,
  title TEXT NOT NULL, doc_type TEXT, url TEXT,
  uploaded_by INTEGER, created_at TEXT
);

CREATE TABLE IF NOT EXISTS society_reports (
  id INTEGER PRIMARY KEY,
  society_id INTEGER REFERENCES societies(id),
  report_type TEXT NOT NULL,           -- monthly_activity | event_report | financial_statement | meeting_minutes | annual_report | incubator_agent
  title TEXT NOT NULL,
  period TEXT,
  body TEXT,
  metrics TEXT DEFAULT '{}',
  event_id INTEGER,
  submitted_by INTEGER,
  status TEXT DEFAULT 'submitted',     -- submitted | approved | returned
  due_on TEXT,
  submitted_at TEXT,
  reviewed_by INTEGER, reviewed_at TEXT, review_note TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS escalations (
  id INTEGER PRIMARY KEY,
  society_id INTEGER,
  title TEXT NOT NULL,
  detail TEXT,
  severity TEXT DEFAULT 'low',         -- low | medium | high
  status TEXT DEFAULT 'open',          -- open | in_progress | resolved
  raised_by INTEGER, assigned_to INTEGER,
  resolution TEXT,
  created_at TEXT, resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS handbook_sections (
  id INTEGER PRIMARY KEY,
  code TEXT, title TEXT NOT NULL, body TEXT,
  sort INTEGER DEFAULT 0, updated_at TEXT
);

-- ---------------- Community ----------------
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT DEFAULT 'interest',        -- society | committee | programme | cohort | interest
  society_id INTEGER, committee_id INTEGER, cohort_id INTEGER,
  visibility TEXT DEFAULT 'public',    -- public | members | private
  description TEXT,
  created_by INTEGER, created_at TEXT
);
CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL, role TEXT DEFAULT 'member', joined_at TEXT,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id),
  identity TEXT NOT NULL DEFAULT 'personal',  -- personal | society | aastec
  society_id INTEGER,
  group_id INTEGER,
  category TEXT DEFAULT 'discussion',  -- announcement | event | opportunity | discussion | achievement
  visibility TEXT DEFAULT 'public',    -- public | society | admins
  audience TEXT DEFAULT 'all',         -- all | chapter | university | partners | custom
  scope TEXT DEFAULT 'chapter',        -- chapter | external | national  (drives the approval chain)
  title TEXT,
  body TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  media TEXT DEFAULT '[]',
  poll TEXT,
  sensitive INTEGER DEFAULT 0,
  risk_score INTEGER DEFAULT 0,
  risk_checks TEXT DEFAULT '[]',
  status TEXT DEFAULT 'published',     -- pending_approval | scheduled | published | flagged | hidden | removed | rejected
  publish_at TEXT,
  pinned INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  event_id INTEGER,
  created_at TEXT, published_at TEXT, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_posts_status ON posts(status, published_at);
CREATE INDEX IF NOT EXISTS ix_posts_society ON posts(society_id, status);
CREATE INDEX IF NOT EXISTS ix_posts_author ON posts(author_id);

CREATE TABLE IF NOT EXISTS post_approvals (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  step INTEGER NOT NULL,
  label TEXT,
  role_key TEXT,
  approver_id INTEGER,
  status TEXT DEFAULT 'waiting',       -- waiting | pending | approved | rejected
  note TEXT,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS reactions (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL, kind TEXT DEFAULT 'like', created_at TEXT,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'visible',       -- visible | hidden
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS saved_posts (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL, created_at TEXT,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS poll_votes (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL, option_index INTEGER NOT NULL, created_at TEXT,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS content_reports (
  id INTEGER PRIMARY KEY,
  target_type TEXT NOT NULL,           -- post | comment | message | user
  target_id INTEGER NOT NULL,
  reporter_id INTEGER,
  reason TEXT, detail TEXT,
  status TEXT DEFAULT 'open',          -- open | actioned | dismissed
  action TEXT,                         -- keep | hide | remove | escalate
  decided_by INTEGER, decided_at TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY,
  kind TEXT DEFAULT 'direct',          -- direct | group
  title TEXT,
  created_by INTEGER, created_at TEXT, last_message_at TEXT
);
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL, last_read_at TEXT,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL, blocked_id INTEGER NOT NULL, created_at TEXT,
  PRIMARY KEY (blocker_id, blocked_id)
);

-- ---------------- Calendar & events ----------------
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'society',  -- society | aastec | training | info_session
  category TEXT DEFAULT 'other',         -- leadership | workshop | training | networking | community_service | career | social | competition | other
  society_id INTEGER, committee_id INTEGER, programme_id INTEGER,
  organizer_id INTEGER, created_by INTEGER,
  start_at TEXT NOT NULL, end_at TEXT,
  location TEXT,
  mode TEXT DEFAULT 'in_person',         -- in_person | online | hybrid
  visibility TEXT DEFAULT 'all',         -- all | society
  capacity INTEGER,
  budget REAL, plan TEXT, risk_note TEXT, kpi_target INTEGER,
  status TEXT DEFAULT 'published',       -- proposed | advisor_review | published | completed | closed | cancelled | rejected
  needs_advisor INTEGER DEFAULT 0,
  approved_by INTEGER, approved_at TEXT,
  advisor_by INTEGER, advisor_at TEXT,
  review_note TEXT,
  checkin_token TEXT,
  training_hours REAL,
  attendance_count INTEGER, expenses REAL, outcome TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_events_start ON events(start_at);
CREATE INDEX IF NOT EXISTS ix_events_society ON events(society_id, status);

CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  status TEXT DEFAULT 'going',           -- going | interested | declined
  checked_in_at TEXT, check_method TEXT,
  created_at TEXT,
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_rsvps_user ON event_rsvps(user_id);

-- ---------------- Elections ----------------
CREATE TABLE IF NOT EXISTS elections (
  id INTEGER PRIMARY KEY,
  society_id INTEGER NOT NULL REFERENCES societies(id),
  title TEXT,
  cycle_year INTEGER,
  nomination_start TEXT, nomination_end TEXT,
  review_start TEXT, review_end TEXT,
  voting_start TEXT, voting_end TEXT,
  results_at TEXT, handover_at TEXT,
  status TEXT DEFAULT 'pending_advisor', -- pending_advisor | approved | nominations | review | voting | tally | results | handover | closed | cancelled
  eligibility TEXT DEFAULT '{}',
  configured_by INTEGER, configured_at TEXT,
  advisor_decision TEXT, advisor_by INTEGER, advisor_at TEXT, advisor_note TEXT,
  sandbox INTEGER DEFAULT 0,
  results_published_at TEXT, handover_completed_at TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS election_positions (
  id INTEGER PRIMARY KEY,
  election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  title TEXT NOT NULL, role_key TEXT, seats INTEGER DEFAULT 1, sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY,
  election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  position_id INTEGER NOT NULL REFERENCES election_positions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  slogan TEXT, manifesto TEXT,
  status TEXT DEFAULT 'nominated',       -- nominated | validated | rejected | withdrawn
  reviewed_by INTEGER, reviewed_at TEXT, review_note TEXT,
  created_at TEXT
);
-- Ballots record THAT a member voted (to block double voting); votes record WHAT was chosen.
-- The two tables share no key, so a choice can never be traced back to a voter.
CREATE TABLE IF NOT EXISTS ballots (
  election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  voter_id INTEGER NOT NULL,
  receipt TEXT,
  cast_at TEXT,
  PRIMARY KEY (election_id, voter_id)
);
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY,
  election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  position_id INTEGER NOT NULL,
  candidate_id INTEGER NOT NULL,
  cast_day TEXT
);
CREATE TABLE IF NOT EXISTS handover_tasks (
  id INTEGER PRIMARY KEY,
  election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  title TEXT NOT NULL, owner_label TEXT,
  done INTEGER DEFAULT 0, done_by INTEGER, done_at TEXT, sort INTEGER DEFAULT 0
);

-- ---------------- Learning & AI ----------------
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  level TEXT DEFAULT 'Beginner',
  duration_label TEXT,
  hours REAL DEFAULT 0,
  instructor TEXT,
  summary TEXT,
  description TEXT,
  color TEXT,
  tag TEXT,                              -- Bestseller | New | Popular | Trending
  is_published INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0,
  pass_mark INTEGER DEFAULT 70,
  rating REAL DEFAULT 4.7,
  created_by INTEGER, created_at TEXT
);
CREATE TABLE IF NOT EXISTS course_modules (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL, sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration_min INTEGER DEFAULT 10,
  content TEXT,
  video_url TEXT,
  sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  answer_index INTEGER NOT NULL,
  explanation TEXT,
  sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  status TEXT DEFAULT 'active',          -- active | completed
  progress INTEGER DEFAULT 0,
  completed_lessons TEXT DEFAULT '[]',
  quiz_score INTEGER, quiz_attempts INTEGER DEFAULT 0,
  last_lesson_id INTEGER,
  enrolled_at TEXT, completed_at TEXT,
  UNIQUE (course_id, user_id)
);
CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  course_id INTEGER,
  title TEXT NOT NULL,
  issued_at TEXT,
  revoked INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS learning_paths (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL, audience TEXT, description TEXT,
  course_ids TEXT DEFAULT '[]', color TEXT
);
CREATE TABLE IF NOT EXISTS learning_activity (
  user_id INTEGER NOT NULL, day TEXT NOT NULL, minutes INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS ai_logs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER, tool TEXT, prompt TEXT, response TEXT, mode TEXT, created_at TEXT
);

-- ---------------- Programmes & incubator ----------------
CREATE TABLE IF NOT EXISTS programmes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT,                             -- society | accelerator | incubator | training | mentoring | competition
  manager_id INTEGER,
  status TEXT DEFAULT 'active',          -- planning | active | paused | closed
  description TEXT,
  start_on TEXT, end_on TEXT,
  color TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS cohorts (
  id INTEGER PRIMARY KEY,
  programme_id INTEGER NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'open_call',       -- open_call | screening | in_progress | demo_day | completed
  open_on TEXT, close_on TEXT, start_on TEXT, end_on TEXT,
  capacity INTEGER,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS ventures (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT,
  sector TEXT,
  stage TEXT DEFAULT 'ideation',         -- ideation | validation | mvp | early_traction | growth
  society_id INTEGER, university_id INTEGER, cohort_id INTEGER,
  founder_id INTEGER, agent_id INTEGER,
  status TEXT DEFAULT 'active',          -- applicant | active | graduated | paused
  website TEXT, email TEXT,
  founded_on TEXT,
  team_size INTEGER DEFAULT 1,
  color TEXT,
  scores TEXT DEFAULT '{}',              -- {problem, solution, market, team}
  tags TEXT DEFAULT '[]',
  registration TEXT,
  description TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS venture_members (
  venture_id INTEGER NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL, role_title TEXT,
  PRIMARY KEY (venture_id, user_id)
);
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY,
  venture_id INTEGER NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending',         -- pending | in_progress | completed
  due_on TEXT, completed_at TEXT, evidence TEXT,
  sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY,
  cohort_id INTEGER NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  venture_id INTEGER,
  applicant_id INTEGER NOT NULL,
  status TEXT DEFAULT 'received',        -- received | under_review | shortlisted | selected | rejected
  score INTEGER,
  pitch TEXT,
  notes TEXT,
  reviewed_by INTEGER, reviewed_at TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS mentor_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT DEFAULT 'mentor',            -- mentor | trainer | both
  headline TEXT, organisation TEXT, country TEXT, city TEXT,
  years_experience INTEGER,
  expertise TEXT DEFAULT '[]',
  industries TEXT DEFAULT '[]',
  availability TEXT DEFAULT '{}',
  preferences TEXT DEFAULT '[]',
  socials TEXT DEFAULT '{}',
  status TEXT DEFAULT 'draft',           -- draft | pending | verified | rejected
  step INTEGER DEFAULT 1,
  verified_by INTEGER, verified_at TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS mentorships (
  id INTEGER PRIMARY KEY,
  venture_id INTEGER NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  mentor_id INTEGER NOT NULL,
  status TEXT DEFAULT 'active',          -- active | completed
  match_score INTEGER,
  assigned_by INTEGER, created_at TEXT
);
CREATE TABLE IF NOT EXISTS mentor_sessions (
  id INTEGER PRIMARY KEY,
  venture_id INTEGER, mentor_id INTEGER NOT NULL,
  topic TEXT NOT NULL,
  start_at TEXT NOT NULL,
  duration_min INTEGER DEFAULT 60,
  mode TEXT DEFAULT 'online',
  status TEXT DEFAULT 'scheduled',       -- requested | scheduled | completed | cancelled
  notes TEXT, rating INTEGER,
  created_by INTEGER, created_at TEXT
);
CREATE TABLE IF NOT EXISTS startup_leads (
  id INTEGER PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  society_id INTEGER,
  name TEXT NOT NULL,
  contact TEXT,
  idea TEXT,
  stage TEXT DEFAULT 'identified',       -- identified | interested | screened | ready | converted | dropped
  notes TEXT,
  created_at TEXT, updated_at TEXT
);

-- ---------------- KPIs ----------------
CREATE TABLE IF NOT EXISTS kpi_definitions (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  unit TEXT DEFAULT 'count',             -- count | percent | number
  target REAL,
  source TEXT DEFAULT 'manual',          -- auto | manual
  icon TEXT,
  weight REAL DEFAULT 1,
  sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS kpi_entries (
  id INTEGER PRIMARY KEY,
  society_id INTEGER NOT NULL,
  academic_year TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  value REAL NOT NULL,
  note TEXT,
  entered_by INTEGER,
  created_at TEXT
);

-- ---------------- Notifications & immutable audit ----------------
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type TEXT, icon TEXT,
  title TEXT NOT NULL, body TEXT, link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_notif_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  actor_name TEXT,
  entity_type TEXT,
  entity_id INTEGER,
  action TEXT,
  detail TEXT,
  created_at TEXT,
  prev_hash TEXT,
  hash TEXT
);
-- Append-only: every row is hash-chained to the previous one and cannot be edited or deleted.
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
