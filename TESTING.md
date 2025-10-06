# ERA Testing & Validation Guide

## Overview
Comprehensive testing checklist to verify ERA is working correctly before production deployment to Fitness Connection.

## Test Environment Setup

### Prerequisites Checklist
- ✅ Supabase database configured with all tables
- ✅ Fitness Connection data loaded (12 JSONL files)
- ✅ OpenAI embeddings generated for all chunks
- ✅ Render service deployed and running
- ✅ Azure Bot configured with Teams channel
- ✅ Bot installed in Teams

## Testing Phases

### Phase 1: Infrastructure Tests

#### 1.1 Database Connectivity

```bash
npx tsx src/ingestion/load-policies.ts stats
```

**Expected Output:**
```
=== Database Statistics ===
Total documents: 12
Total chunks: 150-200
Documents by category:
  attendance: 2
  disciplinary: 3
  termination: 2
  ...
```

**Pass Criteria:** ✅ All counts > 0

#### 1.2 Embedding Verification

```bash
npx tsx src/embeddings/generate.ts stats
```

**Expected Output:**
```
=== Embedding Statistics ===
Total chunks: 150-200
Chunks with embeddings: 150-200
Chunks missing embeddings: 0
Completion: 100.0%
```

**Pass Criteria:** ✅ 100% completion

#### 1.3 Health Endpoint

```bash
curl https://your-app.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-..."
}
```

**Pass Criteria:** ✅ HTTP 200, status: "healthy"

#### 1.4 Bot Endpoint Accessibility

```bash
curl -X POST https://your-app.onrender.com/api/messages \
  -H "Content-Type: application/json" \
  -d '{"type":"message"}'
```

**Pass Criteria:** ✅ No connection errors (response may be auth error - that's OK)

### Phase 2: RAG System Tests

#### 2.1 Vector Search Test

Test semantic search directly (requires local environment with .env configured):

```typescript
// Create test file: test-search.ts
import { DocumentRetriever } from './src/retrieval/search.js';

const retriever = new DocumentRetriever();
const results = await retriever.search('employee missed shifts without calling');

console.log('Search Results:', results.totalResults);
console.log('Avg Similarity:', results.avgSimilarity);
results.results.forEach((r, i) => {
  console.log(`${i+1}. ${r.document_title} (${r.similarity.toFixed(3)})`);
});
```

**Run:**
```bash
npx tsx test-search.ts
```

**Expected:**
- Total results: 3-5
- Avg similarity: > 0.75
- Top result about attendance/no-call-no-show policy

**Pass Criteria:** ✅ Relevant results with good similarity scores

#### 2.2 Template Matching Test

Query variations should match appropriate templates:

| Query | Expected Template Category |
|-------|---------------------------|
| "missed shifts" | attendance |
| "written warning" | disciplinary |
| "terminate employee" | termination |
| "performance issue" | performance |

**Pass Criteria:** ✅ Correct category matched

### Phase 3: Bot Conversation Tests

Test these queries in Microsoft Teams:

#### Test 3.1: Welcome Message

**Input:** "hello"

**Expected Response:**
```
👋 Welcome to ERA - Your HR Assistant!

I'm here to help Fitness Connection managers with HR policies...

What I can help with:
• Attendance and punctuality policies
• Disciplinary procedures...
```

**Pass Criteria:**
- ✅ Welcome message displays
- ✅ Clear instructions provided
- ✅ Response time < 2 seconds

#### Test 3.2: Attendance Violation - No Call/No Show

**Input:** "Employee missed 3 shifts without calling in, what do I do?"

**Expected Response Structure:**
```
🤖 ERA - HR Assistant

[Policy citation about no-call/no-show]

Recommended Actions:
1. Document each incident
2. Review progressive discipline
3. Consider termination if 3rd occurrence

[Email template with placeholders]

✅ High confidence response

📚 Sources: 2-3 policy document(s)
1. No Call No Show Policy
2. Attendance Policy

⏱️ Processed in XXXms
```

**Pass Criteria:**
- ✅ Mentions no-call/no-show policy
- ✅ Includes progressive discipline steps
- ✅ Provides email template or guidance
- ✅ Lists source documents
- ✅ Response time < 2 seconds
- ✅ Confidence score shown

#### Test 3.3: Written Warning

**Input:** "How do I issue a written warning?"

**Expected Response:**
- ✅ Explains written warning process
- ✅ References disciplinary action procedures
- ✅ Includes documentation requirements
- ✅ May include template

#### Test 3.4: Tardiness

**Input:** "Employee has been late 5 times this month"

**Expected Response:**
- ✅ References attendance/tardiness policy
- ✅ Explains progressive discipline
- ✅ Mentions documentation needs

#### Test 3.5: Termination Process

**Input:** "What's the process for terminating an employee?"

**Expected Response:**
- ✅ Outlines termination procedures
- ✅ Mentions HR approval requirement
- ✅ Lists documentation needed
- ✅ Includes final steps (exit interview, property return)

#### Test 3.6: Performance Improvement

**Input:** "How do I put someone on a PIP?"

**Expected Response:**
- ✅ Explains PIP process
- ✅ Mentions timeline (30-90 days)
- ✅ Lists required components
- ✅ References PIP templates

#### Test 3.7: Help Command

**Input:** "/help"

**Expected Response:**
```
🆘 ERA Help Commands

Available Commands:
• /help - Show this help message
• /stats - Show system statistics

Tips for better results:
• Be specific about the situation
...
```

**Pass Criteria:**
- ✅ Lists available commands
- ✅ Provides usage tips
- ✅ Shows example queries

#### Test 3.8: Stats Command

**Input:** "/stats"

**Expected Response:**
```
📊 ERA System Statistics (Last 7 Days)

• Total queries: X
• Average response time: XXms

Most common questions:
1. "..." (X times)

Policy categories accessed:
• attendance: X searches
```

**Pass Criteria:**
- ✅ Shows query statistics
- ✅ Lists common questions
- ✅ Shows category breakdown

### Phase 4: Edge Cases & Error Handling

#### Test 4.1: Ambiguous Query

**Input:** "policy"

**Expected:**
- ✅ Asks for clarification or shows general guidance
- ✅ No error/crash

#### Test 4.2: Off-Topic Query

**Input:** "What's the weather today?"

**Expected:**
- ✅ Politely indicates it's outside scope
- ✅ Suggests HR-related questions

#### Test 4.3: Very Long Query

**Input:** Long paragraph with multiple questions

**Expected:**
- ✅ Processes without error
- ✅ Attempts to address main points

#### Test 4.4: Empty Message

**Input:** (empty or just spaces)

**Expected:**
- ✅ Shows help/prompt for input
- ✅ No crash

### Phase 5: Performance Tests

#### 5.1 Response Time Benchmark

Test 10 queries and measure response time:

```bash
# Run queries and note timestamps
```

**Pass Criteria:**
- ✅ Average response time < 2 seconds
- ✅ Max response time < 5 seconds
- ✅ P95 < 3 seconds

#### 5.2 Concurrent Users

Have 3-5 people test simultaneously

**Pass Criteria:**
- ✅ No degradation in response time
- ✅ All queries processed correctly
- ✅ No errors in Render logs

#### 5.3 Database Load

Check Supabase dashboard for query performance

**Pass Criteria:**
- ✅ Query latency < 500ms
- ✅ No connection errors
- ✅ No timeout errors

### Phase 6: Data Quality Tests

#### 6.1 Source Attribution

For each test query, verify:

**Pass Criteria:**
- ✅ Sources are relevant to query
- ✅ Similarity scores > 0.70
- ✅ At least 2-3 sources cited
- ✅ Source titles match actual documents

#### 6.2 Response Accuracy

Manual review by HR expert:

**Pass Criteria:**
- ✅ Policy information is accurate
- ✅ No contradictory information
- ✅ Up-to-date with current policies
- ✅ Appropriate for Fitness Connection context

#### 6.3 Template Relevance

**Pass Criteria:**
- ✅ Templates match scenario appropriately
- ✅ Placeholders are clear and useful
- ✅ Email templates are professional

### Phase 7: Security & Compliance Tests

#### 7.1 Authentication

**Pass Criteria:**
- ✅ Only authenticated Teams users can access
- ✅ Bot doesn't expose API keys in responses
- ✅ Environment variables secured in Render

#### 7.2 Data Privacy

**Pass Criteria:**
- ✅ No personal employee data exposed
- ✅ Query logs don't contain sensitive info
- ✅ Complies with data retention policies

#### 7.3 Access Control

**Pass Criteria:**
- ✅ Only Fitness Connection managers can install/use
- ✅ Bot respects Teams permissions

## Test Results Documentation

### Test Run Template

```markdown
## Test Run - [Date]

**Tester:** [Name]
**Environment:** [Production/Staging]
**Bot Version:** [Commit SHA]

### Results Summary
- Total Tests: XX
- Passed: XX
- Failed: XX
- Skipped: XX

### Failed Tests
1. [Test Name]
   - Issue: [Description]
   - Severity: [High/Medium/Low]
   - Action: [Next steps]

### Performance Metrics
- Avg Response Time: XXms
- Min/Max: XX/XXms
- Database Queries: XX

### Notes
[Any observations or concerns]
```

## Acceptance Criteria

Before production deployment, ALL must pass:

### Critical (Must Pass)
- ✅ Database connectivity working
- ✅ All embeddings generated (100%)
- ✅ Health endpoint returns healthy
- ✅ Bot responds to basic queries
- ✅ Response time < 2 seconds average
- ✅ Source citations accurate
- ✅ No security vulnerabilities

### Important (Should Pass)
- ✅ Template matching works correctly
- ✅ Help and stats commands functional
- ✅ Error handling graceful
- ✅ All test scenarios pass
- ✅ Concurrent user handling

### Nice to Have
- ✅ Advanced query understanding
- ✅ Context awareness
- ✅ Follow-up question handling

## Continuous Testing

### Daily Health Checks
```bash
# Add to cron or monitoring service
curl https://era-bot.onrender.com/health
```

### Weekly Analytics Review
```sql
-- Check most common queries
SELECT query, COUNT(*) as count
FROM query_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY query
ORDER BY count DESC
LIMIT 10;

-- Check average response time
SELECT AVG(response_time_ms) as avg_ms
FROM query_logs
WHERE created_at > NOW() - INTERVAL '7 days';
```

### Monthly Regression Tests
- Re-run full test suite
- Update test cases based on new queries
- Review and improve responses

## Troubleshooting Test Failures

### Bot Not Responding
1. Check Render logs for errors
2. Verify environment variables
3. Test health endpoint
4. Check Azure Bot configuration

### Low Similarity Scores
1. Verify embeddings generated
2. Check query preprocessing
3. Review document chunking
4. Consider adjusting SIMILARITY_THRESHOLD

### Slow Response Times
1. Check database query performance
2. Review OpenAI API latency
3. Optimize chunking strategy
4. Consider caching frequent queries

## Next Steps After Testing

✅ All tests passing → Deploy to production
⚠️ Some tests failing → Fix issues and retest
❌ Critical tests failing → Do not deploy

→ Production Deployment: See `PRODUCTION_RUNBOOK.md`
→ Monitoring Setup: Configure alerts and dashboards
→ User Training: Prepare managers for bot usage