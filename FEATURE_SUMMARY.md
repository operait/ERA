# Email & Calendar Features - Summary

## ✨ New Features

### 📧 Email Sending
ERA can now automatically send emails via Microsoft Outlook when recommending written warnings or follow-up communications.

**Flow:**
1. ERA detects when her response recommends sending an email
2. Asks manager for employee name and email
3. Collects any missing template variables
4. Shows preview of email with filled template
5. Sends email via Microsoft Graph API on confirmation
6. Logs sent email in database for audit trail

### 📅 Calendar Booking
ERA can now check the manager's calendar and book calls when recommending phone conversations.

**Flow:**
1. ERA detects when her response recommends calling employee
2. Checks manager's Outlook calendar for availability
3. Shows top 3 recommended time slots (prefers morning, next business day)
4. Asks manager to select preferred time
5. Collects employee name and phone number
6. Books calendar event with reminder
7. Logs booking in database for tracking

## 🗂️ What Was Built

### New Files Created

```
src/
├── lib/
│   └── graph-client.ts              # Microsoft Graph API client
├── services/
│   ├── email-composer.ts            # Email template filling & sending
│   ├── calendar.ts                  # Calendar availability & booking
│   └── conversation-state.ts        # Multi-turn conversation management
├── bot/handlers/
│   ├── email-handler.ts             # Email conversation flow handler
│   └── calendar-handler.ts          # Calendar conversation flow handler
└── types/
    └── graph.ts                     # TypeScript types for Graph API

supabase/migrations/
└── 002_email_calendar_tables.sql    # Database schema for logging
```

### Modified Files

- `src/bot/app.ts` - Integrated email/calendar handlers into main bot flow
- `.env.example` - Added Graph API configuration variables

### Database Changes

**New Tables:**
- `email_logs` - Audit log for all sent emails
- `calendar_bookings` - Tracking for all booked calls

**Modified Tables:**
- `templates` - Added `email_subject`, `email_recipient_field`, `template_type` columns

## 🎯 Usage Examples

### Example 1: Email Flow

```
Manager: "Employee missed 3 shifts without calling in, what should I do?"

ERA: [Provides attendance policy guidance]
     "I recommend sending a written warning via email."

     "I can help you send that email. First, what is the employee's full name?"

Manager: "John Smith"

ERA: "What is John Smith's email address?"

Manager: "john.smith@fitnessconnection.com"

ERA: 📧 Email Preview

     To: John Smith <john.smith@fitnessconnection.com>
     Subject: Written Warning - Attendance Policy Violation

     Message:
     Dear John Smith,

     This letter serves as a written warning regarding your attendance...

     ---
     Would you like me to send this email? (Reply "yes" to send)

Manager: "yes"

ERA: ✅ Email sent successfully to john.smith@fitnessconnection.com!

     Is there anything else I can help you with?
```

### Example 2: Calendar Flow

```
Manager: "I need to discuss performance issues with Sarah"

ERA: [Provides performance management guidance]
     "I recommend scheduling a one-on-one call to discuss."

     "I'll help you schedule that call. Let me check your calendar..."

     📅 Available Times:

     1. Tomorrow (Jan 11) at 10:00 AM - 10:30 AM
     2. Tomorrow (Jan 11) at 2:00 PM - 2:30 PM
     3. Friday (Jan 12) at 9:00 AM - 9:30 AM

     Which time works best? (Reply with the number)

Manager: "1"

ERA: "Great! What is the employee's name for this call?"

Manager: "Sarah Johnson"

ERA: "What is Sarah Johnson's phone number? (Or type 'skip')"

Manager: "555-123-4567"

ERA: 📅 Calendar Booking Preview

     Employee: Sarah Johnson
     Time: Tomorrow (Jan 11) at 10:00 AM - 10:30 AM
     Topic: Performance Discussion
     Phone: 555-123-4567

     ---
     Should I book this on your calendar? (Reply "yes" to confirm)

Manager: "yes"

ERA: ✅ Calendar event booked successfully!

     Sarah Johnson - Performance Discussion
     Tomorrow (Jan 11) at 10:00 AM - 10:30 AM

     You'll receive a reminder 15 minutes before.

     Is there anything else I can help you with?
```

## 🔧 Technical Details

### Email Detection Keywords
ERA triggers email flow when her response contains:
- "send an email"
- "email the employee"
- "written warning via email"
- "follow up via email"

### Calendar Detection Keywords
ERA triggers calendar flow when her response contains:
- "schedule a call"
- "call the employee"
- "recommend calling"
- "one-on-one call"

### Template Variables
Email templates support variable substitution using `{{variable_name}}` syntax:
- `{{employee_name}}`
- `{{employee_email}}`
- `{{dates}}`
- `{{incident_date}}`
- `{{policy_reference}}`
- `{{violation_description}}`
- Custom variables as needed

### Calendar Scheduling Logic
- **Working Hours**: 9 AM - 5 PM (configurable)
- **Days Ahead**: Looks 7 days into the future
- **Slot Duration**: 30 minutes (configurable)
- **Preferences**: Morning slots, early in week, soonest available
- **Excludes**: Weekends, outside working hours, conflicting events

## 🔐 Security & Compliance

### Audit Trail
All actions are logged:
- Email logs include: sender, recipient, subject, body, timestamp, status
- Calendar logs include: manager, employee, time, topic, status

### Permissions Required
- `Mail.Send` - Send email as any user
- `Calendars.ReadWrite` - Read and write calendars
- `User.Read.All` - Look up user information

### Data Retention
Consider implementing retention policies:
- Email logs: 90 days
- Calendar bookings: 90 days after completion

## 📊 Monitoring

### Check Email Success Rate
```sql
SELECT status, COUNT(*) as count
FROM email_logs
WHERE sent_at > NOW() - INTERVAL '7 days'
GROUP BY status;
```

### Check Popular Booking Times
```sql
SELECT EXTRACT(HOUR FROM scheduled_time) as hour, COUNT(*) as bookings
FROM calendar_bookings
GROUP BY hour
ORDER BY hour;
```

### Recent Activity
```sql
-- Recent emails
SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 10;

-- Upcoming calls
SELECT * FROM calendar_bookings
WHERE scheduled_time > NOW()
ORDER BY scheduled_time ASC
LIMIT 10;
```

## 🚀 Next Steps

1. **Setup**: Follow [EMAIL_CALENDAR_SETUP.md](EMAIL_CALENDAR_SETUP.md) to configure Azure AD
2. **Test**: Run through example flows in a test environment
3. **Pilot**: Test with 3-5 managers
4. **Refine**: Adjust templates and detection logic based on feedback
5. **Deploy**: Roll out to all managers

## 🐛 Known Limitations

1. **Email Format**: Currently uses HTML emails with basic formatting
2. **Time Zones**: All times in UTC, converted for display
3. **Manager Email**: Extracted from Teams context (may need adjustment for your tenant)
4. **Template Extraction**: Basic regex-based extraction (may need refinement)
5. **Rate Limits**: No current throttling (add if hitting Graph API limits)

## 💡 Future Enhancements

- [ ] Rich HTML email templates with company branding
- [ ] Calendar event rescheduling support
- [ ] Email thread tracking and follow-ups
- [ ] Integration with HR system for employee lookup
- [ ] Multi-timezone support for distributed teams
- [ ] SMS notifications for calendar events
- [ ] Email templates from database instead of response parsing
- [ ] Bulk email sending for team announcements
- [ ] Calendar meeting room booking
- [ ] Integration with shift scheduling system

## 📞 Support

For setup help, see [EMAIL_CALENDAR_SETUP.md](EMAIL_CALENDAR_SETUP.md)

For implementation details, see [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
