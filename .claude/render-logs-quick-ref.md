# Quick Reference: Render Logs Access

## Setup Checklist
- [x] Log fetcher script created: `scripts/render-logs.js`
- [x] NPM scripts added to package.json
- [ ] Add `RENDER_API_KEY` to `.env`
- [ ] Add `RENDER_SERVICE_ID` to `.env`

## Commands
```bash
npm run logs          # Last 100 lines
npm run logs:tail     # Last 200 lines
npm run logs:follow   # Real-time monitoring
```

## Get Credentials
1. API Key: https://dashboard.render.com/account/settings
2. Service ID: From service URL (srv-xxx...)

## Claude Usage
Just tell me to "check the Render logs" and I'll run the command automatically!
