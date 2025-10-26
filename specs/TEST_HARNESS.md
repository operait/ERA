# Terminal Test Harness Specification

**Version:** 1.0
**Owner:** Barry (Feature Development)
**Purpose:** Enable local development and testing of ERA features without requiring Microsoft Teams integration.

---

## Overview

The test harness allows Barry to:
1. Test ERA's conversation logic from a terminal/CLI
2. Test email composition and calendar booking workflows locally
3. Simulate Teams context (user info, conversation state) without Teams
4. Rapidly iterate on features without deploying to Render
5. Debug RAG retrieval and response generation in isolation

This is critical for the `features` branch development workflow where Barry builds new features independently of Meg's prompt tuning work.

---

## User Stories

### Story 1: Interactive Conversation Testing
**As Barry**, I want to chat with ERA from my terminal, so that I can test conversation flows without using Teams.

**Acceptance Criteria:**
- Run `npm run test:conversation` to start an interactive chat session
- I can type messages and get ERA responses in real-time
- Conversation history is maintained across turns
- I can see debug info (search results, similarity scores, processing time)
- I can reset the conversation with a command (e.g., `!reset`)
- I can exit with `Ctrl+C` or `!quit`

**Example Session:**
```bash
$ npm run test:conversation

🤖 ERA Terminal Test Harness
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Connected to Supabase: ✓
Loaded MASTER_PROMPT.md: ✓

Commands:
  !reset    - Clear conversation history
  !debug    - Toggle debug mode (show search results)
  !sources  - Show sources from last response
  !quit     - Exit

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You: My employee didn't show up for 3 days

🔍 Searching... (3 results, avg similarity: 0.82)
💬 Generating response...

ERA: Got it — that's definitely something we need to address right away.

Just to make sure I have the full picture:
- Have you tried reaching out to them yet (phone, text, or email)?
- Were these three consecutive scheduled shifts?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[DEBUG] Processing time: 1,234ms
[DEBUG] RAG results: 3 chunks from "No Show Policy" (0.85), "Attendance Policy" (0.82), "Progressive Discipline" (0.79)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You: I called once today

💬 Generating response...

ERA: Thanks for the context. Since you've already made one attempt, here's what to do next:

**Immediate Steps:**
1. Make a second call attempt today and document it
2. If still no response, send a written communication documenting the absence
3. Document each attempt in your records

Since you need to call the employee to discuss this serious attendance issue, would you like me to schedule that call for you? I'll check your calendar and find available times.

[CALENDAR WORKFLOW TRIGGERED - See email/calendar test harness for testing]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You: !quit

👋 Session ended. 2 turns, 2m 15s
```

### Story 2: Email Workflow Testing
**As Barry**, I want to test email composition flows from the terminal with REAL email sending, so that I can develop and verify email features without Teams.

**Acceptance Criteria:**
- Run `npm run test:email` to start an email testing session
- I can provide scenario parameters (employee name, situation, etc.)
- ERA generates email templates based on the scenario
- I can see the composed email (subject, body, recipients)
- **I can send REAL emails via Microsoft Graph API** (primary mode)
- I can optionally use mock mode for quick iteration without sending
- I can test the full email conversation flow (template generation → review → send)

**Example Session:**
```bash
$ npm run test:email

📧 ERA Email Workflow Test Harness
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Testing email composition for a no-show scenario...

Scenario: Employee missed 3 consecutive shifts
Manager: Sarah Johnson (sarah.j@fitnessconnection.com)
Employee: John Doe (john.d@fitnessconnection.com)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Retrieving policy context...
📝 Generating email template...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 COMPOSED EMAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

From: sarah.j@fitnessconnection.com
To: john.d@fitnessconnection.com
Subject: Urgent - Missed Shifts on Oct 21-23, 2025

Dear John,

You were scheduled to work on October 21, 22, and 23, 2025, but did not report to work or call in. This constitutes three consecutive no-call/no-show violations.

Per our attendance policy, this is a serious matter that requires immediate attention.

Please contact me by end of day October 24, 2025 to discuss this situation.

Best regards,
Sarah Johnson
Manager, Fitness Connection

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Options:
  [1] Send email via Graph API (REAL)
  [2] Save to file (email_draft_20251024.txt)
  [3] Edit template
  [4] Cancel

Your choice: 1

📧 Sending email via Microsoft Graph API...

✅ Email sent successfully!
   Message ID: AAMkAGVm...

📋 Email also saved to: ./test-output/email_sent_20251024.txt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Story 3: Calendar Booking Testing
**As Barry**, I want to test calendar booking flows from the terminal with REAL calendar integration, so that I can develop and verify calendar features without Teams.

**Acceptance Criteria:**
- Run `npm run test:calendar` to start a calendar testing session
- I can provide scenario parameters (manager email, employee name, topic)
- **ERA checks REAL availability using Microsoft Graph API** (primary mode)
- I can see the actual available time slots from my Outlook calendar
- **I can book REAL calendar events** that appear in Outlook
- I can optionally use mock mode for quick iteration without booking
- I can test the full calendar workflow (check availability → select time → book event)

**Example Session:**
```bash
$ npm run test:calendar

📅 ERA Calendar Workflow Test Harness
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Testing calendar booking workflow...

Manager: sarah.j@fitnessconnection.com
Employee: John Doe
Topic: Discuss attendance issue (3 consecutive no-shows)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Checking manager's calendar availability via Microsoft Graph API...

✅ Connected to sarah.j@fitnessconnection.com's Outlook calendar

Available time slots (Today, Oct 24):
  1. Today at 2:00 PM (30 min)
  2. Today at 3:30 PM (30 min)
  3. Today at 4:00 PM (30 min)

Select a time slot [1-3]: 2

📞 Employee phone number (optional): 555-1234

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 CALENDAR EVENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Event: Call: John Doe - Discuss attendance issue
Time: Today at 3:30 PM - 4:00 PM
Calendar: sarah.j@fitnessconnection.com

Description:
Call with John Doe to discuss attendance issue (3 consecutive no-shows)

Employee phone: 555-1234

Reminder: 15 minutes before

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Options:
  [1] Book event via Graph API (REAL)
  [2] Save to file (calendar_event_20251024.ics)
  [3] Cancel

Your choice: 1

📅 Creating calendar event via Microsoft Graph API...

✅ Event booked successfully!
   Event ID: AAMkADU3...
   View in Outlook: https://outlook.office.com/calendar/...

📋 Event also saved to: ./test-output/calendar_event_20251024.ics

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Story 4: RAG Retrieval Testing
**As Barry**, I want to test the RAG retrieval system in isolation, so that I can debug search results and embeddings.

**Acceptance Criteria:**
- Run `npm run test:rag` to start RAG testing
- I can input queries and see search results
- I can see chunk text, similarity scores, document titles
- I can test different similarity thresholds
- I can see which policies are being retrieved for specific scenarios

**Example Session:**
```bash
$ npm run test:rag

🔍 ERA RAG Retrieval Test Harness
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Query: employee missed 3 shifts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔎 SEARCH RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found 5 results (avg similarity: 0.823)

1. No Show Policy (similarity: 0.891)
   "Employees who fail to show up for three consecutive shifts without calling may be considered to have voluntarily resigned. Managers should attempt to contact the employee..."
   [chunk_id: abc-123, document_id: doc-456]

2. Attendance Policy (similarity: 0.854)
   "Regular attendance is expected. Unexcused absences are subject to progressive discipline. After three unexcused absences within a 90-day period..."
   [chunk_id: def-789, document_id: doc-012]

3. Progressive Discipline (similarity: 0.785)
   "Disciplinary actions follow a progressive approach: verbal warning, written warning, final written warning, termination. Serious violations may skip steps..."
   [chunk_id: ghi-345, document_id: doc-678]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commands:
  !new <query>  - New search query
  !threshold <n>  - Set similarity threshold (0.0-1.0)
  !details <n>    - Show full chunk details for result #n
  !quit           - Exit

> !details 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 CHUNK DETAILS #1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Document: No Show Policy
Category: attendance
Chunk Index: 2
Similarity: 0.891

Full Text:
"Employees who fail to show up for three consecutive shifts without calling may be considered to have voluntarily resigned. Managers should attempt to contact the employee at least twice before escalating to HR. Document all contact attempts including date, time, and method (phone, email, text). If the employee cannot be reached after 3 business days, escalate to HR for termination processing."

Metadata: {...}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Technical Architecture

### Project Structure

```
src/test/
├── harness/
│   ├── conversation.ts       # Interactive conversation CLI
│   ├── email.ts              # Email workflow testing
│   ├── calendar.ts           # Calendar workflow testing
│   ├── rag.ts                # RAG retrieval testing
│   └── utils.ts              # Shared utilities (mock context, formatting)
├── mocks/
│   ├── teams-context.ts      # Mock Teams user context
│   ├── graph-client.ts       # Mock Graph API responses
│   └── conversation-state.ts # Mock conversation state manager
└── fixtures/
    ├── scenarios.json        # Test scenarios (no-show, tardiness, etc.)
    └── mock-availability.json # Mock calendar availability data
```

### NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test:conversation": "tsx src/test/harness/conversation.ts",
    "test:email": "tsx src/test/harness/email.ts",
    "test:calendar": "tsx src/test/harness/calendar.ts",
    "test:rag": "tsx src/test/harness/rag.ts"
  }
}
```

---

## Mock Context Specification

### Mock Teams Context

To simulate Teams user context locally:

```typescript
export interface MockTeamsContext {
  user: {
    id: string;
    name: string;
    email: string;
    firstName: string;
  };
  conversation: {
    id: string;
  };
}

export const DEFAULT_MOCK_CONTEXT: MockTeamsContext = {
  user: {
    id: 'test-user-123',
    name: 'Sarah Johnson',
    email: 'sarah.j@fitnessconnection.com',
    firstName: 'Sarah'
  },
  conversation: {
    id: 'test-conversation-456'
  }
};
```

### Mock Conversation State

To simulate conversation state without Teams bot:

```typescript
export class MockConversationStateManager {
  private states: Map<string, ConversationState> = new Map();

  isActive(conversationId: string): boolean { /* ... */ }
  getType(conversationId: string): 'email' | 'calendar' | null { /* ... */ }
  setState(conversationId: string, type: 'email' | 'calendar', data: any): void { /* ... */ }
  clearState(conversationId: string): void { /* ... */ }
}
```

### Mock Graph API Client

To simulate Graph API when credentials are not configured:

```typescript
export class MockGraphClient {
  // Mock calendar availability
  async getCalendarAvailability(email: string, date: Date): Promise<TimeSlot[]> {
    // Return hardcoded mock time slots
    return [
      { start: '2025-10-24T14:00:00Z', end: '2025-10-24T14:30:00Z' },
      { start: '2025-10-24T15:30:00Z', end: '2025-10-24T16:00:00Z' },
      { start: '2025-10-24T16:00:00Z', end: '2025-10-24T16:30:00Z' }
    ];
  }

  // Mock email sending
  async sendEmail(from: string, to: string, subject: string, body: string): Promise<void> {
    console.log('📧 [MOCK] Email would be sent:');
    console.log(`   From: ${from}`);
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    // Don't actually send
  }

  // Mock calendar booking
  async createCalendarEvent(email: string, event: CalendarEvent): Promise<string> {
    const eventId = `mock-event-${Date.now()}`;
    console.log(`📅 [MOCK] Calendar event would be created: ${eventId}`);
    return eventId;
  }
}
```

---

## Test Scenarios

### Scenario Files (`src/test/fixtures/scenarios.json`)

Predefined test scenarios for quick testing:

```json
{
  "scenarios": [
    {
      "id": "no-show-3-days",
      "name": "Employee No-Show 3 Consecutive Days",
      "initialQuery": "My employee didn't show up for 3 days in a row",
      "followUps": [
        "I tried calling once but they didn't answer",
        "Yes, three consecutive days"
      ],
      "expectedBehavior": "Should ask clarifying questions first, then recommend calling employee and offer calendar booking"
    },
    {
      "id": "tardiness-issue",
      "name": "Repeated Tardiness",
      "initialQuery": "My employee has been late 5 times this month",
      "followUps": [
        "I haven't talked to them about it yet",
        "They're usually 10-15 minutes late"
      ],
      "expectedBehavior": "Should recommend documenting the pattern and scheduling a one-on-one"
    },
    {
      "id": "medical-leave",
      "name": "Employee Requesting Medical Leave",
      "initialQuery": "My employee says they need medical leave for surgery",
      "followUps": [
        "They mentioned it will be 6 weeks",
        "No, they haven't provided documentation yet"
      ],
      "expectedBehavior": "Should escalate to HR and mention FMLA process"
    }
  ]
}
```

**Usage:**

```bash
$ npm run test:conversation -- --scenario no-show-3-days

🎬 Running scenario: Employee No-Show 3 Consecutive Days

You: My employee didn't show up for 3 days in a row

ERA: Got it — that's definitely something we need to address right away...

[Scenario continues with predefined follow-ups]
```

---

## Output and Logging

### Conversation Logs

Save conversation transcripts for later review:

```
test-output/
└── conversations/
    ├── conversation_20251024_103000.txt    # Timestamped transcript
    ├── conversation_20251024_103000.json   # Structured JSON format
    └── latest.txt                          # Symlink to most recent
```

**Text Format:**
```
ERA Terminal Test Session
Started: 2025-10-24 10:30:00
User: Sarah Johnson (sarah.j@fitnessconnection.com)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[10:30:15] You: My employee didn't show up for 3 days

[10:30:17] ERA: Got it — that's definitely something we need to address right away.

Just to make sure I have the full picture:
- Have you tried reaching out to them yet?
- Were these three consecutive scheduled shifts?

[10:30:45] You: I called once today

[10:30:48] ERA: Thanks for the context...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Session ended: 2025-10-24 10:35:00
Total turns: 4
Duration: 5m 0s
```

**JSON Format:**
```json
{
  "session_id": "test-session-123",
  "started_at": "2025-10-24T10:30:00Z",
  "ended_at": "2025-10-24T10:35:00Z",
  "user": {
    "name": "Sarah Johnson",
    "email": "sarah.j@fitnessconnection.com"
  },
  "turns": [
    {
      "turn_number": 1,
      "timestamp": "2025-10-24T10:30:15Z",
      "user_message": "My employee didn't show up for 3 days",
      "era_response": "Got it — that's definitely something...",
      "search_results": [...],
      "avg_similarity": 0.85,
      "processing_time_ms": 1234
    }
  ]
}
```

---

## Environment Configuration

### Required Environment Variables

For full functionality (real Graph API calls):

```bash
# Required for all harness testing
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key

# Optional - enables real email/calendar testing
MICROSOFT_GRAPH_CLIENT_ID=your-client-id
MICROSOFT_GRAPH_CLIENT_SECRET=your-client-secret
MICROSOFT_GRAPH_TENANT_ID=your-tenant-id
```

### Testing Modes

**Primary Mode: Real Graph API Integration**
- ✅ Conversation testing: Works fully (no Graph API needed)
- ✅ RAG testing: Works fully (no Graph API needed)
- ✅ Email testing: **Sends REAL emails** via Graph API
- ✅ Calendar testing: **Books REAL events** and checks REAL availability

**Fallback Mode: Mock (Optional)**
If you want to test without sending real emails/events:
- Use `--mock` flag: `npm run test:email -- --mock`
- ⚠️ Email testing: Saves to file instead of sending
- ⚠️ Calendar testing: Uses mock availability, saves .ics file instead of booking

**Recommended Setup:**
- Use REAL mode for final verification before merging
- Use MOCK mode for rapid iteration during development

---

## Success Criteria

**For the test harness to be successful:**
- ✅ Barry can test 90% of ERA features without Teams or Render deployment
- ✅ Test harness runs in < 5 seconds to start
- ✅ Conversation responses feel identical to Teams bot behavior
- ✅ Email and calendar workflows can be tested end-to-end locally
- ✅ RAG retrieval can be debugged and tuned using the harness
- ✅ Test logs are automatically saved for later review
- ✅ Mock data is realistic enough to catch bugs before deployment

---

## Future Enhancements

- **Interactive scenario builder** - Create and save new test scenarios interactively
- **Performance benchmarking** - Track response times over time
- **Regression testing** - Run all scenarios automatically and compare results
- **Record/replay mode** - Record a Teams conversation and replay it locally
- **Multi-turn scenario testing** - Test complex multi-turn flows automatically
- **Integration with Jest** - Use harness utilities in automated tests
