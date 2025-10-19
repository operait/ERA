# Render Logs Setup Guide

✅ **SETUP COMPLETE!** Your Render logs are now accessible automatically.

## Quick Access Commands

```bash
# View last 100 log entries
npm run logs

# View last 200 entries
npm run logs:tail

# View only errors
npm run logs:errors

# Follow logs in real-time (refreshes every 5 seconds)
npm run logs:follow
```

## For Claude Code

I can now fetch your Render logs automatically! Just tell me:
- "Check the Render logs"
- "What's happening in production?"
- "Show me the latest errors"
- "Are there any issues?"

And I'll run `npm run logs:tail` to see what's going on.

## Configuration

Your `.env` file is already configured with:
```bash
RENDER_API_KEY=rnd_...
RENDER_SERVICE_ID=srv-d3esk0jipnbc739kvta0
RENDER_OWNER_ID=tea-d33bk4buibrs73afso90
```

## Features

- **ANSI Color Stripping**: Logs are cleaned of color codes for readability
- **Error Filtering**: Use `--errors` flag to see only error messages
- **Live Following**: Real-time log monitoring with `--follow`
- **Pagination**: Fetch more logs with `--limit=N` parameter

## API Details

The script uses Render's official API:
- **Endpoint**: `GET /v1/logs`
- **Required Parameters**:
  - `ownerId`: Your Render account/team ID
  - `resource`: The service ID to fetch logs from
  - `limit`: Number of log entries (default: 100)

## Troubleshooting

### HTTP 401 Error
- Your API key expired or is invalid
- Generate a new key at https://dashboard.render.com/account/settings

### HTTP 404 Error
- Service ID or Owner ID is incorrect
- Verify IDs match your Render service

### No Logs Shown
- Your service might not be generating logs
- Check that your service is running in Render dashboard

## Security

- Your `.env` file is in `.gitignore` (never committed)
- API key has full access to your Render account - keep it secure
- Logs are fetched read-only - no modifications possible

## Example Output

```
📋 Render Logs (last 100 entries)
================================================================================
[10/16/2025, 7:35:19 AM] Fetched Teams member info - Email: user@example.com
[10/16/2025, 7:35:20 AM] Processing query from User: Hi Era
[10/16/2025, 7:35:20 AM] 🔍 Searching for: "Hi Era"
================================================================================
✅ Fetched 100 log entries
```
