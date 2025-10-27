# Intent Detection System

**Version:** 1.0.0
**Status:** Implementation Phase
**Author:** ERA Development Team
**Last Updated:** 2025-10-27

---

## Overview

The Intent Detection System uses Large Language Models (LLMs) to intelligently detect when ERA's responses recommend actions that require calendar booking or email sending. This replaces the previous keyword-matching approach with a more robust, context-aware solution.

## Problem Statement

### Current Approach (Keyword Matching)
The existing system uses hardcoded keyword lists to detect when to offer calendar booking or email sending:

**Calendar Keywords:**
```typescript
['call them', 'reach out to them', 'next step is to call', ...]
// 26 total phrases
```

**Email Keywords:**
```typescript
['send an email', 'draft a message', 'follow up in writing', ...]
// Similar hardcoded list
```

### Problems with Keyword Matching

1. **False Positives**: "don't call them" triggers calendar
2. **False Negatives**: "get them on the phone" doesn't trigger
3. **Maintenance Burden**: Requires constant updates for new phrasings
4. **No Context Understanding**: Can't distinguish recommendations from references
5. **No Negation Detection**: "you shouldn't call" still triggers
6. **Brittle to Paraphrasing**: Misses natural language variations

### Real-World Failure Examples

**Example 1 - False Negative:**
```
ERA: "The next step is to call your employee..."
Keyword Match: ❌ FALSE (phrase not in list)
Should Trigger: ✅ YES (clear recommendation)
```

**Example 2 - Missing Context:**
```
ERA: "After you call them and they explain the situation..."
Keyword Match: ✅ TRUE (found "call them")
Should Trigger: ❌ NO (not a recommendation, just describing a scenario)
```

---

## Solution: LLM-Based Intent Detection

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ERA Response Generated                    │
│              "The next step is to call them..."             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Intent Detector      │
         │   (Parallel Check)     │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌────────────────┐      ┌────────────────┐
│  LLM Detection │      │ Keyword (Old)  │
│  GPT-4o-mini   │      │   Fallback     │
│  ~100-150ms    │      │   <1ms         │
└────────┬───────┘      └────────┬───────┘
         │                       │
         │  ┌────────────────────┘
         │  │
         ▼  ▼
    ┌─────────────────────┐
    │  Comparison Logging  │
    │  Agreement? Y/N      │
    └──────────┬───────────┘
               │
               ▼
      ┌────────────────────┐
      │  Final Decision     │
      │  (Use LLM result)   │
      └──────────┬──────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │ Trigger Calendar/Email │
     │ or Continue            │
     └───────────────────────┘
```

### Component Description

**1. Intent Detector Service (`src/services/intent-detector.ts`)**
- Central service for LLM-based intent classification
- Uses OpenAI GPT-4o-mini model
- Handles both calendar and email intent detection
- Runs detections in parallel for performance
- Falls back to keyword detection on failures

**2. Calendar Intent Detection**
- Analyzes if ERA recommends calling/contacting employee
- Considers direct recommendations, indirect suggestions, next steps
- Ignores past tense, hypotheticals, and employee-to-manager calls

**3. Email Intent Detection**
- Analyzes if ERA recommends sending email/written documentation
- Considers email drafts, follow-up requests, documentation needs
- Ignores receiving emails, mentions of email addresses

---

## LLM Prompts

### Calendar Intent Prompt

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

### Email Intent Prompt

```
Analyze if this HR guidance recommends that the manager should send an email or written documentation to the employee.

Response: "{response}"

Consider as TRIGGERS:
- Direct recommendations: "send an email", "draft a message", "email them"
- Documentation: "follow up in writing", "send written notice"
- Templates offered: "here's an email template", "want me to draft"
- Next steps: "then email them", "follow up with email"

DO NOT trigger for:
- Receiving emails: "wait for their email response"
- Email as contact: "their email is john@company.com"
- Past tense: "you already emailed them"
- Mentions only: "email is one way to reach them"
- Questions: "have you sent an email?"

Answer in JSON:
{
  "should_trigger_email": true/false,
  "confidence": "high/medium/low",
  "reasoning": "brief explanation in one sentence"
}
```

---

## Comparison Logging

### Log Format

```
═══════════════════════════════════════════════════════════════
📊 INTENT DETECTION COMPARISON
═══════════════════════════════════════════════════════════════
Type: CALENDAR
Conversation ID: abc123
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
  Reasoning: "Explicitly states 'call your employee' as next step"
  Time: 127ms
───────────────────────────────────────────────────────────────
Agreement: ⚠️ DISAGREEMENT
Final Decision: ✅ TRIGGER CALENDAR (using LLM)
═══════════════════════════════════════════════════════════════
```

### Disagreement Tracking

Track cases where keyword and LLM disagree:
- **LLM=true, Keyword=false**: Potential false negative in keyword system
- **LLM=false, Keyword=true**: Potential false positive in keyword system

After 100 messages, analyze disagreements to validate LLM accuracy.

---

## Error Handling & Fallback

### Failure Modes

| Error Type | Fallback Behavior | Logging |
|------------|-------------------|---------|
| **API Timeout (>3s)** | Use keyword detection | ⚠️ WARNING: LLM timeout, using keyword fallback |
| **Invalid JSON** | Parse as boolean, or fallback | ⚠️ WARNING: Invalid LLM JSON, using keyword fallback |
| **Network Error** | Use keyword detection | ❌ ERROR: Network failure, using keyword fallback |
| **Rate Limit** | Use keyword detection | ⚠️ WARNING: Rate limited, using keyword fallback |
| **OpenAI API Down** | Use keyword detection | ❌ ERROR: OpenAI unavailable, using keyword fallback |

### Fallback Strategy

```typescript
async detectIntent(response: string): Promise<boolean> {
  try {
    const llmResult = await this.detectWithLLM(response);
    return llmResult.should_trigger;
  } catch (error) {
    console.warn(`⚠️ LLM detection failed: ${error.message}`);
    console.log(`   Fallback: Using keyword detection`);
    return this.detectWithKeywords(response);
  }
}
```

---

## Cost & Performance Analysis

### API Costs (GPT-4o-mini)

**Per Message:**
- Input tokens: ~200 tokens × $0.150/1M = $0.00003
- Output tokens: ~50 tokens × $0.600/1M = $0.00003
- **Total per detection: ~$0.00006**
- **Total per message (calendar + email): ~$0.00012**

**Monthly at 10,000 messages:**
- 10,000 messages × $0.00012 = **$1.20/month**
- 20,000 LLM calls (calendar + email)

**Annual at 120,000 messages:**
- 120,000 messages × $0.00012 = **$14.40/year**

### Performance Impact

| Metric | Keyword | LLM (Sequential) | LLM (Parallel) |
|--------|---------|------------------|----------------|
| **Calendar Detection** | <1ms | 100-150ms | 100-150ms |
| **Email Detection** | <1ms | 100-150ms | - |
| **Total Time** | <1ms | 200-300ms | 100-150ms |
| **Added Latency** | 0ms | +200-300ms | +100-150ms |

**Recommendation:** Use parallel detection for both calendar and email to minimize latency impact.

---

## Configuration

### Environment Variables

```bash
# Enable/disable LLM intent detection
INTENT_DETECTION_ENABLED=true

# Logging level: verbose, minimal, off
INTENT_DETECTION_LOGGING=verbose

# LLM timeout in milliseconds
INTENT_DETECTION_TIMEOUT=3000

# Fallback to keywords on failure
INTENT_DETECTION_FALLBACK=keyword
```

### Runtime Toggle

Allows switching between LLM and keyword detection without redeployment:

```typescript
if (process.env.INTENT_DETECTION_ENABLED === 'true') {
  return await this.detectWithLLM(response);
} else {
  return this.detectWithKeywords(response);
}
```

---

## Testing Strategy

### Phase 1: Comparison Mode (Week 1)
- Deploy with LLM enabled
- Run both LLM and keyword in parallel
- **Use keyword results** for actual decisions
- Log all disagreements
- Collect data to validate accuracy

### Phase 2: Pilot Mode (Week 2)
- Switch to using **LLM results** for decisions
- Keep keyword as fallback only
- Monitor for false positives/negatives
- Quick rollback if issues detected

### Phase 3: Production
- Full LLM-based detection
- Remove keyword comparison logging
- Keep keyword as emergency fallback only

---

## Success Metrics

### Accuracy Targets
- **Precision**: >95% (few false positives)
- **Recall**: >98% (catch all real recommendations)
- **Agreement with human judgment**: >95%

### Performance Targets
- **LLM response time**: <200ms (p95)
- **Fallback rate**: <1% (LLM failures)
- **Cost**: <$2/month for 10k messages

### Quality Indicators
- Reduced disagreement rate over time
- Fewer user complaints about missed/wrong triggers
- More natural language variations handled correctly

---

## Migration Plan

### Step 1: Implement (Week 1)
- Create IntentDetector service
- Update calendar/email handlers
- Add comprehensive tests
- Deploy with comparison mode

### Step 2: Validate (Week 2)
- Collect 1000+ comparison logs
- Analyze disagreements
- Tune prompts if needed
- Confirm >95% agreement

### Step 3: Switch Primary (Week 3)
- Change to use LLM results
- Keep keyword as fallback
- Monitor closely for 1 week

### Step 4: Cleanup (Week 4)
- Remove comparison logging
- Keep keyword code for emergency fallback
- Document lessons learned

---

## Rollback Plan

If issues arise:

1. **Immediate**: Set `INTENT_DETECTION_ENABLED=false` in Render
2. **Quick**: Redeploy previous commit
3. **Analysis**: Review logs to identify failure patterns
4. **Fix**: Update prompts or add edge case handling
5. **Retry**: Re-enable with fixes

**Time to rollback: 2-3 minutes** (environment variable change)

---

## Related Documents

- [Calendar Intent Detection Spec](./INTENT_DETECTION_CALENDAR.md) - Detailed calendar spec
- [Email Intent Detection Spec](./INTENT_DETECTION_EMAIL.md) - Detailed email spec
- [Testing Plan](./TEST_PLAN.md) - Comprehensive testing strategy

---

## Appendix: Keyword Lists (For Fallback)

### Calendar Keywords (26 phrases)
```
'schedule a call', 'call the employee', 'call your employee', 'call them',
'reach out to them', 'reach out to your employee', 'contact them',
'contact your employee', 'give them a call', 'try calling',
'next step is to call', 'you should call', 'you need to call',
'phone call', 'set up a call', 'arrange a call', 'reach them',
'get in touch with them', 'make a second call', 'schedule that call',
'phone them', 'schedule a meeting', 'schedule that', 'check your calendar',
'find available times', 'would you like me to schedule'
```

### Email Keywords (Similar list maintained for fallback)
