# Manual Testing Guide - Context-Aware Actions (Option 1)

**Version:** 3.4.6
**Feature:** Context-aware calendar and email detection
**Purpose:** Verify ERA waits for context before triggering automated actions

---

## Quick Test Summary

✅ **Pass Criteria:** ERA should NOT trigger calendar/email during clarification phase
✅ **Pass Criteria:** ERA SHOULD trigger after context is gathered
✅ **Pass Criteria:** ERA should NOT re-trigger when already in a flow

---

## Test Scenario 1: Premature Trigger Prevention ❌→✅

**Goal:** Verify calendar does NOT trigger when ERA is asking clarifying questions

### Test Steps:
1. Start fresh conversation with ERA in Teams
2. Send: `"My employee didn't show up for 3 days"`
3. **Expected ERA Response:**
   ```
   Got it — that's definitely something we need to address right away.

   Just to make sure I have the full picture:
   - Have you tried reaching out to them yet (phone, text, or email)?
   - Were these three consecutive scheduled shifts?
   ```

### ✅ Pass Criteria:
- ERA response contains question marks (`?`)
- **Calendar booking UI does NOT appear**
- ERA is gathering context, not offering actions

### ❌ Fail Criteria:
- If calendar booking UI appears
- If ERA offers "Would you like me to schedule a call?" before user answers

---

## Test Scenario 2: Post-Clarification Trigger ✅

**Goal:** Verify calendar DOES trigger after user provides context

### Test Steps:
1. Continue from Scenario 1
2. Send: `"I tried calling once but they didn't pick up"`
3. **Expected ERA Response:**
   ```
   Thanks for the context. Since you need to call the employee again to discuss
   this serious attendance issue, would you like me to schedule that call?
   I can check your calendar and find available times.
   ```

### ✅ Pass Criteria:
- ERA response contains action offer ("would you like me to schedule")
- **Calendar booking UI DOES appear**
- ERA offers specific action after gathering context

### ❌ Fail Criteria:
- If calendar booking UI does NOT appear
- If ERA asks more clarifying questions instead of offering action

---

## Test Scenario 3: No Re-trigger in Active Flow ❌

**Goal:** Verify calendar does NOT re-trigger when already booking

### Test Steps:
1. Continue from Scenario 2
2. If calendar UI appeared, interact with it (select employee name, etc.)
3. ERA may mention "call" again during booking flow
4. **Expected Behavior:**
   - Calendar booking continues normally
   - No duplicate calendar UI
   - No restart of booking process

### ✅ Pass Criteria:
- Calendar flow continues smoothly
- No interruptions or restarts

### ❌ Fail Criteria:
- Calendar flow restarts
- Multiple calendar UIs appear
- Booking gets interrupted

---

## Test Scenario 4: Email Detection (Same Pattern)

**Goal:** Verify email detection follows same context-aware rules

### Test Steps:
1. Start fresh conversation
2. Send: `"Employee has been late 5 times this month"`
3. **Expected ERA Response:** (Clarifying questions)
   ```
   Got it — let me help you address this.

   Have you already documented these tardiness instances?
   Have you had a verbal conversation with them about it?
   ```

### ✅ Pass Criteria:
- **Email UI does NOT appear** (ERA is clarifying)

4. Send: `"Yes, I've documented it and spoke with them verbally"`
5. **Expected ERA Response:** (Action offer)
   ```
   Since you've completed the verbal warning, the next step is a written warning.
   Would you like me to draft that email for you?
   ```

### ✅ Pass Criteria:
- **Email UI DOES appear** (after context gathered)

---

## Test Scenario 5: Hypothetical Question (Edge Case)

**Goal:** Verify ERA doesn't trigger actions for policy explanations

### Test Steps:
1. Start fresh conversation
2. Send: `"What should I do if an employee misses 3 shifts?"`
3. **Expected ERA Response:** (Policy explanation, no action)
   ```
   Here's the process for handling no-call/no-show situations:

   1. Attempt to contact the employee (call, text, email)
   2. Document each attempt with timestamps
   3. If no response after 2 attempts, follow progressive discipline...
   ```

### ✅ Pass Criteria:
- ERA explains the process (policy guidance)
- **No calendar or email UI appears**
- Response is educational, not action-oriented

### ❌ Fail Criteria:
- Calendar/email UI appears for hypothetical question
- ERA starts booking/drafting for a hypothetical scenario

---

## Test Scenario 6: Action Offer Question vs Clarification

**Goal:** Verify "Would you like me to..." questions DO trigger actions

### Test Steps:
1. After gathering context (Scenario 2 continuation)
2. ERA says: `"Would you like me to schedule a call with them?"`

### ✅ Pass Criteria:
- **Calendar UI DOES appear** (this is an action offer, not clarification)
- The question mark indicates offering help, not requesting info

### Note:
The detection algorithm distinguishes:
- **Clarification question:** "Have you tried calling them?" ❌ Don't trigger
- **Action offer question:** "Would you like me to schedule a call?" ✅ DO trigger

---

## Debugging: What to Check if Tests Fail

### If calendar triggers TOO EARLY (Scenario 1 fails):
1. Check `src/bot/handlers/calendar-handler.ts:88-210`
2. Verify `containsClarifyingQuestions()` is working
3. Look for keywords in clarifying responses that match action keywords
4. Check console logs for detection algorithm output

### If calendar NEVER triggers (Scenario 2 fails):
1. Check `conversationHistory` is being tracked in `bot/app.ts`
2. Verify keywords list includes "schedule that call", "would you like me to schedule"
3. Check `isContextGathered()` logic - may be too strict

### If calendar RE-TRIGGERS (Scenario 3 fails):
1. Check `conversationStateManager.getState(conversationId)` returns correct state
2. Verify state guard in `detectCalendarRecommendationWithContext()` line 88

---

## Quick Verification Checklist

Run through these scenarios and mark results:

- [ ] **Scenario 1:** Calendar does NOT trigger during clarification ✅
- [ ] **Scenario 2:** Calendar DOES trigger after context gathered ✅
- [ ] **Scenario 3:** Calendar does NOT re-trigger in active flow ✅
- [ ] **Scenario 4:** Email follows same pattern (clarify → action) ✅
- [ ] **Scenario 5:** No actions for hypothetical questions ✅
- [ ] **Scenario 6:** Action offers with "?" DO trigger ✅

---

## Test Environment Setup

### Prerequisites:
- ERA deployed and running in Teams
- Access to Teams channel with ERA bot
- Fresh conversation (no cached state)

### Recommended Testing:
1. Test in **Microsoft Teams** (production-like environment)
2. Use **fresh conversations** (click "New conversation" between tests)
3. Test with **different managers** if possible (verify state isolation)

---

## Expected Behavior Summary

| User Action | ERA Response | Calendar/Email Trigger? |
|-------------|--------------|-------------------------|
| Initial question about active issue | Asks clarifying questions | ❌ NO (gathering context) |
| Answers ERA's questions | Offers specific action | ✅ YES (context gathered) |
| Hypothetical "what if" question | Explains policy | ❌ NO (educational) |
| Already in booking flow | Continues flow | ❌ NO (already active) |

---

## Success Metrics

After manual testing, Option 1 is successful if:

✅ **Zero premature triggers** - Calendar/email never appears during clarification
✅ **Zero missed triggers** - Actions always offered after context gathered
✅ **Smooth user experience** - No interruptions or duplicate UIs

---

## Next Steps After Manual Testing

1. ✅ If all tests pass → Proceed to Day 2.5 (Documentation)
2. ❌ If tests fail → Debug using "Debugging" section above
3. 📝 Document any edge cases discovered during testing

---

**Testing completed by:** _______________
**Date:** _______________
**Result:** ✅ Pass / ❌ Fail / ⚠️ Partial
**Notes:** _________________________________
