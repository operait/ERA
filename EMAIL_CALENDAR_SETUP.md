# Email & Calendar Integration Setup Guide

This guide walks you through setting up Microsoft Graph API integration for ERA's email sending and calendar booking features.

## Prerequisites

- Azure AD tenant with admin access
- Microsoft 365 account for testing
- Existing ERA bot application registered in Azure

## Step 1: Configure Azure AD App Registration

### 1.1 Add API Permissions

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Select your ERA bot application
4. Go to **API permissions**
5. Click **Add a permission** → **Microsoft Graph** → **Application permissions**
6. Add the following permissions:
   - `Mail.Send` - Send mail as any user
   - `Calendars.ReadWrite` - Read and write calendars in all mailboxes
   - `MailboxSettings.Read` - Read user mailbox settings (for timezone detection)
   - `User.Read.All` - Read all users' basic profiles
7. Click **Grant admin consent** for your organization

### 1.2 Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Enter description: "ERA Graph API Access"
4. Select expiration (recommended: 24 months)
5. Click **Add**
6. **IMPORTANT**: Copy the secret value immediately (you won't see it again!)

### 1.3 Note Your Application Details

Copy these values for your `.env` file:
- **Application (client) ID**: Found on the Overview page
- **Directory (tenant) ID**: Found on the Overview page
- **Client secret**: The value you just copied

## Step 2: Update Environment Variables

Add these variables to your `.env` file:

```bash
# Microsoft Graph API Configuration
MICROSOFT_CLIENT_ID=your-app-client-id-here
MICROSOFT_CLIENT_SECRET=your-client-secret-here
MICROSOFT_TENANT_ID=your-tenant-id-here
GRAPH_API_SCOPES=Mail.Send,Calendars.ReadWrite
```

**Note**: If you're using the same Azure app for both the bot and Graph API, the `MICROSOFT_TENANT_ID` will be the same as `MICROSOFT_APP_TENANT_ID`.

## Step 3: Run Database Migrations

Apply the new database schema for email and calendar logging:

```bash
# If using Supabase CLI
supabase db push

# Or manually run the migration SQL
# Navigate to Supabase dashboard → SQL Editor
# Run the contents of: supabase/migrations/002_email_calendar_tables.sql
```

This creates:
- `email_logs` table - Audit trail for sent emails
- `calendar_bookings` table - Tracking for scheduled calls
- Additional columns on `templates` table for email support

## Step 4: Test the Integration

### 4.1 Build and Start ERA

```bash
npm run build
npm start
```

### 4.2 Test Email Flow

In Microsoft Teams, send ERA a message:

```
Employee missed 3 shifts without calling in
```

ERA should:
1. Provide policy guidance
2. Recommend sending a written warning via email
3. Ask for employee name
4. Ask for employee email
5. Collect any missing template variables
6. Show email preview
7. Ask for confirmation
8. Send the email via Outlook

### 4.3 Test Calendar Flow

In Microsoft Teams, send ERA a message:

```
Need to discuss performance issues with an employee
```

ERA should:
1. Provide policy guidance
2. Recommend scheduling a call
3. Check your calendar
4. Show 3 available time slots
5. Ask you to select a time
6. Ask for employee name and phone
7. Show booking preview
8. Book the event on your calendar

## Step 5: Verify Permissions

### Email Permission Test

Try this command to verify email sending works:

```bash
# Test using the Graph API directly
curl -X POST https://graph.microsoft.com/v1.0/users/your-email@domain.com/sendMail \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "subject": "Test from ERA",
      "body": {
        "contentType": "Text",
        "content": "This is a test email from ERA."
      },
      "toRecipients": [
        {
          "emailAddress": {
            "address": "test@example.com"
          }
        }
      ]
    }
  }'
```

### Calendar Permission Test

Test calendar access:

```bash
curl -X GET https://graph.microsoft.com/v1.0/users/your-email@domain.com/calendar/events \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Troubleshooting

### Error: "Insufficient privileges"

**Solution**: Ensure admin consent was granted for the API permissions in Azure AD.

### Error: "Invalid client secret"

**Solution**:
1. Verify the client secret in `.env` matches the one in Azure
2. Check if the secret has expired
3. Generate a new secret if needed

### Error: "User not found"

**Solution**:
1. Verify the user email format is correct
2. Check that the user exists in your Azure AD tenant
3. Ensure the bot has User.Read.All permission

### Email not sending

**Solution**:
1. Check `email_logs` table in database for error messages
2. Verify SMTP settings in Exchange Online
3. Check if the sender's mailbox is enabled
4. Review Exchange Online message trace logs

### Calendar not showing availability

**Solution**:
1. Ensure the manager has an Exchange Online mailbox
2. Verify calendar permissions
3. Check if calendar is shared correctly
4. Test Graph API access directly using Graph Explorer

### Calendar showing wrong available times / timezone issues

**Problem**: ERA recommends times that are actually busy on the calendar

**Solution**:
1. Add `MailboxSettings.Read` permission in Azure AD (see Step 1.1)
2. Grant admin consent for the new permission
3. Verify timezone detection works by checking logs for "Detected manager timezone"
4. If timezone detection fails, events may be off by 1+ hours

### Manager email format incorrect

**Problem**: The bot extracts manager email as `aadObjectId@fitnessconnection.com`

**Solution**: Update the email extraction logic in `src/bot/app.ts` to use the actual email from Teams:

```typescript
const managerEmail = context.activity.from?.email ||
                     context.activity.from?.userPrincipalName ||
                     'unknown@fitnessconnection.com';
```

## Security Best Practices

### 1. Principle of Least Privilege

Only grant the minimum required permissions. Current permissions:
- `Mail.Send` - Allows sending on behalf of any user
- `Calendars.ReadWrite` - Allows reading/writing any calendar

**Recommendation**: Consider delegated permissions if you want users to control their own data.

### 2. Secret Rotation

Rotate client secrets regularly:
1. Create a new secret in Azure
2. Update `.env` with new secret
3. Restart ERA
4. Delete old secret after confirming new one works

### 3. Audit Logging

Monitor the following tables for unusual activity:
- `email_logs` - Track all sent emails
- `calendar_bookings` - Track all calendar events
- `query_logs` - Track user queries

Run regular audits:

```sql
-- Emails sent in last 24 hours
SELECT * FROM email_logs
WHERE sent_at > NOW() - INTERVAL '24 hours'
ORDER BY sent_at DESC;

-- Failed email attempts
SELECT * FROM email_logs
WHERE status = 'failed'
ORDER BY sent_at DESC
LIMIT 50;

-- Calendar bookings by manager
SELECT manager_email, COUNT(*) as booking_count
FROM calendar_bookings
GROUP BY manager_email
ORDER BY booking_count DESC;
```

### 4. Data Retention

Implement data retention policies:

```sql
-- Delete old email logs (older than 90 days)
DELETE FROM email_logs
WHERE sent_at < NOW() - INTERVAL '90 days';

-- Delete old completed calendar bookings
DELETE FROM calendar_bookings
WHERE status = 'completed'
AND scheduled_time < NOW() - INTERVAL '90 days';
```

## Advanced Configuration

### Custom Email Templates

Add custom email templates to the database:

```sql
INSERT INTO templates (title, content, category, template_type, email_subject)
VALUES (
  'Attendance Warning',
  'Dear {{employee_name}},\n\nThis letter serves as a written warning...',
  'attendance',
  'email',
  'Written Warning - Attendance Policy Violation'
);
```

### Customize Working Hours

Edit `src/services/calendar.ts`:

```typescript
private readonly WORKING_HOURS_START = 8; // 8 AM
private readonly WORKING_HOURS_END = 18; // 6 PM
```

### Customize Time Zone

Update timezone handling in calendar service:

```typescript
timeZone: 'America/New_York' // or your preferred timezone
```

## Monitoring & Analytics

### Email Metrics

Track email success rate:

```sql
SELECT
  DATE(sent_at) as date,
  COUNT(*) as total_emails,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as successful,
  ROUND(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 2) as success_rate
FROM email_logs
WHERE sent_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(sent_at)
ORDER BY date DESC;
```

### Calendar Metrics

Track calendar booking patterns:

```sql
SELECT
  EXTRACT(HOUR FROM scheduled_time) as hour_of_day,
  COUNT(*) as bookings
FROM calendar_bookings
WHERE scheduled_time > NOW() - INTERVAL '30 days'
GROUP BY hour_of_day
ORDER BY hour_of_day;
```

## Next Steps

1. **Pilot Testing**: Test with 3-5 managers before full rollout
2. **User Training**: Create quick reference guide for managers
3. **Feedback Loop**: Collect feedback on email templates and calendar booking UX
4. **Refinement**: Adjust detection keywords and template extraction logic
5. **Scale**: Monitor API rate limits and performance under load

## Support

For issues or questions:
- Check application logs: `npm run dev` (includes detailed logging)
- Review database logs: Check `email_logs` and `calendar_bookings` tables
- Test Graph API: Use [Microsoft Graph Explorer](https://developer.microsoft.com/graph/graph-explorer)
- Azure Support: For permission or tenant issues

## Appendix: Permission Details

### Mail.Send (Application)
- **Risk Level**: High
- **Why needed**: Send emails on behalf of managers without user interaction
- **Alternative**: Mail.Send (Delegated) - Requires user consent each time

### Calendars.ReadWrite (Application)
- **Risk Level**: High
- **Why needed**: Read calendar availability and book events for managers
- **Alternative**: Calendars.ReadWrite (Delegated) - Requires user consent

### MailboxSettings.Read (Application)
- **Risk Level**: Low
- **Why needed**: Detect user's timezone for accurate calendar availability
- **Alternative**: None - Required for correct timezone handling
- **Note**: Without this permission, calendar times may be off by 1+ hours

### User.Read.All (Application)
- **Risk Level**: Medium
- **Why needed**: Look up user information for email addressing
- **Alternative**: User.ReadBasic.All - More restrictive option
