import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Use service role key for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Database types
export interface Database {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string;
          title: string;
          content: string;
          category: string;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          category: string;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          category?: string;
          metadata?: Record<string, any>;
          updated_at?: string;
        };
      };
      document_chunks: {
        Row: {
          id: string;
          document_id: string;
          chunk_text: string;
          chunk_index: number;
          embedding: number[] | null;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          chunk_text: string;
          chunk_index: number;
          embedding?: number[] | null;
          metadata?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          chunk_text?: string;
          chunk_index?: number;
          embedding?: number[] | null;
          metadata?: Record<string, any>;
        };
      };
      templates: {
        Row: {
          id: string;
          scenario: string;
          template_text: string;
          placeholders: string[];
          category: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scenario: string;
          template_text: string;
          placeholders?: string[];
          category: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          scenario?: string;
          template_text?: string;
          placeholders?: string[];
          category?: string;
          updated_at?: string;
        };
      };
      query_logs: {
        Row: {
          id: string;
          query: string;
          response: string | null;
          context_used: Record<string, any>;
          similarity_scores: number[];
          response_time_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          query: string;
          response?: string | null;
          context_used?: Record<string, any>;
          similarity_scores?: number[];
          response_time_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          query?: string;
          response?: string | null;
          context_used?: Record<string, any>;
          similarity_scores?: number[];
          response_time_ms?: number | null;
        };
      };
    };
  };
}