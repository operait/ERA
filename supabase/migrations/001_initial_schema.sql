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
  embedding VECTOR(3072), -- OpenAI text-embedding-3-large dimensions
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
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON templates (category);
CREATE INDEX ON query_logs (created_at);

-- Row Level Security (RLS) policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_logs ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (all tables accessible for now - can be restricted later)
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

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();