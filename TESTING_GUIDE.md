# Testing Guide - ERA MVP

**Version:** 3.4.6
**Last Updated:** 2025-10-26

---

## Test Infrastructure Overview

ERA uses **Jest** for unit and integration testing with TypeScript support.

### Test Statistics
- **Total Tests:** 134
- **Test Suites:** 6
- **Coverage:** Core business logic (handlers, metrics, services)

---

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/bot/handlers/__tests__/context-aware-calendar.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run tests matching pattern
npm test -- --testNamePattern="clarification"
```

### CI/CD
Tests run automatically on every push and PR via GitHub Actions:
- `.github/workflows/ci.yml`
- Includes: typecheck → lint → test → build

---

## Test Organization

### Test Suites

```
src/
├── bot/handlers/__tests__/
│   ├── context-aware-calendar.test.ts  (30 tests) - Calendar detection
│   ├── context-aware-email.test.ts     (24 tests) - Email detection
│   └── prompt-tuning.test.ts           (17 tests) - Integration tests*
├── metrics/__tests__/
│   └── evaluator.test.ts               (36 tests) - Response quality metrics
├── services/__tests__/
│   └── calendar.test.ts                (14 tests) - Calendar service logic
└── templates/__tests__/
    └── clarification-protocol.test.ts   (13 tests) - ACTIVE/HYPOTHETICAL detection
```

*Integration tests require Supabase env vars; skip gracefully in CI if missing

---

## Test Categories

### 1. Context-Aware Detection Tests (54 tests)

**Files:**
- `context-aware-calendar.test.ts`
- `context-aware-email.test.ts`

**Purpose:** Verify the 5-step context-aware detection algorithm prevents premature action triggers

**Key Test Cases:**

#### State Guards
```typescript
test('should NOT trigger when response contains question marks', () => {
  const response = 'Got it. Have you tried calling them yet?';
  const result = handler.detectCalendarRecommendationWithContext(response, history, state);
  expect(result).toBe(false); // Clarifying, don't trigger
});
```

#### Clarification Detection
```typescript
test('should trigger when response offers action after clarification', () => {
  const response = 'Based on this, would you like me to schedule a call?';
  const history = [
    { role: 'user', content: 'My employee is absent' },
    { role: 'assistant', content: 'Have you tried calling?' },
    { role: 'user', content: 'Yes, no answer' }
  ];
  const result = handler.detectCalendarRecommendationWithContext(response, history, null);
  expect(result).toBe(true); // Context gathered, should trigger
});
```

#### Conversation Depth
```typescript
test('should NOT trigger on first response (insufficient depth)', () => {
  const history = [
    { role: 'user', content: 'My employee is absent' }
  ];
  const result = handler.detectCalendarRecommendationWithContext(response, history, null);
  expect(result).toBe(false); // Need >= 2 turns
});
```

**Run with:**
```bash
npm test -- context-aware
```

---

### 2. Prompt Tuning Integration Tests (17 tests)

**File:** `prompt-tuning.test.ts`

**Purpose:** Test Meg's feedback workflow (!improve, !print, !reset commands)

**Requirements:**
- Supabase env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Real database connection
- **Skipped in CI if env vars missing**

**Key Test Cases:**
- Session creation and management
- !improve command attaches feedback
- !print exports session as CSV
- !reset creates new session

**Run with:**
```bash
# With Supabase (local development)
npm test -- prompt-tuning

# Without Supabase (CI)
# Tests automatically skip
```

---

### 3. Clarification Protocol Tests (13 tests)

**File:** `clarification-protocol.test.ts`

**Purpose:** Verify MASTER_PROMPT.md ACTIVE vs HYPOTHETICAL detection

**Key Test Cases:**
- "My employee" → ACTIVE (ask clarifying questions)
- "An employee" → HYPOTHETICAL (provide full guidance)
- Sequential action workflow (call first, then email)

**Mocking:**
- Uses OpenAI mock (does NOT require API key)
- Tests prompt structure, not actual LLM behavior

**Run with:**
```bash
npm test -- clarification-protocol
```

---

### 4. Calendar Service Tests (14 tests)

**File:** `calendar.test.ts`

**Purpose:** Test calendar availability, timezone handling, event parsing

**Key Test Cases:**
- Find available time slots
- Respect working hours (9 AM - 5 PM)
- Handle multiple timezones (Chicago, Pacific)
- Parse Graph API calendar events
- Detect overlapping meetings

**Run with:**
```bash
npm test -- calendar
```

---

### 5. Metrics Evaluator Tests (36 tests)

**File:** `evaluator.test.ts`

**Purpose:** Test response quality metrics for prompt optimization

**Key Test Cases:**
- Citation accuracy (references policy docs)
- Structural quality (has sections, lists)
- Length appropriateness (not too short/long)
- Clarity (avoids jargon)
- Action orientation (provides next steps)

**Run with:**
```bash
npm test -- evaluator
```

---

## Writing New Tests

### Test File Template

```typescript
/**
 * [Feature Name] Tests
 *
 * Purpose: What does this test?
 * Dependencies: What's required to run?
 */

import { MyHandler } from '../my-handler';

describe('MyHandler', () => {
  let handler: MyHandler;

  beforeEach(() => {
    handler = new MyHandler();
  });

  describe('detectSomething', () => {
    test('should detect when condition is met', () => {
      // Arrange
      const input = 'test input';

      // Act
      const result = handler.detectSomething(input);

      // Assert
      expect(result).toBe(true);
    });

    test('should NOT detect when condition is not met', () => {
      const input = 'different input';
      const result = handler.detectSomething(input);
      expect(result).toBe(false);
    });
  });
});
```

### Best Practices

1. **Arrange-Act-Assert Pattern**
   ```typescript
   // Arrange - Set up test data
   const input = 'test';

   // Act - Execute the function
   const result = handler.process(input);

   // Assert - Verify the result
   expect(result).toBe('expected');
   ```

2. **Clear Test Names**
   ```typescript
   // ✅ Good: Describes behavior
   test('should trigger calendar when context is gathered', () => {});

   // ❌ Bad: Too vague
   test('calendar test 1', () => {});
   ```

3. **Test Edge Cases**
   ```typescript
   describe('Edge Cases', () => {
     test('handles empty input', () => {});
     test('handles very long input', () => {});
     test('handles special characters', () => {});
   });
   ```

4. **Mock External Dependencies**
   ```typescript
   jest.mock('../../lib/supabase', () => ({
     supabase: {
       from: jest.fn(() => ({
         select: jest.fn(() => Promise.resolve({ data: [], error: null }))
       }))
     }
   }));
   ```

---

## Mocking Strategies

### Mock Supabase
```typescript
// Skip tests if Supabase not available
const describeIfSupabase = process.env.SUPABASE_URL ? describe : describe.skip;

describeIfSupabase('Integration Tests', () => {
  // Tests that need real DB
});
```

### Mock OpenAI
```typescript
const mockOpenAICreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockOpenAICreate
      }
    }
  }));
});

// In test:
mockOpenAICreate.mockResolvedValue({
  choices: [{
    message: {
      content: 'Mocked response'
    }
  }]
});
```

### Mock Microsoft Graph
```typescript
jest.mock('../../lib/graph-client', () => ({
  getGraphClient: jest.fn(() => ({
    api: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({ value: [] }))
    }))
  }))
}));
```

---

## Debugging Failed Tests

### Common Issues

#### 1. "Missing Supabase environment variables"
**Cause:** Integration test trying to connect to DB
**Fix:** Set env vars or skip test
```bash
SUPABASE_URL="test" SUPABASE_SERVICE_ROLE_KEY="test" npm test
```

#### 2. "Cannot find module"
**Cause:** Import path incorrect or file not compiled
**Fix:** Check TypeScript compilation
```bash
npm run build
```

#### 3. "Timeout exceeded"
**Cause:** Async operation not awaited or mock not returning
**Fix:** Ensure all promises are awaited and mocks return resolved values

#### 4. "Expected true, received false"
**Cause:** Detection logic changed or test data outdated
**Fix:** Review detection algorithm and update test assertions

### Debug Tips

```typescript
// Add console.log to see what's happening
test('debug test', () => {
  const result = handler.detect(input);
  console.log('Input:', input);
  console.log('Result:', result);
  expect(result).toBe(true);
});

// Use .only to run single test
test.only('this one test', () => {
  // Only this test runs
});

// Skip specific test
test.skip('broken test', () => {
  // This test is skipped
});
```

---

## Test Coverage

### Viewing Coverage
```bash
npm test -- --coverage
```

### Coverage Goals
- **Statements:** > 80%
- **Branches:** > 75%
- **Functions:** > 80%
- **Lines:** > 80%

### Current Coverage Highlights
- ✅ Context-aware detection: 100% (all branches tested)
- ✅ Calendar service: 95%
- ⚠️  Bot app.ts: 60% (integration logic, harder to test)

---

## CI/CD Integration

### GitHub Actions Workflow

**File:** `.github/workflows/ci.yml`

**Steps:**
1. Checkout code
2. Setup Node.js 20.x
3. `npm ci` (clean install)
4. `npm run typecheck`
5. `npm run lint`
6. `npm test` (with Supabase secrets if available)
7. `npm run build`

**Environment Variables in CI:**
- `SUPABASE_URL`: Not set (integration tests skip)
- `SUPABASE_SERVICE_ROLE_KEY`: Not set (integration tests skip)

**Result:**
- ✅ 117/117 tests pass (17 skipped)
- ❌ Fails if any test fails or lint has errors

---

## Manual Testing

See **MANUAL_TESTING.md** for user-facing behavioral tests:
- Test scenarios with real Teams bot
- Verify context-aware detection in production
- Validate end-to-end workflows

---

## Adding New Tests for Context-Aware Detection

### Scenario: Add new clarification phrase

1. **Update detection logic:**
   ```typescript
   // src/bot/handlers/calendar-handler.ts
   const clarificationPhrases = [
     ...existing,
     'new phrase to detect'
   ];
   ```

2. **Add test case:**
   ```typescript
   // src/bot/handlers/__tests__/context-aware-calendar.test.ts
   test('should NOT trigger when response contains "new phrase"', () => {
     const response = 'Got it. New phrase to detect more info?';
     const history = [
       { role: 'user', content: 'Initial query' }
     ];
     const result = handler.detectCalendarRecommendationWithContext(
       response, history, null
     );
     expect(result).toBe(false);
   });
   ```

3. **Run test:**
   ```bash
   npm test -- context-aware-calendar
   ```

---

## Test Maintenance Checklist

- [ ] All tests pass locally before committing
- [ ] New features have corresponding tests
- [ ] Tests are readable and well-named
- [ ] Mocks are properly configured
- [ ] Edge cases are covered
- [ ] CI pipeline passes
- [ ] Integration tests skip gracefully without env vars

---

## Resources

- **Jest Documentation:** https://jestjs.io/docs/getting-started
- **Testing Best Practices:** https://github.com/goldbergyoni/javascript-testing-best-practices
- **Test Specifications:** `specs/` directory
- **Manual Testing Guide:** `MANUAL_TESTING.md`

---

**Questions?** Check the spec files in `specs/` or review existing test files for patterns.
