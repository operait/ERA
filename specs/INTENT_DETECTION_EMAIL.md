# Email Intent Detection Specification

**Version:** 1.0.0
**Related:** [Intent Detection System](./INTENT_DETECTION.md)
**Last Updated:** 2025-10-27

---

## Purpose

Detect when ERA's HR guidance recommends that a manager should send an email or written documentation to an employee, triggering the automated email composition and sending flow.

---

## Detection Criteria

### SHOULD Trigger Email Sending

**1. Direct Email Recommendations**
- "Send them an email..."
- "Email the employee..."
- "Draft an email to..."
- "You should email them..."
- "Shoot them an email..."

**2. Written Documentation Recommendations**
- "Follow up in writing..."
- "Send written documentation..."
- "Put it in writing..."
- "Document via email..."
- "Send a written notice..."

**3. Template Offers**
- "Here's an email template..."
- "Want me to draft an email?"
- "I can help you write an email..."
- "Would you like me to draft that email?"

**4. Follow-Up Guidance**
- "Follow up with an email..."
- "Then email them the details..."
- "Send an email summarizing..."
- "Email them after the call..."

**5. Next Step Email Guidance**
- "The next step is to email them..."
- "After that, send an email..."
- "First, email the employee..."

### Should NOT Trigger Email Sending

**1. Receiving Emails (Reverse Direction)**
- ❌ "Wait for their email response"
- ❌ "They should email you"
- ❌ "See if they send an email"
- ❌ "Ask them to email you"

**2. Email as Contact Information**
- ❌ "Their email is john@company.com"
- ❌ "Use their email address from the directory"
- ❌ "Email is listed in their profile"

**3. Past Tense (Already Sent)**
- ❌ "Since you already emailed them..."
- ❌ "After you sent that email..."
- ❌ "Following your email yesterday..."

**4. Questions About Emailing**
- ❌ "Have you sent an email yet?"
- ❌ "Did you email the employee?"
- ❌ "Were you able to send that email?"

**5. Negative/Conditional Don'ts**
- ❌ "Don't email them yet"
- ❌ "Wait before sending an email"
- ❌ "Avoid emailing until..."

**6. General Mentions (No Recommendation)**
- ❌ "Email is one way to communicate..."
- ❌ "Employees often miss emails..."
- ❌ "Email policies require..."

**7. Email System References**
- ❌ "Check your email for the policy"
- ❌ "The template is in your email"
- ❌ "Email settings can be updated"

---

## LLM Prompt Template

```
Analyze if this HR guidance recommends that the manager should send an email or written documentation to the employee.

Response: "{response}"

Consider as TRIGGERS:
- Direct recommendations: "send an email", "email them", "draft a message"
- Documentation: "follow up in writing", "send written notice", "document via email"
- Templates offered: "here's an email template", "want me to draft"
- Next steps: "then email them", "follow up with email", "send them an email"
- Written communication: "put it in writing", "written documentation"

DO NOT trigger for:
- Receiving emails: "wait for their email response"
- Email as contact: "their email is john@company.com"
- Past tense: "you already emailed them"
- Email mentions only: "email is one way to reach them"
- Questions: "have you sent an email?"
- Negatives: "don't email them yet"

Answer in JSON:
{
  "should_trigger_email": true/false,
  "confidence": "high/medium/low",
  "reasoning": "brief explanation in one sentence"
}
```

---

## Test Cases (35 Examples)

### Group 1: Clear Email Recommendations (Should Trigger = TRUE)

| # | ERA Response | Expected | Confidence | Reasoning |
|---|--------------|----------|------------|-----------|
| 1 | "Send them an email documenting the missed shifts." | ✅ TRUE | HIGH | Explicit instruction to send email |
| 2 | "You should email the employee to confirm the discussion." | ✅ TRUE | HIGH | Direct email recommendation |
| 3 | "Draft an email to the employee outlining the expectations." | ✅ TRUE | HIGH | Email drafting instruction |
| 4 | "Follow up in writing to create a paper trail." | ✅ TRUE | HIGH | Written documentation recommendation |
| 5 | "Send a written notice about the attendance policy." | ✅ TRUE | HIGH | Written notice instruction |
| 6 | "Email them a summary of your conversation." | ✅ TRUE | HIGH | Email with specific content |
| 7 | "Put it in writing so you have documentation." | ✅ TRUE | MEDIUM | Indirect email recommendation |
| 8 | "Send written documentation of the warning." | ✅ TRUE | HIGH | Written doc instruction |
| 9 | "Shoot them an email with the policy details." | ✅ TRUE | MEDIUM | Casual email instruction |
| 10 | "The next step is to email them the corrective action plan." | ✅ TRUE | HIGH | Sequential email instruction |

### Group 2: Template Offers (Should Trigger = TRUE)

| # | ERA Response | Expected | Confidence | Reasoning |
|---|--------------|----------|------------|-----------|
| 11 | "Here's an email template you can use..." | ✅ TRUE | HIGH | Template provision for email |
| 12 | "Want me to draft an email for you?" | ✅ TRUE | HIGH | Explicit offer to draft email |
| 13 | "I can help you write an email to send them." | ✅ TRUE | HIGH | Assistance offer for emailing |
| 14 | "Would you like me to draft that email?" | ✅ TRUE | HIGH | Direct drafting offer |
| 15 | "Let me provide an email template for this situation." | ✅ TRUE | HIGH | Template offering |

### Group 3: Follow-Up/Sequential (Should Trigger = TRUE)

| # | ERA Response | Expected | Confidence | Reasoning |
|---|--------------|----------|------------|-----------|
| 16 | "After the call, follow up with an email." | ✅ TRUE | HIGH | Sequential email instruction |
| 17 | "Once you document it, send them an email summary." | ✅ TRUE | HIGH | Conditional email instruction |
| 18 | "Then email them the details of your discussion." | ✅ TRUE | HIGH | Next-step email instruction |
| 19 | "Follow this up with a written email to the employee." | ✅ TRUE | HIGH | Follow-up email instruction |
| 20 | "After documenting, send an email confirming next steps." | ✅ TRUE | HIGH | Post-action email instruction |

### Group 4: Indirect/Natural Language (Should Trigger = TRUE)

| # | ERA Response | Expected | Confidence | Reasoning |
|---|--------------|----------|------------|-----------|
| 21 | "It would be good to send them written confirmation." | ✅ TRUE | MEDIUM | Softer recommendation |
| 22 | "Consider emailing them the policy for reference." | ✅ TRUE | MEDIUM | Suggestion framing |
| 23 | "You might want to email a summary of expectations." | ✅ TRUE | MEDIUM | Gentle recommendation |
| 24 | "Best to put this in writing via email." | ✅ TRUE | MEDIUM | Comparative recommendation |
| 25 | "I'd recommend sending an email to document this." | ✅ TRUE | HIGH | Explicit recommendation |

### Group 5: Should NOT Trigger (Receiving Emails)

| # | ERA Response | Expected | Confidence | Reasoning |
|---|--------------|----------|------------|-----------|
| 26 | "Wait for their email response before proceeding." | ❌ FALSE | HIGH | Employee sending email, not manager |
| 27 | "They should email you with an explanation." | ❌ FALSE | HIGH | Employee's responsibility |
| 28 | "See if the employee sends an email by end of day." | ❌ FALSE | HIGH | Waiting for employee email |
| 29 | "Ask them to email you their availability." | ❌ FALSE | HIGH | Requesting employee to email |

### Group 6: Should NOT Trigger (Past Tense)

| # | ERA Response | Expected | Confidence | Reasoning |
|---|--------------|----------|------------|-----------|
| 30 | "Since you already emailed them, wait for a response." | ❌ FALSE | HIGH | Past tense, already sent |
| 31 | "After you sent that email, did they respond?" | ❌ FALSE | HIGH | Refers to sent email |
| 32 | "Following your email yesterday, document any replies." | ❌ FALSE | HIGH | Past email reference |

### Group 7: Should NOT Trigger (Questions/Mentions)

| # | ERA Response | Expected | Confidence | Reasoning |
|---|--------------|----------|------------|-----------|
| 33 | "Have you sent them an email about this?" | ❌ FALSE | HIGH | Question about past action |
| 34 | "Email is one way to communicate with employees." | ❌ FALSE | HIGH | General mention, no recommendation |
| 35 | "Their email address is in the employee directory." | ❌ FALSE | HIGH | Contact information only |

---

## Edge Cases & Ambiguity

### Ambiguous Case 1: Multiple Communication Methods

**Example:** "Call them first, and if no answer, send an email."

**Analysis:**
- Contains both call and email recommendations
- Email is conditional on call failing
- Both actions are recommended

**Decision:** ✅ TRUE for BOTH calendar AND email
(Both intents detected, both workflows triggered)

### Ambiguous Case 2: Email Mentions in Context

**Example:** "When documenting this incident, include details like date, time, and email correspondence."

**Analysis:**
- "email correspondence" is mentioned
- But not recommending to send an email
- Just referring to emails as data to include

**Decision:** ❌ FALSE (mention only, not recommendation)

### Ambiguous Case 3: Written vs Email

**Example:** "Send them written documentation of the policy violation."

**Analysis:**
- "Written documentation" could mean email or physical letter
- In modern context, usually means email
- Best interpreted as email recommendation

**Decision:** ✅ TRUE (written documentation typically means email)

### Ambiguous Case 4: Template Without Send Instruction

**Example:** "Here's a template you can use if you decide to reach out in writing."

**Analysis:**
- Template provided
- But conditional "if you decide"
- Not a direct recommendation

**Decision:** 🟡 MEDIUM confidence → Lean toward ✅ TRUE
(Template provision typically implies recommendation to use it)

---

## Integration with Context-Aware Detection

Email intent detection runs AFTER context-aware blocking logic:

```typescript
// Step 1: Context-aware blocking (from specs/CONTEXT_AWARE_ACTIONS.md)
if (conversationState?.type === 'email') {
  return false; // Already in email flow
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
const emailIntent = await intentDetector.detectEmailIntent(response);
return emailIntent.should_trigger;
```

This ensures email workflow only triggers when:
1. Not already in email flow
2. ERA isn't asking clarifying questions
3. Enough conversation context exists
4. Manager has answered ERA's questions
5. **AND** ERA's response recommends emailing

---

## Logging Format

```
═══════════════════════════════════════════════════════════════
📊 EMAIL INTENT DETECTION
═══════════════════════════════════════════════════════════════
Conversation ID: conv_abc123
Response: "Follow up in writing to document the conversation..."
───────────────────────────────────────────────────────────────
Keyword Detection:
  Result: ✅ TRUE
  Matches: ['follow up in writing']
  Time: <1ms
───────────────────────────────────────────────────────────────
LLM Detection (GPT-4o-mini):
  Result: ✅ TRUE
  Confidence: HIGH
  Reasoning: "Explicitly recommends written follow-up documentation"
  Time: 118ms
───────────────────────────────────────────────────────────────
Context Check:
  Already in flow: ❌ NO
  Clarifying questions: ❌ NO
  Min conversation depth: ✅ YES (4 turns)
  Context gathered: ✅ YES
───────────────────────────────────────────────────────────────
Agreement: ✅ AGREEMENT
Final Decision: ✅ TRIGGER EMAIL WORKFLOW
═══════════════════════════════════════════════════════════════
```

---

## Email Templates and Variable Extraction

When email intent is detected, the system also extracts:

1. **Template Type**: Warning letter, follow-up, policy reminder, etc.
2. **Required Variables**: Employee name, dates, policy references
3. **Tone**: Formal, conversational, urgent
4. **Subject Line**: Derived from context

Example:
```typescript
{
  should_trigger_email: true,
  confidence: 'high',
  reasoning: 'Recommends sending written warning',
  template_type: 'disciplinary_warning',
  suggested_subject: 'Attendance Discussion Follow-Up',
  required_vars: ['employee_name', 'dates', 'policy_section']
}
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
| **Agreement with Keywords** | >75% | Both methods agree (lower than calendar due to "written" ambiguity) |

### Success Criteria

- Zero false positives in first 100 production uses
- <3% false negatives in first 100 production uses
- >90% agreement with manual human review
- No user complaints about email triggered incorrectly

---

## Parallel Detection with Calendar

Both calendar and email detection run in parallel to minimize latency:

```typescript
const [calendarIntent, emailIntent] = await Promise.all([
  intentDetector.detectCalendarIntent(response, history),
  intentDetector.detectEmailIntent(response, history)
]);

// Both can trigger if response recommends both actions
if (calendarIntent.should_trigger) {
  // Start calendar flow
}

if (emailIntent.should_trigger) {
  // Start email flow
}
```

**Example triggering both:**
```
ERA: "Call them to discuss, then follow up with a written email summarizing your conversation."

Result:
- Calendar: ✅ TRUE (recommends calling)
- Email: ✅ TRUE (recommends email follow-up)
- Action: Both workflows offered in sequence
```

---

## Prompt Tuning Guidelines

If accuracy issues arise, tune the LLM prompt by:

1. **Clarify "written" ambiguity** - Does it always mean email?
2. **Add examples for template offers** - When is offering a template enough?
3. **Handle multi-method scenarios** - "Call or email them"
4. **Address conditional recommendations** - "If needed, send an email"

### Prompt Versioning

Track prompt changes over time:
- **v1.0**: Initial prompt (this spec)
- **v1.1**: Clarify "written documentation" = email (if needed)
- **v1.2**: Add guidance for template-only responses (if needed)

---

## Related Specifications

- [Intent Detection System Overview](./INTENT_DETECTION.md)
- [Calendar Intent Detection](./INTENT_DETECTION_CALENDAR.md)
- [Context-Aware Actions](./CONTEXT_AWARE_ACTIONS.md)
- [Email Handler](../src/bot/handlers/email-handler.ts)

---

## Appendix: Full Keyword List (Fallback)

Current keyword list maintained for fallback only:

```typescript
const emailKeywords = [
  'send an email',
  'send them an email',
  'email them',
  'email the employee',
  'draft an email',
  'draft a message',
  'follow up in writing',
  'send written notice',
  'written documentation',
  'document via email',
  'put it in writing',
  'send a written',
  'here\'s an email template',
  'want me to draft',
  'i can help you write',
  'would you like me to draft',
  'follow up with an email',
  'then email them',
  'send an email summary',
  'email after the call',
  'shoot them an email',
  'send them written',
  'email documenting',
  'email to confirm',
  'email outlining',
];
```

**Note:** This list will remain in code as emergency fallback but will not be expanded. LLM should handle all new phrasings naturally, especially ambiguous "written" references.
