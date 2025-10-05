# ERA - HR Assistant Bot

A Microsoft Teams bot for Fitness Connection that provides instant access to HR policies and procedures using RAG (Retrieval-Augmented Generation).

## Quick Start

1. **Setup Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Setup Database**
   - Create a Supabase project
   - Run the migration: `supabase/migrations/001_initial_schema.sql`
   - Run the function: `supabase/functions/similarity_search.sql`

4. **Load Data**
   ```bash
   npm run ingest    # Load JSONL files from ./data
   npm run embeddings # Generate embeddings
   ```

5. **Start Bot**
   ```bash
   npm run dev       # Development mode
   npm start         # Production mode
   ```

## Commands

- `npm run ingest` - Load policy documents from JSONL files
- `npm run embeddings` - Generate OpenAI embeddings for search
- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Start in development mode with hot reload
- `npm start` - Start production server
- `npm run lint` - Check code style
- `npm run typecheck` - Verify TypeScript types

## Architecture

- **Database**: Supabase (PostgreSQL + pgvector)
- **Embeddings**: OpenAI text-embedding-3-large
- **LLM**: Claude Sonnet 4.5 (via Anthropic API)
- **Bot Framework**: Microsoft Bot Framework
- **Language**: TypeScript/Node.js

## Data Format

Place JSONL files in the `./data` directory:

```jsonl
{"title": "Attendance Policy", "content": "Policy text here...", "category": "attendance"}
{"title": "Disciplinary Procedures", "content": "Procedure details...", "category": "disciplinary"}
```

## Bot Usage

In Microsoft Teams, ask ERA questions like:
- "Employee missed 3 shifts without calling in, what do I do?"
- "What's the process for issuing a written warning?"
- "How do I handle tardiness issues?"

## Environment Variables

See `.env.example` for all required configuration variables.

## Deployment

Deploy to Render or similar platform with:
- Node.js environment
- Environment variables configured
- Database accessible
- Bot registered in Azure Bot Service