# Meg's Feedback Workflow Specification

**Version:** 1.0
**Owner:** Meg (Prompt Tuning)
**Purpose:** Allow Meg to test ERA in Teams, provide feedback on responses, and export conversation data for LLM-assisted prompt tuning.

---

## Overview

Meg needs a streamlined workflow to:
1. Test ERA in Microsoft Teams on the `prompt-tuning` branch
2. Provide real-time feedback on ERA's responses using `!improve` command
3. Export full conversation sessions as CSV using `!print` command
4. Use exported CSV with Claude Web Code to tune the MASTER_PROMPT.md
5. Push updated MASTER_PROMPT.md to the `prompt-tuning` branch

This workflow runs entirely in Microsoft Teams and doesn't require Meg to use a terminal or code editor directly.

---

## User Stories

### Story 1: Starting a New Testing Session
**As Meg**, I want to start a fresh testing session after each Render deployment, so that I can test the latest prompt changes in isolation.

**Acceptance Criteria:**
- When Render deploys a new version of `prompt-tuning` branch, a new session begins automatically
- When I use `!reset` or `!restart` command, a new session begins
- Sessions are isolated (feedback from one session doesn't bleed into another)
- I can see which session I'm currently in (optional: via a session ID)

### Story 2: Providing Improvement Feedback
**As Meg**, I want to attach feedback to ERA's responses inline, so that I can capture improvement notes while testing without breaking my flow.

**Acceptance Criteria:**
- I can type `!improve <my feedback>` immediately after ERA responds
- The feedback is attached to the most recent ERA response
- I can add multiple `!improve` commands to the same response (they all accumulate)
- I can categorize feedback using categories like `!improve tone: <feedback>` or `!improve citation: <feedback>`
- The feedback is stored but doesn't interrupt the conversation flow

**Examples:**
```
ERA: "Got it — that's definitely something we need to address right away..."
Meg: !improve Should mention email option earlier in the response
Meg: !improve tone: Too formal, should be more conversational
```

### Story 3: Exporting Conversation Data
**As Meg**, I want to export my testing session as a CSV, so that I can paste it into Claude Web Code for prompt tuning.

**Acceptance Criteria:**
- I can type `!print` at any time to export the current session
- The CSV includes:
  - Turn number
  - User message (Meg's question/response)
  - ERA's response
  - Improvement notes (all notes for that turn, separated or categorized)
  - Timestamp
- The CSV is formatted so it can be directly pasted into Claude Web Code chat
- The export doesn't end the session (I can continue testing after `!print`)

**Example CSV Output:**
```csv
Turn,User Message,ERA Response,Improvement Notes,Category,Timestamp
1,"My employee didn't show up for 3 days","Got it — that's definitely something we need to address right away...","Should mention email option earlier","content","2025-10-24 10:30:00"
1,"My employee didn't show up for 3 days","Got it — that's definitely something we need to address right away...","Too formal, should be more conversational","tone","2025-10-24 10:30:15"
2,"I called once today","Thanks for the context. Since you've already made one attempt...","Good response, no changes needed","","2025-10-24 10:31:00"
```

### Story 4: Session Management
**As Meg**, I want to explicitly control when sessions start and end, so that I can organize my testing sessions logically.

**Acceptance Criteria:**
- `!reset` or `!restart` starts a new session
- The new session gets a unique session ID
- Old session data is preserved in the database
- ERA confirms the session reset: "🔄 New testing session started (Session ID: abc123)"

---

## Commands Reference

### `!improve <feedback>`
**Purpose:** Attach improvement feedback to the last ERA response

**Syntax:**
```
!improve <your feedback>
!improve <category>: <your feedback>
```

**Categories (optional):**
- `tone` - Feedback about the response tone/personality
- `content` - Feedback about the information provided
- `citation` - Feedback about policy citations
- `clarity` - Feedback about how clear/understandable the response is
- `structure` - Feedback about response formatting/organization
- `action` - Feedback about recommended actions/next steps

**Examples:**
```
!improve Should ask clarifying questions first
!improve tone: Too robotic, needs more empathy
!improve citation: Missing policy reference for 3-day no-show rule
!improve Should offer calendar booking after clarification, not immediately
```

**Behavior:**
- Stores feedback in database linked to the last ERA response
- Doesn't send a visible response to Meg (silent acknowledgment or emoji reaction)
- Multiple `!improve` commands accumulate on the same response
- If there's no recent ERA response, shows error: "⚠️ No recent ERA response to attach feedback to. Ask ERA a question first."

### `!print`
**Purpose:** Export current session as CSV for prompt tuning

**Syntax:**
```
!print
```

**Behavior:**
- Exports all conversation turns in the current session
- Includes all improvement notes attached to each turn
- Formats as CSV that Meg can copy/paste into Claude Web Code
- Shows the CSV in Teams chat (formatted as code block for easy copying)
- Provides session metadata: Session ID, start time, total turns, total improvements

**Example Output:**
```
📊 **Session Export (Session ID: abc123)**
Started: 2025-10-24 10:00:00
Turns: 5
Improvements: 8

```csv
Turn,User Message,ERA Response,Improvement Notes,Category,Timestamp
1,"My employee didn't show up","Got it — that's something we need to address...","Should ask clarifying questions first","content","2025-10-24 10:01:00"
...
```

**Copy the CSV above and paste into Claude Web Code to tune the master prompt.**
```

### `!reset` / `!restart`
**Purpose:** Start a new testing session (already exists in ERA, will be extended)

**Syntax:**
```
!reset
!restart
```

**New Behavior:**
- Clears conversation history (existing functionality)
- **NEW:** Ends current prompt tuning session
- **NEW:** Starts new prompt tuning session with unique ID
- **NEW:** Shows session ID to Meg

**Example Response:**
```
🔄 **Session Reset Complete**

- Previous session (abc123) ended and saved
- New session (def456) started
- Conversation history cleared

Ready to test! Ask me an HR question.
```

---

## Database Schema

### Table: `prompt_tuning_sessions`

Stores metadata about Meg's testing sessions.

```sql
CREATE TABLE prompt_tuning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_start TIMESTAMP NOT NULL DEFAULT NOW(),
  session_end TIMESTAMP,
  master_prompt_version TEXT, -- Git commit hash of MASTER_PROMPT.md
  branch_name TEXT DEFAULT 'prompt-tuning',
  total_turns INTEGER DEFAULT 0,
  total_improvements INTEGER DEFAULT 0,
  tester_id TEXT, -- Meg's Teams user ID
  tester_email TEXT, -- Meg's email
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_tuning_sessions_start ON prompt_tuning_sessions(session_start DESC);
CREATE INDEX idx_tuning_sessions_tester ON prompt_tuning_sessions(tester_id);
```

### Table: `tuning_conversation_turns`

Stores each conversation turn (user message + ERA response).

```sql
CREATE TABLE tuning_conversation_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES prompt_tuning_sessions(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  user_message TEXT NOT NULL,
  era_response TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Search context (for debugging)
  search_results JSONB, -- Which policy chunks were used
  avg_similarity FLOAT, -- RAG similarity score

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  UNIQUE(session_id, turn_number)
);

CREATE INDEX idx_tuning_turns_session ON tuning_conversation_turns(session_id, turn_number);
```

### Table: `tuning_improvements`

Stores Meg's improvement feedback for each turn.

```sql
CREATE TABLE tuning_improvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id UUID NOT NULL REFERENCES tuning_conversation_turns(id) ON DELETE CASCADE,
  improvement_note TEXT NOT NULL,
  category TEXT, -- tone, content, citation, clarity, structure, action, or NULL
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_tuning_improvements_turn ON tuning_improvements(turn_id);
CREATE INDEX idx_tuning_improvements_category ON tuning_improvements(category);
```

---

## Data Flow

### Flow 1: Starting a Session
```
1. Render deploys prompt-tuning branch
   ↓
2. First Teams message to ERA after deployment
   ↓
3. ERA creates new session in prompt_tuning_sessions table
   ↓
4. Session ID generated (e.g., "abc123")
   ↓
5. Conversation begins
```

### Flow 2: Conversation Turn with Improvement
```
1. Meg: "My employee didn't show up for 3 days"
   ↓
2. ERA: [Generates response using MASTER_PROMPT.md]
   ↓
3. System: Creates row in tuning_conversation_turns
   - session_id: current session
   - turn_number: 1
   - user_message: "My employee didn't show up for 3 days"
   - era_response: [ERA's full response]
   - search_results: [RAG context used]
   ↓
4. Meg: "!improve Should ask clarifying questions first"
   ↓
5. System: Creates row in tuning_improvements
   - turn_id: [ID from step 3]
   - improvement_note: "Should ask clarifying questions first"
   - category: NULL
   ↓
6. Meg: "!improve tone: Too formal"
   ↓
7. System: Creates another row in tuning_improvements
   - turn_id: [ID from step 3]
   - improvement_note: "Too formal"
   - category: "tone"
```

### Flow 3: Exporting Session
```
1. Meg: "!print"
   ↓
2. System: Queries database
   - Get session from prompt_tuning_sessions
   - Get all turns from tuning_conversation_turns WHERE session_id = current
   - Get all improvements from tuning_improvements JOIN turns
   ↓
3. System: Formats CSV
   - One row per improvement (if multiple improvements on same turn, duplicate the turn)
   - Include all columns: Turn, User Message, ERA Response, Improvement Notes, Category, Timestamp
   ↓
4. ERA: Posts CSV in Teams chat (formatted as code block)
   ↓
5. Meg: Copies CSV and pastes into Claude Web Code
```

---

## Integration Points

### With Existing ERA Bot (src/bot/app.ts)

**New command handlers needed:**
- `handleImproveCommand(context, conversationId, feedback, category?)`
- `handlePrintCommand(context, conversationId, sessionId)`
- Extend `handleReset()` to create new tuning session

**Session tracking:**
- Track current tuning session ID per conversation
- Auto-create session on first message after deployment
- Link conversation turns to session

### With Database (src/lib/supabase.ts)

**New database types:**
```typescript
export interface PromptTuningSession {
  id: string;
  session_start: string;
  session_end?: string;
  master_prompt_version?: string;
  branch_name: string;
  total_turns: number;
  total_improvements: number;
  tester_id?: string;
  tester_email?: string;
  metadata: Record<string, any>;
}

export interface TuningConversationTurn {
  id: string;
  session_id: string;
  turn_number: number;
  user_message: string;
  era_response: string;
  timestamp: string;
  search_results?: any;
  avg_similarity?: number;
  metadata: Record<string, any>;
}

export interface TuningImprovement {
  id: string;
  turn_id: string;
  improvement_note: string;
  category?: string;
  timestamp: string;
  metadata: Record<string, any>;
}
```

---

## CSV Format Specification

### Basic Structure
- **Encoding:** UTF-8
- **Line Separator:** `\n`
- **Column Separator:** `,`
- **Text Qualifier:** `"` (double quotes for fields containing commas or newlines)
- **Header Row:** Yes, always included

### Columns (in order)
1. **Turn** (INTEGER) - The conversation turn number (1, 2, 3, ...)
2. **User Message** (TEXT) - What Meg said to ERA
3. **ERA Response** (TEXT) - ERA's full response
4. **Improvement Notes** (TEXT) - Meg's feedback for this turn (or empty string)
5. **Category** (TEXT) - The category of the improvement (or empty string)
6. **Timestamp** (TIMESTAMP) - When the turn happened (ISO 8601 format)

### Row Handling for Multiple Improvements
If a single turn has multiple improvements, the turn is **duplicated** with one row per improvement:

```csv
Turn,User Message,ERA Response,Improvement Notes,Category,Timestamp
1,"My employee is late","Here's what to do...","Should mention policy citation","content","2025-10-24 10:00:00"
1,"My employee is late","Here's what to do...","Tone is too formal","tone","2025-10-24 10:00:15"
2,"I called them","Good, next step...","Perfect response","","2025-10-24 10:01:00"
```

### Special Character Handling
- **Newlines in responses:** Preserved as `\n` within quoted fields
- **Quotes in text:** Escaped as `""` (double quotes)
- **Commas in text:** Wrapped in quotes

**Example:**
```csv
Turn,User Message,ERA Response,Improvement Notes,Category,Timestamp
1,"My employee said ""I quit""","Got it — here's the next step:
1. Document the resignation
2. Process termination","Should ask if it's in writing","content","2025-10-24 10:00:00"
```

---

## Error Handling

### Edge Cases

**Case 1: `!improve` with no recent ERA response**
```
Meg: !improve This is feedback
ERA: ⚠️ No recent ERA response to attach feedback to. Ask me a question first, then use !improve.
```

**Case 2: `!print` with empty session**
```
Meg: !print
ERA: ⚠️ No conversation turns in this session yet. Ask me some questions first, then use !print to export.
```

**Case 3: Multiple `!improve` commands in a row**
```
Meg: !improve First feedback
Meg: !improve Second feedback
Meg: !improve Third feedback

All three are attached to the same ERA response (the last one before these commands)
```

**Case 4: Database write failure**
```
If saving to database fails:
- Log the error server-side
- Show user-friendly message: "⚠️ Failed to save feedback. Please try again or contact support."
- Don't crash the bot
```

---

## Success Metrics

**For Meg's workflow to be successful:**
- ✅ Meg can complete a full testing session (10+ turns) without interruption
- ✅ CSV export contains all turns and improvements accurately
- ✅ CSV can be pasted into Claude Web Code without formatting issues
- ✅ Session management is intuitive (Meg doesn't get confused about which session she's in)
- ✅ Improvement feedback is consistently captured (no data loss)
- ✅ The workflow takes ≤2 minutes from `!print` to pasting into Claude Web Code

---

## Open Questions

1. **Session visibility:** Should Meg see the session ID after every message, or only on `!reset`?
2. **Improvement confirmation:** Should ERA send a visible confirmation after `!improve`, or just a silent emoji reaction (👍)?
3. **CSV size limits:** What if a session has 100+ turns? Should we paginate or warn about size?
4. **Git commit hash:** How do we automatically capture the current MASTER_PROMPT.md version (git commit hash)?
5. **Multi-tester support:** Will anyone besides Meg use this workflow? (Affects whether we need user identification)

---

## Future Enhancements (Post-MVP)

- **`!export-json`** - Export as JSON for programmatic analysis
- **`!session-summary`** - Show stats for current session (turns, improvements, duration)
- **`!list-sessions`** - List Meg's recent sessions
- **`!resume <session-id>`** - Resume a previous session for more testing
- **Automated prompt tuning** - Instead of manual LLM tuning, auto-suggest prompt changes based on improvement patterns
- **Metrics integration** - Automatically score each response and include metrics in CSV export
