// Core types for the ERA application

export interface PolicyDocument {
  id?: string;
  title: string;
  content: string;
  category: string;
  metadata?: Record<string, any>;
}

export interface DocumentChunk {
  id?: string;
  document_id: string;
  chunk_text: string;
  chunk_index: number;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface Template {
  id?: string;
  scenario: string;
  template_text: string;
  placeholders: string[];
  category: string;
}

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  document_title: string;
  document_category: string;
  chunk_text: string;
  chunk_index: number;
  similarity: number;
  metadata: Record<string, any>;
}

export interface QueryLog {
  id?: string;
  query: string;
  response?: string;
  context_used?: Record<string, any>;
  similarity_scores?: number[];
  response_time_ms?: number;
}

// JSONL input format
export interface JSONLDocument {
  title: string;
  content: string;
  category: string;
  metadata?: Record<string, any>;
}