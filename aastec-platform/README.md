# AASTEC Digital Platform

**AASTEC | Rally Society — Innovation through Collaboration**
*Ecosystem · Community · Governance · Learning · AI*

The AASTEC Digital Platform is the integrated system of the AAST Entrepreneurship Center (AASTEC). It brings every Rally Society chapter, at AAST campuses and partner universities, onto one platform for supervised student governance, community, a shared calendar, elections, learning with AI support, incubation and programme management.

The platform follows the *AASTEC Digital Platform – Full Project Report* and the Rally Society Handbook (v2.0). It runs as its own application inside this repository and does not share code, data or deployment with the café POS in the repository root.

---

## Modules

| Module | What it covers |
| --- | --- |
| **Governance & RBAC** | 14 roles from Executive Director to Member, a capability matrix the administrator can edit, and President-granted authorisations (official posting, event support, committee access, calendar support, moderation, report submission). Includes the VP delegation switch, Society hierarchy and committees, monthly reports, escalations and the Faculty Advisor supervision panel. |
| **Approvals inbox** | One queue per user for membership requests, authorisation requests, official posts, reports, event proposals, Advisor reviews, elections, candidates, incubator applications and mentor verification. |
| **Community** | Feed, stories and groups. Personal posts are checked automatically by the policy and risk engine. Official Society or AASTEC posts go through an approval chain: Committee Head → President → Faculty Advisor (sensitive or external) → AASTEC (national). Also covers reactions, comments, polls, saved posts, reporting, the moderation console, direct messages and blocking. |
| **Shared calendar** | Society, AASTEC-wide, training, incubator info-session and mentoring events, plus election milestones and report deadlines. Members can submit event proposals, and Advisor review is required for external or high-budget events. RSVP, QR check-in, member pass codes, attendance and event close-out are included. |
| **Elections** | Configured by the Programme Manager, approved by the Faculty Advisor and limited to the **July–August window**. The cycle runs through nominations, candidate review, an **anonymous ballot** (ballots are stored apart from voter identity), results publication and a handover checklist. When handover completes, roles and grants are reset. A pilot (sandbox) mode allows training rehearsals that never change roles. |
| **Learning & AI** | Course catalogue, lessons, quizzes and learning paths. Certificates come with public QR verification (`/verify/<code>`) and an "Add to LinkedIn" link. Also includes the AI Learning Coach (skills radar, gap insights, action plan, chat), AI course copilot, quiz generator, pitch review, report drafting and handbook Q&A. |
| **Incubator & programmes** | Programmes and cohorts, the scouting funnel for Incubator Agents, applications and reviews, ventures with milestones and a traction score, mentor registration and verification, mentor matching and sessions. |
| **KPI & insights** | 18 KPIs, either computed automatically from platform activity or reported with evidence notes. The Rallians Score, trend charts, compliance matrix, Society ranking, CSV and PDF export, and role-specific dashboards. |
| **Audit** | Append-only audit log. Each entry is SHA-256 hash-chained to the one before it, and database triggers block edits and deletes. Integrity can be verified from the Audit Log screen. |

## Brand identity

| Token | Colour | Usage |
| --- | --- | --- |
| Primary (navy) | `#102D5A` | Header and main navigation, primary buttons, headings |
| Accent (gold) | `#F2B91E` | Accent buttons and highlights. Text placed on gold is always navy. |
| Tech (blue) | `#247BC1` | Links, technology and AI icons |
| Surface | `#F3F6FB` | Secondary sections (the main background is `#FFFFFF`) |
| Secondary text | `#64748B` | |
| Borders and dividers | `#D9E1EC` | |

The AASTEC emblem and wordmark appear throughout the interface. Typography is Montserrat for display text and Inter for UI text. A dark theme is also available.

## Running locally

Requirements: **Node.js 22.13 or later**. The platform uses the built-in `node:sqlite`, so no database server is needed.

```bash
cd aastec-platform
npm install
npm start            # http://localhost:4800
```

On first start the database is created and seeded with a realistic demo network: 53 institutions, 30 active Rally Societies, about 580 members, events, posts, courses, ventures, elections and KPI history. To rebuild it from scratch, run `npm run reset`.

### Demo accounts

All demo accounts use the password **`Demo@2026`**. The sign-in page lists them while demo mode is on.

| Role | Email |
| --- | --- |
| Executive Director | director@aastec.demo |
| Programme Manager (Rally Societies) | pm@aastec.demo |
| Incubator Programme Manager | incubator@aastec.demo |
| AASTEC Staff | staff@aastec.demo |
| Society President (AAST Miami) | president@miami.rally.demo |
| Vice President | vp@miami.rally.demo |
| Committee Head | committee@miami.rally.demo |
| Faculty Advisor | advisor@miami.rally.demo |
| Member | member@miami.rally.demo |
| Incubator Agent | agent@miami.rally.demo |
| Founder | founder@miami.rally.demo |
| Mentor / Trainer | mentor@aastec.demo |
| Platform Administrator | admin@aastec.demo |

### Checks

```bash
npm run smoke        # 400+ API and workflow checks against a running server (BASE=http://localhost:4800)
```

The smoke test signs in as every role. It exercises the posting workflow, risk flagging, authorisations, membership, event proposals, voting (including double-vote rejection), election rules, learning and certificates, AI tools, KPI entries, audit-chain verification and RBAC denials. It changes data, so run `npm run reset` afterwards.

## Configuration

Copy `.env.example` and set the variables in your hosting environment:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4800` | HTTP port |
| `DB_PATH` | `db/aastec.db` | SQLite database file. Put it on a persistent disk in production. |
| `UPLOAD_DIR` | `./uploads` | Folder for uploaded images (avatars, post photos) |
| `SEED_DEMO` | `1` | Set to `0` for a clean production install with no demo data. Demo mode and pilot elections start switched off. |
| `ADMIN_EMAIL` | `admin@aastec.demo` | First administrator account |
| `ADMIN_PASSWORD` | *(random)* | Password for that account. If it is not set on a production install, a one-time password is printed to the server log. |
| `ANTHROPIC_API_KEY` | — | Turns on Claude for the AI features |
| `AI_MODEL` | `claude-opus-5-5` | Claude model used by the AI features |

### AI features

AI features call Claude through the official Anthropic SDK (`@anthropic-ai/sdk`) with server-side model fallbacks enabled. Every call is recorded in `ai_logs`. Without `ANTHROPIC_API_KEY`, or if the API is unreachable, the platform switches to a transparent **offline assistant** that builds rule-based answers from platform data, so every feature keeps working. The interface shows which mode is active.

## Production checklist

1. Deploy with `SEED_DEMO=0`, `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD`, and put `DB_PATH` and `UPLOAD_DIR` on a persistent disk.
2. Sign in as the administrator. Add universities and their Rally Societies (**Societies & Universities → Add university**), then create AASTEC staff, Faculty Advisor and Society President accounts under **Users & Roles**.
3. Open each Society and use **Manage chapter** to set its status to *Active* and assign its Faculty Advisor.
4. Under **Settings**, check the election window, the risk threshold, report due day and KPI targets. Make sure **Demo mode** and **Pilot mode** are off. They are on in the demo build.
5. Set `ANTHROPIC_API_KEY` to turn on the AI features.

### Render

`render.yaml` in this folder is a Render Blueprint for the platform. It uses `rootDir: aastec-platform` and a persistent disk for the database and uploads. Select it as the blueprint file when you create the service on Render. It is separate from the café POS blueprint in the repository root.

## Project structure

```
aastec-platform/
├── server.js              Express app: security headers, API, static portal
├── db/
│   ├── schema.sql         60 tables, indexes and audit-log immutability triggers
│   ├── database.js        node:sqlite access helpers
│   ├── content.js         Handbook, roles, KPIs, courses, institutions, templates
│   └── seed.js            Base and demo data (deterministic, relative to today)
├── lib/                   RBAC and core rules, KPI engine, AI services, stats, approvals
├── routes/                public, core, society, community, events, elections, learning, incubator, insights
├── scripts/               icon sprite builder, smoke test
└── public/
    ├── index.html         Public landing page
    ├── portal.html        Single-page portal (hash routing)
    ├── verify.html        Public certificate verification
    ├── css/app.css        Design system (light and dark)
    ├── js/                core helpers, shell (navigation, search, notifications), views/*
    ├── img/               AASTEC emblem, logo, banner, Lucide icon sprite
    └── vendor/            Chart.js, qrcode-generator
```

## Licences

Icons are from [Lucide](https://lucide.dev) (ISC licence). Charts use [Chart.js](https://www.chartjs.org) (MIT licence). QR codes use [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT licence). The AASTEC and AAST names, emblem and Rally Society identity belong to the Arab Academy for Science, Technology & Maritime Transport.
