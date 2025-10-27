# Calendar Intent Detection Specification

**Version:** 1.0.0
**Related:** [Intent Detection System](./INTENT_DETECTION.md)
**Last Updated:** 2025-10-27

---

## Purpose

Detect when ERA's HR guidance recommends that a manager should call or directly contact an employee, triggering the automated calendar booking flow.

---

## Detection Criteria

### SHOULD Trigger Calendar Booking

**1. Direct Call Recommendations**
- "Call them to discuss..."
- "You should call your employee..."
- "Give them a call..."
- "Phone them to check in..."
- "Call the employee directly..."

**2. Contact/Reach Out Recommendations**
- "Reach out to them..."
- "Contact your employee..."
- "Get in touch with them..."
- "Try to reach them..."
- "Make contact with the employee..."

**3. Next Step Guidance**
- "The next step is to call..."
- "First, call them..."
- "Start by calling the employee..."
- "Your first action should be to call..."

**4. Conditional Call Recommendations**
- "If they don't respond, call them..."
- "After documenting, call to follow up..."
- "Once you have the details, call them..."

**5. Phone-Specific Guidance**
- "Give them a phone call..."
- "Try reaching by phone..."
- "Contact them by phone..."

### Should NOT Trigger Calendar Booking

**1. Employee Calling Manager (Reverse Direction)**
- ❌ "Wait for them to call you back"
- ❌ "They should call you"
- ❌ "Ask them to give you a call"
- ❌ "See if they reach out"

**2. Past Tense (Already Done)**
- ❌ "You called them yesterday"
- ❌ "After you called..."
- ❌ "Since you already reached out..."
- ❌ "Following your call..."

**3. Hypothetical Scenarios (Not Recommendations)**
- ❌ "If you call them, make sure to..."
- ❌ "When you call, remember to..."
- ❌ "Calling might be helpful, but..."

**4. Questions About Calling (Not Instructions)**
- ❌ "Have you tried calling them?"
- ❌ "Did you call the employee?"
- ❌ "Have you reached out yet?"

**5. Negative/Conditional Don'ts**
- ❌ "Don't call them yet"
- ❌ "Wait before calling"
- ❌ "Avoid calling until..."

**6. Just Mentioning Calls (No Recommendation)**
- ❌ "Employees often call in sick..."
- ❌ "No call/no show policy states..."
- ❌ "Phone numbers should be updated..."

---

## LLM Prompt Template

```
Analyze if this HR guidance recommends that the manager should call or contact the employee directly.

Response: "{response}"

Consider as TRIGGERS:
- Direct recommendations: "call them", "reach out to them", "contact the employee"
- Indirect suggestions: "try contacting", "get in touch", "give them a call"
- Next steps: "the next step is to call", "you should call"
- Action guidance: "reach out by phone", "schedule a call"

DO NOT trigger for:
- Employee calling IN: "wait for them to call you back"
- Past tense: "you called them yesterday"
- Hypotheticals: "if you call them" (without recommendation)
- Negative: "don't call them yet"
- Questions about calling: "have you tried calling?"

Answer in JSON:
{
  "should_trigger_calendar": true/false,
  "confidence": "high/medium/low",
  "reasoning": "brief explanation in one sentence"
}
```

---

## Test Cases (35 Examples)

### Group 1: Clear Recommendations (Should Trigger = TRUE)

| # | ERA Response | Expected | Confidence | Reasoning |
|---|--------------|----------|------------|-----------|
| 1 | "The next step is to call your employee to discuss the missed shifts." | ✅ TRUE | HIGH | Explicit next step instruction to call |
| 2 | "You should reach out to them by phone to understand the situation." | ✅ TRUE | HIGH | Direct recommendation to reach out |
| 3 | "Give them a call to check in and see if everything is okay." | ✅ TRUE | HIGH | Clear instruction to call |
| 4 | "Contact the employee directly to discuss the attendance issue." | ✅ TRUE | HIGH | Direct contact recommendation |
| 5 | "Try calling them to see if you can connect." | ✅ TRUE | HIGH | Recommendation to try calling |
| 6 | "Reach out to your employee to clarify the situation." | ✅ TRUE | HIGH | Clear reach-out instruction |
| 7 | "First, call them to confirm they received your message." | ✅ TRUE | HIGH | Sequenced action starting with call |
| 8 | "You need to call the employee to document their response." | ✅ TRUE | HIGH | Necessity statement for calling |
| 9 | "Get in touch with them to discuss next steps." | ✅ TRUE | MEDIUM | Less direct but clear contact recommendation |
| 10 | "Make contact with the employee to address the concern." | ✅ TRUE | MEDIUM | Professional phrasing for contact |

### Group 2: Conditional/Sequenced Recommendations (Should Trigger = TRUE)

| # | ERA Response | Expected | Confidence | Reasoning |
|---|--------------|----------|------------|-----------|
| 11 | "After documenting this, call them to follow up." | ✅ TRUE | HIGH | Sequenced action including call |
| 12 | "If they don't respond to the voicemail, call again." | ✅ TRUE | HIGH | Conditional recommendation to call |
| 13 | "Once you have all the details, reach out by phone." | ✅ TRUE | HIGH | Conditional sequencing with call |
| 14 | "Since you haven't heard back, call them directly." | ✅ TRUE | HIGH | Contextual recommendation to call |
| 15 | "Before escalating to HR, try calling the employee." | ✅ TRUE | MEDIUM | Pre-escalation call recommendation |

### Group 3: Indirect/Natural Language (Should Trigger = TRUE)

| # | ERA Response | Expected | Confidence | Reasoning |
|---|--------------|----------|------------|-----------|
| 16 | "It would be good to connect with them by phone." | ✅ TRUE | MEDIUM | Softer recommendation language |
| 17 | "Consider giving them a call to discuss this." | ✅ TRUE | MEDIUM | Suggestion framing |
| 18 | "You might want to reach out by phone first." | ✅ TRUE | MEDIUM | Gentle recommendation |
| 19 | "Best to call them before taking further action." | ✅ TRUE | MEDIUM | Comparative recommendation |
| 20 | "I'd recommend calling to get their side of the story." | ✅ TRUE | HIGH | Explicit recommendation |

### Group 4: Should NOT Trigger (Past Tense)

| # | ERA Response | Expected | Confidence | Reasoning |
|---|--------------|----------|------------|-----------|
| 21 | "Since you already called them yesterday, wait for a response." | ❌ FALSE | HIGH | Past tense, action already complete |
| 22 | "After you called, did they explain the absence?" | ❌ FALSE | HIGH | Past tense question |
| 23 | "Following your call this morning, document what was said." | ❌ FALSE | HIGH | Refers to completed call |

### Group 5: Should NOT Trigger (Employee to Manager)

| # | ERA Response | Expected | Confidence | Reasoning |
|---|--------------|----------|------------|-----------|
| 24 | "Wait for them to call you back with an explanation." | ❌ FALSE | HIGH | Employee calling manager, not reverse |
| 25 | "They should call you to confirm their attendance." | ❌ FALSE | HIGH | Employee's responsibility to call |
| 26 | "See if the employee reaches out by end of day." | ❌ FALSE | HIGH | Waiting for employee contact |
| 27 | "Ask them to give you a call when they're available." | ❌ FALSE | HIGH | Requesting employee to call |

### Group 6: Should NOT Trigger (Questions)

| # | ERA Response | Expected | Confidence | Reasoning |
|---|--------------|----------|------------|-----------|
| 28 | "Have you tried calling them yet?" | ❌ FALSE | HIGH | Question about past action |
| 29 | "Did you reach out to the employee by phone?" | ❌ FALSE | HIGH | Question about completed action |
| 30 | "Were you able to get them on the phone?" | ❌ FALSE | HIGH | Question about outcome |

### Group 7: Should NOT Trigger (Negatives/Mentions)

| # | ERA Response | Expected | Confidence | Reasoning |
|---|--------------|----------|------------|-----------|
| 31 | "Don't call them until you have all the facts." | ❌ FALSE | HIGH | Negative instruction |
| 32 | "Wait before calling to gather more information." | ❌ FALSE | HIGH | Delay instruction |
| 33 | "Employees who no-call/no-show should be documented." | ❌ FALSE | HIGH | Policy mention, not recommendation |
| 34 | "The no-call policy applies when employees don't call in." | ❌ FALSE | HIGH | Policy description |
| 35 | "Their phone number is in the employee directory." | ❌ FALSE | HIGH | Information only, no recommendation |

---

## Edge Cases & Ambiguity

### Ambiguous Case 1: Conditional Hypotheticals

**Example:** "If you decide to call them, make sure to document it."

**Analysis:**
- Contains "call them" but framed as hypothetical
- No direct recommendation to call
- Just guidance on what to do IF calling

**Decision:** ❌ FALSE (not a recommendation)

### Ambiguous Case 2: Multi-Step with Call Included

**Example:** "Document the incident, call the employee, and email HR."

**Analysis:**
- Multiple actions listed
- "Call" is one of the steps
- Part of a sequence of instructions

**Decision:** ✅ TRUE (call is recommended as part of action plan)

### Ambiguous Case 3: Indirect "Should"

**Example:** "You should try to reach them somehow."

**Analysis:**
- "Reach them" is contact-related
- But "somehow" is vague - could mean any method
- Not phone-specific

**Decision:** 🟡 MEDIUM confidence → Lean toward ✅ TRUE
(LLM can interpret "reach them" as call-worthy)

---

## Integration with Context-Aware Detection

Calendar intent detection runs AFTER context-aware blocking logic:

```typescript
// Step 1: Context-aware blocking (from specs/CONTEXT_AWARE_ACTIONS.md)
if (conversationState?.type === 'calendar') {
  return false; // Already in calendar flow
}

if (this.containsClarifyingQuestions(response)) {
  return false; // ERA is still gathering info
}

if (conversationHistory.length < 2) {
  return false; // Need minimum conversation depth
}

if (!this.isContextGathered(conversationHistory)) {
  return false; // Manager hasn't answered ERA's questions yet
}

// Step 2: Intent detection (this spec)
const calendarIntent = await intentDetector.detectCalendarIntent(response);
return calendarIntent.should_trigger;
```

This ensures calendar booking only triggers when:
1. Not already in calendar flow
2. ERA isn't asking clarifying questions
3. Enough conversation context exists
4. Manager has answered ERA's questions
5. **AND** ERA's response recommends calling

---

## Logging Format

```
═══════════════════════════════════════════════════════════════
📊 CALENDAR INTENT DETECTION
═══════════════════════════════════════════════════════════════
Conversation ID: conv_abc123
Response: "The next step is to call your employee to discuss..."
───────────────────────────────────────────────────────────────
Keyword Detection:
  Result: ❌ FALSE
  Matches: none
  Time: <1ms
───────────────────────────────────────────────────────────────
LLM Detection (GPT-4o-mini):
  Result: ✅ TRUE
  Confidence: HIGH
  Reasoning: "Explicitly recommends calling employee as next step"
  Time: 132ms
───────────────────────────────────────────────────────────────
Context Check:
  Already in flow: ❌ NO
  Clarifying questions: ❌ NO
  Min conversation depth: ✅ YES (3 turns)
  Context gathered: ✅ YES
───────────────────────────────────────────────────────────────
Agreement: ⚠️ DISAGREEMENT
Final Decision: ✅ TRIGGER CALENDAR BOOKING
═══════════════════════════════════════════════════════════════
```

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Precision** | >95% | (True Positives) / (True Positives + False Positives) |
| **Recall** | >98% | (True Positives) / (True Positives + False Negatives) |
| **F1 Score** | >96% | Harmonic mean of precision and recall |
| **LLM Response Time** | <200ms p95 | Time from request to response |
| **Agreement with Keywords** | >80% | Both methods agree on result |

### Success Criteria

- Zero false positives in first 100 production uses
- <2% false negatives in first 100 production uses
- >90% agreement with manual human review
- No user complaints about calendar triggered incorrectly

---

## Prompt Tuning Guidelines

If accuracy issues arise, tune the LLM prompt by:

1. **Add more examples** in the prompt for edge cases
2. **Clarify ambiguous phrases** (e.g., "reach out somehow")
3. **Add explicit negative examples** that were triggering incorrectly
4. **Adjust confidence thresholds** (e.g., only trigger on HIGH confidence)

### Prompt Versioning

Track prompt changes over time:
- **v1.0**: Initial prompt (this spec)
- **v1.1**: Add clarification for hypotheticals (if needed)
- **v1.2**: Add examples for multi-step sequences (if needed)

---

## Related Specifications

- [Intent Detection System Overview](./INTENT_DETECTION.md)
- [Email Intent Detection](./INTENT_DETECTION_EMAIL.md)
- [Context-Aware Actions](./CONTEXT_AWARE_ACTIONS.md)
- [Calendar Handler](../src/bot/handlers/calendar-handler.ts)

---

## Appendix: Full Keyword List (Fallback)

Current keyword list maintained for fallback only:

```typescript
const calendarKeywords = [
  'schedule a call',
  'schedule that call',
  'schedule the call',
  'call the employee',
  'call your employee',
  'call them',
  'phone call',
  'schedule a meeting',
  'set up a call',
  'arrange a call',
  'would you like me to schedule',
  'i can schedule',
  'check your calendar',
  'find available times',
  'you should call',
  'you need to call',
  'make a second call',
  'schedule that',
  'reach out to them',
  'reach out to your employee',
  'contact them',
  'contact your employee',
  'give them a call',
  'try calling',
  'next step is to call',
  'reach them',
  'get in touch with them',
];
```

**Note:** This list will remain in code as emergency fallback but will not be expanded. LLM should handle all new phrasings naturally.
