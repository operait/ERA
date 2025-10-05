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