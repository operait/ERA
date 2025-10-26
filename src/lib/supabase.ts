import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Lazy initialization to allow imports without env vars (for testing)
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }

    // Use service role key for backend operations
    supabaseInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return supabaseInstance;
}

// Export as a getter so it's lazy-initialized
export const supabase = new Proxy({} as SupabaseClient, {
  get: (target, prop) => {
    const client = getSupabaseClient();
    const value = client[prop as keyof SupabaseClient];
    return typeof value === 'function' ? value.bind(client) : value;
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
          metrics: Record<string, any>;
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
          metrics?: Record<string, any>;
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
          metrics?: Record<string, any>;
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