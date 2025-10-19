# Clarification Protocol Test Suite

This document defines the expected behavior for ERA's clarification protocol to prevent regressions.

## Test Cases

### 1. ACTIVE vs HYPOTHETICAL Detection

#### ACTIVE SITUATIONS (Must Ask Clarifying Questions First)

These queries contain "my," "our," or specific employee names and should trigger clarifying questions BEFORE providing guidance.

| Query | Expected First Response | Should NOT Include |
|-------|------------------------|-------------------|
| `"What should I do if my employee doesn't show up for 3 days in a row?"` | "Have you tried reaching out...?" | "Immediate Steps" or calendar booking |
| `"My employee didn't show up for 3 days"` | "Have you tried...?" | "Immediate Steps" or calendar booking |
| `"My employee John hasn't shown up"` | "Have you tried...?" | "Immediate Steps" or calendar booking |
| `"Our team member is having issues"` | "Have you tried...?" | "Immediate Steps" or calendar booking |
| `"Sarah missed three shifts"` | "Have you tried...?" | "Immediate Steps" or calendar booking |

**Critical Test (v3.1.3 Fix):**
- Query: `"What should I do if my employee doesn't show up for 3 days in a row?"`
- This was **FAILING** before v3.1.3 (Claude treated it as HYPOTHETICAL)
- Now **MUST** be treated as ACTIVE because it contains "my"
- Expected: Ask clarifying questions first

#### HYPOTHETICAL SITUATIONS (Can Provide Full Guidance Immediately)

These queries use generic references only ("an employee," "someone," "employees") and can provide immediate guidance.

| Query | Expected Behavior |
|-------|-------------------|
| `"What should I do if an employee doesn't show up for 3 days?"` | Provide full policy guidance immediately |
| `"How do I handle someone who is late?"` | Provide full policy guidance immediately |
| `"What's the process for employees who miss shifts?"` | Provide full policy guidance immediately |
| `"What should I do if a worker doesn't call in?"` | Provide full policy guidance immediately |

### 2. Sequential Action Workflow (v3.1.2)

ERA must focus on ONE action at a time. When recommending a call, ERA should:
1. Help schedule the call
2. STOP (do NOT offer email drafting)
3. Wait for manager to complete call and report back
4. THEN offer email drafting if needed based on call outcome

#### Test Case: Call First, Then Email

**Conversation Flow:**

```
Manager: "What should I do if my employee doesn't show up for 3 days in a row?"
ERA: "Have you tried reaching out to them yet?"  [STOP]

Manager: "I tried calling once but they didn't pick up. Three consecutive days."
ERA: "Since you need to call the employee, would you like me to schedule that call?"  [STOP - NO email offer]

Manager: "I called them and they said they were sick."
ERA: "Since they mentioned being sick, we need to explore if this qualifies for medical leave.
      Would you like me to help draft the email to HR?"  [NOW can offer email]
```

**What Should NOT Happen:**
```
Manager: "I tried calling once but they didn't pick up."
ERA: "You should call them again. Would you like me to schedule the call?
     Also, would you like me to draft an email?"  [WRONG - offers both call AND email]
```

### 3. Conversation Context Recognition

ERA should recognize when the user is answering a clarifying question and provide guidance (not ask more questions).

**Test:**
```
Manager: "My employee didn't show up"
ERA: "Have you tried reaching out to them?"
Manager: "Yes, I called them once today"
ERA: "Since you've already made one attempt, here's what to do next..." [Provide guidance]
```

**Should NOT happen:**
```
ERA: "Have you called them? Also, how many days were missed?"  [Don't ask multiple new questions]
```

## Manual Testing Checklist

Test these scenarios in Teams and verify ERA's behavior matches expectations:

- [ ] Query: "What should I do if my employee doesn't show up for 3 days?" → Should ask clarifying questions
- [ ] Query: "What should I do if an employee doesn't show up for 3 days?" → Should provide immediate guidance
- [ ] After clarifying questions are answered → Should offer calendar booking if recommending call
- [ ] Should NOT offer both call AND email in same response
- [ ] After manager reports call was completed → THEN can offer email drafting

## Automated Test Commands

Once Jest tests are implemented:

```bash
# Run all clarification protocol tests
npm test -- clarification-protocol.test.ts

# Run specific test suite
npm test -- --testNamePattern="ACTIVE vs HYPOTHETICAL"

# Run with coverage
npm test -- --coverage clarification-protocol.test.ts
```

## Expected Test Results

All tests should **PASS** after v3.1.3. If any test fails, it indicates a regression in the clarification protocol.

### Key Assertions

1. **ACTIVE Detection**: Queries with "my," "our," or names → Ask questions first
2. **HYPOTHETICAL Detection**: Queries with "an employee," "someone" → Provide guidance immediately
3. **Sequential Workflow**: Recommend call → Offer calendar → STOP (no email yet)
4. **Follow-up Context**: After call completed → THEN offer email if needed

## Version History

- **v3.1.3**: Fixed ACTIVE detection for "What should I do if MY employee..." queries
- **v3.1.2**: Added Sequential Action Workflow (call first, then email)
- **v3.1.1**: Initial clarification protocol implementation
