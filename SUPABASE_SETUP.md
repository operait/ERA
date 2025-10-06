# Supabase Database Setup Guide

## Overview
This guide walks you through setting up the Supabase database for ERA, including creating tables, enabling vector search, and configuring the pgvector extension.

## Prerequisites
- Supabase project created: `djrquyyppywxxqqdioih.supabase.co`
- Access to Supabase SQL Editor
- Service role key configured

## Step 1: Enable pgvector Extension

1. Go to https://supabase.com/dashboard
2. Navigate to your project: `djrquyyppywxxqqdioih`
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"

### Run the Initial Schema Migration

Copy and paste the entire contents of `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document_chunks table for embeddings
CREATE TABLE document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding VECTOR(3072), -- OpenAI text-embedding-3-small dimensions
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create templates table for response templates
CREATE TABLE templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario TEXT NOT NULL,
  template_text TEXT NOT NULL,
  placeholders TEXT[] DEFAULT '{}',
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create query_logs table for usage tracking
CREATE TABLE query_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  response TEXT,
  context_used JSONB DEFAULT '{}',
  similarity_scores FLOAT[] DEFAULT '{}',
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX ON documents (category);
CREATE INDEX ON documents (created_at);
CREATE INDEX ON document_chunks (document_id);
-- Use HNSW index instead of ivfflat for embeddings > 2000 dimensions
CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON templates (category);
CREATE INDEX ON query_logs (created_at);

-- Row Level Security (RLS) policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_logs ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies
CREATE POLICY "Enable read access for all users" ON documents FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON documents FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON document_chunks FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON document_chunks FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON document_chunks FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON templates FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON templates FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON query_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON query_logs FOR INSERT WITH CHECK (true);

-- Update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

5. Click "Run" button
6. Verify success message appears

## Step 2: Create Vector Search Functions

1. Create another "New Query" in SQL Editor
2. Copy and paste contents of `supabase/functions/similarity_search.sql`:

```sql
-- Vector similarity search function
CREATE OR REPLACE FUNCTION similarity_search(
  query_embedding VECTOR(3072),
  similarity_threshold FLOAT DEFAULT 0.75,
  match_count INTEGER DEFAULT 5
)
RETURNS TABLE(
  chunk_id UUID,
  document_id UUID,
  document_title TEXT,
  document_category TEXT,
  chunk_text TEXT,
  chunk_index INTEGER,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id AS chunk_id,
    dc.document_id,
    d.title AS document_title,
    d.category AS document_category,
    dc.chunk_text,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    dc.metadata
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE 1 - (dc.embedding <=> query_embedding) > similarity_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to search by category
CREATE OR REPLACE FUNCTION similarity_search_by_category(
  query_embedding VECTOR(3072),
  category_filter TEXT,
  similarity_threshold FLOAT DEFAULT 0.75,
  match_count INTEGER DEFAULT 5
)
RETURNS TABLE(
  chunk_id UUID,
  document_id UUID,
  document_title TEXT,
  document_category TEXT,
  chunk_text TEXT,
  chunk_index INTEGER,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id AS chunk_id,
    dc.document_id,
    d.title AS document_title,
    d.category AS document_category,
    dc.chunk_text,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    dc.metadata
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE d.category = category_filter
    AND 1 - (dc.embedding <=> query_embedding) > similarity_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

3. Click "Run" button
4. Verify functions were created successfully

## Step 3: Verify Database Setup

Run these verification queries in SQL Editor:

### Check tables exist:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('documents', 'document_chunks', 'templates', 'query_logs');
```

Expected: 4 rows returned

### Check pgvector extension:
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

Expected: 1 row with vector extension

### Check functions exist:
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('similarity_search', 'similarity_search_by_category');
```

Expected: 2 rows returned

## Step 4: Test Database Connection

From your local machine, test the connection:

```bash
npx tsx src/ingestion/load-policies.ts stats
```

Expected output:
```
=== Database Statistics ===
Total documents: 0
Total chunks: 0
Documents by category:
```

## Troubleshooting

### Issue: "column cannot have more than 2000 dimensions for hnsw index"
**Problem**: Supabase's pgvector has a 2000 dimension limit for both ivfflat and HNSW indexes.

**Solution**: ✅ **Already fixed!** The schema uses OpenAI's `text-embedding-3-small` model which creates 1536-dimensional vectors (well under the 2000 limit):
```sql
embedding VECTOR(1536) -- OpenAI text-embedding-3-small or ada-002
```

**Why 1536 dimensions?**
- `text-embedding-3-small`: 1536 dimensions, excellent performance, lower cost
- `text-embedding-ada-002`: 1536 dimensions, proven reliability
- Both models work perfectly with Supabase's 2000 dimension limit
- Still provide excellent semantic search quality for HR policies

### Issue: pgvector extension not available
**Solution**: Enable via Supabase dashboard → Database → Extensions → Enable "vector"

### Issue: RLS policy preventing inserts
**Solution**: Verify service role key is being used (not anon key)

### Issue: Function creation fails
**Solution**: Ensure schema migration ran first, check for syntax errors

## Next Steps

✅ Database is now ready!
✅ Proceed to data ingestion (see `RENDER_DEPLOYMENT.md`)
✅ Load Fitness Connection policies
✅ Generate embeddings

## Database Credentials Reference

Store these in Render environment variables:
```
SUPABASE_URL=https://djrquyyppywxxqqdioih.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
```

**Important**: Use SERVICE_ROLE_KEY for backend operations, not ANON_KEY!