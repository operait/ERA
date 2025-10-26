-- Migration: Prompt Tuning Tables
-- Description: Add tables for tracking Meg's prompt tuning testing sessions
-- Based on: specs/DATABASE_SCHEMA.md

-- Table: prompt_tuning_sessions
-- Tracks each testing session that Meg runs
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
  WHERE session_end IS NULL; -- Active sessions only

-- Comments
COMMENT ON TABLE prompt_tuning_sessions IS
  'Tracks prompt tuning testing sessions for MASTER_PROMPT.md optimization';

COMMENT ON COLUMN prompt_tuning_sessions.master_prompt_version IS
  'Git commit hash of MASTER_PROMPT.md when session started';

COMMENT ON COLUMN prompt_tuning_sessions.metadata IS
  'Additional session data: render_deployment_id, environment, etc.';

-- Table: tuning_conversation_turns
-- Stores each conversation turn (user message + ERA response)
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

  -- Metrics (calculated by metrics framework)
  metrics JSONB DEFAULT '{}'::jsonb,

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

COMMENT ON COLUMN tuning_conversation_turns.metrics IS
  'Calculated metrics for this response (objective and subjective quality scores)';

COMMENT ON COLUMN tuning_conversation_turns.metadata IS
  'Additional turn data: user_context, conversation_state, etc.';

-- Table: tuning_improvements
-- Stores Meg's improvement feedback for each turn
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

-- Triggers and Functions

-- Function to update session metrics when turns are added
CREATE OR REPLACE FUNCTION update_session_turn_count()
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
  EXECUTE FUNCTION update_session_turn_count();

-- Function to update session improvement count
CREATE OR REPLACE FUNCTION update_session_improvement_count()
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
  EXECUTE FUNCTION update_session_improvement_count();

-- Auto-update updated_at timestamp (reuse existing function if available)
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

-- Migration complete
COMMENT ON SCHEMA public IS
  'Prompt tuning tables migration 003 applied successfully';
