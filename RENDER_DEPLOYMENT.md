# Render Deployment Guide for ERA

## Overview
This guide covers deploying the ERA bot to Render.com as a Web Service, including environment configuration, data loading, and verification.

## Prerequisites
✅ GitHub repository set up: https://github.com/operait/ERA
✅ Supabase database configured (see `SUPABASE_SETUP.md`)
✅ Render account created
✅ Microsoft App ID and Password obtained

## Step 1: Create Web Service in Render

1. Go to https://dashboard.render.com
2. Click "New +" button → "Web Service"
3. Connect your GitHub account if not already connected
4. Select repository: `operait/ERA`
5. Configure service:

### Basic Settings
- **Name**: `era-bot` (or your preference)
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: Leave blank
- **Runtime**: `Node`

### Build & Deploy Settings
- **Build Command**:
  ```bash
  npm install && npm run build
  ```

- **Start Command**:
  ```bash
  npm start
  ```

### Instance Settings
- **Instance Type**:
  - **Free** - Good for testing (spins down after inactivity)
  - **Starter ($7/month)** - Recommended for production (always on)

6. Click "Create Web Service" (Don't deploy yet - add environment variables first!)

## Step 2: Configure Environment Variables

In your Render dashboard, go to "Environment" tab and add these variables:

### Required Database & API Keys

```
SUPABASE_URL=https://djrquyyppywxxqqdioih.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrYWhia3B1aHNrYmlyemhham5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3MDQ1MTYsImV4cCI6MjA3MzI4MDUxNn0.9uISg5AKaWYy5IZGdvmGV7jLkbPJBnXIW73UXd4phKY
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SERVICE_ROLE_KEY]
OPENAI_API_KEY=[YOUR_OPENAI_KEY]
```

### Microsoft Teams Bot Credentials

```
MICROSOFT_APP_ID=931971a9-ee0c-413d-9f6c-d9e2ca09347e
MICROSOFT_APP_PASSWORD=[YOUR_APP_PASSWORD]
```

### Application Settings

```
PORT=3978
NODE_ENV=production
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=3072
MAX_CONTEXT_CHUNKS=5
SIMILARITY_THRESHOLD=0.75
```

**Important Notes:**
- Click "Add Environment Variable" for each one
- Values are encrypted by Render
- Don't use quotes around values
- Set `NODE_ENV=production` (not development)

7. Click "Save Changes"

## Step 3: Deploy the Service

1. Render will automatically trigger a deploy
2. Monitor the deploy logs in the "Logs" tab
3. Wait for build to complete (~2-3 minutes)
4. Look for success message: "Your service is live 🎉"

### Your Service URL
Render will assign a URL like:
```
https://era-bot.onrender.com
or
https://era-bot-xxxx.onrender.com
```

**Save this URL** - you'll need it for Azure Bot configuration!

## Step 4: Verify Deployment

### Test Health Endpoint

Open in browser or use curl:
```bash
curl https://your-app.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-..."
}
```

### Check Application Logs

In Render dashboard → Logs tab, you should see:
```
🤖 ERA Bot server listening on port 3978
📋 Health check: http://localhost:3978/health
💬 Bot endpoint: http://localhost:3978/api/messages
```

## Step 5: Load Fitness Connection Data

### Option A: Using Render Shell (Recommended)

1. In Render dashboard, click "Shell" tab
2. Run the deployment script:
   ```bash
   npm run deploy-data
   ```

This will:
- Load all 12 Fitness Connection JSONL files
- Generate OpenAI embeddings
- Verify data loaded correctly

Expected output:
```
🚀 ERA Data Deployment Script
📁 Found 12 policy files...
📥 Step 1: Loading HR Policy Documents
✅ Document ingestion completed
🧠 Step 2: Generating OpenAI Embeddings
✅ Embedding generation completed
🎉 Data Deployment Complete!
```

### Option B: Run Locally (Alternative)

If you prefer to load data from your local machine:

```bash
# Ensure your .env has production Supabase credentials
npm run deploy-data
```

### Verify Data Loaded

In Render shell or locally:
```bash
npx tsx src/ingestion/load-policies.ts stats
```

Expected:
```
=== Database Statistics ===
Total documents: 12
Total chunks: ~150-200
Documents by category:
  attendance: X
  disciplinary: X
  termination: X
  ...
```

## Step 6: Configure Bot Messaging Endpoint

Now that your service is deployed, configure Azure Bot:

1. Go to Azure Portal → Bot Services
2. Find your bot: ERA
3. Go to Configuration
4. Set **Messaging endpoint**:
   ```
   https://your-app.onrender.com/api/messages
   ```
5. Click "Apply"

## Step 7: Test the Bot

### Test Bot Endpoint

```bash
curl -X POST https://your-app.onrender.com/api/messages \
  -H "Content-Type: application/json" \
  -d '{"type":"message","text":"hello"}'
```

### Install in Teams

1. In Azure Bot → Channels → Add Microsoft Teams
2. Click "Microsoft Teams" to open in Teams
3. Send test message: "Employee missed 3 shifts without calling in"

Expected response with:
- Relevant policy information
- Escalation guidance
- Email template
- Source citations

## Monitoring & Maintenance

### View Logs
- Render Dashboard → Logs tab
- Real-time log streaming
- Search and filter capabilities

### Monitor Performance
- Response time should be < 2 seconds
- Check `query_logs` table in Supabase for analytics

### Update Environment Variables
- Render Dashboard → Environment tab
- Changes trigger automatic redeploy

### Redeploy Application
- Manual Deploy: Render Dashboard → "Manual Deploy" → Deploy latest commit
- Auto Deploy: Push to GitHub `main` branch

## Troubleshooting

### Issue: Build fails
**Check**:
- Build logs for specific error
- Ensure all dependencies in `package.json`
- Verify Node version compatibility

### Issue: Health check fails
**Check**:
- Service is running (not crashed)
- PORT environment variable set to 3978
- Firewall/network settings

### Issue: Bot not responding
**Check**:
- Messaging endpoint in Azure matches Render URL
- MICROSOFT_APP_ID and PASSWORD are correct
- Bot is added to Teams
- Check Render logs for errors

### Issue: Database connection fails
**Check**:
- SUPABASE_SERVICE_ROLE_KEY is correct (not ANON_KEY)
- Database migrations were run
- Supabase project is active

### Issue: OpenAI embedding fails
**Check**:
- OPENAI_API_KEY is valid
- API quota/rate limits
- Check Render logs for specific error

## Free Tier Limitations

⚠️ **Render Free Tier**:
- Spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- **Recommendation**: Use Starter tier ($7/mo) for production

## Cost Estimates

- **Render Starter**: $7/month (always on)
- **Supabase**: Free tier sufficient for pilot
- **OpenAI Embeddings**: ~$0.10 for initial load, minimal ongoing
- **Total**: ~$7-10/month for production deployment

## Next Steps

✅ Service deployed to Render
✅ Data loaded and embeddings generated
✅ Health check passing

→ Next: Configure Teams bot (see `AZURE_BOT_SETUP.md`)
→ Then: Test with real queries (see `TESTING.md`)

## Support Resources

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- ERA Issues: https://github.com/operait/ERA/issues