# ERA Production Deployment Runbook

## Overview
Complete step-by-step guide for deploying ERA to production for Fitness Connection managers.

## Pre-Deployment Checklist

### Code & Repository
- [  ] All code committed to main branch
- [  ] GitHub repository clean (no sensitive data)
- [  ] `.env` not committed (check with `git ls-files .env`)
- [  ] All tests passing (see TESTING.md)
- [  ] TypeScript compilation successful (`npm run build`)
- [  ] No linting errors (`npm run lint`)

### Infrastructure
- [  ] Supabase project created and accessible
- [  ] Database migrations applied successfully
- [  ] Vector search functions created
- [  ] Render account set up
- [  ] Azure account with bot registration
- [  ] Microsoft App registered with correct permissions

### API Keys & Credentials
- [  ] Supabase Service Role Key obtained
- [  ] OpenAI API key with sufficient quota
- [  ] Microsoft App ID and Password saved securely
- [  ] All credentials tested and working

### Data Preparation
- [  ] Fitness Connection policy files ready (12 JSONL files)
- [  ] Policy data reviewed and current
- [  ] Sample queries prepared for testing

## Deployment Timeline

**Estimated Total Time: 2-3 hours**

- Database Setup: 30 minutes
- Render Deployment: 30 minutes
- Data Loading: 30-45 minutes
- Azure Bot Config: 20 minutes
- Testing & Validation: 30 minutes

## Step-by-Step Deployment

### STEP 1: Database Setup (30 min)

**Reference:** `SUPABASE_SETUP.md`

1. [ ] Open Supabase SQL Editor
2. [ ] Run `001_initial_schema.sql` migration
3. [ ] Verify tables created:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public';
   ```
4. [ ] Run `similarity_search.sql` functions
5. [ ] Verify functions created:
   ```sql
   SELECT routine_name FROM information_schema.routines
   WHERE routine_schema = 'public';
   ```
6. [ ] Test connection from local:
   ```bash
   npx tsx src/ingestion/load-policies.ts stats
   ```

**Expected:** Database returns empty stats (0 documents)

**Checkpoint:** ✅ Database ready for data

---

### STEP 2: Render Web Service Deployment (30 min)

**Reference:** `RENDER_DEPLOYMENT.md`

1. [ ] Create new Web Service in Render
2. [ ] Connect to GitHub repository: `operait/ERA`
3. [ ] Configure build settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. [ ] Add environment variables (copy from `.env`):
   ```
   SUPABASE_URL
   SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   OPENAI_API_KEY
   MICROSOFT_APP_ID
   MICROSOFT_APP_PASSWORD
   PORT=3978
   NODE_ENV=production
   EMBEDDING_MODEL=text-embedding-3-small
   EMBEDDING_DIMENSIONS=3072
   MAX_CONTEXT_CHUNKS=5
   SIMILARITY_THRESHOLD=0.75
   ```
5. [ ] Trigger deploy
6. [ ] Monitor deploy logs for success
7. [ ] Save service URL (e.g., `https://era-bot.onrender.com`)
8. [ ] Test health endpoint:
   ```bash
   curl https://era-bot.onrender.com/health
   ```

**Expected:** `{"status":"healthy",...}`

**Checkpoint:** ✅ Service deployed and healthy

---

### STEP 3: Data Loading (30-45 min)

**Reference:** `RENDER_DEPLOYMENT.md` Step 5

#### Option A: Via Render Shell (Recommended)

1. [ ] Open Render Dashboard → Shell tab
2. [ ] Run deployment script:
   ```bash
   npm run deploy-data
   ```
3. [ ] Monitor progress (will take 20-30 minutes)
4. [ ] Watch for completion message
5. [ ] Verify stats:
   ```bash
   npx tsx src/ingestion/load-policies.ts stats
   npx tsx src/embeddings/generate.ts stats
   ```

**Expected:**
- 12 documents loaded
- 150-200 chunks created
- 100% embeddings generated

#### Option B: Via Local Machine

1. [ ] Ensure `.env` has production credentials
2. [ ] Run locally:
   ```bash
   npm run deploy-data
   ```

**Checkpoint:** ✅ All data loaded with embeddings

---

### STEP 4: Azure Bot Configuration (20 min)

**Reference:** `AZURE_BOT_SETUP.md`

1. [ ] Open Azure Portal → Bot Services
2. [ ] Find bot: ERA (or create new Azure Bot)
3. [ ] Configure messaging endpoint:
   ```
   https://era-bot.onrender.com/api/messages
   ```
   (Replace with your actual Render URL)
4. [ ] Save and verify endpoint
5. [ ] Navigate to Channels
6. [ ] Add Microsoft Teams channel
7. [ ] Enable and save Teams channel
8. [ ] Get bot install link
9. [ ] Test bot endpoint:
   ```bash
   curl -X POST https://era-bot.onrender.com/api/messages \
     -H "Content-Type: application/json" \
     -d '{"type":"message"}'
   ```

**Expected:** Response received (even if auth error)

**Checkpoint:** ✅ Bot endpoint configured

---

### STEP 5: Teams Installation & Testing (30 min)

**Reference:** `TESTING.md`

#### Install Bot

1. [ ] Click Teams install link from Azure
2. [ ] Or upload app package to Teams
3. [ ] Add bot to personal chat

#### Run Test Suite

1. [ ] Test welcome: "hello"
   - **Expected:** Welcome message with instructions

2. [ ] Test primary use case: "Employee missed 3 shifts without calling in"
   - **Expected:** Policy guidance + escalation + template
   - **Check:** Response time < 2 seconds
   - **Verify:** Sources cited correctly

3. [ ] Test help command: "/help"
   - **Expected:** Help message displayed

4. [ ] Test stats command: "/stats"
   - **Expected:** Statistics displayed

5. [ ] Test edge cases:
   - Empty message
   - Off-topic query
   - Ambiguous query

**Pass Criteria:**
- ✅ All core queries work
- ✅ Response time < 2 seconds
- ✅ Accurate policy information
- ✅ Source citations present

**Checkpoint:** ✅ Bot working in Teams

---

### STEP 6: Production Validation

#### 6.1 Performance Check

1. [ ] Run 10 test queries
2. [ ] Measure average response time
3. [ ] Check Render logs for errors
4. [ ] Verify database performance in Supabase

**Target:** < 2 seconds average

#### 6.2 Data Quality Check

1. [ ] Query Supabase for document count:
   ```sql
   SELECT category, COUNT(*) as count
   FROM documents
   GROUP BY category;
   ```

2. [ ] Verify embedding coverage:
   ```sql
   SELECT
     COUNT(*) as total_chunks,
     COUNT(embedding) as with_embeddings,
     COUNT(*) - COUNT(embedding) as missing
   FROM document_chunks;
   ```

**Target:** 0 missing embeddings

#### 6.3 Query Log Verification

1. [ ] Check query logs table populated:
   ```sql
   SELECT COUNT(*) FROM query_logs;
   ```

**Expected:** > 0 (from test queries)

---

### STEP 7: Monitoring Setup

#### 7.1 Render Monitoring

1. [ ] Enable logging in Render dashboard
2. [ ] Set up log retention
3. [ ] Configure alerts (if available on plan)

#### 7.2 Supabase Monitoring

1. [ ] Review database performance metrics
2. [ ] Check storage usage
3. [ ] Monitor connection pool

#### 7.3 Analytics Setup

Create views for common queries:

```sql
-- View for most common queries
CREATE VIEW popular_queries AS
SELECT query, COUNT(*) as count
FROM query_logs
GROUP BY query
ORDER BY count DESC
LIMIT 20;

-- View for slow queries
CREATE VIEW slow_queries AS
SELECT query, response_time_ms
FROM query_logs
WHERE response_time_ms > 3000
ORDER BY response_time_ms DESC;
```

---

### STEP 8: User Rollout

#### Phase 1: Pilot Group (Week 1)

1. [ ] Select 5-10 Fitness Connection managers
2. [ ] Share bot install link
3. [ ] Provide quick start guide:
   ```
   ERA - Quick Start
   =================
   1. Install ERA bot in Teams
   2. Ask HR policy questions naturally
   3. Examples:
      - "Employee missed 3 shifts, what do I do?"
      - "How do I issue a written warning?"
   4. Use /help for commands
   ```
4. [ ] Collect feedback daily
5. [ ] Monitor usage and errors

#### Phase 2: Expanded Rollout (Week 2-3)

1. [ ] Analyze pilot feedback
2. [ ] Make necessary adjustments
3. [ ] Expand to 25-50 managers
4. [ ] Continue monitoring

#### Phase 3: Full Deployment (Week 4+)

1. [ ] Deploy to all Fitness Connection managers
2. [ ] Announce via company channels
3. [ ] Provide training materials
4. [ ] Establish support process

---

## Post-Deployment Tasks

### Daily (First Week)

- [ ] Review Render logs for errors
- [ ] Check Supabase performance
- [ ] Monitor query logs for common questions
- [ ] Respond to user feedback

### Weekly

- [ ] Analyze usage statistics
- [ ] Review slow queries
- [ ] Check embedding coverage
- [ ] Update documentation if needed

### Monthly

- [ ] Run full test suite
- [ ] Review and update policies
- [ ] Optimize performance
- [ ] Plan feature enhancements

---

## Rollback Procedure

If critical issues occur:

### Immediate Actions

1. [ ] Notify users of outage
2. [ ] Disable bot in Teams (remove from Teams Admin Center)
3. [ ] Stop Render service (or scale to 0 instances)

### Investigation

1. [ ] Review Render logs for root cause
2. [ ] Check Supabase for database issues
3. [ ] Verify API key status
4. [ ] Test in staging environment

### Restore Options

**Option A: Revert Code**
```bash
git revert HEAD
git push origin main
# Render auto-deploys previous version
```

**Option B: Redeploy Previous Version**
1. Render Dashboard → Deploys
2. Select previous successful deploy
3. Click "Redeploy"

**Option C: Database Rollback**
1. Restore Supabase snapshot (if available)
2. Reload data from backup
3. Regenerate embeddings

---

## Success Metrics

### Week 1 Targets
- Uptime: > 99%
- Response time: < 2 seconds avg
- Error rate: < 1%
- User queries: > 50
- Unique users: > 5

### Month 1 Targets
- Uptime: > 99.5%
- Response time: < 1.5 seconds avg
- Error rate: < 0.5%
- User queries: > 500
- Unique users: > 20
- Satisfaction: > 4/5 stars

---

## Support & Escalation

### Tier 1: Self-Service
- User refers to `/help` command
- Check TESTING.md for common issues
- Review Render logs

### Tier 2: Developer Support
- Check database connectivity
- Review API key status
- Analyze error logs
- Apply fixes and redeploy

### Tier 3: Vendor Escalation
- **Supabase**: support@supabase.com
- **Render**: support@render.com
- **Microsoft/Azure**: Azure support portal
- **OpenAI**: help.openai.com

---

## Contact Information

**ERA Development Team:**
- GitHub: https://github.com/operait/ERA
- Issues: https://github.com/operait/ERA/issues

**Fitness Connection Sponsor:**
- [Contact Name]
- [Email]
- [Phone]

---

## Appendix: Quick Reference Commands

### Health Check
```bash
curl https://era-bot.onrender.com/health
```

### View Database Stats
```bash
npx tsx src/ingestion/load-policies.ts stats
```

### Check Embeddings
```bash
npx tsx src/embeddings/generate.ts stats
```

### Reload Data
```bash
npm run deploy-data
```

### View Logs (Render)
```bash
# Via Render Dashboard → Logs tab
```

### Query Analytics (Supabase)
```sql
SELECT COUNT(*) as total_queries,
       AVG(response_time_ms) as avg_response_time
FROM query_logs
WHERE created_at > NOW() - INTERVAL '24 hours';
```

---

## Completion Checklist

Before marking deployment complete:

- [  ] All steps completed successfully
- [  ] All checkpoints passed
- [  ] Test suite 100% pass rate
- [  ] Pilot users can access bot
- [  ] Monitoring enabled
- [  ] Documentation complete
- [  ] Support process established
- [  ] Rollback plan tested

**Deployment Completed By:** _______________
**Date:** _______________
**Sign-off:** _______________

---

🎉 **ERA is now live for Fitness Connection managers!**