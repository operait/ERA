# ERA Response Metrics Framework Specification

**Version:** 1.0
**Purpose:** Define objective and subjective metrics for evaluating ERA's response quality.

---

## Overview

The metrics framework provides:
1. **Objective metrics** - Can be scored programmatically (automation-ready)
2. **Subjective metrics** - Require human judgment (Meg's expertise)
3. **Composite scoring** - Overall quality score combining multiple metrics
4. **Baseline tracking** - Compare prompt versions over time
5. **DSPy readiness** - Structure metrics for future DSPy integration

This framework will help Meg and Barry:
- Measure improvement from prompt tuning
- Identify weak areas in ERA's responses
- Make data-driven decisions about prompt changes
- Prepare for automated prompt optimization (DSPy)

---

## Metric Categories

### 1. Objective Metrics (Automated Scoring)

These can be computed programmatically without human judgment.

| Metric | Type | Range | Description | Implementation |
|--------|------|-------|-------------|----------------|
| `has_policy_citation` | Boolean | 0-1 | Does response cite a specific policy? | Regex: `Policy:`, `per our`, `according to` |
| `appropriate_action_suggested` | Boolean | 0-1 | Does response recommend email/calendar/call when relevant? | Check for: `email`, `call`, `calendar`, `schedule` |
| `response_structure_complete` | Boolean | 0-1 | Does response have greeting + answer + next steps? | Check for structural components |
| `citation_accuracy` | Float | 0-1 | How accurate is the policy citation? | Compare cited text to actual policy chunk |
| `response_length_appropriate` | Boolean | 0-1 | Is response length appropriate (not too short/long)? | 100-500 words = appropriate |
| `asks_clarifying_questions` | Boolean | 0-1 | For ACTIVE situations, does ERA ask clarifying questions first? | Check for `?` in first response + ACTIVE detection |
| `sequential_action_correct` | Boolean | 0-1 | Does ERA offer ONE action at a time (not call + email together)? | Check response doesn't contain both call and email offers |
| `rag_similarity_score` | Float | 0-1 | Average similarity of retrieved policy chunks | From RAG system |
| `processing_time_acceptable` | Boolean | 0-1 | Did ERA respond within 3 seconds? | `processing_time_ms < 3000` |

### 2. Subjective Metrics (Human Scoring)

These require Meg's judgment based on HR expertise.

| Metric | Type | Range | Description | Scoring Guide |
|--------|------|-------|-------------|---------------|
| `professionalism_score` | Integer | 1-5 | How professional is the tone? | 1=Unprofessional, 3=Adequate, 5=Exemplary |
| `empathy_score` | Integer | 1-5 | How empathetic is the response? | 1=Cold, 3=Neutral, 5=Highly empathetic |
| `clarity_score` | Integer | 1-5 | How clear and understandable is the response? | 1=Confusing, 3=Clear, 5=Crystal clear |
| `actionability_score` | Integer | 1-5 | How actionable are the next steps? | 1=Vague, 3=Specific, 5=Step-by-step |
| `compliance_score` | Integer | 1-5 | How well does it handle compliance (FMLA, ADA, etc.)? | 1=Risky, 3=Safe, 5=Excellent escalation |

### 3. Composite Metrics (Calculated)

Derived from other metrics to give an overall quality score.

| Metric | Formula | Range | Description |
|--------|---------|-------|-------------|
| `objective_quality_score` | Average of all objective metrics | 0-1 | Overall automated quality |
| `subjective_quality_score` | Average of all subjective metrics / 5 | 0-1 | Overall human-rated quality |
| `overall_quality_score` | (objective × 0.4) + (subjective × 0.6) | 0-1 | Weighted overall quality (subjective weighted higher) |

---

## Metric Definitions (Detailed)

### Objective Metric 1: `has_policy_citation`

**What it measures:** Does ERA cite a specific policy in the response?

**Scoring:**
- `1` (TRUE) - Response contains policy citation
- `0` (FALSE) - No policy citation

**Detection Logic:**

```typescript
function hasPolicyCitation(response: string): boolean {
  const citationPatterns = [
    /policy:/i,
    /per our .+ policy/i,
    /according to .+ policy/i,
    /fitness connection policy/i,
    /our .+ policy states/i,
    /\[policy reference:/i
  ];

  return citationPatterns.some(pattern => pattern.test(response));
}
```

**Examples:**
- ✅ "Per our No Call No Show policy, employees who miss three consecutive shifts..."
- ✅ "According to the Attendance Policy, managers should..."
- ❌ "You should call the employee and document the absence."

---

### Objective Metric 2: `appropriate_action_suggested`

**What it measures:** Does ERA recommend the appropriate next action (email, call, calendar, escalate)?

**Scoring:**
- `1` (TRUE) - Appropriate action is suggested
- `0` (FALSE) - No action suggested OR inappropriate action

**Detection Logic:**

```typescript
function hasAppropriateAction(response: string, scenario: string): boolean {
  const actionKeywords = {
    email: /email|send.*message|written communication/i,
    call: /call|phone|speak.*directly|contact.*employee/i,
    calendar: /schedule|calendar|book.*call|set up.*meeting/i,
    escalate: /escalate|contact hr|reach out.*hr/i,
    document: /document|record|log|track/i
  };

  // At least one action keyword should be present
  return Object.values(actionKeywords).some(pattern => pattern.test(response));
}
```

**Examples:**
- ✅ "I recommend you call the employee to discuss this situation."
- ✅ "Would you like me to help draft an email to the employee?"
- ✅ "This should be escalated to HR for FMLA review."
- ❌ "That's a tough situation." (No action suggested)

---

### Objective Metric 3: `response_structure_complete`

**What it measures:** Does the response have proper structure (acknowledgment + guidance + next steps)?

**Scoring:**
- `1` (TRUE) - Response has all required components
- `0` (FALSE) - Missing one or more components

**Required Components:**
1. **Acknowledgment** - Recognizes the user's situation
2. **Guidance** - Provides answer/steps based on policy
3. **Next Steps** - Clear action items or follow-up

**Detection Logic:**

```typescript
function hasCompleteStructure(response: string): boolean {
  // Check for acknowledgment (first ~50 chars should have one)
  const acknowledgmentPatterns = [
    /^(got it|thanks|okay|i understand|that's|this is)/i,
    /^hi\s+\w+|^hello\s+\w+/i
  ];

  const hasAcknowledgment = acknowledgmentPatterns.some(pattern =>
    pattern.test(response.substring(0, 100))
  );

  // Check for guidance content (should have policy or step-by-step info)
  const hasGuidance = response.length > 100; // Guidance is substantive

  // Check for next steps (should have actionable language)
  const nextStepPatterns = [
    /next step/i,
    /here's what/i,
    /would you like/i,
    /\d+\.\s/g // Numbered lists
  ];

  const hasNextSteps = nextStepPatterns.some(pattern => pattern.test(response));

  return hasAcknowledgment && hasGuidance && hasNextSteps;
}
```

---

### Objective Metric 4: `citation_accuracy`

**What it measures:** How accurate is the cited policy compared to actual policy content?

**Scoring:**
- `1.0` - Citation is 100% accurate
- `0.5-0.99` - Citation is mostly accurate but paraphrased
- `0.0-0.49` - Citation is inaccurate or misleading

**Detection Logic:**

```typescript
function measureCitationAccuracy(
  response: string,
  searchResults: SearchResult[]
): number {
  // Extract cited text from response
  const citedText = extractCitedText(response);
  if (!citedText) return 0;

  // Compare to actual policy chunks
  const similarities = searchResults.map(result =>
    cosineSimilarity(citedText, result.chunk_text)
  );

  return Math.max(...similarities);
}
```

**Note:** This requires comparing the response text to the RAG search results. Can use simple string matching or semantic similarity.

---

### Objective Metric 5: `asks_clarifying_questions`

**What it measures:** For ACTIVE situations, does ERA ask clarifying questions BEFORE providing guidance?

**Scoring:**
- `1` (TRUE) - ERA asks clarifying questions first
- `0` (FALSE) - ERA provides guidance without clarifying
- `N/A` - Not applicable (hypothetical question, not active situation)

**Detection Logic:**

```typescript
function asksClarifyingQuestions(
  query: string,
  response: string,
  isFirstResponse: boolean
): boolean | null {
  // Only applicable for ACTIVE situations
  const isActive = /\b(my|our)\b/i.test(query) || hasProperName(query);
  if (!isActive) return null; // N/A

  // Only applicable for first response
  if (!isFirstResponse) return null; // N/A

  // Check if response asks questions
  const questionCount = (response.match(/\?/g) || []).length;
  const hasClarifyingQuestion = questionCount >= 1;

  // Check if response ALSO provides guidance (should NOT)
  const providesGuidance = /immediate steps|here's what|next steps/i.test(response);

  // Should ask questions WITHOUT providing guidance yet
  return hasClarifyingQuestion && !providesGuidance;
}
```

---

### Objective Metric 6: `sequential_action_correct`

**What it measures:** Does ERA offer ONE action at a time (call first, THEN email after call completes)?

**Scoring:**
- `1` (TRUE) - Offers one action (sequential approach)
- `0` (FALSE) - Offers multiple actions simultaneously (call + email)

**Detection Logic:**

```typescript
function sequentialActionCorrect(response: string): boolean {
  const hasCallOffer = /call|phone|speak.*directly/i.test(response);
  const hasEmailOffer = /draft.*email|help.*email|send.*email/i.test(response);

  // If both are offered in same response, it's WRONG (should be sequential)
  if (hasCallOffer && hasEmailOffer) return false;

  // If only one is offered, it's correct
  return true;
}
```

**Examples:**
- ✅ "Since you need to call the employee, would you like me to schedule that call?" (Only call)
- ❌ "You should call the employee. Would you also like me to draft a follow-up email?" (Call + email together)

---

### Subjective Metric 1: `professionalism_score`

**What it measures:** How professional is the tone and language?

**Scoring Guide:**

| Score | Description | Examples |
|-------|-------------|----------|
| 1 | Unprofessional - Too casual, slang, inappropriate | "Dude, that employee is totally ghosting you." |
| 2 | Somewhat unprofessional - Too informal for HR context | "Yeah, just fire them lol" |
| 3 | Adequate - Professional but could be more polished | "You should probably talk to them about this." |
| 4 | Professional - Appropriate tone for HR guidance | "I recommend scheduling a formal conversation to address this." |
| 5 | Exemplary - Polished, confident, and perfectly professional | "Per our policy, the next step is to document this incident and schedule a formal discussion with the employee." |

**Meg's Scoring:** Meg manually assigns this score based on overall tone.

---

### Subjective Metric 2: `empathy_score`

**What it measures:** How empathetic is the response to the manager's situation?

**Scoring Guide:**

| Score | Description | Examples |
|-------|-------------|----------|
| 1 | Cold - No acknowledgment of difficulty | "Employee missed shifts. Follow policy." |
| 2 | Minimal empathy - Brief acknowledgment | "This is a policy violation." |
| 3 | Neutral - Acknowledges situation without much warmth | "I understand this is a situation that needs to be addressed." |
| 4 | Empathetic - Warm acknowledgment of difficulty | "That sounds challenging — let's figure out the best way to handle this together." |
| 5 | Highly empathetic - Strong acknowledgment + support | "I can see this is a tough situation, and I'm here to help you navigate it thoughtfully and compliantly." |

---

### Subjective Metric 3: `clarity_score`

**What it measures:** How clear and understandable is the response?

**Scoring Guide:**

| Score | Description |
|-------|-------------|
| 1 | Confusing - Hard to understand what to do next |
| 2 | Somewhat unclear - Main point is vague |
| 3 | Clear - Easy to understand the guidance |
| 4 | Very clear - Well-organized and easy to follow |
| 5 | Crystal clear - Step-by-step, no ambiguity |

---

## Metrics Implementation

### 1. Metrics Module

**Location:** `src/metrics/evaluator.ts`

**Purpose:** Calculate all objective metrics for a response.

```typescript
export interface ResponseMetrics {
  // Objective metrics (automated)
  has_policy_citation: boolean;
  appropriate_action_suggested: boolean;
  response_structure_complete: boolean;
  citation_accuracy: number;
  response_length_appropriate: boolean;
  asks_clarifying_questions: boolean | null; // null = N/A
  sequential_action_correct: boolean;
  rag_similarity_score: number;
  processing_time_acceptable: boolean;

  // Calculated objective score
  objective_quality_score: number;

  // Subjective metrics (set by human scorer)
  professionalism_score?: number; // 1-5
  empathy_score?: number; // 1-5
  clarity_score?: number; // 1-5
  actionability_score?: number; // 1-5
  compliance_score?: number; // 1-5

  // Calculated subjective score
  subjective_quality_score?: number;

  // Overall composite score
  overall_quality_score?: number;
}

export class ResponseEvaluator {
  evaluate(
    query: string,
    response: string,
    searchContext: SearchContext,
    processingTimeMs: number,
    isFirstResponse: boolean
  ): ResponseMetrics {
    // Calculate all objective metrics
    // Return metrics object
  }

  calculateObjectiveScore(metrics: ResponseMetrics): number {
    // Average of all objective boolean/float metrics
  }

  calculateSubjectiveScore(metrics: ResponseMetrics): number {
    // Average of all subjective scores (1-5) / 5
  }

  calculateOverallScore(metrics: ResponseMetrics): number {
    // Weighted: objective 40%, subjective 60%
  }
}
```

### 2. Database Storage

**Add to `tuning_conversation_turns` table:**

```sql
ALTER TABLE tuning_conversation_turns
ADD COLUMN metrics JSONB DEFAULT '{}'::jsonb;

-- Store metrics as JSON
-- Example:
-- {
--   "has_policy_citation": true,
--   "appropriate_action_suggested": true,
--   "objective_quality_score": 0.85,
--   "professionalism_score": 4,
--   "empathy_score": 5,
--   "subjective_quality_score": 0.87,
--   "overall_quality_score": 0.86
-- }
```

### 3. CSV Export Enhancement

**Include metrics in CSV export:**

```csv
Turn,User Message,ERA Response,Improvement Notes,Category,Objective Score,Subjective Score,Overall Score,Timestamp
1,"My employee didn't show up","Got it — that's...","Should ask clarifying questions","content",0.85,0.87,0.86,"2025-10-24 10:00:00"
```

---

## Metrics Collection Workflow

### During Conversation Turn

```
1. User sends message
   ↓
2. ERA generates response
   ↓
3. System calculates OBJECTIVE metrics automatically
   ↓
4. Store turn + metrics in database
   ↓
5. (Later) Meg uses !score command to add SUBJECTIVE metrics
```

### New Command: `!score`

**Purpose:** Allow Meg to add subjective scores to the last response.

**Syntax:**
```
!score professionalism:4 empathy:5 clarity:5
```

**Behavior:**
- Updates the latest turn with subjective metrics
- Recalculates subjective_quality_score and overall_quality_score
- Shows confirmation with updated overall score

**Example:**
```
Meg: !score professionalism:4 empathy:5 clarity:5 actionability:4 compliance:5

✅ Subjective scores added!

Objective Quality: 0.85
Subjective Quality: 0.90
Overall Quality: 0.88
```

---

## Metrics Analysis

### Aggregate Session Metrics

**Query to get average metrics for a session:**

```sql
SELECT
  s.id AS session_id,
  s.master_prompt_version,
  AVG((t.metrics->>'objective_quality_score')::float) AS avg_objective_quality,
  AVG((t.metrics->>'subjective_quality_score')::float) AS avg_subjective_quality,
  AVG((t.metrics->>'overall_quality_score')::float) AS avg_overall_quality,
  COUNT(*) AS total_turns
FROM prompt_tuning_sessions s
JOIN tuning_conversation_turns t ON t.session_id = s.id
WHERE s.id = 'abc-123'
GROUP BY s.id, s.master_prompt_version;
```

### Compare Prompt Versions

**Query to compare two prompt versions:**

```sql
SELECT
  s.master_prompt_version,
  AVG((t.metrics->>'overall_quality_score')::float) AS avg_quality,
  COUNT(*) AS sample_size
FROM prompt_tuning_sessions s
JOIN tuning_conversation_turns t ON t.session_id = s.id
WHERE s.master_prompt_version IN ('fc26922', 'ee59fe5')
GROUP BY s.master_prompt_version;
```

**Example Results:**

| master_prompt_version | avg_quality | sample_size |
|-----------------------|-------------|-------------|
| fc26922 | 0.78 | 45 |
| ee59fe5 | 0.86 | 38 |

**Conclusion:** Version `ee59fe5` improved quality by 8 percentage points! 🎉

---

## DSPy Integration Readiness

These metrics are structured to work with DSPy optimizers:

```python
import dspy

# ERA's quality metric function (for DSPy)
def era_quality(example, prediction):
    metrics = calculate_metrics(
        example.query,
        prediction.response,
        example.search_context
    )

    # Return 0-1 score
    return metrics['overall_quality_score']

# Use in DSPy optimizer
optimizer = dspy.BootstrapFewShot(metric=era_quality)
optimized_era = optimizer.compile(ERA(), trainset=examples)
```

---

## Success Criteria

**For the metrics framework to be successful:**
- ✅ All objective metrics can be calculated automatically
- ✅ Subjective metrics have clear scoring guides
- ✅ Metrics are stored in database for historical analysis
- ✅ CSV exports include metrics data
- ✅ Can compare prompt versions objectively
- ✅ Metrics inform prompt tuning decisions
- ✅ Framework is ready for DSPy integration

---

## Open Questions

1. **Metric weighting:** Should some metrics be weighted more heavily than others?
2. **Threshold for "good":** What overall_quality_score is considered "production ready"? (e.g., 0.85?)
3. **Metrics per scenario:** Should different scenarios have different metric priorities?
4. **Automated subjective scoring:** Can we use an LLM to auto-score subjective metrics initially?

---

## Future Enhancements

- **Metrics dashboard** - Visualize metrics over time
- **Automated regression detection** - Alert if quality drops after prompt change
- **Per-category metrics** - Different metrics for attendance vs. discipline scenarios
- **A/B testing framework** - Test two prompt versions in parallel
- **Automated golden examples** - Automatically select high-scoring responses as examples
