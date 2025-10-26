# ERA Co-Development Branching Strategy

**Version:** 1.0
**Purpose:** Define the branching workflow for parallel development between Barry (features) and Meg (prompt tuning).

---

## Overview

ERA has two primary development tracks that run in parallel:
1. **Prompt Tuning** (Meg) - Optimizing MASTER_PROMPT.md on `prompt-tuning` branch
2. **Feature Development** (Barry) - Building new features on `features` branch

This document defines how these branches work together without blocking each other.

---

## Branch Structure

```
main (production-ready code)
├── prompt-tuning (Meg's testing/tuning branch)
│   └── Deployed to Render → Microsoft Teams
│
└── features (Barry's development branch)
    └── Local development only (no deployment)
```

---

## Branch Responsibilities

### `main` Branch

**Owner:** Both (requires approval from both Barry and Meg)

**Purpose:** Production-ready, stable code

**Rules:**
- ✅ Only merge from `prompt-tuning` when Meg confirms the prompt is tuned and tested
- ✅ Only merge from `features` when Barry confirms features are complete and tested
- ❌ Never commit directly to `main`
- ❌ Never merge untested code

**Merge Frequency:** Weekly or when major milestone is reached

---

### `prompt-tuning` Branch

**Owner:** Meg

**Purpose:** Live testing environment for prompt tuning

**Deployed To:** Render → Microsoft Teams (ERA bot)

**Key Files Modified:**
- `MASTER_PROMPT.md` (primary focus)
- Occasionally: `src/templates/generator.ts` (if prompt loading logic needs adjustment)

**Rules:**
- ✅ Meg can push to this branch anytime using Claude Web Code
- ✅ Render auto-deploys every push
- ✅ Meg tests in Teams after each deployment
- ✅ Meg uses `!improve` and `!print` commands to collect feedback
- ✅ Meg uses prompt optimizer script to update MASTER_PROMPT.md
- ❌ Meg does NOT merge code changes from `features` (Barry does this)

**Workflow:**
1. Render deploys latest `prompt-tuning` code
2. Meg tests ERA in Teams
3. Meg uses `!improve` to add feedback
4. Meg uses `!print` to export CSV
5. Meg runs optimizer script in Claude Web Code
6. Meg pushes updated MASTER_PROMPT.md
7. Render auto-deploys
8. Repeat until prompt is optimized

**Merge Strategy:**
- Meg merges `prompt-tuning` → `main` when prompt is tuned and stable
- Barry periodically merges `main` → `prompt-tuning` to bring in new features

---

### `features` Branch

**Owner:** Barry

**Purpose:** Feature development without disrupting Meg's testing

**Deployed To:** Local only (no Render deployment)

**Key Files Modified:**
- `src/` (all source code)
- Database migrations
- Tests
- Utilities and scripts

**Rules:**
- ✅ Barry develops all new features here
- ✅ Barry tests locally using terminal test harness
- ✅ Barry does NOT push to Render (only Meg's branch is deployed)
- ✅ Barry merges `main` → `features` regularly to stay up-to-date
- ❌ Barry does NOT modify MASTER_PROMPT.md on this branch (Meg owns it)

**Workflow:**
1. Barry creates new feature on `features` branch
2. Barry tests locally using test harness (`npm run test:conversation`, etc.)
3. Barry commits and pushes to `features` branch (GitHub only)
4. When feature is complete, Barry merges `features` → `prompt-tuning` for Meg to test in Teams
5. Meg tests the new feature in Teams
6. If good, Barry merges `features` → `main`

**Merge Strategy:**
- Barry merges `features` → `main` when feature is complete and tested
- Barry merges `main` → `features` daily to stay in sync

---

## Merge Workflows

### Workflow 1: Meg's Prompt Tuning (Frequent)

**Goal:** Update MASTER_PROMPT.md based on testing feedback

```
1. Meg tests on prompt-tuning branch in Teams
2. Meg collects feedback using !improve
3. Meg exports CSV using !print
4. Meg optimizes prompt using optimizer script in Claude Web Code
5. Meg commits updated MASTER_PROMPT.md to prompt-tuning branch
6. Render auto-deploys
7. Meg tests again
```

**No merge needed** - stays on `prompt-tuning` branch until stable.

---

### Workflow 2: Barry's Feature Development (Weekly)

**Goal:** Add new feature without disrupting Meg

```
1. Barry develops feature on features branch
2. Barry tests locally using test harness
3. Barry commits to features branch
4. When ready for Teams testing:

   Barry merges features → prompt-tuning:

   git checkout prompt-tuning
   git merge features
   git push origin prompt-tuning

5. Render auto-deploys prompt-tuning with new feature
6. Meg tests the new feature in Teams
7. If approved, Barry merges features → main:

   git checkout main
   git merge features
   git push origin main
```

---

### Workflow 3: Syncing Branches (Daily/Weekly)

**Goal:** Keep branches in sync to avoid conflicts

**Barry syncs `main` → `features` (daily):**
```bash
git checkout features
git merge main
git push origin features
```

**Barry syncs `main` → `prompt-tuning` (weekly or after feature merges):**
```bash
git checkout prompt-tuning
git merge main
git push origin prompt-tuning
```

**Why?** So Meg's prompt-tuning branch gets the latest features without her having to manually merge.

---

### Workflow 4: Stable Release (Monthly)

**Goal:** Release tested, stable version to `main`

```
1. Meg confirms prompt is tuned and stable on prompt-tuning
2. Barry confirms features are complete and tested on features
3. Barry merges features → main
4. Meg merges prompt-tuning → main (or Barry does it for her)
5. main branch now has both tuned prompt AND new features
6. Tag release: git tag v1.2.0
7. Deploy main to production (if separate from prompt-tuning)
```

---

## Conflict Resolution

### Conflict Scenario 1: MASTER_PROMPT.md

**Problem:** Both branches modified MASTER_PROMPT.md

**Resolution:**
- Meg's changes take priority (she owns the prompt)
- Barry manually merges prompt content from `prompt-tuning`
- If structural changes needed (e.g., new sections), Barry and Meg coordinate

**Prevention:**
- Barry does NOT edit MASTER_PROMPT.md on `features` branch
- All prompt changes go through Meg on `prompt-tuning` branch

---

### Conflict Scenario 2: Database Schema

**Problem:** Barry added new migration on `features`, conflicts with `prompt-tuning`

**Resolution:**
- Barry's migration wins (he owns database schema)
- Barry ensures migration is compatible with both branches
- Barry runs migration on `prompt-tuning` branch after merge

**Prevention:**
- Barry communicates schema changes to Meg before merging
- Use sequential migration numbers (003, 004, etc.)

---

### Conflict Scenario 3: Code Changes in Shared Files

**Problem:** Both modified `src/bot/app.ts`

**Resolution:**
- Merge carefully, preserving both changes
- Test locally before deploying to Render
- If uncertain, Barry and Meg review together

**Prevention:**
- Barry focuses on new files/modules when possible
- Meg does NOT edit code files (only MASTER_PROMPT.md)

---

## File Ownership

| File/Directory | Owner | Branch | Notes |
|----------------|-------|--------|-------|
| `MASTER_PROMPT.md` | Meg | `prompt-tuning` | Meg optimizes via Claude Web Code |
| `src/**/*.ts` | Barry | `features` | Barry develops features locally |
| `supabase/migrations/*.sql` | Barry | `features` | Barry manages schema changes |
| `specs/**/*.md` | Barry | `features` | Specification documents |
| `scripts/**/*.ts` | Barry | `features` | Utility scripts |
| `package.json` | Barry | `features` | Dependency management |
| `.env` | Both | Local only | Never commit to git |

---

## Communication Protocol

### When Meg Needs Barry

**Scenarios:**
- Meg finds a bug in the bot logic (not prompt-related)
- Meg wants a new feature (e.g., new `!command`)
- Meg can't push to GitHub (technical issue)

**How:**
- Slack/email Barry: "I found a bug where..."
- Barry fixes on `features` branch
- Barry merges to `prompt-tuning` so Meg can test

---

### When Barry Needs Meg

**Scenarios:**
- Barry added a new feature that needs prompt guidance
- Barry needs Meg to test something in Teams
- Barry wants to merge to `main` (needs Meg's approval)

**How:**
- Slack/email Meg: "I added X feature, can you test?"
- Barry merges `features` → `prompt-tuning`
- Meg tests in Teams and gives feedback

---

## GitHub Branch Protection

### Recommended Settings

**For `main` branch:**
- ✅ Require pull request reviews (1 approver)
- ✅ Require status checks to pass (tests, linting)
- ✅ Require branches to be up to date before merging

**For `prompt-tuning` branch:**
- ✅ Allow Meg to push directly, PR required for MASTER_PROMPT.md changes
- ⚠️ Allow Barry to push for feature merges
- ❌ Do not allow force pushes

**For `features` branch:**
- ✅ Barry can push freely
- ❌ No protection needed (Barry's playground)

---

## Deployment Strategy

### Current (MVP Phase)

**Deployed Environment:**
- `prompt-tuning` branch → Render → Microsoft Teams

**Not Deployed:**
- `features` branch (Barry tests locally)
- `main` branch (not yet deployed to production)

---

### Future (Post-MVP)

**Deployed Environments:**
- `main` branch → Production Render → Teams (stable release)
- `prompt-tuning` branch → Staging Render → Teams (Meg's testing)
- `features` branch → Local only (Barry's development)

**Workflow:**
1. Barry develops on `features`
2. Barry merges `features` → `prompt-tuning` (staging)
3. Meg tests on staging
4. When stable, merge `prompt-tuning` → `main` (production)

---

## Timeline

### Week 1-2: Parallel Development Begins
- Meg: Tests and tunes prompt on `prompt-tuning`
- Barry: Builds test harness and metrics framework on `features`

### Week 3-4: First Feature Merge
- Barry: Merges `features` → `prompt-tuning` (Meg tests in Teams)
- Meg: Continues prompt tuning with new features

### Week 5-8: Iterative Improvements
- Meg: Multiple prompt optimization cycles
- Barry: Adds new features (email, calendar, etc.)
- Sync branches weekly

### Week 9-10: Stable Release
- Meg: Final prompt tuning
- Barry: Final feature polish
- Merge both to `main` for v1.0 release

---

## FAQ

**Q: Can Meg merge `features` into `prompt-tuning` herself?**
A: No, Barry should do this to ensure no merge conflicts. Meg focuses only on MASTER_PROMPT.md.

**Q: What if Barry needs to test in Teams?**
A: Barry merges `features` → `prompt-tuning`, which auto-deploys to Render. Then Barry can test in Teams.

**Q: What if Render deployment fails?**
A: Barry checks Render logs, fixes the issue on `prompt-tuning` branch, and pushes a fix.

**Q: Can we both work on the same feature?**
A: Yes, but coordinate first. Barry handles code, Meg handles prompt guidance for that feature.

**Q: What if `prompt-tuning` gets too far ahead of `main`?**
A: Merge `prompt-tuning` → `main` when the prompt is stable. Don't let them diverge for more than 2-3 weeks.

**Q: Should we delete branches after merging?**
A: No, keep `prompt-tuning` and `features` as long-lived branches. Only delete feature branches if we create separate ones.

---

## Success Criteria

**This branching strategy is successful if:**
- ✅ Meg can tune prompts without Barry blocking her
- ✅ Barry can develop features without disrupting Meg's testing
- ✅ Both can push to their respective branches without conflicts
- ✅ Merges happen smoothly with minimal conflicts
- ✅ Render deployments are stable and predictable
- ✅ Both developers feel productive and unblocked

---

## Rollback Plan

**If a bad merge happens:**

```bash
# Rollback prompt-tuning to previous commit
git checkout prompt-tuning
git reset --hard <previous-commit-hash>
git push --force origin prompt-tuning

# Or revert a specific commit
git revert <bad-commit-hash>
git push origin prompt-tuning
```

**Render will auto-deploy the rollback.**

---

## Future: Voice Features (Month 2-3)

When adding voice/TTS features:

**Option:** Create a second Teams bot for Barry

```
main
├── prompt-tuning (Meg's bot)
│   └── Render App 1 → Teams Bot 1
│
└── features (Barry's bot - NEW)
    └── Render App 2 → Teams Bot 2
```

Barry can then test voice features independently on his own bot without affecting Meg.

See [main conversation] for details on setting up dual bot environments.
