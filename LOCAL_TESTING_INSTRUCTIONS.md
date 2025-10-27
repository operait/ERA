# Local Testing Instructions - Context-Aware Detection

## Quick Start

1. **Ensure environment variables are set:**
   ```bash
   # Check your .env file has these:
   SUPABASE_URL=your_url
   SUPABASE_SERVICE_ROLE_KEY=your_key
   OPENAI_API_KEY=your_key  # or ANTHROPIC_API_KEY
   ```

2. **Run the interactive test harness:**
   ```bash
   npm run test:conversation
   ```

3. **Test the scenarios from MANUAL_TESTING.md**

---

## Test Scenario 1: Premature Trigger Prevention

**Goal:** Verify ERA doesn't offer calendar/email during clarification

### Test in Terminal:
```
You: My employee didn't show up for 3 days

Expected ERA Response:
✅ Should ask clarifying questions
✅ Should NOT contain "Would you like me to schedule a call?"
✅ Should contain question marks (?)

Look for phrases like:
- "Have you tried reaching out to them?"
- "Were these consecutive shifts?"
```

**What to check:**
- Response is asking questions (clarifying)
- No action offers yet

---

## Test Scenario 2: Post-Clarification Trigger

**Goal:** Verify ERA DOES offer actions after context gathered

### Continue from Scenario 1:
```
You: I tried calling once but they didn't pick up

Expected ERA Response:
✅ Should offer specific action
✅ Should contain "Would you like me to schedule a call?"
✅ No more clarifying questions

Example phrases:
- "Since you need to call the employee..."
- "Would you like me to schedule that call?"
- "I can check your calendar..."
```

**What to check:**
- Response offers action (not asking more questions)
- Mentions calendar/scheduling explicitly

---

## Test Scenario 3: Hypothetical Question

**Goal:** Verify ERA explains policy without offering actions

### Test in Terminal:
```
!reset  # Start fresh conversation

You: What should I do if an employee misses 3 shifts?

Expected ERA Response:
✅ Should explain the policy/process
✅ Should NOT offer to schedule a call
✅ Educational tone, not action-oriented

Example phrases:
- "Here's the process..."
- "You should call the employee..."
- "Document each attempt..."

NOT expecting:
- "Would you like me to schedule...?"
- "I can draft an email...?"
```

**What to check:**
- Response is educational (explaining "what to do")
- No action offers (this is hypothetical)

---

## Test Scenario 4: Email Detection

**Goal:** Verify same pattern for email actions

### Test in Terminal:
```
!reset  # Fresh conversation

You: Employee has been late 5 times this month

Expected ERA First Response:
✅ Asks clarifying questions
✅ NO email offer yet

You: Yes, I've documented it and spoke with them verbally

Expected ERA Second Response:
✅ Offers to draft email
✅ Contains "Would you like me to draft..."
```

---

## Using Test Harness Commands

### Available Commands:
```bash
!reset    # Clear conversation history (start fresh scenario)
!debug    # Toggle debug mode (show RAG results)
!sources  # Show which policy documents were used
!metrics  # Show quality metrics for last response
!quit     # Exit
```

### Debug Mode Features:
When debug is ON:
- Shows search results and similarity scores
- Shows processing time
- Shows which policy documents were retrieved

**Tip:** Use `!debug` to turn off verbose output for cleaner testing

---

## What to Look For

### ✅ Good Behavior (Pass):
1. First response asks clarifying questions → No action offers
2. After user answers → ERA offers specific action
3. Hypothetical questions → Policy explanation, no actions
4. Response contains "Would you like me to..." → Action offer (good timing)

### ❌ Bad Behavior (Fail):
1. First response offers calendar/email → TOO EARLY
2. ERA keeps asking questions after user answered → Not progressing
3. Hypothetical question triggers calendar/email → Wrong context
4. Response never offers actions → TOO CAUTIOUS

---

## Sample Test Session

```
$ npm run test:conversation

🤖 ERA Terminal Test Harness
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Testing conversation flows locally...

Connected to Supabase: ✓
Response Generator ready: ✓

Commands:
  !reset    - Clear conversation history
  !debug    - Toggle debug mode (show search results)
  !sources  - Show sources from last response
  !metrics  - Show quality metrics for last response
  !quit     - Exit

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You: My employee didn't show up for 3 days

🔍 Searching... ✓
💬 Generating response...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERA: Got it — that's definitely something we need to address
right away.

Just to make sure I have the full picture:
- Have you tried reaching out to them yet (phone, text, or email)?
- Were these three consecutive scheduled shifts?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ PASS: Asks questions, no action offer

You: I tried calling once but no answer

🔍 Searching... ✓
💬 Generating response...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERA: Thanks for the context. Since you need to make a second
call attempt, would you like me to schedule that call for you?
I can check your calendar and find available times.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ PASS: Offers action after context gathered

You: !quit

👋 Session ended.
   Turns: 2
   Duration: 0m 45s
   Avg processing time: 1200ms
```

---

## Troubleshooting

### Issue: "Missing Supabase environment variables"
**Fix:** Check `.env` file has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### Issue: "OpenAI/Anthropic API error"
**Fix:** Check `.env` file has valid API key for the LLM you're using

### Issue: ERA offers actions too early
**Problem:** Context-aware detection might not be working
**Debug:**
1. Check if code is running from correct branch (`features` or `prompt-tuning`)
2. Verify `detectCalendarRecommendationWithContext` is being called
3. Check conversation history is being tracked

### Issue: ERA never offers actions
**Problem:** Detection might be too strict
**Debug:**
1. Use `!debug` to see RAG results
2. Check if ERA's response contains action keywords
3. Verify conversation depth >= 2 turns

---

## Expected Test Results

After running all scenarios, you should observe:

| Scenario | ERA Behavior | Result |
|----------|--------------|---------|
| Initial absence query | Asks clarifying questions | ✅ No premature trigger |
| After user answers | Offers calendar booking | ✅ Triggers correctly |
| Hypothetical "what if" | Explains policy only | ✅ No action for hypothetical |
| Initial tardiness query | Asks clarifying questions | ✅ No premature email |
| After user confirms docs | Offers email drafting | ✅ Email triggers correctly |

---

## Next Steps After Local Testing

1. ✅ If all scenarios pass → Deploy to Render (Option A)
2. ❌ If scenarios fail → Debug using test harness + `!debug` mode
3. 📝 Document any unexpected behavior for tuning

---

**Happy Testing!** 🧪
