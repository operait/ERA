# ERA - HR Assistant Bot

A Microsoft Teams bot for Fitness Connection that provides instant access to HR policies and procedures using RAG (Retrieval-Augmented Generation).

## 🚀 Production Deployment

**ERA is ready for production deployment to Microsoft Teams!**

### Quick Deployment Links
- 📖 [Complete Production Runbook](PRODUCTION_RUNBOOK.md) - Step-by-step deployment guide
- 🗄️ [Database Setup](SUPABASE_SETUP.md) - Supabase configuration
- ☁️ [Render Deployment](RENDER_DEPLOYMENT.md) - Cloud hosting setup
- 🤖 [Azure Bot Setup](AZURE_BOT_SETUP.md) - Teams integration
- 🧪 [Testing Guide](TESTING.md) - Comprehensive test suite

### Deployment Overview

**Estimated Time:** 2-3 hours
**Prerequisites:** Supabase account, Render account, Azure account

1. **Database Setup** (30 min)
   ```bash
   # Run SQL migrations in Supabase
   # See: SUPABASE_SETUP.md
   ```

2. **Deploy to Render** (30 min)
   ```bash
   # Configure Web Service
   # Set environment variables
   # See: RENDER_DEPLOYMENT.md
   ```

3. **Load Fitness Connection Data** (30-45 min)
   ```bash
   npm run deploy-data
   ```

4. **Configure Azure Bot** (20 min)
   - Set messaging endpoint
   - Enable Teams channel
   - Install in Teams

5. **Test & Validate** (30 min)
   - Run test suite
   - Verify responses
   - See: TESTING.md

## 📋 Available Commands

- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Start in development mode with hot reload
- `npm start` - Start production server
- `npm run ingest` - Load policy documents from JSONL files
- `npm run embeddings` - Generate OpenAI embeddings
- `npm run deploy-data` - Full data deployment (load + embeddings)
- `npm run lint` - Check code style
- `npm run typecheck` - Verify TypeScript types

## Architecture

- **Database**: Supabase (PostgreSQL + pgvector)
- **Embeddings**: OpenAI text-embedding-3-small
- **LLM**: Claude Sonnet 4.5 (via Anthropic API)
- **Bot Framework**: Microsoft Bot Framework
- **Language**: TypeScript/Node.js

## 💬 Bot Usage Examples

In Microsoft Teams, ask ERA questions like:

**Attendance Issues:**
- "Employee missed 3 shifts without calling in, what do I do?"
- "How do I handle chronic tardiness?"

**Disciplinary Actions:**
- "What's the process for issuing a written warning?"
- "When should I escalate to a final written warning?"

**Termination:**
- "What are the steps for terminating an employee?"
- "How do I document performance issues for termination?"

**Performance Management:**
- "How do I put someone on a PIP?"
- "What goes into a performance improvement plan?"

## 📊 Current Status

**Fitness Connection Data:**
- ✅ 12 policy documents (900+ KB)
- ✅ Attendance policies
- ✅ Disciplinary procedures
- ✅ Termination templates
- ✅ PIP templates
- ✅ Corrective action templates
- ✅ Incident escalation matrix
- ✅ Employee handbook sections

**Infrastructure:**
- ✅ Code deployed to GitHub: [operait/ERA](https://github.com/operait/ERA)
- ✅ Supabase database: `djrquyyppywxxqqdioih.supabase.co`
- ✅ Microsoft App registered
- ✅ Ready for Render deployment

## 🔧 Environment Variables

See `.env.example` for all required configuration variables. Key variables:

```bash
SUPABASE_URL=https://djrquyyppywxxqqdioih.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[your-key]
OPENAI_API_KEY=[your-key]
MICROSOFT_APP_ID=931971a9-ee0c-413d-9f6c-d9e2ca09347e
MICROSOFT_APP_PASSWORD=[your-password]
```

## 📚 Documentation

- [PRODUCTION_RUNBOOK.md](PRODUCTION_RUNBOOK.md) - Complete deployment guide
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) - Database configuration
- [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) - Cloud deployment
- [AZURE_BOT_SETUP.md](AZURE_BOT_SETUP.md) - Teams integration
- [TESTING.md](TESTING.md) - Testing & validation
- [DEPLOYMENT.md](DEPLOYMENT.md) - System overview
- [CLAUDE.md](CLAUDE.md) - Developer guide

## 🤝 Support

- GitHub Issues: https://github.com/operait/ERA/issues
- Project Repository: https://github.com/operait/ERA

---

**Ready to deploy ERA to Microsoft Teams for Fitness Connection! 🚀**