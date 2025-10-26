# ERA Test Plan

**Version:** 1.0
**Purpose:** Define comprehensive testing strategy for co-development features.

---

## Overview

This document outlines all tests that will be written to verify the co-development features work as specified. Tests follow the **spec → test → code** approach.

---

## Test Organization

```
src/
├── bot/
│   └── handlers/
│       └── __tests__/
│           └── prompt-tuning.test.ts         # !improve, !print, session mgmt
│
├── metrics/
│   └── __tests__/
│       └── evaluator.test.ts                 # Objective metrics calculation
│
├── test/
│   ├── harness/
│   │   └── __tests__/
│   │       ├── conversation.test.ts          # Conversation harness
│   │       ├── email.test.ts                 # Email harness
│   │       ├── calendar.test.ts              # Calendar harness
│   │       └── rag.test.ts                   # RAG harness
│   └── mocks/
│       └── __tests__/
│           ├── teams-context.test.ts         # Mock Teams context
│           └── graph-client.test.ts          # Mock Graph client
│
└── scripts/
    └── __tests__/
        └── optimize-prompt.test.ts           # Prompt optimizer
```

---

## Test Categories

### 1. Unit Tests
Test individual functions and classes in isolation.

**Coverage:**
- Metrics evaluator functions
- CSV parsing logic
- Pattern detection algorithms
- Mock utilities

**Framework:** Jest

---

### 2. Integration Tests
Test how components work together.

**Coverage:**
- Bot command handlers with database
- Prompt optimizer with Claude API
- Test harness with real/mock Graph API

**Framework:** Jest

---

### 3. End-to-End Tests
Test complete workflows from user perspective.

**Coverage:**
- Meg's full feedback workflow (!improve → !print → /optimize)
- Barry's local testing workflow (conversation → email → calendar)

**Framework:** Jest + manual verification

---

## Test Suites

### Suite 1: Prompt Tuning Workflow Tests

**File:** `src/bot/handlers/__tests__/prompt-tuning.test.ts`

**Tests:**

#### `!improve` Command
- ✅ Attaches improvement to last ERA response
- ✅ Supports multiple improvements on same response
- ✅ Parses category from `category: note` format
- ✅ Stores improvement in database
- ✅ Returns error if no recent ERA response
- ✅ Handles edge cases (empty note, very long note)

#### `!print` Command
- ✅ Exports current session as CSV
- ✅ Includes all turns with improvements
- ✅ Formats CSV correctly (escapes quotes, newlines)
- ✅ Shows session metadata (ID, start time, total turns)
- ✅ Returns error if session is empty
- ✅ Handles turns with multiple improvements (duplicates row)

#### Session Management
- ✅ Creates new session on first message after deployment
- ✅ `!reset` ends current session and starts new one
- ✅ Session tracks total turns and improvements
- ✅ Session stores master prompt version (git commit hash)
- ✅ Multiple sessions can exist for same user

---

### Suite 2: Metrics Framework Tests

**File:** `src/metrics/__tests__/evaluator.test.ts`

**Tests:**

#### Objective Metrics
- ✅ `has_policy_citation` detects citations correctly
- ✅ `appropriate_action_suggested` detects actions
- ✅ `response_structure_complete` validates structure
- ✅ `citation_accuracy` measures accuracy (0-1)
- ✅ `asks_clarifying_questions` detects clarification (ACTIVE only)
- ✅ `sequential_action_correct` detects call+email conflict
- ✅ `response_length_appropriate` checks 100-500 word range
- ✅ `processing_time_acceptable` checks < 3000ms

#### Composite Scores
- ✅ `calculateObjectiveScore` averages objective metrics
- ✅ `calculateSubjectiveScore` averages subjective (1-5) / 5
- ✅ `calculateOverallScore` weights objective 40%, subjective 60%

#### Edge Cases
- ✅ Handles missing subjective scores (returns undefined)
- ✅ N/A metrics (null) don't affect averages
- ✅ Very short/long responses handled correctly

---

### Suite 3: Prompt Optimizer Tests

**File:** `scripts/__tests__/optimize-prompt.test.ts`

**Tests:**

#### CSV Parsing
- ✅ Parses valid CSV correctly
- ✅ Handles quoted fields with commas
- ✅ Handles newlines in quoted fields
- ✅ Handles escaped quotes (`""`)
- ✅ Returns error for malformed CSV

#### Pattern Detection
- ✅ Identifies frequent patterns (3+ occurrences)
- ✅ Groups similar improvements by category
- ✅ Detects semantic similarity patterns
- ✅ Ignores one-off improvements

#### Prompt Generation
- ✅ Increments version number correctly (v3.1.3 → v3.1.4)
- ✅ Adds changelog entry with summary
- ✅ Preserves YAML frontmatter
- ✅ Preserves all existing sections
- ✅ Applies changes to correct sections

#### Claude Integration
- ✅ Sends correct system prompt
- ✅ Includes current prompt in request
- ✅ Includes patterns in request
- ✅ Parses Claude's response correctly
- ✅ Handles API errors gracefully

---

### Suite 4: Test Harness Tests

**File:** `src/test/harness/__tests__/conversation.test.ts`

**Tests:**

#### Conversation Harness
- ✅ Starts interactive session
- ✅ Maintains conversation history
- ✅ Shows typing indicators
- ✅ Handles `!reset` command
- ✅ Handles `!sources` command
- ✅ Handles `!quit` command
- ✅ Saves conversation log to file
- ✅ Shows debug info when enabled

---

**File:** `src/test/harness/__tests__/email.test.ts`

**Tests:**

#### Email Harness
- ✅ Loads test scenario
- ✅ Generates email template
- ✅ Sends real email via Graph API
- ✅ Falls back to mock if credentials missing
- ✅ Saves email to file
- ✅ Shows email preview before sending

---

**File:** `src/test/harness/__tests__/calendar.test.ts`

**Tests:**

#### Calendar Harness
- ✅ Checks real availability via Graph API
- ✅ Shows available time slots
- ✅ Books real calendar event
- ✅ Falls back to mock if credentials missing
- ✅ Saves event to .ics file
- ✅ Shows event details before booking

---

**File:** `src/test/harness/__tests__/rag.test.ts`

**Tests:**

#### RAG Harness
- ✅ Performs semantic search
- ✅ Shows similarity scores
- ✅ Shows chunk details
- ✅ Filters by threshold
- ✅ Shows document metadata

---

### Suite 5: Mock Utilities Tests

**File:** `src/test/mocks/__tests__/teams-context.test.ts`

**Tests:**

#### Mock Teams Context
- ✅ Creates default mock context
- ✅ Allows custom user info
- ✅ Generates unique conversation IDs
- ✅ Matches real Teams context structure

---

**File:** `src/test/mocks/__tests__/graph-client.test.ts`

**Tests:**

#### Mock Graph Client
- ✅ Returns mock calendar availability
- ✅ Simulates email sending
- ✅ Simulates event booking
- ✅ Returns realistic mock data
- ✅ Logs actions without making real API calls

---

## Test Data & Fixtures

### Fixtures Directory Structure

```
src/test/fixtures/
├── scenarios.json              # Test scenarios (no-show, tardiness, etc.)
├── mock-availability.json      # Mock calendar time slots
├── sample-csv.csv             # Sample !print output
├── sample-improvements.json   # Sample improvement data
└── sample-prompts/
    ├── v3.1.3.md              # Sample prompt versions
    └── v3.1.4.md
```

### Sample Scenarios

**File:** `src/test/fixtures/scenarios.json`

```json
{
  "scenarios": [
    {
      "id": "no-show-3-days",
      "name": "Employee No-Show 3 Consecutive Days",
      "initialQuery": "My employee didn't show up for 3 days in a row",
      "expectedClarificationQuestions": [
        "Have you tried reaching out",
        "Were these consecutive"
      ],
      "followUps": [
        {
          "userMessage": "I tried calling once but they didn't answer",
          "expectedActions": ["call", "document"]
        }
      ]
    },
    {
      "id": "tardiness-issue",
      "name": "Repeated Tardiness",
      "initialQuery": "My employee has been late 5 times this month",
      "expectedClarificationQuestions": [
        "Have you talked to them",
        "How late"
      ],
      "followUps": [
        {
          "userMessage": "I haven't talked to them about it yet",
          "expectedActions": ["schedule", "document"]
        }
      ]
    }
  ]
}
```

---

## Database Test Setup

### Test Database Configuration

**Option 1: Use Supabase Test Instance**
- Create separate Supabase project for testing
- Run migrations on test instance
- Use different `.env.test` file

**Option 2: Use Local PostgreSQL**
- Run PostgreSQL in Docker for tests
- Reset database before each test suite
- Use `pg-mem` for in-memory testing

**Recommended:** Option 1 (Supabase test instance)

### Test Data Cleanup

```typescript
// Before each test suite
beforeAll(async () => {
  // Clear test data
  await supabase.from('prompt_tuning_sessions').delete().neq('id', '');
  await supabase.from('tuning_conversation_turns').delete().neq('id', '');
  await supabase.from('tuning_improvements').delete().neq('id', '');
});

// After each test
afterEach(async () => {
  // Clean up specific test data
});
```

---

## API Mocking Strategy

### Anthropic API (Claude)

**Mock responses:**
```typescript
jest.mock('@anthropic-ai/sdk');

const mockAnthropicCreate = jest.fn().mockResolvedValue({
  content: [{
    type: 'text',
    text: 'Got it — that\'s definitely something we need to address...'
  }]
});
```

### Microsoft Graph API

**Use real API when credentials available, otherwise mock:**
```typescript
const graphClient = process.env.MICROSOFT_GRAPH_CLIENT_ID
  ? new RealGraphClient()
  : new MockGraphClient();
```

### OpenAI API (Embeddings)

**Mock embeddings:**
```typescript
jest.mock('openai');

const mockCreateEmbedding = jest.fn().mockResolvedValue({
  data: [{
    embedding: new Array(1536).fill(0.5)
  }]
});
```

---

## Coverage Goals

**Minimum Coverage:**
- Overall: 80%
- Critical paths (prompt tuning workflow): 95%
- Utilities and helpers: 70%

**Run coverage:**
```bash
npm run test:coverage
```

---

## Continuous Integration

### GitHub Actions Workflow

**File:** `.github/workflows/test.yml`

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

---

## Test Execution

### Run All Tests
```bash
npm test
```

### Run Specific Suite
```bash
npm test prompt-tuning
npm test metrics
npm test optimizer
```

### Run with Coverage
```bash
npm run test:coverage
```

### Run in Watch Mode
```bash
npm test -- --watch
```

### Run Integration Tests Only
```bash
npm test -- --testPathPattern=integration
```

---

## Success Criteria

Tests are successful if:

✅ **All tests pass** (100% pass rate)
✅ **Coverage meets goals** (>80% overall, >95% critical paths)
✅ **No flaky tests** (tests pass consistently)
✅ **Tests run fast** (< 30 seconds for unit tests, < 2 minutes total)
✅ **Tests are readable** (clear test names, good documentation)
✅ **Edge cases covered** (error handling, boundary conditions)

---

## Next Steps

1. ✅ Create test fixtures
2. ✅ Write unit tests for each component
3. ✅ Write integration tests
4. ✅ Set up CI/CD pipeline
5. ✅ Run tests and verify coverage
6. ✅ Fix any failing tests
7. ✅ Proceed to implementation

---

## Open Questions

1. **Test database:** Should we use Supabase test instance or local PostgreSQL?
2. **Real API calls:** Should tests hit real Graph API if credentials available, or always mock?
3. **Test duration:** What's acceptable total test execution time?
4. **Flaky tests:** How do we handle tests that depend on external APIs?

Let me know your preferences and I'll proceed with writing the actual test files!
