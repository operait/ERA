---
description: View Render logs and recent ERA conversations
---

Fetch the latest Render logs to see:
1. Recent deployments and their status
2. User messages and ERA's responses
3. Any errors or warnings
4. Calendar/email activity

Please run the following command:

```bash
npm run logs:tail
```

After fetching the logs, provide a summary of:
1. **Deployment Status**: Latest deployment info and health
2. **Recent Conversations**: User queries and ERA's responses
3. **Errors/Warnings**: Any issues that need attention
4. **Activity**: Calendar bookings, email sends, etc.

Focus on extracting:
- User messages (e.g., "Processing query from User: ...")
- ERA's response times
- Any error messages or stack traces
- System health indicators
