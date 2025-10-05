# ERA Setup Guide

## Quick Start (5 minutes)

### 1. Database Setup (Supabase)
1. Go to https://supabase.com and create a new project
2. Copy your project URL and service role key
3. Run the SQL migration in Supabase SQL Editor:
   ```sql
   -- Copy/paste the contents of supabase/migrations/001_initial_schema.sql
   ```
4. Run the vector search functions:
   ```sql
   -- Copy/paste the contents of supabase/functions/similarity_search.sql
   ```

### 2. Environment Configuration
Update `.env` with your real credentials:
```bash
# Replace these with your actual values
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
OPENAI_API_KEY=sk-your-openai-key-here

# Optional (for future features)
ANTHROPIC_API_KEY=your-anthropic-key
MICROSOFT_APP_ID=your-teams-bot-id
MICROSOFT_APP_PASSWORD=your-teams-bot-password
```

### 3. Load Data & Generate Embeddings
```bash
npm run ingest      # Load HR policies into database
npm run embeddings  # Generate vector embeddings
```

### 4. Start Development Server
```bash
npm run dev         # Start with hot reload
# OR
npm run build && npm start  # Production mode
```

### 5. Test the System
The bot will be available at: http://localhost:3978

Test queries:
- "Employee missed 3 shifts without calling in, what do I do?"
- "What's the process for issuing a written warning?"
- "How do I handle tardiness issues?"

## Deployment to Production

### Render Deployment
1. Connect your GitHub repo to Render
2. Set environment variables in Render dashboard
3. Deploy as a Web Service
4. Configure Teams bot endpoint to your Render URL

### Teams Bot Registration
1. Go to Azure Portal > Bot Services
2. Create new Bot Channels Registration
3. Configure messaging endpoint: `https://your-app.onrender.com/api/messages`
4. Add Teams channel
5. Install bot in your Teams environment

## Troubleshooting

### Database Issues
- Ensure pgvector extension is enabled
- Check Supabase RLS policies allow inserts
- Verify service role key has admin permissions

### Embedding Issues
- Check OpenAI API key and quota
- Verify internet connectivity
- Monitor rate limits (50 requests/minute)

### Bot Issues
- Check Azure bot registration
- Verify Teams endpoint configuration
- Test with Bot Framework Emulator first

## Success Criteria
✅ Database has HR policies loaded
✅ Vector embeddings generated
✅ Search returns relevant results
✅ Bot responds to test queries
✅ Response time < 2 seconds