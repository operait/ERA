# Azure Bot Service Setup for ERA

## Overview
Configure your Microsoft App Registration to work with Teams and connect it to your deployed Render service.

## Prerequisites
✅ Render service deployed and running
✅ Service URL from Render: `https://your-app.onrender.com`
✅ Microsoft App registered with ID: `931971a9-ee0c-413d-9f6c-d9e2ca09347e`
✅ Database populated with Fitness Connection policies

## Current Status
- **App ID**: `931971a9-ee0c-413d-9f6c-d9e2ca09347e`
- **App Password**: Already generated
- **Account Type**: Multitenant (Any Microsoft Entra ID tenant)

## Step 1: Verify App Registration

1. Go to https://portal.azure.com
2. Navigate to "App registrations"
3. Find your app: "ERA"
4. Verify details:
   - **Application (client) ID**: `931971a9-ee0c-413d-9f6c-d9e2ca09347e`
   - **Supported account types**: Multitenant

## Step 2: Configure Redirect URIs

In your app registration:

1. Go to "Authentication" in left sidebar
2. Under "Platform configurations" → "Web"
3. Add/verify redirect URIs:
   ```
   https://your-app.onrender.com/auth/oauth/redirect
   https://token.botframework.com/.auth/web/redirect
   ```
4. Under "Implicit grant and hybrid flows":
   - ✅ Check "ID tokens"
5. Click "Save"

## Step 3: Create Bot Channels Registration

### Option A: Create Azure Bot Resource

1. In Azure Portal, click "Create a resource"
2. Search for "Azure Bot"
3. Click "Create"

#### Configuration:
- **Bot handle**: `era-hr-assistant` (must be unique)
- **Subscription**: Your Azure subscription
- **Resource group**: Create new or use existing
- **Pricing tier**:
  - **F0 (Free)**: 10,000 messages/month - Good for pilot
  - **S1 (Standard)**: Unlimited - For production
- **Microsoft App ID**:
  - Select "Use existing app registration"
  - Enter: `931971a9-ee0c-413d-9f6c-d9e2ca09347e`

4. Click "Review + Create"
5. Click "Create"

### Option B: Configure Existing Bot (if already created)

1. Go to your Bot resource in Azure Portal
2. Navigate to "Configuration"

## Step 4: Configure Messaging Endpoint

This is the **most critical step**!

1. In Bot resource → "Configuration"
2. Set **Messaging endpoint**:
   ```
   https://your-app.onrender.com/api/messages
   ```

   Replace `your-app.onrender.com` with your actual Render URL

3. Click "Apply"

### Verify Endpoint

Test the endpoint is accessible:
```bash
curl https://your-app.onrender.com/api/messages
```

Should return a response (even if error - proves endpoint exists)

## Step 5: Add Microsoft Teams Channel

1. In Bot resource → "Channels"
2. Click "Microsoft Teams" icon
3. Configure Teams channel:
   - **Calling**: Leave disabled (not needed for ERA)
   - **Messaging**: Enabled
   - **Enable calling**: No
4. Click "Apply"
5. Click "Agree" to Terms of Service

You'll see Microsoft Teams listed as a channel with status "Running"

## Step 6: Get Bot Install Link

1. In Channels, click "Microsoft Teams"
2. You'll see a link like:
   ```
   https://teams.microsoft.com/l/app/YOUR-APP-ID
   ```
3. **Save this link** - this is how users install the bot

## Step 7: Configure Bot Settings (Optional but Recommended)

### Bot Profile

1. Go to "Configuration" → "Bot profile settings"
2. Set:
   - **Display name**: ERA - HR Assistant
   - **Description**: Get instant answers to HR policy questions for Fitness Connection managers
   - **Long description**: ERA helps Fitness Connection managers quickly find HR policy guidance, escalation procedures, and response templates for employee management situations.
   - **Icon**: Upload a professional bot icon (512x512 px)
   - **Privacy URL**: Your company privacy policy
   - **Terms of Use**: Your terms of use URL

3. Click "Apply"

### OAuth Connection (if needed later)

Skip for now - ERA doesn't require OAuth for basic functionality

## Step 8: Create Teams App Manifest (For Custom Installation)

Create a file `manifest.json` for custom Teams app:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "931971a9-ee0c-413d-9f6c-d9e2ca09347e",
  "packageName": "com.operait.era",
  "developer": {
    "name": "Operait",
    "websiteUrl": "https://operait.com",
    "privacyUrl": "https://operait.com/privacy",
    "termsOfUseUrl": "https://operait.com/terms"
  },
  "name": {
    "short": "ERA",
    "full": "ERA - HR Assistant for Fitness Connection"
  },
  "description": {
    "short": "Get instant HR policy answers",
    "full": "ERA helps Fitness Connection managers quickly find HR policy guidance, escalation procedures, and response templates for employee management situations."
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#0078D4",
  "bots": [
    {
      "botId": "931971a9-ee0c-413d-9f6c-d9e2ca09347e",
      "scopes": [
        "personal",
        "team"
      ],
      "supportsFiles": false,
      "isNotificationOnly": false,
      "commandLists": [
        {
          "scopes": [
            "personal",
            "team"
          ],
          "commands": [
            {
              "title": "help",
              "description": "Get help using ERA"
            },
            {
              "title": "stats",
              "description": "View usage statistics"
            }
          ]
        }
      ]
    }
  ],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ],
  "validDomains": []
}
```

### Create App Package

1. Create icons:
   - `color.png` - 192x192px colored icon
   - `outline.png` - 32x32px outline icon

2. Zip the files:
   ```
   manifest.json
   color.png
   outline.png
   ```

3. Name it: `era-teams-app.zip`

## Step 9: Install Bot in Teams

### Method A: Via Azure Portal Link (Quickest)

1. Use the link from Step 6
2. Click it (opens Teams)
3. Click "Add" to install for yourself
4. Or click "Add to a team" to install for a team/channel

### Method B: Via App Package Upload

1. In Microsoft Teams, go to Apps
2. Click "Manage your apps"
3. Click "Upload an app"
4. Select "Upload a custom app"
5. Upload `era-teams-app.zip`
6. Click "Add"

### Method C: Teams Admin Center (Organization-wide)

For IT Admins to deploy across Fitness Connection:

1. Go to https://admin.teams.microsoft.com
2. Navigate to "Teams apps" → "Manage apps"
3. Click "Upload new app"
4. Upload `era-teams-app.zip`
5. Set permissions and policies
6. Deploy to specific teams or users

## Step 10: Test the Bot

### First Test - Hello Message

1. Open Teams
2. Find ERA bot in your chats
3. Send: "hello"

Expected response:
```
👋 Welcome to ERA - Your HR Assistant!

I'm here to help Fitness Connection managers with HR policies...
```

### Second Test - Real Query

Send: "Employee missed 3 shifts without calling in, what do I do?"

Expected response:
- Policy citation about no-call/no-show
- Escalation procedures
- Progressive discipline steps
- Email template with placeholders
- Source document references

### Third Test - Help Command

Send: "/help"

Expected: Help message with available commands and usage tips

## Step 11: Verify End-to-End Flow

Check these components work:

1. ✅ Teams sends message to Azure Bot
2. ✅ Azure Bot forwards to Render endpoint
3. ✅ Render service receives request
4. ✅ ERA searches Supabase for relevant policies
5. ✅ ERA generates response with templates
6. ✅ Response sent back through Azure to Teams
7. ✅ User sees formatted response in Teams

**Check Render logs** to see message processing in real-time!

## Troubleshooting

### Issue: Bot not appearing in Teams
**Check**:
- Teams channel is enabled in Azure
- App ID matches in all configurations
- Try reinstalling the bot

### Issue: Bot shows offline/error
**Check**:
- Render service is running (check health endpoint)
- Messaging endpoint URL is correct
- No typos in endpoint URL

### Issue: Bot doesn't respond
**Check**:
- Render logs show incoming request
- MICROSOFT_APP_ID and PASSWORD match in environment variables
- Bot authentication is working

### Issue: Bot responds but with errors
**Check**:
- Database has data (run stats command)
- Embeddings were generated
- OpenAI API key is valid
- Check Render logs for specific error

### Issue: "Unauthorized" or "403" errors
**Check**:
- App Password in Render matches Azure
- App ID is correct
- Bot authentication middleware is working

## Monitoring

### Azure Bot Analytics

1. In Bot resource → "Analytics"
2. View:
   - Total messages
   - Active users
   - Channels performance

### Query Logs

Check Supabase `query_logs` table:
```sql
SELECT query, response_time_ms, created_at
FROM query_logs
ORDER BY created_at DESC
LIMIT 20;
```

### Render Logs

Monitor real-time:
1. Render Dashboard → Logs
2. Filter for errors or specific queries
3. Check response times

## Security Best Practices

### Rotate App Password

Every 90 days:
1. Azure Portal → App Registration → Certificates & secrets
2. Create new client secret
3. Update MICROSOFT_APP_PASSWORD in Render
4. Delete old secret after verifying new one works

### Restrict Bot Access

Use Teams policies to limit who can install/use:
1. Teams Admin Center → Teams apps → Permission policies
2. Create policy for Fitness Connection managers only
3. Block others from installing

## Next Steps

✅ Bot configured in Azure
✅ Teams channel enabled
✅ Bot installed in Teams

→ Next: Production testing (see `TESTING.md`)
→ Then: Deploy to Fitness Connection teams
→ Finally: Monitor and iterate based on feedback

## Support Resources

- Azure Bot Service Docs: https://docs.microsoft.com/azure/bot-service/
- Teams App Development: https://docs.microsoft.com/microsoftteams/platform/
- Bot Framework: https://dev.botframework.com/