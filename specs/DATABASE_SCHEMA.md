# Prompt Tuning Database Schema Specification

**Version:** 1.0
**Purpose:** Define database tables and migrations for Meg's prompt tuning workflow.

---

## Overview

This schema extends the existing ERA database to support:
1. Tracking prompt tuning sessions (when Meg tests ERA)
2. Storing conversation turns with ERA's responses
3. Capturing improvement feedback from Meg
4. Enabling CSV export for LLM-assisted prompt tuning

These tables are **separate** from the production query logs and are used exclusively for the prompt tuning workflow.

---

## Migration File

**Location:** `supabase/migrations/003_prompt_tuning_tables.sql`

**Dependencies:**
- Must run after `001_initial_schema.sql`
- Must run after `002_email_calendar_tables.sql`

---

## Table Definitions

### 1. `prompt_tuning_sessions`

**Purpose:** Track each testing session that Meg runs.

**Schema:**

```sql
CREATE TABLE IF NOT EXISTS prompt_tuning_sessions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session timing
  session_start TIMESTAMP NOT NULL DEFAULT NOW(),
  session_end TIMESTAMP,

  -- Version tracking
  master_prompt_version TEXT, -- Git commit hash of MASTER_PROMPT.md at session start
  branch_name TEXT DEFAULT 'prompt-tuning',

  -- Session metrics
  total_turns INTEGER DEFAULT 0,
  total_improvements INTEGER DEFAULT 0,

  -- Tester identification
  tester_id TEXT, -- Teams user ID (AAD object ID)
  tester_email TEXT, -- Teams user email
  tester_name TEXT, -- Teams user display name

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_tuning_sessions_start
  ON prompt_tuning_sessions(session_start DESC);

CREATE INDEX idx_tuning_sessions_tester
  ON prompt_tuning_sessions(tester_id);

CREATE INDEX idx_tuning_sessions_branch
  ON prompt_tuning_sessions(branch_name);

CREATE INDEX idx_tuning_sessions_active
  ON prompt_tuning_sessions(session_end)
  WHERE session_end IS NULL; -- Active sessions

-- Comments
COMMENT ON TABLE prompt_tuning_sessions IS
  'Tracks prompt tuning testing sessions for MASTER_PROMPT.md optimization';

COMMENT ON COLUMN prompt_tuning_sessions.master_prompt_version IS
  'Git commit hash of MASTER_PROMPT.md when session started';

COMMENT ON COLUMN prompt_tuning_sessions.metadata IS
  'Additional session data: render_deployment_id, environment, etc.';
```

**Example Rows:**

| id | session_start | session_end | master_prompt_version | branch_name | total_turns | total_improvements | tester_email |
|----|--------------|-------------|----------------------|-------------|-------------|-------------------|--------------|
| abc-123 | 2025-10-24 10:00:00 | 2025-10-24 10:30:00 | fc26922 | prompt-tuning | 12 | 18 | meg@fc.com |
| def-456 | 2025-10-24 14:00:00 | NULL | ee59fe5 | prompt-tuning | 5 | 7 | meg@fc.com |

---

### 2. `tuning_conversation_turns`

**Purpose:** Store each conversation turn (user message + ERA response).

**Schema:**

```sql
CREATE TABLE IF NOT EXISTS tuning_conversation_turns (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session relationship
  session_id UUID NOT NULL REFERENCES prompt_tuning_sessions(id) ON DELETE CASCADE,

  -- Turn data
  turn_number INTEGER NOT NULL,
  user_message TEXT NOT NULL,
  era_response TEXT NOT NULL,

  -- Timing
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  processing_time_ms INTEGER, -- How long ERA took to respond

  -- RAG context (for debugging)
  search_results JSONB, -- Array of search result chunks
  avg_similarity FLOAT, -- Average similarity score from RAG
  total_chunks INTEGER, -- Number of chunks retrieved

  -- Response metadata
  confidence_score FLOAT, -- ERA's confidence in the response
  template_used TEXT, -- If a template was used

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Unique constraint: one turn number per session
  CONSTRAINT unique_session_turn UNIQUE(session_id, turn_number)
);

-- Indexes
CREATE INDEX idx_tuning_turns_session
  ON tuning_conversation_turns(session_id, turn_number);

CREATE INDEX idx_tuning_turns_timestamp
  ON tuning_conversation_turns(timestamp DESC);

CREATE INDEX idx_tuning_turns_similarity
  ON tuning_conversation_turns(avg_similarity)
  WHERE avg_similarity IS NOT NULL;

-- Comments
COMMENT ON TABLE tuning_conversation_turns IS
  'Stores each conversation turn during prompt tuning sessions';

COMMENT ON COLUMN tuning_conversation_turns.search_results IS
  'RAG search results used to generate this response (for debugging)';

COMMENT ON COLUMN tuning_conversation_turns.metadata IS
  'Additional turn data: user_context, conversation_state, etc.';
```

**Example Rows:**

| id | session_id | turn_number | user_message | era_response | timestamp | avg_similarity |
|----|-----------|-------------|--------------|--------------|-----------|----------------|
| turn-1 | abc-123 | 1 | "My employee didn't show up" | "Got it — that's definitely..." | 2025-10-24 10:01:00 | 0.85 |
| turn-2 | abc-123 | 2 | "I called once today" | "Thanks for the context..." | 2025-10-24 10:02:30 | 0.82 |

**Search Results JSON Example:**

```json
{
  "results": [
    {
      "chunk_id": "chunk-789",
      "document_title": "No Show Policy",
      "chunk_text": "Employees who fail to show up...",
      "similarity": 0.89
    },
    {
      "chunk_id": "chunk-456",
      "document_title": "Attendance Policy",
      "chunk_text": "Regular attendance is expected...",
      "similarity": 0.82
    }
  ]
}
```

---

### 3. `tuning_improvements`

**Purpose:** Store Meg's improvement feedback for each turn.

**Schema:**

```sql
CREATE TABLE IF NOT EXISTS tuning_improvements (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Turn relationship
  turn_id UUID NOT NULL REFERENCES tuning_conversation_turns(id) ON DELETE CASCADE,

  -- Improvement data
  improvement_note TEXT NOT NULL,
  category TEXT, -- tone, content, citation, clarity, structure, action, or NULL

  -- Timing
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_tuning_improvements_turn
  ON tuning_improvements(turn_id);

CREATE INDEX idx_tuning_improvements_category
  ON tuning_improvements(category)
  WHERE category IS NOT NULL;

CREATE INDEX idx_tuning_improvements_timestamp
  ON tuning_improvements(timestamp DESC);

-- Comments
COMMENT ON TABLE tuning_improvements IS
  'Stores improvement feedback from testers on ERA responses';

COMMENT ON COLUMN tuning_improvements.category IS
  'Optional category: tone, content, citation, clarity, structure, action';

COMMENT ON COLUMN tuning_improvements.metadata IS
  'Additional improvement data: severity, suggested_change, etc.';
```

**Example Rows:**

| id | turn_id | improvement_note | category | timestamp |
|----|---------|-----------------|----------|-----------|
| imp-1 | turn-1 | "Should ask clarifying questions first" | content | 2025-10-24 10:01:15 |
| imp-2 | turn-1 | "Too formal, needs more empathy" | tone | 2025-10-24 10:01:30 |
| imp-3 | turn-2 | "Good response, no changes needed" | NULL | 2025-10-24 10:02:45 |

---

### 4. Triggers and Functions

**Auto-update session metrics:**

```sql
-- Function to update session metrics when turns are added
CREATE OR REPLACE FUNCTION update_session_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total_turns count
  UPDATE prompt_tuning_sessions
  SET total_turns = (
    SELECT COUNT(*)
    FROM tuning_conversation_turns
    WHERE session_id = NEW.session_id
  ),
  updated_at = NOW()
  WHERE id = NEW.session_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on turn insertion
CREATE TRIGGER trigger_update_turn_count
  AFTER INSERT ON tuning_conversation_turns
  FOR EACH ROW
  EXECUTE FUNCTION update_session_metrics();

-- Function to update session improvement count
CREATE OR REPLACE FUNCTION update_improvement_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the session_id from the turn
  UPDATE prompt_tuning_sessions
  SET total_improvements = (
    SELECT COUNT(*)
    FROM tuning_improvements i
    JOIN tuning_conversation_turns t ON i.turn_id = t.id
    WHERE t.session_id = (
      SELECT session_id
      FROM tuning_conversation_turns
      WHERE id = NEW.turn_id
    )
  ),
  updated_at = NOW()
  WHERE id = (
    SELECT session_id
    FROM tuning_conversation_turns
    WHERE id = NEW.turn_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on improvement insertion
CREATE TRIGGER trigger_update_improvement_count
  AFTER INSERT ON tuning_improvements
  FOR EACH ROW
  EXECUTE FUNCTION update_improvement_count();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to sessions table
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON prompt_tuning_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## TypeScript Types

**Location:** `src/lib/supabase.ts`

**Add to Database interface:**

```typescript
export interface Database {
  public: {
    Tables: {
      // ... existing tables ...

      prompt_tuning_sessions: {
        Row: {
          id: string;
          session_start: string;
          session_end: string | null;
          master_prompt_version: string | null;
          branch_name: string;
          total_turns: number;
          total_improvements: number;
          tester_id: string | null;
          tester_email: string | null;
          tester_name: string | null;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_start?: string;
          session_end?: string | null;
          master_prompt_version?: string | null;
          branch_name?: string;
          total_turns?: number;
          total_improvements?: number;
          tester_id?: string | null;
          tester_email?: string | null;
          tester_name?: string | null;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_start?: string;
          session_end?: string | null;
          master_prompt_version?: string | null;
          branch_name?: string;
          total_turns?: number;
          total_improvements?: number;
          tester_id?: string | null;
          tester_email?: string | null;
          tester_name?: string | null;
          metadata?: Record<string, any>;
          updated_at?: string;
        };
      };

      tuning_conversation_turns: {
        Row: {
          id: string;
          session_id: string;
          turn_number: number;
          user_message: string;
          era_response: string;
          timestamp: string;
          processing_time_ms: number | null;
          search_results: any | null;
          avg_similarity: number | null;
          total_chunks: number | null;
          confidence_score: number | null;
          template_used: string | null;
          metadata: Record<string, any>;
        };
        Insert: {
          id?: string;
          session_id: string;
          turn_number: number;
          user_message: string;
          era_response: string;
          timestamp?: string;
          processing_time_ms?: number | null;
          search_results?: any | null;
          avg_similarity?: number | null;
          total_chunks?: number | null;
          confidence_score?: number | null;
          template_used?: string | null;
          metadata?: Record<string, any>;
        };
        Update: {
          id?: string;
          session_id?: string;
          turn_number?: number;
          user_message?: string;
          era_response?: string;
          timestamp?: string;
          processing_time_ms?: number | null;
          search_results?: any | null;
          avg_similarity?: number | null;
          total_chunks?: number | null;
          confidence_score?: number | null;
          template_used?: string | null;
          metadata?: Record<string, any>;
        };
      };

      tuning_improvements: {
        Row: {
          id: string;
          turn_id: string;
          improvement_note: string;
          category: string | null;
          timestamp: string;
          metadata: Record<string, any>;
        };
        Insert: {
          id?: string;
          turn_id: string;
          improvement_note: string;
          category?: string | null;
          timestamp?: string;
          metadata?: Record<string, any>;
        };
        Update: {
          id?: string;
          turn_id?: string;
          improvement_note?: string;
          category?: string | null;
          timestamp?: string;
          metadata?: Record<string, any>;
        };
      };
    };
  };
}
```

---

## Common Queries

### Get Active Session for User

```sql
SELECT *
FROM prompt_tuning_sessions
WHERE tester_email = 'meg@fitnessconnection.com'
  AND session_end IS NULL
ORDER BY session_start DESC
LIMIT 1;
```

### Get All Turns for a Session

```sql
SELECT *
FROM tuning_conversation_turns
WHERE session_id = 'abc-123'
ORDER BY turn_number ASC;
```

### Get Improvements for a Turn

```sql
SELECT *
FROM tuning_improvements
WHERE turn_id = 'turn-1'
ORDER BY timestamp ASC;
```

### Export Session Data (for CSV)

```sql
SELECT
  t.turn_number,
  t.user_message,
  t.era_response,
  i.improvement_note,
  i.category,
  i.timestamp
FROM tuning_conversation_turns t
LEFT JOIN tuning_improvements i ON i.turn_id = t.id
WHERE t.session_id = 'abc-123'
ORDER BY t.turn_number, i.timestamp;
```

### Session Statistics

```sql
SELECT
  s.id,
  s.session_start,
  s.session_end,
  s.branch_name,
  s.total_turns,
  s.total_improvements,
  EXTRACT(EPOCH FROM (COALESCE(s.session_end, NOW()) - s.session_start)) / 60 AS duration_minutes,
  AVG(t.avg_similarity) AS avg_rag_similarity,
  AVG(t.processing_time_ms) AS avg_processing_time_ms
FROM prompt_tuning_sessions s
LEFT JOIN tuning_conversation_turns t ON t.session_id = s.id
WHERE s.tester_email = 'meg@fitnessconnection.com'
GROUP BY s.id
ORDER BY s.session_start DESC;
```

---

## Data Retention Policy

### Automatic Cleanup (Future Enhancement)

```sql
-- Delete sessions older than 90 days (optional)
DELETE FROM prompt_tuning_sessions
WHERE session_start < NOW() - INTERVAL '90 days';
-- Turns and improvements will cascade delete
```

### Archive Old Sessions (Future Enhancement)

```sql
-- Create archive table
CREATE TABLE prompt_tuning_sessions_archive (
  LIKE prompt_tuning_sessions INCLUDING ALL
);

-- Move old sessions to archive
INSERT INTO prompt_tuning_sessions_archive
SELECT * FROM prompt_tuning_sessions
WHERE session_start < NOW() - INTERVAL '90 days';
```

---

## Migration Execution

### Step 1: Create Migration File

```bash
# Create migration file
touch supabase/migrations/003_prompt_tuning_tables.sql
```

### Step 2: Add SQL to Migration

Copy all SQL from this spec into `003_prompt_tuning_tables.sql`.

### Step 3: Run Migration Locally

```bash
# If using Supabase CLI
supabase db reset

# Or manually run the SQL in Supabase Studio
```

### Step 4: Deploy to Render Database

```bash
# Connect to Render Postgres
psql <RENDER_DATABASE_URL>

# Run migration
\i supabase/migrations/003_prompt_tuning_tables.sql
```

---

## Rollback Plan

**To rollback this migration:**

```sql
-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_update_turn_count ON tuning_conversation_turns;
DROP TRIGGER IF EXISTS trigger_update_improvement_count ON tuning_improvements;
DROP TRIGGER IF EXISTS update_sessions_updated_at ON prompt_tuning_sessions;

-- Drop functions
DROP FUNCTION IF EXISTS update_session_metrics();
DROP FUNCTION IF EXISTS update_improvement_count();

-- Drop tables (cascade will remove foreign key constraints)
DROP TABLE IF EXISTS tuning_improvements CASCADE;
DROP TABLE IF EXISTS tuning_conversation_turns CASCADE;
DROP TABLE IF EXISTS prompt_tuning_sessions CASCADE;
```

---

## Testing Checklist

Before deploying to production:

- [ ] Migration runs successfully on local Supabase instance
- [ ] All indexes are created
- [ ] Triggers update session metrics correctly
- [ ] Foreign key constraints work (cascade delete)
- [ ] TypeScript types match database schema
- [ ] Can insert/query sessions, turns, and improvements
- [ ] CSV export query returns correct format
- [ ] No performance issues with 1000+ turns in a session

---

## Future Schema Enhancements

### Metrics Storage

Add columns to `tuning_conversation_turns` for programmatic metrics:

```sql
ALTER TABLE tuning_conversation_turns
ADD COLUMN has_policy_citation BOOLEAN,
ADD COLUMN appropriate_action_suggested BOOLEAN,
ADD COLUMN structure_complete BOOLEAN,
ADD COLUMN professionalism_score INTEGER CHECK (professionalism_score BETWEEN 1 AND 5),
ADD COLUMN empathy_score INTEGER CHECK (empathy_score BETWEEN 1 AND 5),
ADD COLUMN clarity_score INTEGER CHECK (clarity_score BETWEEN 1 AND 5);
```

### Version Comparison

Add table to compare prompt versions:

```sql
CREATE TABLE prompt_version_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_a TEXT NOT NULL,
  version_b TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  version_a_score FLOAT,
  version_b_score FLOAT,
  comparison_date TIMESTAMP DEFAULT NOW()
);
```
