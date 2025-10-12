# URGENT: Fix Calendar Timezone Issue

## Problem
ERA is recommending calendar times that are actually busy. The times are off by approximately 1 hour.

## Root Cause
The `MailboxSettings.Read` permission is missing from the Azure AD app registration. Without this permission, ERA cannot detect the user's timezone and defaults to `America/Chicago`, causing a timezone mismatch.

## Error in Logs
```
Failed to get mailbox settings for OperitHR@OperaitHR.onmicrosoft.com:
GraphError: Access is denied. Check credentials and try again.
```

## Quick Fix (Azure Admin Required)

### Step 1: Add Missing Permission

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Select your ERA bot application
4. Go to **API permissions**
5. Click **Add a permission**
6. Select **Microsoft Graph** → **Application permissions**
7. Search for and add: `MailboxSettings.Read`
8. Click **Add permissions**

### Step 2: Grant Admin Consent

1. Still in the **API permissions** page
2. Click **Grant admin consent for [Your Organization]**
3. Confirm the consent dialog
4. Wait a few moments for the permission to propagate

### Step 3: Restart ERA

If ERA is running on Render or another hosting platform:
1. Go to your deployment dashboard
2. Restart the service to pick up the new permissions
3. If using manual deployment: restart the Node.js process

### Step 4: Verify Fix

1. Open Microsoft Teams
2. Send ERA a message: "Need to schedule a call with an employee"
3. ERA will check your calendar availability
4. Check the logs for: `📍 Detected manager timezone: [Your Timezone]`
5. Verify that the recommended times match your actual calendar availability

## Expected Behavior After Fix

**Before Fix (Current):**
```
Failed to get mailbox settings...
📍 Detected manager timezone: America/Chicago (DEFAULT - may be incorrect)
```

**After Fix:**
```
📍 Detected manager timezone: America/New_York (or your actual timezone)
```

## Technical Details

The Graph API `calendarView` endpoint returns times in the timezone specified by the `Prefer: outlook.timezone` header. When we can't detect the user's actual timezone:

1. We default to `America/Chicago` (Central Time)
2. Graph API returns events in Central Time
3. But Outlook displays them in YOUR actual timezone
4. This causes a mismatch - events appear 1+ hours off

With the `MailboxSettings.Read` permission:
- ERA fetches your actual timezone from Outlook settings
- Uses that timezone for all calendar queries
- Times match perfectly between ERA and your Outlook calendar

## Alternative Workaround (If Admin Consent Not Available)

If you cannot add the permission immediately, you can hardcode your timezone:

1. Edit `src/services/calendar.ts`
2. Find line 31: `private readonly DEFAULT_TIMEZONE = 'America/Chicago';`
3. Change to your timezone (e.g., `'America/New_York'`, `'America/Los_Angeles'`, etc.)
4. Rebuild and redeploy: `npm run build && npm start`

**Note:** This is a temporary workaround. The proper fix is to add the permission.

## Common Timezones

- **Eastern Time**: `America/New_York`
- **Central Time**: `America/Chicago`
- **Mountain Time**: `America/Denver`
- **Pacific Time**: `America/Los_Angeles`

## Verification Checklist

- [ ] `MailboxSettings.Read` permission added in Azure AD
- [ ] Admin consent granted
- [ ] ERA service restarted
- [ ] Logs show correct timezone detection
- [ ] Calendar availability matches Outlook calendar
- [ ] Test booking creates event at correct time

## Still Having Issues?

If calendar times are still incorrect after adding the permission:

1. **Check your Outlook timezone setting:**
   - Open Outlook Web → Settings → Calendar → Time zones
   - Note your selected timezone

2. **Check the ERA logs:**
   - Look for: `📍 Detected manager timezone: [timezone]`
   - Verify it matches your Outlook timezone

3. **Test Graph API directly:**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://graph.microsoft.com/v1.0/users/YOUR_EMAIL/mailboxSettings
   ```
   Should return: `"timeZone": "America/New_York"` (or your timezone)

4. **Contact support** with:
   - ERA log output showing timezone detection
   - Your Outlook timezone setting screenshot
   - Specific example of incorrect time recommendation
