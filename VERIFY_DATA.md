# How to Verify Data is Loaded

## Quick Check in Render Shell

### Option 1: Use the Check Script (Easiest)

In Render Shell, run:
```bash
npm run check-data
```

This will show:
- Total documents loaded
- Total chunks created
- Embedding completion percentage
- Documents by category

**Expected Output:**
```
🔍 ERA Data Verification
========================

🗄️  Database Statistics
======================

=== Database Statistics ===
Total documents: 12
Total chunks: 150-200
Documents by category:
  attendance: 2
  disciplinary: 3
  termination: 2
  ...

🧠 Embedding Statistics
=======================

=== Embedding Statistics ===
Total chunks: 150-200
Chunks with embeddings: 150-200
Chunks missing embeddings: 0
Completion: 100.0%
```

---

### Option 2: Check Documents Directly

```bash
npx tsx src/ingestion/load-policies.ts stats
```

**What you'll see:**
- Total number of documents
- Total number of chunks
- Breakdown by category

---

### Option 3: Check Embeddings

```bash
npx tsx src/embeddings/generate.ts stats
```

**What you'll see:**
- Total chunks
- How many have embeddings
- How many are missing embeddings
- Completion percentage (should be 100%)

---

## Verify in Supabase Dashboard

### 1. Check Documents Table

1. Go to https://supabase.com/dashboard
2. Select project: **Era Fitness Connection** (`djrquyyppywxxqqdioih`)
3. Click **Table Editor** in left sidebar
4. Select `documents` table
5. You should see **12 rows** (one for each policy file)

### 2. Check Document Chunks Table

1. In Table Editor, select `document_chunks` table
2. You should see **150-200 rows** (text chunks from all documents)
3. Check that the `embedding` column has values (not NULL)

### 3. Run SQL Query

In Supabase SQL Editor:

```sql
-- Count total documents
SELECT COUNT(*) as total_documents FROM documents;

-- Count documents by category
SELECT category, COUNT(*) as count
FROM documents
GROUP BY category
ORDER BY category;

-- Count total chunks
SELECT COUNT(*) as total_chunks FROM document_chunks;

-- Count chunks with embeddings
SELECT
  COUNT(*) as total,
  COUNT(embedding) as with_embeddings,
  COUNT(*) - COUNT(embedding) as missing
FROM document_chunks;
```

**Expected Results:**
- `total_documents`: 12
- `total_chunks`: 150-200
- `with_embeddings`: 150-200 (same as total)
- `missing`: 0

---

## Troubleshooting

### Issue: "Total documents: 0"

**Problem**: Data not loaded yet

**Solution**: Run the data deployment:
```bash
npm run deploy-data
```

Wait for completion (20-30 minutes for embeddings).

---

### Issue: "Chunks missing embeddings: 150"

**Problem**: Embeddings not generated

**Solution**: Generate embeddings:
```bash
npx tsx src/embeddings/generate.ts generate
```

This will take 20-30 minutes for ~900KB of policy content.

---

### Issue: "Cannot find module 'tsx'"

**Problem**: Development dependencies not installed

**Solution**: In Render Shell:
```bash
npm install tsx
```

Then retry the verification command.

---

### Issue: "Error connecting to Supabase"

**Problem**: Environment variables not set

**Solution**: Check Render environment variables:
1. Go to Render Dashboard → Environment
2. Verify these are set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`

---

## Quick Verification Checklist

Run these commands in order to verify everything:

```bash
# 1. Check documents loaded
npx tsx src/ingestion/load-policies.ts stats

# 2. Check embeddings generated
npx tsx src/embeddings/generate.ts stats

# 3. Or use the all-in-one check:
npm run check-data
```

**Success Criteria:**
- ✅ 12 documents loaded
- ✅ 150-200 chunks created
- ✅ 100% embeddings generated
- ✅ 0 missing embeddings

---

## Alternative: Check Logs from deploy-data

If you ran `npm run deploy-data` earlier, scroll up in the Render Shell to see the output.

Look for these messages:
```
✅ Document ingestion completed
✅ Embedding generation completed
🎉 Data Deployment Complete!
```

If you see these, your data is loaded successfully!

---

## Test the Bot Works

Once data is verified, test a query:

In Render Shell or locally:
```bash
# This won't work in shell, but tests the bot is running
curl http://localhost:3978/health
```

Or install ERA in Microsoft Teams and ask:
```
"Employee missed 3 shifts without calling in, what do I do?"
```

You should get a detailed response with policy citations.

---

**Need more help?** Check [SUPABASE_SETUP.md](SUPABASE_SETUP.md) or [TESTING.md](TESTING.md)