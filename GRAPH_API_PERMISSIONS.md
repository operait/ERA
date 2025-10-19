# Microsoft Graph API Permissions for ERA

## Required Permissions

To enable automatic timezone detection and full calendar functionality, ERA requires the following Microsoft Graph API permissions:

### Application Permissions (for the Azure AD App)

1. **Calendars.ReadWrite** - Required for:
   - Reading user calendar events
   - Creating calendar events for scheduled calls
   - Deleting calendar events if needed

2. **MailboxSettings.Read** - Required for:
   - Automatically detecting user's timezone from mailbox settings
   - Ensuring calendar times are displayed in the correct timezone

3. **Mail.Send** - Required for:
   - Sending emails on behalf of managers
   - Email templates for HR communications

4. **User.Read.All** - Required for:
   - Reading user profile information
   - Getting user's email address and display name

## Current Status

✅ **Calendars.ReadWrite** - Working
✅ **Mail.Send** - Working
✅ **User.Read.All** - Working
❌ **MailboxSettings.Read** - **NOT CONFIGURED** (causes access denied error)

## Fallback Behavior

When MailboxSettings.Read permission is not available, ERA will:

1. **First attempt**: Try to detect timezone from the user's calendar events
   - Reads the timezone property from the first available calendar event
   - Works if the user has at least one event in their calendar

2. **Final fallback**: Use the default timezone (America/New_York)
   - This is the current behavior
   - May cause incorrect time recommendations if user is in a different timezone

## How to Add MailboxSettings.Read Permission

1. Go to Azure Portal: https://portal.azure.com
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find your ERA application
4. Go to **API permissions**
5. Click **Add a permission**
6. Select **Microsoft Graph** → **Application permissions**
7. Search for and add **MailboxSettings.Read**
8. Click **Grant admin consent** for your organization
9. Restart the ERA service

## Testing Timezone Detection

After adding the permission, you can test by:

1. Asking ERA to schedule a call
2. Check the logs for: `✅ Detected manager timezone: America/New_York` (or other timezone)
3. Verify that recommended times match your Outlook calendar exactly

## Alternative: Manual Timezone Configuration

If you cannot add the MailboxSettings.Read permission, you can manually configure each user's timezone:

1. Update the default timezone in `src/services/calendar.ts`:
   ```typescript
   private readonly DEFAULT_TIMEZONE = 'America/New_York'; // Change this
   ```

2. Or create a user settings table in the database to store timezone preferences per user

## Supported Timezones

ERA supports all IANA timezone identifiers, including:
- `America/New_York` (Eastern Time)
- `America/Chicago` (Central Time)
- `America/Denver` (Mountain Time)
- `America/Los_Angeles` (Pacific Time)
- And all other standard timezone names

For the full list, see: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
