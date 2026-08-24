# Promptify

> **A production-grade Prompt Engineering Championship platform for high-intensity, multi-round AI competitions.**

Promptify is a configurable competition platform designed to run **5–6 hour, large-scale Prompt Engineering events** for B.Tech students across different academic years.

It combines a participant competition portal, comprehensive admin control center, AI/BYOK infrastructure, real-time monitoring, configurable rounds, server-authoritative scoring, evaluation pipelines, audit trails, and event recovery.

---

## ✨ What Promptify Provides

### 🧑‍💻 Participant Platform

Participants can:

- Register and authenticate
- Join their assigned team
- Complete coordinator verification
- Access rounds according to event rules
- Solve configurable challenges
- Use permitted AI providers through BYOK
- Test prompts before submission
- Manage attempts and hints
- Track progress
- Submit solutions
- Recover sessions after connection loss
- View scores and leaderboard information

### 🛠️ Admin Control Center

The admin dashboard is the **central command center for the entire event**.

Administrators can manage:

- Events
- Participants
- Teams
- Verification
- Devices and sessions
- Rounds
- Challenges
- Question banks
- AI configuration
- Evaluation
- Scoring
- Leaderboards
- Live monitoring
- Announcements
- Security/integrity
- Activity logs
- System health
- Backups
- Event snapshots
- Event restoration
- Exports
- Event archival

The objective is to operate the complete event **without modifying application code during the competition**.

---

# 🏆 Competition Architecture

Promptify is built around a generic competition engine rather than five hardcoded pages.

```text
Event
 │
 ├── Teams
 │    └── Participants
 │
 ├── Rounds
 │    └── Challenges
 │
 ├── Sessions
 │    └── Challenge Sessions
 │
 ├── Submissions
 │    └── Evaluations
 │
 ├── Score Events
 │    └── Final Scores
 │
 └── Audit / Recovery
```

This allows the same platform to support future competitions without rebuilding the application.

---

# 🎯 Round Engine

Promptify supports configurable round types such as:

```text
R1  QUIZ
R2  PROMPT
R3  ESCAPE_ROOM
R4  AI_BATTLE
R5  AI_GRANDMASTER
```

Rounds are **database-configured**.

The platform does not depend on hardcoded:

- Round names
- Durations
- Scores
- Attempts
- Challenges
- AI policies
- Evaluation rules
- Unlock conditions

Administrators can configure these through the dashboard.

---

# 🤖 AI & BYOK

AI-enabled rounds can support **Bring Your Own Key (BYOK)**.

The AI architecture is designed around an abstraction layer:

```text
Participant
     │
     ▼
AI Gateway
     │
     ├── Provider Adapter
     │      ├── OpenAI
     │      ├── Gemini
     │      ├── Anthropic
     │      └── Other providers
     │
     ▼
AI Response
```

AI configuration can be controlled per event, round, or challenge, including:

- AI enabled/disabled
- BYOK requirement
- Provider availability
- Model availability
- Request limits
- Token limits
- Tool access
- Web access
- File access

API keys must never be exposed through logs, URLs, public database records, or participant-visible administrative data.

---

# 🧠 Evaluation Engine

AI-generated solutions are not evaluated solely through an LLM.

The evaluation architecture supports:

```text
Submission
    │
    ▼
Schema Validation
    │
    ▼
Deterministic Tests
    │
    ▼
Hidden Tests
    │
    ▼
Security / Edge Cases
    │
    ▼
AI Evaluation
    │
    ▼
Score Aggregation
```

Long-running evaluations can be processed through an evaluation/job queue.

This allows failed evaluations to be retried without corrupting participant submissions.

---

# 📊 Scoring Engine

Scores are designed around an auditable score ledger rather than directly modifying a participant's total score.

Example:

```text
Base Score          +100
Speed Bonus           +5
Hint Penalty         -10
Attempt Penalty       -5
Quality Score         +20
--------------------------------
Final Score           110
```

Every adjustment can retain:

- Event
- Team
- Round
- Challenge
- Reason
- Source
- Administrator
- Timestamp

This makes score disputes and corrections traceable.

---

# ⏱️ Server-Authoritative Competition

Participant browsers are **not trusted as the source of competition truth**.

Critical values such as:

- Round deadlines
- Attempts
- Scores
- Unlock status
- Verification
- Submission validity
- Team status

are determined server-side.

For example:

```text
Round Start
     │
     ▼
Server Timestamp
     │
     +
Round Duration
     │
     ▼
Authoritative Deadline
```

The browser only displays the remaining time.

---

# 🔄 Session Recovery & Offline Support

Promptify is designed for unstable event environments.

Participant actions can be persisted locally and synchronized when connectivity returns.

```text
Participant Action
       │
       ▼
Local State
       │
       ▼
Sync Queue
       │
       ├── Online ──────► Server
       │
       └── Offline
             │
             ▼
        Wait for Network
             │
             ▼
           Sync
```

Important operations use idempotency mechanisms to prevent duplicate submissions or duplicate score events.

---

# 👥 Team Architecture

A competition team can contain multiple participants while maintaining a shared competition state.

```text
Team
 ├── Participant A
 └── Participant B
        │
        ▼
 Shared Competition Session
        │
        ├── Round Progress
        ├── Challenge State
        ├── Workspace
        ├── Attempts
        └── Submissions
```

Individual actions remain attributable to the participant who performed them.

---

# 🔐 Verification & Session Security

Competition access can follow:

```text
Participant Login
       │
       ▼
Verification Pending
       │
       ▼
Coordinator Review
       │
       ▼
Team + Participant + Device Verification
       │
       ▼
Approved Session
       │
       ▼
Competition Access
```

The verification action is server-authoritative.

---

# 🛡️ Integrity & Audit System

Promptify maintains detailed competition activity records.

Examples include:

```text
LOGIN
VERIFICATION
ROUND_START
CHALLENGE_START
ANSWER_SAVE
PROMPT_TEST
AI_REQUEST
HINT_USED
SUBMISSION
EVALUATION
SCORE_EVENT
TAB_SWITCH
FULLSCREEN_EXIT
DISCONNECT
RECONNECT
ADMIN_OVERRIDE
```

Each relevant action can be associated with:

```text
Event
Team
Participant
Session
Action
Timestamp
Metadata
```

This allows administrators to reconstruct what happened during an event.

---

# 🚨 Live Event Control

Administrators can manage an event while it is running.

Possible controls include:

- Pause event
- Resume event
- Extend round
- Lock round
- Unlock round
- Disable challenge
- Re-enable challenge
- Suspend team
- Resume team
- Force session recovery
- Retry evaluation
- Broadcast announcement

Sensitive operations require appropriate authorization and auditing.

---

# 💾 Event Snapshots & Recovery

Promptify is designed with event recovery in mind.

Snapshots can preserve:

- Event configuration
- Teams
- Participants
- Round configuration
- Challenge versions
- Question versions
- Scoring configuration
- Evaluation configuration
- Progress
- Submissions
- Scores
- Verification
- Sessions
- Audit information

Example:

```text
Pre-Event Snapshot
       ↓
Post-Round-1 Snapshot
       ↓
Post-Round-2 Snapshot
       ↓
Post-Round-3 Snapshot
```

Before restoring an older state, the current state should itself be preserved so the restoration can be reversed if necessary.

---

# 📦 Event Export & Archive

Completed events can be prepared for archival and reporting.

Possible exports include:

- Participants
- Teams
- Scores
- Submissions
- Activity logs
- Security events
- Evaluation results
- Event configuration

A complete event archive can contain structured JSON/CSV data without exposing sensitive credentials.

---

# 🧪 Test / Dry-Run Events

The platform can support test events using duplicated configuration:

```text
Production Event
      │
      ▼
Duplicate Configuration
      │
      ▼
Test Event
      │
      ├── Fake Teams
      ├── Fake Participants
      ├── Test Rounds
      ├── Test Submissions
      └── Test Evaluation
```

This allows the complete event workflow to be tested before the real competition.

---

# 🏗️ Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 |
| Build Tool | Vite 8 |
| Language | TypeScript 5.7 |
| Styling | Tailwind CSS v4 |
| Backend / DB | Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| Realtime | Supabase Realtime |
| Server Functions | Supabase Edge Functions where appropriate |
| Package Manager | pnpm |
| Development | Node.js 20 |
| Deployment | Vercel / compatible static hosting |

Long-running or resource-intensive evaluation workloads should be isolated from lightweight request handling where required.

---

# 📁 Project Structure

```text
Promptify/
│
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── admin/
│   │   ├── participant/
│   │   └── shared/
│   │
│   ├── pages/
│   │   ├── admin/
│   │   └── participant/
│   │
│   ├── lib/
│   │   ├── services/
│   │   ├── engines/
│   │   ├── ai/
│   │   ├── evaluation/
│   │   └── utils/
│   │
│   ├── stores/
│   ├── hooks/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── seed/
│
├── public/
│
├── vite.config.ts
├── package.json
├── .env.example
└── README.md
```

---

# 🔒 Security Principles

Promptify follows a **server-authoritative security model**.

Never trust the client for:

- Scores
- Attempts
- Rank
- Timers
- Unlock conditions
- Verification
- Team ownership
- Submission validity

Use:

- Supabase Auth
- PostgreSQL RLS
- Role-based access control
- Server-side validation
- Audit logs
- Idempotency
- Session controls
- Secure secret handling

Historical competition records should not be casually deleted.

---

# 📈 Scalability Target

The platform is intended for large college-level events with approximately **300–400 concurrent participants**, subject to proper load testing and infrastructure configuration.

Performance testing should include:

- Concurrent login
- Concurrent round starts
- High-frequency autosave
- Concurrent AI requests
- Submission spikes
- Evaluation queue spikes
- Leaderboard updates
- Realtime connections
- Reconnection storms

---

# ⚙️ Development Principles

### Database-driven

Competition data belongs in the database.

### Configuration-driven

Administrators configure the event instead of developers modifying code.

### Server-authoritative

The server decides competition truth.

### Auditable

Important actions should be traceable.

### Recoverable

Event state should be recoverable after failures.

### Modular

Competition, scoring, evaluation, AI, sessions, and administration remain separate systems.

### Reusable

A completed event should be clonable into a new event without rebuilding the application.

---

# 🚀 Getting Started

## Prerequisites

- Node.js 20.x
- pnpm 9.x
- Git
- Supabase CLI

Install dependencies:

```bash
pnpm install
```

---

## Environment

Create the environment file:

```bash
cp .env.example .env
```

Configure the required Supabase credentials.

Never commit secrets or participant API keys.

---

# 🗄️ Supabase Development

Start local Supabase:

```bash
supabase start
```

Apply migrations:

```bash
supabase db push
```

Reset the local database when required:

```bash
supabase db reset
```

---

# 💻 Development

Start the development server:

```bash
pnpm dev
```

The application runs on the configured Vite development port.

---

# 🏗️ Production Build

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

---

# 🧹 Code Quality

Format:

```bash
pnpm format
```

Lint:

```bash
pnpm lint
```

Before production deployment, verify:

```bash
pnpm build
pnpm lint
```

---

# 🧪 Production Readiness Checklist

## Authentication

- [ ] Participant authentication tested
- [ ] Admin RBAC tested
- [ ] Coordinator permissions tested

## Competition

- [ ] Team assignment tested
- [ ] Verification tested
- [ ] Device/session rules tested
- [ ] Round transitions tested
- [ ] Timer tested against server time

## Reliability

- [ ] Browser refresh tested
- [ ] Internet disconnect tested
- [ ] Reconnection tested
- [ ] Duplicate submission tested
- [ ] Offline synchronization tested

## AI

- [ ] BYOK tested
- [ ] Invalid API keys tested
- [ ] Rate limits tested
- [ ] Provider failures tested
- [ ] AI usage tracking tested

## Evaluation

- [ ] Deterministic tests tested
- [ ] Hidden tests protected
- [ ] Evaluation queue tested
- [ ] Failed evaluations recoverable
- [ ] Score calculation verified

## Administration

- [ ] Event lifecycle tested
- [ ] Live monitoring tested
- [ ] Emergency pause tested
- [ ] Team suspension tested
- [ ] Score correction tested
- [ ] Audit logs verified

## Recovery

- [ ] Event snapshot created
- [ ] Event export tested
- [ ] Restore tested
- [ ] Recovery rollback tested
- [ ] Final archive tested

## Load

- [ ] 300+ concurrent participants tested
- [ ] Concurrent submissions tested
- [ ] AI request spikes tested
- [ ] Evaluation queue tested
- [ ] Realtime connections tested

---

# 🗺️ Platform Development Roadmap

```text
Foundation
    ↓
Authentication + RLS
    ↓
Participants + Teams
    ↓
Event Management
    ↓
Competition Engine
    ↓
Round / Challenge Engine
    ↓
Submission Engine
    ↓
Scoring Engine
    ↓
AI Gateway + BYOK
    ↓
Evaluation Engine
    ↓
Live Admin Control
    ↓
Integrity + Audit
    ↓
Snapshots + Recovery
    ↓
Load + Security Testing
    ↓
Production Event
```

---

# 👥 Team

### Happeno Technologies

Promptify is developed as a technology platform for modern AI-powered competitive events.

### Developers

- **Shubham Gundu**
- **Sriram Naidu**
- **Goli Pranay Kumar**

---

# 📄 License

This project is licensed under the **MIT License**.

---

## Promptify

**Build once. Configure every event. Run with confidence.**
