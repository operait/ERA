# Quick Test Scenarios - Copy/Paste These

## Test 1: Calendar Detection (No Premature Trigger)

Type exactly:
```
My employee didn't show up for 3 days
```

**Expected Result:**
- ERA should ask clarifying questions
- Should contain "?" (questions)
- Should NOT contain "Would you like me to schedule"
- ✅ PASS if: ERA is gathering context first

---

## Test 2: Calendar Detection (Trigger After Context)

After Test 1 response, type:
```
I tried calling once but they didn't pick up
```

**Expected Result:**
- ERA should offer to schedule a call
- Should contain "Would you like me to schedule"
- Should NOT ask more clarifying questions
- ✅ PASS if: ERA offers action after context gathered

---

## Test 3: Hypothetical Query (No Action Trigger)

Type `!reset` first, then:
```
What should I do if an employee misses 3 shifts?
```

**Expected Result:**
- ERA explains the policy/process
- Educational response (steps to follow)
- Should NOT offer to schedule a call
- ✅ PASS if: Policy explanation only, no actions

---

## Test 4: Email Detection

Type `!reset` first, then:
```
Employee has been late 5 times this month
```

**Expected Result (First Response):**
- ERA asks clarifying questions
- Should NOT offer to draft email yet

Then type:
```
Yes I've documented it and spoke with them verbally
```

**Expected Result (Second Response):**
- ERA should offer to draft email
- Should contain "Would you like me to draft"
- ✅ PASS if: Email offered after context gathered

---

## Quick Copy-Paste Sequence

```bash
# Test 1: Calendar - no premature trigger
My employee didn't show up for 3 days

# Test 2: Calendar - trigger after context
I tried calling once but they didn't pick up

# Test 3: Hypothetical - no action
!reset
What should I do if an employee misses 3 shifts?

# Test 4: Email detection
!reset
Employee has been late 5 times this month
# (wait for response, then:)
Yes I've documented it and spoke with them verbally
```

---

## What You're Looking For

### ✅ Good Behavior (Context-Aware Working):
- First message → ERA asks questions (no actions offered)
- Second message → ERA offers action ("Would you like me to...")
- Hypothetical → ERA explains policy (no actions)

### ❌ Bad Behavior (Detection Broken):
- First message → ERA immediately offers calendar/email
- ERA never offers actions even after context provided
- Hypothetical questions trigger calendar/email

---

## Commands:
- `!reset` - Start fresh conversation
- `!debug` - Show detailed search results
- `!quit` - Exit
