# ERA Email & Calendar Integration - Implementation Plan

## Overview
Add Microsoft Outlook integration to ERA for automated email sending and calendar booking based on HR policy recommendations.

## Feature 1: Email Sending via Outlook

### Requirements
- When ERA recommends sending a follow-up email, collect required information from manager
- Fill out email template with collected data
- Send email via Microsoft Graph API (Outlook)
- Confirm delivery to manager

### Implementation Checklist

#### 1. Microsoft Graph API Setup
- [ ] Add Microsoft Graph API dependencies (`@microsoft/microsoft-graph-client`, `@azure/identity`)
- [ ] Configure OAuth permissions in Azure AD app registration (Mail.Send, Mail.ReadWrite)
- [ ] Add Graph API client configuration to environment variables
- [ ] Create Graph API client wrapper in `src/lib/graph-client.ts`

#### 2. Email Template System Enhancement
- [ ] Extend template schema in database to include email metadata (subject, recipient placeholders)
- [ ] Update `src/templates/` to support email-specific templates
- [ ] Create conversation flow to collect missing template variables from manager
- [ ] Add validation for email addresses and required fields

#### 3. Email Conversation Flow
- [ ] Detect when ERA recommends sending an email (keyword/intent detection)
- [ ] Implement multi-turn conversation to gather template variables (employee name, email, dates, etc.)
- [ ] Show preview of filled email template to manager for approval
- [ ] Send email via Graph API on manager confirmation
- [ ] Store sent email log in database for audit trail

#### 4. Bot Integration
- [ ] Add email sending state management to bot conversation flow
- [ ] Create email composer service in `src/services/email-composer.ts`
- [ ] Implement error handling for email failures (invalid addresses, API errors)
- [ ] Add retry logic for transient failures

---

## Feature 2: Calendar Booking via Outlook

### Requirements
- When ERA recommends calling employee, check manager's Outlook calendar
- Find optimal available time slots
- Recommend best time to manager
- Book calendar event on manager confirmation

### Implementation Checklist

#### 1. Microsoft Graph Calendar API Setup
- [ ] Add OAuth permissions for calendar access (Calendars.ReadWrite, Calendars.Read)
- [ ] Extend Graph API client to support calendar operations
- [ ] Create calendar service wrapper in `src/services/calendar.ts`

#### 2. Calendar Availability Logic
- [ ] Implement function to retrieve manager's calendar for next 7 days
- [ ] Create algorithm to find available time slots (exclude existing events, working hours only)
- [ ] Rank time slots by preference (next business day, morning preference, etc.)
- [ ] Format available times for display to manager

#### 3. Calendar Booking Flow
- [ ] Detect when ERA recommends calling employee
- [ ] Query manager's calendar via Graph API
- [ ] Present top 3 available time slots to manager
- [ ] Collect additional booking details (employee name, phone number, topic)
- [ ] Create calendar event with proper details on confirmation
- [ ] Add reminder notification (15 minutes before)

#### 4. Event Management
- [ ] Generate calendar event with proper subject line (e.g., "Call: [Employee Name] - [Topic]")
- [ ] Include employee contact info in event description
- [ ] Add option to cancel/reschedule booked calls
- [ ] Store booking metadata in database for tracking

---

## Technical Architecture

### New Files to Create
```
src/
├── lib/
│   └── graph-client.ts          # Microsoft Graph API client wrapper
├── services/
│   ├── email-composer.ts        # Email template filling and sending
│   ├── calendar.ts              # Calendar availability and booking
│   └── conversation-state.ts    # Multi-turn conversation state management
└── types/
    └── graph.ts                 # TypeScript types for Graph API responses
```

### Database Schema Updates
```sql
-- Add email templates table (extend existing templates)
ALTER TABLE templates ADD COLUMN email_subject TEXT;
ALTER TABLE templates ADD COLUMN email_recipient_field TEXT;

-- Add email audit log
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  template_id UUID REFERENCES templates(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  status TEXT NOT NULL -- 'sent', 'failed', 'pending'
);

-- Add calendar booking log
CREATE TABLE calendar_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  employee_phone TEXT,
  event_id TEXT NOT NULL, -- Outlook event ID
  scheduled_time TIMESTAMP NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL, -- 'scheduled', 'completed', 'cancelled'
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Environment Variables to Add
```
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
GRAPH_API_SCOPES=Mail.Send,Calendars.ReadWrite
```

---

## Conversation Flow Examples

### Email Flow
```
Manager: "Employee missed 3 shifts without calling"
ERA: [Provides policy guidance] "I recommend sending a written warning via email."

ERA: "I can help you send that email. What is the employee's name?"
Manager: "John Smith"

ERA: "What is John's email address?"
Manager: "john.smith@fitnessconnection.com"

ERA: "What dates did John miss shifts?"
Manager: "January 5th, 8th, and 10th"

ERA: [Shows email preview]
"Subject: Written Warning - Attendance Policy Violation
To: john.smith@fitnessconnection.com

Dear John Smith,

This letter serves as a written warning regarding your attendance...
[template filled with collected info]

Would you like me to send this email?"

Manager: "Yes"
ERA: "Email sent successfully to john.smith@fitnessconnection.com"
```

### Calendar Flow
```
Manager: "Employee has performance issues, need to discuss"
ERA: [Provides policy guidance] "I recommend scheduling a one-on-one call to discuss."

ERA: "Let me check your calendar for available times..."

ERA: "I found these available slots:
1. Tomorrow (Jan 11) at 10:00 AM
2. Tomorrow (Jan 11) at 2:00 PM
3. Friday (Jan 12) at 9:00 AM

Which time works best?"

Manager: "Option 1"

ERA: "What is the employee's name and phone number?"
Manager: "Sarah Johnson, 555-123-4567"

ERA: "I've booked 'Call: Sarah Johnson - Performance Discussion' for tomorrow at 10:00 AM.
You'll receive a reminder 15 minutes before."
```

---

## Testing Checklist
- [ ] Unit tests for email template variable extraction
- [ ] Unit tests for calendar availability algorithm
- [ ] Integration tests for Graph API calls (mocked)
- [ ] End-to-end test: complete email sending flow
- [ ] End-to-end test: complete calendar booking flow
- [ ] Error handling tests (API failures, invalid input)
- [ ] Manual testing in Teams with real Outlook account

---

## Security & Compliance
- [ ] Ensure proper OAuth token handling and refresh
- [ ] Store no sensitive data in plain text (email content encryption consideration)
- [ ] Implement rate limiting for API calls
- [ ] Add audit logging for all sent emails and calendar events
- [ ] Manager consent required before sending emails
- [ ] GDPR compliance check for storing employee email addresses

---

## Rollout Plan
1. **Phase 1**: Microsoft Graph API setup and authentication (Week 1)
2. **Phase 2**: Email sending implementation (Week 2)
3. **Phase 3**: Calendar booking implementation (Week 3)
4. **Phase 4**: Testing and refinement (Week 4)
5. **Phase 5**: Deploy to staging environment
6. **Phase 6**: Pilot with 5 managers
7. **Phase 7**: Production rollout

---

## Success Metrics
- Email sending success rate > 95%
- Calendar booking completion rate > 90%
- Average time to send email < 60 seconds
- Average time to book call < 45 seconds
- Manager satisfaction score > 4/5

---

## Dependencies & Risks

### Dependencies
- Microsoft Graph API access and permissions
- Valid Azure AD app registration
- Manager Outlook accounts properly configured
- Network access to Microsoft Graph endpoints

### Risks
- OAuth token expiration during conversation flow
- Calendar API rate limits for high-volume usage
- Email deliverability issues (spam filters)
- Time zone handling complexity
- Manager calendar privacy concerns

### Mitigation
- Implement robust token refresh logic
- Add caching for calendar availability queries
- Use official Microsoft email sending endpoints
- Store all times in UTC, convert for display
- Clear privacy policy and opt-in mechanism
