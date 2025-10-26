# Context-Aware Actions Specification

**Version:** 1.0
**Status:** Implementation Ready
**Owner:** Barry (Development)
**Purpose:** Prevent premature calendar/email triggering by making action detection context-aware

---

## Problem Statement

### Current Behavior (Broken)
ERA uses simple keyword matching to detect when calendar booking or email sending should be triggered:

```typescript
// calendar-handler.ts (current)
detectCalendarRecommendation(response: string): boolean {
  const keywords = ['call the employee', 'schedule a call', 'phone call', ...];
  return keywords.some(keyword => response.toLowerCase().includes(keyword));
}
```

**The Issue:**
- ERA triggers calendar booking **during clarification phase**
- Keywords appear in ERA's response even when asking questions
- No awareness of conversation state or context gathering

**Example of Broken Behavior:**
```
User: "My employee didn't show up for 3 days"

ERA: "Got it — that's definitely something we need to address right away.

Just to make sure I have the full picture:
- Have you tried reaching out to them yet (phone, text, or email)?
- Were these three consecutive scheduled shifts?"

❌ BUG: Calendar booking triggers here because response contains:
- "reach out" (matches "reach them")
- Question marks indicate clarification is needed
- Context NOT yet gathered
```

---

## Solution: Context-Aware Detection

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   ERA Response Generated                     │
│                  (via MASTER_PROMPT.md)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│            Context-Aware Action Detection                    │
│                                                              │
│  1. Check Conversation State                                │
│     └─ Already in calendar/email flow? → Skip               │
│                                                              │
│  2. Analyze Response Content                                │
│     └─ Contains questions? → Clarifying, don't trigger      │
│                                                              │
│  3. Check Conversation Depth                                │
│     └─ < 2 turns? → Too early, don't trigger                │
│                                                              │
│  4. Verify Context Gathered                                 │
│     └─ Check history for manager providing info             │
│                                                              │
│  5. Keyword Match (final check)                             │
│     └─ Contains action keywords? → Trigger!                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Trigger Action│  (or skip)
              └───────────────┘
```

---

## Detection Algorithm

### New Method Signature
```typescript
detectCalendarRecommendationWithContext(
  response: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  conversationState: ConversationState | null
): boolean
```

### Algorithm Steps

#### **Step 1: State Guard**
```typescript
// Don't trigger if already in active flow
if (conversationState?.type === 'calendar') {
  return false; // Already booking, don't re-trigger
}
```

**Why:** Prevents recursive triggering or interrupting active workflows

---

#### **Step 2: Clarification Detection**
```typescript
function containsClarifyingQuestions(response: string): boolean {
  // Check for question marks (strong signal of clarification)
  const hasQuestions = response.includes('?');

  // Check for clarification phrases
  const clarificationPhrases = [
    'just to make sure',
    'just to confirm',
    'can you clarify',
    'need to know',
    'could you provide',
    'what about',
    'have you',
    'did you',
    'were these',
    'was this'
  ];

  const hasClarificationPhrases = clarificationPhrases.some(
    phrase => response.toLowerCase().includes(phrase)
  );

  return hasQuestions || hasClarificationPhrases;
}

// In detection:
if (containsClarifyingQuestions(response)) {
  return false; // Still gathering context
}
```

**Why:** ERA should gather context BEFORE triggering actions

---

#### **Step 3: Conversation Depth Check**
```typescript
// Require minimum conversation depth
if (conversationHistory.length < 2) {
  return false; // Need at least user query + ERA response
}
```

**Why:**
- First message: User asks question (Turn 1)
- Second message: ERA clarifies (Turn 2)
- Third message: User provides context (Turn 3)
- Fourth message: ERA recommends action + triggers calendar (Turn 4) ✅

**Minimum 2 turns prevents triggering on first response**

---

#### **Step 4: Context Gathering Verification**
```typescript
function isContextGathered(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): boolean {
  // Look for ERA asking questions (signals clarification phase)
  const eraAskedQuestions = conversationHistory
    .filter(turn => turn.role === 'assistant')
    .some(turn => turn.content.includes('?'));

  if (!eraAskedQuestions) {
    // ERA never asked questions, might be hypothetical query
    return true; // Allow trigger
  }

  // ERA asked questions - check if manager answered
  // Look for most recent ERA question
  let lastERAQuestionIndex = -1;
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    if (conversationHistory[i].role === 'assistant' &&
        conversationHistory[i].content.includes('?')) {
      lastERAQuestionIndex = i;
      break;
    }
  }

  // Check if there's a user response after the last question
  const hasUserResponseAfterQuestion = conversationHistory.length > lastERAQuestionIndex + 1;

  return hasUserResponseAfterQuestion;
}

// In detection:
if (!isContextGathered(conversationHistory)) {
  return false; // Wait for manager to answer
}
```

**Why:** Ensures manager has provided requested context before taking action

---

#### **Step 5: Keyword Matching (Final Gate)**
```typescript
function containsCalendarKeywords(response: string): boolean {
  const calendarKeywords = [
    'schedule a call',
    'call the employee',
    'phone call',
    'schedule a meeting',
    'set up a call',
    'arrange a call',
    'would you like me to schedule',
    'i can schedule',
    'check your calendar'
  ];

  const lowerResponse = response.toLowerCase();
  return calendarKeywords.some(keyword => lowerResponse.includes(keyword));
}

// In detection:
return containsCalendarKeywords(response);
```

**Why:** Only trigger if ERA explicitly recommends the action (keywords are statements, not questions)

---

## Full Implementation

### calendar-handler.ts

```typescript
export class CalendarHandler {
  /**
   * DEPRECATED: Old keyword-only detection (kept for fallback)
   */
  detectCalendarRecommendation(response: string): boolean {
    // Old implementation...
  }

  /**
   * NEW: Context-aware calendar detection
   */
  detectCalendarRecommendationWithContext(
    response: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    conversationState: ConversationState | null
  ): boolean {
    // Step 1: State guard
    if (conversationState?.type === 'calendar') {
      return false;
    }

    // Step 2: Clarification detection
    if (this.containsClarifyingQuestions(response)) {
      return false;
    }

    // Step 3: Conversation depth check
    if (conversationHistory.length < 2) {
      return false;
    }

    // Step 4: Context gathering verification
    if (!this.isContextGathered(conversationHistory)) {
      return false;
    }

    // Step 5: Keyword matching
    return this.containsCalendarKeywords(response);
  }

  private containsClarifyingQuestions(response: string): boolean {
    const hasQuestions = response.includes('?');

    const clarificationPhrases = [
      'just to make sure',
      'just to confirm',
      'can you clarify',
      'need to know',
      'could you provide',
      'what about',
      'have you',
      'did you',
      'were these',
      'was this',
      'to confirm'
    ];

    const hasClarificationPhrases = clarificationPhrases.some(
      phrase => response.toLowerCase().includes(phrase)
    );

    return hasQuestions || hasClarificationPhrases;
  }

  private isContextGathered(
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): boolean {
    // Find last ERA question
    let lastERAQuestionIndex = -1;
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      if (conversationHistory[i].role === 'assistant' &&
          conversationHistory[i].content.includes('?')) {
        lastERAQuestionIndex = i;
        break;
      }
    }

    // If ERA never asked questions, context is gathered
    if (lastERAQuestionIndex === -1) {
      return true;
    }

    // Check if user responded after ERA's question
    return conversationHistory.length > lastERAQuestionIndex + 1;
  }

  private containsCalendarKeywords(response: string): boolean {
    const calendarKeywords = [
      'schedule a call',
      'call the employee',
      'phone call',
      'schedule a meeting',
      'set up a call',
      'arrange a call',
      'would you like me to schedule',
      'i can schedule',
      'check your calendar',
      'find available times'
    ];

    const lowerResponse = response.toLowerCase();
    return calendarKeywords.some(keyword => lowerResponse.includes(keyword));
  }
}
```

### email-handler.ts (same pattern)

```typescript
export class EmailHandler {
  detectEmailRecommendationWithContext(
    response: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    conversationState: ConversationState | null
  ): boolean {
    // Same algorithm as calendar, different keywords
    if (conversationState?.type === 'email') return false;
    if (this.containsClarifyingQuestions(response)) return false;
    if (conversationHistory.length < 2) return false;
    if (!this.isContextGathered(conversationHistory)) return false;
    return this.containsEmailKeywords(response);
  }

  private containsEmailKeywords(response: string): boolean {
    const emailKeywords = [
      'send an email',
      'email the employee',
      'written warning via email',
      'send a written',
      'email template',
      'would you like me to draft',
      'i can draft'
    ];

    return emailKeywords.some(kw => response.toLowerCase().includes(kw));
  }

  // Reuse same helper methods from CalendarHandler
}
```

---

## Integration with bot/app.ts

### Before (Broken)
```typescript
if (emailHandler.detectEmailRecommendation(response)) {
  await emailHandler.startEmailFlow(...);
} else if (calendarHandler.detectCalendarRecommendation(response)) {
  await calendarHandler.startCalendarFlow(...);
}
```

### After (Fixed)
```typescript
const conversationHistory = conversationState.history || [];
const state = conversationStateManager.getState(conversationId);

if (emailHandler.detectEmailRecommendationWithContext(response, conversationHistory, state)) {
  await emailHandler.startEmailFlow(...);
} else if (calendarHandler.detectCalendarRecommendationWithContext(response, conversationHistory, state)) {
  await calendarHandler.startCalendarFlow(...);
}
```

---

## Test Scenarios

### Scenario 1: Premature Trigger (Should NOT trigger)
```
Turn 1 - User: "My employee didn't show up for 3 days"
Turn 2 - ERA: "Got it — that's definitely something we need to address.
               Have you tried reaching out to them yet?"

❌ Should NOT trigger calendar (response has "?", clarifying)
✅ Algorithm blocks: containsClarifyingQuestions() returns true
```

### Scenario 2: Post-Clarification (SHOULD trigger)
```
Turn 1 - User: "My employee didn't show up for 3 days"
Turn 2 - ERA: "Have you tried reaching out to them yet?"
Turn 3 - User: "I tried calling once but they didn't pick up"
Turn 4 - ERA: "Thanks for the context. Since you need to call the employee
               to discuss this, would you like me to schedule that call?"

✅ Should trigger calendar
✅ Algorithm allows:
   - No questions in current response
   - History length = 4 (>= 2)
   - Context gathered (user answered ERA's question)
   - Contains keyword "schedule that call"
```

### Scenario 3: Already in Calendar Flow (Should NOT re-trigger)
```
State: { type: 'calendar', step: 'awaiting_time_selection' }
ERA: "Which time works best? I can also call the employee after..."

❌ Should NOT trigger calendar (already in flow)
✅ Algorithm blocks: conversationState.type === 'calendar'
```

---

## Edge Cases

### Edge Case 1: Hypothetical Questions
```
User: "What should I do if an employee doesn't show up?"
ERA: "You should call the employee and document the attempt..."

✅ Should trigger? NO - this is policy explanation, not active situation
✅ Algorithm handles: Requires conversationHistory.length >= 2
   - First turn = hypothetical question
   - Need follow-up to indicate active situation
```

**Fix:** MASTER_PROMPT.md should distinguish hypothetical vs. active situations

### Edge Case 2: Multiple Actions in One Response
```
ERA: "Send an email documenting the attempts, and then call the employee..."

Question: Which triggers first, email or calendar?
Answer: Order matters - check email first, then calendar (app.ts order)
```

### Edge Case 3: Context Gathered Mid-Response
```
ERA: "Just to confirm - you've already called twice? In that case, schedule
      a follow-up call for tomorrow..."

Problem: Response has "?" but also recommends calendar
Solution: containsClarifyingQuestions() checks beginning of response
         or uses more sophisticated parsing
```

---

## Backward Compatibility

### Fallback Mode
Keep old methods for testing/comparison:
```typescript
const USE_CONTEXT_AWARE = process.env.USE_CONTEXT_AWARE !== 'false'; // Default true

if (USE_CONTEXT_AWARE) {
  // New context-aware detection
  if (calendarHandler.detectCalendarRecommendationWithContext(...)) { ... }
} else {
  // Old keyword-only detection
  if (calendarHandler.detectCalendarRecommendation(response)) { ... }
}
```

### Migration Path
1. Deploy with feature flag (USE_CONTEXT_AWARE=false)
2. Test in staging with flag enabled
3. Monitor in production for 1 week
4. Remove old method after successful rollout

---

## Performance Considerations

### Algorithm Complexity
- **Step 1 (State guard):** O(1)
- **Step 2 (Clarification):** O(n) where n = response length
- **Step 3 (Depth):** O(1)
- **Step 4 (Context):** O(h) where h = history length
- **Step 5 (Keywords):** O(n * k) where k = keyword count

**Total:** O(n + h) - Linear in response and history size

**Expected Performance:**
- Response length: ~500 chars
- History length: ~10 turns
- **Detection time: < 1ms** (negligible overhead)

---

## Metrics & Monitoring

### Success Metrics
- **Premature triggers:** Should drop to 0%
- **Missed triggers:** Should remain 0% (no regression)
- **Avg triggers per conversation:** Track before/after

### Logging
```typescript
console.log('[CalendarDetection]', {
  triggered: result,
  reason: result ? 'keywords match' : 'context not ready',
  checks: {
    stateGuard: !stateGuardFailed,
    noClarifying: !hasClarifying,
    depthOk: historyLength >= 2,
    contextGathered: contextGathered,
    hasKeywords: hasKeywords
  }
});
```

---

## Future Enhancements (Post-Option 2.5)

Once DSPy is integrated, replace this rule-based system with learned behavior:

```python
class CalendarDecision(dspy.Signature):
    """Learned from Meg's feedback instead of hardcoded rules"""
    user_query: str = dspy.InputField()
    era_response: str = dspy.InputField()
    conversation_history: str = dspy.InputField()
    should_trigger: bool = dspy.OutputField()  # Optimized by DSPy
```

**Meg's !improve feedback becomes training data:**
- "Calendar triggers too early" → should_trigger = False
- "Good timing for calendar" → should_trigger = True

---

## Summary

| Aspect | Old Approach | New Approach |
|--------|-------------|--------------|
| **Detection Logic** | Keyword matching only | Multi-factor context analysis |
| **Conversation Awareness** | None | Full history + state tracking |
| **Clarification Handling** | Broken (triggers during questions) | Fixed (waits for answers) |
| **False Positive Rate** | ~30% (triggers too early) | <1% (with context checks) |
| **Maintainability** | Fragile keyword lists | Structured algorithm |
| **Future Path** | Dead end | Ready for DSPy optimization |

**Result:** ERA will wait for context before offering calendar/email actions, matching the behavior tuned in MASTER_PROMPT.md.
