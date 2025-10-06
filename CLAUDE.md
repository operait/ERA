# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Era MVP - Fitness Connection HR Assistant Bot

## Project Overview
ERA is a Microsoft Teams bot that helps Fitness Connection managers access HR policies and procedures using RAG (Retrieval-Augmented Generation). The bot provides instant policy guidance, escalation procedures, and email templates for common HR scenarios.

## Tech Stack
- **Database**: Supabase (PostgreSQL + pgvector for semantic search)
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions)
- **LLM**: Claude Sonnet 4.5 via Anthropic API
- **Bot Framework**: Microsoft Bot Framework for Teams integration
- **Runtime**: Node.js with TypeScript
- **Hosting**: Render (or similar platform)

## Development Commands

### Core Development
- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm run lint` - Run ESLint code quality checks
- `npm run typecheck` - Verify TypeScript types

### Data Management
- `npm run ingest` - Load JSONL policy files into database
- `npm run embeddings` - Generate OpenAI embeddings for semantic search

### CLI Tools
- `tsx src/ingestion/load-policies.ts [load|clear|reload|stats]` - Data management
- `tsx src/embeddings/generate.ts [generate|regenerate|stats]` - Embedding management
- `tsx src/templates/generator.ts [load-defaults]` - Template management

## Project Architecture

### Core Components
1. **Data Ingestion** (`src/ingestion/`) - Processes JSONL policy documents
2. **Embeddings** (`src/embeddings/`) - Generates and manages OpenAI embeddings
3. **Retrieval** (`src/retrieval/`) - RAG-based semantic search system
4. **Templates** (`src/templates/`) - Response generation with HR templates
5. **Bot** (`src/bot/`) - Microsoft Teams bot implementation

### Database Schema
- `documents` - HR policy documents
- `document_chunks` - Text chunks with embeddings for search
- `templates` - Response templates for common scenarios
- `query_logs` - Usage analytics and query tracking

### Key Files
- `src/bot/app.ts` - Main Teams bot application
- `src/retrieval/search.ts` - RAG search implementation
- `src/lib/supabase.ts` - Database client and types
- `src/lib/chunker.ts` - Text chunking utilities
- `supabase/migrations/001_initial_schema.sql` - Database schema
- `supabase/functions/similarity_search.sql` - Vector search functions

## Data Format
Policy documents should be in JSONL format in the `./data` directory:
```jsonl
{"title": "Policy Name", "content": "Policy text...", "category": "attendance"}
```

## Environment Setup
1. Copy `.env.example` to `.env`
2. Configure Supabase, OpenAI, and Microsoft Bot credentials
3. Run database migrations
4. Load sample data and generate embeddings

## Bot Usage Examples
- "Employee missed 3 shifts without calling in, what do I do?"
- "What's the process for issuing a written warning?"
- "How do I handle tardiness issues?"

## Success Criteria
- Semantic search retrieves relevant policy sections (>0.75 similarity)
- Template system generates structured responses with placeholders
- Bot responds within 2 seconds for typical queries
- Supports progressive discipline scenarios with proper escalation guidance

