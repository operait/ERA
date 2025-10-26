# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Era MVP - Fitness Connection HR Assistant Bot

## Project Overview
ERA is a Microsoft Teams bot that helps Fitness Connection managers access HR policies and procedures using RAG (Retrieval-Augmented Generation). The bot provides instant policy guidance, escalation procedures, email templates, automated email sending via Outlook, and calendar booking for employee calls.

## Tech Stack
- **Database**: Supabase (PostgreSQL + pgvector for semantic search)
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions)
- **LLM**: Claude Sonnet 4.5 via Anthropic API
- **Bot Framework**: Microsoft Bot Framework for Teams integration
- **Integration**: Microsoft Graph API for Outlook email and calendar
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
6. **Services** (`src/services/`) - Email composer and calendar booking services
7. **Handlers** (`src/bot/handlers/`) - Email and calendar conversation flows

### Database Schema
- `documents` - HR policy documents
- `document_chunks` - Text chunks with embeddings for search
- `templates` - Response templates for common scenarios (with email support)
- `query_logs` - Usage analytics and query tracking
- `email_logs` - Audit trail for sent emails
- `calendar_bookings` - Tracking for scheduled employee calls

### Key Files
- `src/bot/app.ts` - Main Teams bot application with email/calendar integration
- `src/retrieval/search.ts` - RAG search implementation
- `src/services/email-composer.ts` - Email template filling and sending
- `src/services/calendar.ts` - Calendar availability and booking
- `src/lib/graph-client.ts` - Microsoft Graph API client
- `src/lib/supabase.ts` - Database client and types
- `src/lib/chunker.ts` - Text chunking utilities
- `supabase/migrations/001_initial_schema.sql` - Initial database schema
- `supabase/migrations/002_email_calendar_tables.sql` - Email/calendar tables
- `supabase/functions/similarity_search.sql` - Vector search functions

## Data Format
Policy documents should be in JSONL format in the `./data` directory:
```jsonl
{"title": "Policy Name", "content": "Policy text...", "category": "attendance"}
```

## Environment Setup
1. Copy `.env.example` to `.env`
2. Configure Supabase, OpenAI, and Microsoft Bot credentials
3. Configure Microsoft Graph API credentials (see EMAIL_CALENDAR_SETUP.md)
4. Run database migrations (including 002_email_calendar_tables.sql)
5. Load sample data and generate embeddings

## Bot Usage Examples
- "Employee missed 3 shifts without calling in, what do I do?" → Policy guidance + auto email
- "What's the process for issuing a written warning?" → Policy guidance + template
- "How do I handle tardiness issues?" → Policy guidance + email/call workflow
- "Need to discuss performance with an employee" → Policy guidance + calendar booking

## New Features
- **Email Sending**: ERA detects when to send emails and guides managers through template filling and sending
- **Calendar Booking**: ERA checks manager availability and books employee calls automatically
- **Context-Aware Actions** (v3.4.0+): Smart detection prevents premature calendar/email triggering during clarification phase
- See FEATURE_SUMMARY.md for detailed examples and workflows

## Context-Aware Action Detection (v3.4.0)
ERA now uses intelligent multi-factor analysis to determine WHEN to offer calendar booking or email sending:

### The Problem (Fixed)
Previously, ERA would trigger calendar/email actions during clarification questions:
```
User: "My employee didn't show up for 3 days"
ERA: "Have you tried calling them?" → ❌ Calendar triggered too early
```

### The Solution
5-step context-aware detection algorithm:
1. **State Guard**: Don't re-trigger if already in a flow
2. **Clarification Detection**: Block if ERA is asking questions
3. **Conversation Depth**: Require minimum 2 turns
4. **Context Verification**: Ensure manager answered ERA's questions
5. **Keyword Matching**: Final check for action keywords

### Result
```
User: "My employee didn't show up for 3 days"
ERA: "Have you tried calling them?" → ⏸️  No trigger (clarifying)
User: "I tried once but no answer"
ERA: "Would you like me to schedule a call?" → ✅ Trigger (context gathered)
```

**Files:** `src/bot/handlers/calendar-handler.ts`, `email-handler.ts`
**Spec:** `specs/CONTEXT_AWARE_ACTIONS.md`
**Tests:** `src/bot/handlers/__tests__/context-aware-*.test.ts` (54 tests)
**Manual Testing:** See `MANUAL_TESTING.md`

## Success Criteria
- Semantic search retrieves relevant policy sections (>0.75 similarity)
- Template system generates structured responses with placeholders
- Bot responds within 2 seconds for typical queries
- Supports progressive discipline scenarios with proper escalation guidance

