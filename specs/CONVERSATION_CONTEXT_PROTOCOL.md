# Conversation Context Protocol

**Version:** 1.0
**Status:** Implementation Ready
**Owner:** Barry & Meg
**Purpose:** Define rules for when ERA has "sufficient context" to trigger actions

---

## Overview

This protocol defines the **rules and signals** that determine when ERA has gathered enough context from a manager to trigger automated actions (calendar booking, email sending).

**Core Principle:** ERA should **ask, then act** — never act while asking.

---

## Context States

A conversation progresses through these states:

```
┌───────────────┐
│   INITIAL     │  User asks question
│   (Turn 1)    │  ERA doesn't know if context is sufficient
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  CLARIFYING   │  ERA asks clarifying questions
│   (Turn 2)    │  Context NOT sufficient yet
└───────┬───────┘
        │
        ▼
┌───────────────┐
│   ANSWERING   │  Manager provides context
│   (Turn 3)    │  Context may now be sufficient
└───────┬───────┘
        │
        ▼
┌───────────────┐
│   GUIDING     │  ERA provides actionable guidance
│   (Turn 4)    │  ✅ Context SUFFICIENT - can trigger actions
└───────────────┘
```

---

## Detection Rules

### Rule 1: **ERA Must Not Ask and Act Simultaneously**

**❌ Wrong:**
```
ERA: "Have you tried calling them? I'll schedule a call for you now..."
```

**✅ Correct:**
```
ERA: "Have you tried calling them?"
[Manager answers]
ERA: "Thanks for clarifying. Would you like me to schedule that call?"
```

**Implementation:**
```typescript
if (response.includes('?')) {
  return false; // Don't trigger - still asking questions
}
```

---

### Rule 2: **Minimum Conversation Depth**

Actions should NOT trigger on the first ERA response.

**Required Minimum:** 2 conversation turns (user + ERA)

**Why:**
- Turn 1: User asks
- Turn 2: ERA clarifies (might trigger prematurely)
- Turn 3: User answers
- Turn 4: ERA acts ✅

**Implementation:**
```typescript
if (conversationHistory.length < 2) {
  return false; // Too early
}
```

---

### Rule 3: **Context Gathering Flow**

If ERA has asked questions, manager must answer before actions trigger.

**Detection:**
```typescript
function isContextGathered(history): boolean {
  // Find last ERA question
  const lastQuestionIndex = findLastERAQuestion(history);

  if (lastQuestionIndex === -1) {
    return true; // ERA never asked, context OK
  }

  // Check if manager responded after ERA's question
  return history.length > lastQuestionIndex + 1;
}
```

**Example:**
```
Turn 1 - User: "My employee is absent"
Turn 2 - ERA: "Have you contacted them?" (lastQuestionIndex = 1)
Turn 3 - User: "Yes, called twice" (history.length = 3)

isContextGathered() = true (3 > 1 + 1)
```

---

### Rule 4: **State Guards**

Don't trigger the same action twice or interrupt active flows.

```typescript
if (conversationState?.type === 'calendar') {
  return false; // Already in calendar flow
}

if (conversationState?.type === 'email') {
  return false; // Already in email flow
}
```

---

## Clarification Signals

### Strong Signals (Definite Clarification)

**Question Marks:**
```
"Have you tried calling them?"
"Were these consecutive shifts?"
```

**Clarification Phrases:**
- "Just to make sure..."
- "Just to confirm..."
- "Can you clarify..."
- "Need to know..."
- "Could you provide..."

### Weak Signals (Ambiguous)

**Rhetorical Questions:**
```
"You should call them — when do you want to schedule that?"
```
→ This is NOT clarification, it's an action offer

**Solution:** Only treat as clarification if:
1. Question mark present AND
2. No action keywords in same sentence

---

## Action Trigger Signals

### Calendar Triggers (Strong)

**Explicit Offers:**
- "Would you like me to schedule that call?"
- "I can schedule a call for you..."
- "Let me check your calendar..."

**Implicit Recommendations:**
- "You should call the employee..." (weaker, but still valid)

### Email Triggers (Strong)

**Explicit Offers:**
- "Would you like me to draft an email?"
- "I can help you send a written warning..."

**Implicit Recommendations:**
- "You should send an email documenting this..."

---

## Edge Cases & Resolutions

### Edge Case 1: Hypothetical vs. Active Situations

**Hypothetical:**
```
User: "What should I do if an employee doesn't show up?"
ERA: "You should call the employee and document it."
```

**Active:**
```
User: "My employee didn't show up."
ERA: "You should call the employee. Would you like me to schedule that?"
```

**Rule:** Only trigger for active situations
- Detection: Check for possessive pronouns ("my", "our") or names
- Already handled by MASTER_PROMPT.md (hypothetical vs. active detection)

### Edge Case 2: Multiple Actions in One Response

```
ERA: "Document this via email, then schedule a call with them..."
```

**Rule:** Priority order in app.ts
1. Check email first
2. Then check calendar
3. Only one triggers per turn

**Implementation:**
```typescript
if (emailHandler.detectEmailRecommendationWithContext(...)) {
  // Email flow starts
} else if (calendarHandler.detectCalendarRecommendationWithContext(...)) {
  // Calendar flow starts (only if email didn't trigger)
}
```

### Edge Case 3: Clarification + Action in Same Response

```
ERA: "Just to confirm - you've already called twice? In that case,
      let me schedule a follow-up call for you..."
```

**Problem:** Response has "?" but also offers action

**Solution:** Stricter clarification detection
- Only first sentence has "?"
- Action is in second sentence
- OR: Use more sophisticated parsing (future DSPy improvement)

**Current Implementation:** Conservative approach
- If ANY "?" exists, don't trigger
- Requires ERA to separate responses:
  ```
  Turn N: "Just to confirm - you've already called twice?"
  Turn N+1 (after answer): "Got it. Let me schedule that call..."
  ```

---

## Testing Protocol

### Test Matrix

| Scenario | History Length | ERA Has "?" | Manager Answered | State | Should Trigger? |
|----------|---------------|-------------|------------------|-------|-----------------|
| First response | 1 | No | N/A | None | ❌ No (too early) |
| Clarifying | 2 | Yes | No | None | ❌ No (still asking) |
| Post-clarification | 4 | No | Yes | None | ✅ Yes |
| Already in flow | 4 | No | Yes | Calendar | ❌ No (state guard) |
| Hypothetical | 2 | No | N/A | None | ❌ No (no action keywords) |

---

## Integration with MASTER_PROMPT.md

The MASTER_PROMPT.md controls **what ERA says**.
This protocol controls **when ERA acts**.

**MASTER_PROMPT.md responsibilities:**
- Determine if clarification is needed
- Ask appropriate questions
- Provide guidance after context gathered
- Use action keywords when recommending actions

**Context Protocol responsibilities:**
- Detect if context is sufficient (based on conversation state)
- Block premature triggers
- Allow triggers when safe

**Together they ensure:**
1. MASTER_PROMPT asks good questions
2. Context protocol waits for answers
3. MASTER_PROMPT recommends actions
4. Context protocol triggers them

---

## Future: DSPy Optimization

In Option 2.5, this rule-based protocol will be replaced with learned behavior:

```python
class CalendarDecision(dspy.Signature):
    """Learn when to trigger from Meg's feedback"""
    conversation_history: str = dspy.InputField()
    era_response: str = dspy.InputField()
    context_sufficient: bool = dspy.OutputField()
    should_trigger: bool = dspy.OutputField()
```

**Training data from Meg:**
```csv
Turn,User,ERA,Improvement,Label
2,"My employee is absent","Have you called?","Calendar too early",should_trigger=False
4,"Yes I called","Thanks. Schedule call?","Good timing",should_trigger=True
```

DSPy compiler learns: **Don't trigger until context is sufficient**

---

## Summary

**The Protocol in 3 Rules:**

1. **Ask, then act** - Never trigger while ERA is asking questions
2. **Wait for answers** - If ERA asked, manager must respond first
3. **Guard active flows** - Don't interrupt or re-trigger

**Implementation Checklist:**
- ✅ Check conversation state (no active flow)
- ✅ Check for clarifying questions (no "?" in response)
- ✅ Check conversation depth (>= 2 turns)
- ✅ Verify context gathered (manager answered ERA's questions)
- ✅ Match action keywords (calendar/email triggers)

**Result:** ERA waits for full context before offering to automate actions.
