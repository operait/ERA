# ERA Co-Development Specifications

**Version:** 1.0
**Created:** 2025-10-24
**Purpose:** Comprehensive specification documents for ERA's co-development environment supporting parallel prompt tuning (Meg) and feature development (Barry).

---

## 📋 Overview

This directory contains **spec-driven development** documentation for building ERA's co-development infrastructure. These specifications define the requirements, architecture, and implementation details for all features **before** any code is written.

### Development Approach: Spec → Test → Code

1. **Specifications** (this directory) - Define what to build
2. **Tests** (to be written) - Define how to verify it works
3. **Implementation** (to be written) - Build it based on specs and tests

---

## 📚 Specification Documents

### 1. [Meg's Feedback Workflow](./MEG_FEEDBACK_WORKFLOW.md)
**Owner:** Meg
**Purpose:** Allow Meg to test ERA in Teams, provide feedback, and optimize the master prompt.

**Key Features:**
- `!improve` command to attach feedback to ERA responses
- `!print` command to export testing sessions as CSV
- Database tables to track sessions, turns, and improvements
- Integration with Claude Web Code for prompt optimization

**Dependencies:**
- Database Schema (spec #3)
- Prompt Optimizer (spec #5)

**Status:** ⏳ Awaiting approval

---

### 2. [Terminal Test Harness](./TEST_HARNESS.md)
**Owner:** Barry
**Purpose:** Enable local testing of ERA features without Microsoft Teams.

**Key Features:**
- Interactive conversation testing from terminal
- Email workflow testing with mock/real Graph API
- Calendar booking testing with mock/real availability
- RAG retrieval debugging tools
- Conversation logging and replay

**Dependencies:**
- None (standalone utilities)

**Status:** ⏳ Awaiting approval

---

### 3. [Database Schema](./DATABASE_SCHEMA.md)
**Technical Spec**
**Purpose:** Define database tables for prompt tuning workflow.

**Key Tables:**
- `prompt_tuning_sessions` - Track Meg's testing sessions
- `tuning_conversation_turns` - Store each conversation turn
- `tuning_improvements` - Store Meg's feedback notes

**Migration File:** `supabase/migrations/003_prompt_tuning_tables.sql`

**Dependencies:**
- Existing migrations (001, 002)

**Status:** ⏳ Awaiting approval

---

### 4. [Metrics Framework](./METRICS_FRAMEWORK.md)
**Technical Spec**
**Purpose:** Define objective and subjective metrics for evaluating ERA response quality.

**Key Metrics:**
- **Objective:** Policy citation, clarifying questions, sequential actions, etc.
- **Subjective:** Professionalism, empathy, clarity (scored by Meg)
- **Composite:** Overall quality score

**Integration Points:**
- Conversation turns (automatic scoring)
- CSV export (include metrics)
- DSPy optimization (future)

**Dependencies:**
- Database Schema (stores metrics)

**Status:** ⏳ Awaiting approval

---

### 5. [Prompt Optimizer Script](./PROMPT_OPTIMIZER.md)
**Owner:** Meg (via Claude Web Code)
**Purpose:** Automatically optimize MASTER_PROMPT.md based on testing feedback.

**Key Features:**
- `/optimize` slash command in Claude Web Code (simple UX)
- Parse CSV export from `!print` command
- Identify improvement patterns (frequency + semantic similarity)
- Use Claude to generate specific prompt changes
- Update MASTER_PROMPT.md with version bump and changelog
- Claude Web Code creates GitHub PR automatically

**Script Location:** `scripts/optimize-prompt.ts`
**Slash Command:** `.claude/commands/optimize.md`

**Dependencies:**
- Meg's Feedback Workflow (provides CSV data)
- Anthropic API (for LLM analysis)
- Claude Web Code GitHub integration (for PR creation)

**Status:** ⏳ Awaiting approval

---

### 6. [Branching Strategy](./BRANCHING_STRATEGY.md)
**Process Spec**
**Purpose:** Define git workflow for parallel development.

**Key Branches:**
- `main` - Production-ready code
- `prompt-tuning` - Meg's testing environment (deployed to Render → Teams)
- `features` - Barry's development branch (local only)

**Merge Workflows:**
- Meg: Tunes prompt on `prompt-tuning`, merges to `main` when stable
- Barry: Develops on `features`, merges to `prompt-tuning` for testing, then to `main`

**Dependencies:**
- None (process documentation)

**Status:** ⏳ Awaiting approval

---

## 🎯 Success Criteria

This co-development setup is successful if:

✅ **Meg can:**
- Test ERA in Teams without Barry blocking her
- Provide feedback inline during testing (`!improve`)
- Export testing data easily (`!print`)
- Optimize the master prompt using Claude Web Code
- Push changes and see them deployed automatically

✅ **Barry can:**
- Develop features locally without Teams
- Test conversation flows from terminal
- Test email/calendar workflows without deployment
- Debug RAG retrieval in isolation
- Merge features to Meg's branch for Teams testing

✅ **Both can:**
- Work in parallel without conflicts
- Merge branches smoothly
- See each other's changes without manual syncing
- Deploy to Render without downtime

---

## 📊 Implementation Roadmap

### Phase 1: Foundation (Week 1)
**Goal:** Set up database and basic testing infrastructure

| Task | Spec | Owner | Estimated Time |
|------|------|-------|----------------|
| Run database migration (003) | [Database Schema](./DATABASE_SCHEMA.md) | Barry | 1 hour |
| Create test harness (conversation) | [Test Harness](./TEST_HARNESS.md) | Barry | 4 hours |
| Test local conversation flow | [Test Harness](./TEST_HARNESS.md) | Barry | 1 hour |
| Set up branch structure | [Branching Strategy](./BRANCHING_STRATEGY.md) | Barry | 30 min |

**Deliverables:**
- ✅ Database tables exist
- ✅ Barry can test ERA locally
- ✅ Branches are set up correctly

---

### Phase 2: Meg's Feedback Workflow (Week 2)
**Goal:** Enable Meg to provide feedback and export data

| Task | Spec | Owner | Estimated Time |
|------|------|-------|----------------|
| Implement `!improve` command | [Meg's Feedback Workflow](./MEG_FEEDBACK_WORKFLOW.md) | Barry | 3 hours |
| Implement `!print` command | [Meg's Feedback Workflow](./MEG_FEEDBACK_WORKFLOW.md) | Barry | 3 hours |
| Extend `!reset` for sessions | [Meg's Feedback Workflow](./MEG_FEEDBACK_WORKFLOW.md) | Barry | 1 hour |
| Test feedback workflow in Teams | [Meg's Feedback Workflow](./MEG_FEEDBACK_WORKFLOW.md) | Meg | 1 hour |

**Deliverables:**
- ✅ Meg can use `!improve` and `!print` in Teams
- ✅ CSV export works correctly
- ✅ Sessions are tracked in database

---

### Phase 3: Metrics Framework (Week 2-3)
**Goal:** Enable objective and subjective scoring

| Task | Spec | Owner | Estimated Time |
|------|------|-------|----------------|
| Build metrics evaluator module | [Metrics Framework](./METRICS_FRAMEWORK.md) | Barry | 4 hours |
| Add metrics to conversation turns | [Metrics Framework](./METRICS_FRAMEWORK.md) | Barry | 2 hours |
| Implement `!score` command (optional) | [Metrics Framework](./METRICS_FRAMEWORK.md) | Barry | 2 hours |
| Test metrics calculation | [Metrics Framework](./METRICS_FRAMEWORK.md) | Barry | 1 hour |

**Deliverables:**
- ✅ Objective metrics calculated automatically
- ✅ Meg can add subjective scores (optional)
- ✅ Metrics included in CSV export

---

### Phase 4: Prompt Optimizer (Week 3)
**Goal:** Enable automated prompt optimization

| Task | Spec | Owner | Estimated Time |
|------|------|-------|----------------|
| Build prompt optimizer script | [Prompt Optimizer](./PROMPT_OPTIMIZER.md) | Barry | 6 hours |
| Test CSV parsing | [Prompt Optimizer](./PROMPT_OPTIMIZER.md) | Barry | 1 hour |
| Test pattern detection | [Prompt Optimizer](./PROMPT_OPTIMIZER.md) | Barry | 2 hours |
| Test Claude integration | [Prompt Optimizer](./PROMPT_OPTIMIZER.md) | Barry | 2 hours |
| Run end-to-end optimization | [Prompt Optimizer](./PROMPT_OPTIMIZER.md) | Meg | 1 hour |

**Deliverables:**
- ✅ Meg can run optimizer in Claude Web Code
- ✅ MASTER_PROMPT.md is updated automatically
- ✅ Version and changelog are managed correctly

---

### Phase 5: Full Test Harness (Week 4)
**Goal:** Complete local testing infrastructure

| Task | Spec | Owner | Estimated Time |
|------|------|-------|----------------|
| Build email test harness | [Test Harness](./TEST_HARNESS.md) | Barry | 4 hours |
| Build calendar test harness | [Test Harness](./TEST_HARNESS.md) | Barry | 4 hours |
| Build RAG test harness | [Test Harness](./TEST_HARNESS.md) | Barry | 3 hours |
| Create test scenarios | [Test Harness](./TEST_HARNESS.md) | Barry | 2 hours |
| Test all harness utilities | [Test Harness](./TEST_HARNESS.md) | Barry | 2 hours |

**Deliverables:**
- ✅ Barry can test all ERA features locally
- ✅ Email and calendar workflows work with mock data
- ✅ RAG debugging is easy

---

## 🔗 Dependencies Between Specs

```
Branching Strategy (foundational)
  └── Defines how all other work is organized

Database Schema
  └── Required by: Meg's Feedback Workflow, Metrics Framework

Meg's Feedback Workflow
  └── Required by: Prompt Optimizer (provides CSV data)
  └── Requires: Database Schema

Metrics Framework
  └── Requires: Database Schema
  └── Enhances: Meg's Feedback Workflow (adds metrics to CSV)

Prompt Optimizer
  └── Requires: Meg's Feedback Workflow (CSV export)

Test Harness
  └── Independent (can be built in parallel)
```

---

## 💻 Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Database | Supabase (PostgreSQL) | Store sessions, turns, improvements, metrics |
| LLM | Anthropic Claude Sonnet 4.5 | Generate ERA responses, optimize prompts |
| Embeddings | OpenAI text-embedding-3-small | RAG similarity search |
| Bot Framework | Microsoft Bot Framework | Teams integration |
| Calendar/Email | Microsoft Graph API | Outlook integration |
| Testing | Jest + Custom Harness | Unit tests + terminal testing |
| Language | TypeScript + Node.js | All code |
| Deployment | Render | Auto-deploy from `prompt-tuning` branch |
| Version Control | Git + GitHub | Branch management |

---

## 📁 File Structure (After Implementation)

```
ERA/
├── specs/                          # ← YOU ARE HERE
│   ├── README.md                   # This file
│   ├── MEG_FEEDBACK_WORKFLOW.md
│   ├── TEST_HARNESS.md
│   ├── DATABASE_SCHEMA.md
│   ├── METRICS_FRAMEWORK.md
│   ├── PROMPT_OPTIMIZER.md
│   └── BRANCHING_STRATEGY.md
│
├── .claude/
│   └── commands/
│       └── optimize.md             # ← NEW: /optimize command for Meg
│
├── src/
│   ├── bot/
│   │   ├── app.ts                  # ← Add !improve, !print, session mgmt
│   │   └── handlers/
│   │       ├── prompt-tuning.ts    # ← NEW: Handle prompt tuning commands
│   │       ├── email-handler.ts
│   │       └── calendar-handler.ts
│   │
│   ├── metrics/                    # ← NEW: Metrics evaluation
│   │   ├── evaluator.ts
│   │   └── __tests__/
│   │       └── evaluator.test.ts
│   │
│   ├── test/                       # ← NEW: Terminal test harness
│   │   ├── harness/
│   │   │   ├── conversation.ts
│   │   │   ├── email.ts
│   │   │   ├── calendar.ts
│   │   │   └── rag.ts
│   │   ├── mocks/
│   │   │   ├── teams-context.ts
│   │   │   ├── graph-client.ts
│   │   │   └── conversation-state.ts
│   │   └── fixtures/
│   │       ├── scenarios.json
│   │       └── mock-availability.json
│   │
│   └── lib/
│       └── supabase.ts             # ← Update with new table types
│
├── scripts/
│   └── optimize-prompt.ts          # ← NEW: Prompt optimizer for Claude Web Code
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_email_calendar_tables.sql
│       └── 003_prompt_tuning_tables.sql  # ← NEW
│
├── MASTER_PROMPT.md                # ← Meg optimizes this
├── package.json                    # ← Add new npm scripts
└── README.md
```

---

## 🚀 Getting Started

### For Barry (Feature Development)

1. **Review all specs** in this directory
2. **Ask questions** or request changes to specs
3. **Once approved**, write tests based on specs
4. **Then** implement features according to specs and tests

### For Meg (Prompt Tuning)

1. **Review** [Meg's Feedback Workflow](./MEG_FEEDBACK_WORKFLOW.md)
2. **Understand** the commands you'll use (`!improve`, `!print`)
3. **Once Barry implements**, start testing in Teams
4. **Provide feedback** on the workflow itself if needed

---

## ❓ FAQ

**Q: Can we modify these specs after approval?**
A: Yes, specs are living documents. If requirements change, update the spec, then update tests and code.

**Q: Do we need to implement everything in Phase 1-5?**
A: No, phases are guidelines. Prioritize what's most valuable. For MVP, focus on Phases 1-2.

**Q: What if we disagree on a spec?**
A: Discuss and revise before writing code. Better to catch issues in specs than in code.

**Q: Can we implement features not in the specs?**
A: Yes, but write a spec first (even a small one). Spec-driven keeps everyone aligned.

**Q: What if a spec is too detailed?**
A: That's okay! Detailed specs reduce ambiguity and speed up implementation.

**Q: Should Meg read the technical specs?**
A: Optional. Meg should read specs #1 (her workflow) and #6 (branching). The rest are for Barry.

---

## ✅ Approval Process

### Step 1: Review
Barry and Meg review all specs in this directory.

### Step 2: Feedback
Provide feedback, ask questions, request changes.

### Step 3: Revise
Barry updates specs based on feedback.

### Step 4: Approve
Once both approve, Barry proceeds to write tests and code.

---

## 📞 Next Steps

**Barry:**
- ✅ Wait for Meg to review specs
- ✅ Answer questions and make revisions
- ✅ Once approved, write unit tests
- ✅ Then implement features

**Meg:**
- ✅ Review [Meg's Feedback Workflow](./MEG_FEEDBACK_WORKFLOW.md)
- ✅ Review [Branching Strategy](./BRANCHING_STRATEGY.md)
- ✅ Ask questions if anything is unclear
- ✅ Approve or request changes

---

## 📝 Changelog

**v1.0 (2025-10-24):**
- Initial specification documents created
- Covers: Feedback workflow, test harness, database, metrics, optimizer, branching
- Awaiting approval before implementation

---

**Questions?** Contact Barry or Meg.

**Ready to build?** Start with tests! 🧪
