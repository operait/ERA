/**
 * Prompt Tuning Workflow Handlers
 *
 * Handles Meg's feedback workflow for testing ERA and tuning prompts.
 * Based on: specs/MEG_FEEDBACK_WORKFLOW.md
 */

import { TurnContext } from 'botbuilder';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/supabase';

type PromptTuningSession = Database['public']['Tables']['prompt_tuning_sessions']['Row'];
type TuningConversationTurn = Database['public']['Tables']['tuning_conversation_turns']['Row'];
type TuningImprovement = Database['public']['Tables']['tuning_improvements']['Row'];

/**
 * Session storage - maps Teams conversation ID to current session ID
 */
const activeSessions = new Map<string, string>();

/**
 * Last turn ID storage - maps Teams conversation ID to last turn ID
 */
const lastTurnIds = new Map<string, string>();

/**
 * Create a new prompt tuning session
 */
export async function createSession(
  context: TurnContext
): Promise<PromptTuningSession | null> {
  const conversationId = context.activity.conversation.id;
  const userId = context.activity.from.id;
  const userEmail = context.activity.from.aadObjectId
    ? `${context.activity.from.name}@fitnessconnection.com`
    : undefined;

  // Get current git commit hash (if available)
  const masterPromptVersion = process.env.GIT_COMMIT_SHA || 'unknown';

  const { data: session, error } = await supabase
    .from('prompt_tuning_sessions')
    .insert({
      tester_id: userId,
      tester_email: userEmail,
      master_prompt_version: masterPromptVersion,
      branch_name: process.env.BRANCH_NAME || 'prompt-tuning',
      metadata: {
        conversationId,
        userName: context.activity.from.name
      }
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating prompt tuning session:', error);
    return null;
  }

  // Store session ID in memory
  activeSessions.set(conversationId, session.id);

  return session;
}

/**
 * Get or create active session for a conversation
 */
export async function getOrCreateSession(
  context: TurnContext
): Promise<PromptTuningSession | null> {
  const conversationId = context.activity.conversation.id;
  const sessionId = activeSessions.get(conversationId);

  // If we have a session ID, verify it still exists
  if (sessionId) {
    const { data: session, error } = await supabase
      .from('prompt_tuning_sessions')
      .select()
      .eq('id', sessionId)
      .eq('session_end', null)
      .single();

    if (!error && session) {
      return session;
    }
  }

  // No active session, create a new one
  return createSession(context);
}

/**
 * End current session
 */
export async function endSession(
  context: TurnContext
): Promise<PromptTuningSession | null> {
  const conversationId = context.activity.conversation.id;
  const sessionId = activeSessions.get(conversationId);

  if (!sessionId) {
    return null;
  }

  const { data: session, error } = await supabase
    .from('prompt_tuning_sessions')
    .update({ session_end: new Date().toISOString() })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    console.error('Error ending session:', error);
    return null;
  }

  // Remove from active sessions
  activeSessions.delete(conversationId);

  return session;
}

/**
 * Store a conversation turn
 */
export async function storeTurn(
  context: TurnContext,
  userMessage: string,
  eraResponse: string,
  metadata?: Record<string, any>
): Promise<TuningConversationTurn | null> {
  const conversationId = context.activity.conversation.id;
  const session = await getOrCreateSession(context);

  if (!session) {
    console.error('No active session to store turn');
    return null;
  }

  // Get current turn count for this session
  const { count, error: countError } = await supabase
    .from('tuning_conversation_turns')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session.id);

  if (countError) {
    console.error('Error counting turns:', countError);
    return null;
  }

  const turnNumber = (count || 0) + 1;

  const { data: turn, error } = await supabase
    .from('tuning_conversation_turns')
    .insert({
      session_id: session.id,
      turn_number: turnNumber,
      user_message: userMessage,
      era_response: eraResponse,
      metadata: metadata || {}
    })
    .select()
    .single();

  if (error) {
    console.error('Error storing turn:', error);
    return null;
  }

  // Store last turn ID for !improve command
  lastTurnIds.set(conversationId, turn.id);

  return turn;
}

/**
 * Handle !improve command
 */
export async function handleImproveCommand(
  context: TurnContext,
  feedbackText: string
): Promise<void> {
  const conversationId = context.activity.conversation.id;
  const lastTurnId = lastTurnIds.get(conversationId);

  if (!lastTurnId) {
    await context.sendActivity(
      '⚠️ No recent ERA response to attach feedback to. Ask ERA a question first.'
    );
    return;
  }

  // Parse category if provided (format: "category: feedback" or just "feedback")
  let category: string | undefined;
  let improvementNote = feedbackText.trim();

  const categoryMatch = feedbackText.match(/^(tone|content|citation|clarity|structure|action):\s*(.+)$/i);
  if (categoryMatch) {
    category = categoryMatch[1].toLowerCase();
    improvementNote = categoryMatch[2].trim();
  }

  // Store improvement
  const { data: improvement, error } = await supabase
    .from('tuning_improvements')
    .insert({
      turn_id: lastTurnId,
      improvement_note: improvementNote,
      category
    })
    .select()
    .single();

  if (error) {
    console.error('Error storing improvement:', error);
    await context.sendActivity('❌ Error saving feedback. Please try again.');
    return;
  }

  // Silent acknowledgment with emoji reaction
  await context.sendActivity('✅');
}

/**
 * Handle !print command
 */
export async function handlePrintCommand(context: TurnContext): Promise<void> {
  const conversationId = context.activity.conversation.id;
  const sessionId = activeSessions.get(conversationId);

  if (!sessionId) {
    await context.sendActivity('⚠️ No active testing session. Start a conversation first.');
    return;
  }

  // Fetch session
  const { data: session, error: sessionError } = await supabase
    .from('prompt_tuning_sessions')
    .select()
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    await context.sendActivity('❌ Error fetching session data.');
    return;
  }

  // Fetch turns with improvements
  const { data: turns, error: turnsError } = await supabase
    .from('tuning_conversation_turns')
    .select('*, tuning_improvements(*)')
    .eq('session_id', sessionId)
    .order('turn_number', { ascending: true });

  if (turnsError) {
    await context.sendActivity('❌ Error fetching conversation turns.');
    return;
  }

  if (!turns || turns.length === 0) {
    await context.sendActivity('⚠️ No conversation turns in this session yet.');
    return;
  }

  // Generate CSV
  const csv = generateCSV(turns, session);

  // Format message
  const sessionStartFormatted = new Date(session.session_start).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const message = `📊 **Session Export (Session ID: ${session.id.substring(0, 8)}...)**
Started: ${sessionStartFormatted}
Turns: ${session.total_turns}
Improvements: ${session.total_improvements}

\`\`\`csv
${csv}
\`\`\`

**Copy the CSV above and paste into Claude Web Code to tune the master prompt.**`;

  await context.sendActivity(message);
}

/**
 * Generate CSV from turns and improvements
 */
function generateCSV(
  turns: Array<
    TuningConversationTurn & {
      tuning_improvements?: TuningImprovement[];
    }
  >,
  session: PromptTuningSession
): string {
  const rows: string[] = [];

  // Header
  rows.push('Turn,User Message,ERA Response,Improvement Notes,Category,Timestamp');

  // Data rows
  for (const turn of turns) {
    const improvements = turn.tuning_improvements || [];

    if (improvements.length === 0) {
      // No improvements for this turn
      rows.push(
        csvRow(
          turn.turn_number,
          turn.user_message,
          turn.era_response,
          '',
          '',
          turn.timestamp
        )
      );
    } else {
      // One row per improvement
      for (const improvement of improvements) {
        rows.push(
          csvRow(
            turn.turn_number,
            turn.user_message,
            turn.era_response,
            improvement.improvement_note,
            improvement.category || '',
            improvement.timestamp
          )
        );
      }
    }
  }

  return rows.join('\n');
}

/**
 * Generate a CSV row with proper escaping
 */
function csvRow(
  turnNumber: number,
  userMessage: string,
  eraResponse: string,
  improvementNote: string,
  category: string,
  timestamp: string
): string {
  const escape = (str: string) => {
    // Always wrap in quotes for consistency and safety
    // Replace internal quotes with double quotes (CSV escaping)
    // Normalize newlines to spaces for better CSV compatibility
    const normalized = str
      .replace(/\n/g, ' ')  // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .replace(/"/g, '""')  // Escape quotes
      .trim();
    return `"${normalized}"`;
  };

  // Format timestamp without commas: YYYY-MM-DD HH:MM:SS
  const timestampFormatted = new Date(timestamp)
    .toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    .replace(/(\d+)\/(\d+)\/(\d+),?\s+(\d+:\d+:\d+)/, '$3-$1-$2 $4');

  return [
    turnNumber,
    escape(userMessage),
    escape(eraResponse),
    escape(improvementNote),
    escape(category),
    `"${timestampFormatted}"`
  ].join(',');
}

/**
 * Handle !reset command (extended for prompt tuning)
 */
export async function handleResetCommand(context: TurnContext): Promise<void> {
  const conversationId = context.activity.conversation.id;
  const oldSessionId = activeSessions.get(conversationId);

  // End old session
  const oldSession = await endSession(context);

  // Create new session
  const newSession = await createSession(context);

  if (!newSession) {
    await context.sendActivity('❌ Error creating new session.');
    return;
  }

  // Clear last turn ID
  lastTurnIds.delete(conversationId);

  // Format message
  const message = oldSession
    ? `🔄 **Session Reset Complete**

- Previous session (${oldSession.id.substring(0, 8)}...) ended and saved
- New session (${newSession.id.substring(0, 8)}...) started
- Conversation history cleared

Ready to test! Ask me an HR question.`
    : `🔄 **New Testing Session Started**

Session ID: ${newSession.id.substring(0, 8)}...

Ready to test! Ask me an HR question.`;

  await context.sendActivity(message);
}

/**
 * Handle /optimize command
 */
export async function handleOptimizeCommand(
  context: TurnContext,
  autoMerge: boolean = false
): Promise<void> {
  const conversationId = context.activity.conversation.id;
  const sessionId = activeSessions.get(conversationId);

  // Validate active session
  if (!sessionId) {
    await context.sendActivity('⚠️ No active testing session. Start a conversation first.');
    return;
  }

  await context.sendActivity('⏳ Optimizing MASTER_PROMPT.md...');

  try {
    // Fetch session data
    const { data: session, error: sessionError } = await supabase
      .from('prompt_tuning_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      await context.sendActivity('❌ Error fetching session data. Please contact Barry.');
      return;
    }

    // Check for improvements
    if (session.total_improvements === 0) {
      await context.sendActivity('⚠️ No improvements in this session. Use `!improve` to add feedback before optimizing.');
      return;
    }

    // Fetch turns with improvements
    const { data: turns, error: turnsError } = await supabase
      .from('tuning_conversation_turns')
      .select('*, tuning_improvements(*)')
      .eq('session_id', sessionId)
      .order('turn_number', { ascending: true });

    if (turnsError || !turns) {
      await context.sendActivity('❌ Error fetching conversation data. Please contact Barry.');
      return;
    }

    // Generate CSV
    const csv = generateCSV(turns, session);

    // Import optimizer and GitHub services
    const { PromptOptimizer } = await import('../../services/prompt-optimizer');
    const { GitHubService } = await import('../../services/github');

    const optimizer = new PromptOptimizer();
    const github = new GitHubService();

    // Optimize prompt using GPT-4
    const optimization = await optimizer.optimize(csv);

    // Count improvements by category
    const categoryCounts = optimizer.countImprovementsByCategory(csv);
    const categoryBreakdown = Object.entries(categoryCounts)
      .map(([cat, count]) => `- ${cat || 'general'}: ${count} improvement${count > 1 ? 's' : ''}`)
      .join('\n');

    // Build PR description
    const prTitle = 'Optimize MASTER_PROMPT.md based on testing session';
    const prBody = `## 📊 Session Summary
- **Session ID**: ${session.id.substring(0, 8)}...
- **Started**: ${new Date(session.session_start).toLocaleString('en-US', { timeZone: 'America/Chicago' })}
- **Turns**: ${session.total_turns}
- **Improvements**: ${session.total_improvements}

## ✨ Key Changes
${optimization.summary}

## 📈 Improvement Breakdown
${categoryBreakdown || '- No categorized improvements'}

## 📋 Full Session Data
<details>
<summary>Click to expand CSV</summary>

\`\`\`csv
${csv}
\`\`\`
</details>

---
🤖 Optimized automatically by ERA \`/optimize\` command using GPT-4`;

    // Create PR via GitHub API
    const pr = await github.createOptimizationPR(
      optimization.updatedPrompt,
      prTitle,
      prBody,
      autoMerge
    );

    // Send success message
    const autoMergeStatus = autoMerge ? ' (auto-merged)' : '';
    const message = `✅ MASTER_PROMPT.md optimized${autoMergeStatus}!

📊 Session: ${session.total_turns} turns, ${session.total_improvements} improvements
🔀 Branch: ${pr.branch}
📝 PR: #${pr.number}

${autoMerge ? 'View changes:' : 'Review and merge:'}
${pr.url}`;

    await context.sendActivity(message);

  } catch (error: any) {
    console.error('Error in /optimize command:', error);
    await context.sendActivity(`❌ Optimization failed: ${error.message}\n\nPlease contact Barry for assistance.`);
  }
}
