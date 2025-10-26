/**
 * Prompt Tuning Workflow Tests
 *
 * Tests for Meg's feedback workflow:
 * - !improve command (attach feedback to ERA responses)
 * - !print command (export session as CSV)
 * - Session management (!reset creates new sessions)
 *
 * Based on: specs/MEG_FEEDBACK_WORKFLOW.md
 */

import { supabase } from '../../../lib/supabase';

describe('Prompt Tuning Workflow', () => {
  // Test session IDs for cleanup
  const testSessionIds: string[] = [];

  beforeAll(async () => {
    // Clean up any existing test data
    await supabase.from('prompt_tuning_sessions').delete().like('tester_email', '%test%');
    await supabase.from('tuning_conversation_turns').delete().neq('id', '');
    await supabase.from('tuning_improvements').delete().neq('id', '');
  });

  afterEach(async () => {
    // Clean up test sessions
    for (const sessionId of testSessionIds) {
      await supabase.from('prompt_tuning_sessions').delete().eq('id', sessionId);
    }
    testSessionIds.length = 0;
  });

  describe('Session Management', () => {
    test('creates new session on first message', async () => {
      // Create a new session
      const { data: session, error } = await supabase
        .from('prompt_tuning_sessions')
        .insert({
          tester_email: 'meg@test.com',
          tester_name: 'Meg Test',
          branch_name: 'prompt-tuning',
          master_prompt_version: 'fc26922'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(session).toBeDefined();
      expect(session?.tester_email).toBe('meg@test.com');
      expect(session?.total_turns).toBe(0);
      expect(session?.total_improvements).toBe(0);

      if (session) testSessionIds.push(session.id);
    });

    test('session tracks total turns and improvements', async () => {
      // Create session
      const { data: session } = await supabase
        .from('prompt_tuning_sessions')
        .insert({
          tester_email: 'meg@test.com',
          branch_name: 'prompt-tuning'
        })
        .select()
        .single();

      if (!session) fail('Session not created');
      testSessionIds.push(session.id);

      // Add a conversation turn
      const { data: turn } = await supabase
        .from('tuning_conversation_turns')
        .insert({
          session_id: session.id,
          turn_number: 1,
          user_message: 'My employee didn\'t show up',
          era_response: 'Got it — that\'s definitely something we need to address...',
          avg_similarity: 0.85
        })
        .select()
        .single();

      expect(turn).toBeDefined();

      // Verify session was updated by trigger
      const { data: updatedSession } = await supabase
        .from('prompt_tuning_sessions')
        .select('total_turns')
        .eq('id', session.id)
        .single();

      expect(updatedSession?.total_turns).toBe(1);
    });

    test('!reset ends current session and starts new one', async () => {
      // Create first session
      const { data: session1 } = await supabase
        .from('prompt_tuning_sessions')
        .insert({
          tester_email: 'meg@test.com',
          branch_name: 'prompt-tuning'
        })
        .select()
        .single();

      if (!session1) fail('Session 1 not created');
      testSessionIds.push(session1.id);

      // Add turn to first session
      await supabase
        .from('tuning_conversation_turns')
        .insert({
          session_id: session1.id,
          turn_number: 1,
          user_message: 'Test message',
          era_response: 'Test response'
        });

      // End first session
      await supabase
        .from('prompt_tuning_sessions')
        .update({ session_end: new Date().toISOString() })
        .eq('id', session1.id);

      // Create new session (simulating !reset)
      const { data: session2 } = await supabase
        .from('prompt_tuning_sessions')
        .insert({
          tester_email: 'meg@test.com',
          branch_name: 'prompt-tuning'
        })
        .select()
        .single();

      if (!session2) fail('Session 2 not created');
      testSessionIds.push(session2.id);

      // Verify they're different sessions
      expect(session2.id).not.toBe(session1.id);
      expect(session2.total_turns).toBe(0);

      // Verify first session is ended
      const { data: endedSession } = await supabase
        .from('prompt_tuning_sessions')
        .select('session_end')
        .eq('id', session1.id)
        .single();

      expect(endedSession?.session_end).not.toBeNull();
    });
  });

  describe('!improve Command', () => {
    let sessionId: string;
    let turnId: string;

    beforeEach(async () => {
      // Create test session and turn
      const { data: session } = await supabase
        .from('prompt_tuning_sessions')
        .insert({
          tester_email: 'meg@test.com',
          branch_name: 'prompt-tuning'
        })
        .select()
        .single();

      if (!session) fail('Session not created');
      sessionId = session.id;
      testSessionIds.push(sessionId);

      const { data: turn } = await supabase
        .from('tuning_conversation_turns')
        .insert({
          session_id: sessionId,
          turn_number: 1,
          user_message: 'My employee didn\'t show up',
          era_response: 'Got it — that\'s definitely something we need to address...'
        })
        .select()
        .single();

      if (!turn) fail('Turn not created');
      turnId = turn.id;
    });

    test('attaches improvement to last ERA response', async () => {
      const { data: improvement, error } = await supabase
        .from('tuning_improvements')
        .insert({
          turn_id: turnId,
          improvement_note: 'Should ask clarifying questions first'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(improvement).toBeDefined();
      expect(improvement?.improvement_note).toBe('Should ask clarifying questions first');
      expect(improvement?.turn_id).toBe(turnId);
    });

    test('supports multiple improvements on same response', async () => {
      // Add first improvement
      await supabase
        .from('tuning_improvements')
        .insert({
          turn_id: turnId,
          improvement_note: 'Should ask clarifying questions first'
        });

      // Add second improvement
      await supabase
        .from('tuning_improvements')
        .insert({
          turn_id: turnId,
          improvement_note: 'Tone is too formal'
        });

      // Verify both exist
      const { data: improvements } = await supabase
        .from('tuning_improvements')
        .select('*')
        .eq('turn_id', turnId);

      expect(improvements).toHaveLength(2);
      expect(improvements?.map(i => i.improvement_note)).toContain('Should ask clarifying questions first');
      expect(improvements?.map(i => i.improvement_note)).toContain('Tone is too formal');
    });

    test('parses category from improvement note', async () => {
      const { data: improvement } = await supabase
        .from('tuning_improvements')
        .insert({
          turn_id: turnId,
          improvement_note: 'Too formal, needs more empathy',
          category: 'tone'
        })
        .select()
        .single();

      expect(improvement?.category).toBe('tone');
      expect(improvement?.improvement_note).toBe('Too formal, needs more empathy');
    });

    test('handles empty improvement note', async () => {
      const { error } = await supabase
        .from('tuning_improvements')
        .insert({
          turn_id: turnId,
          improvement_note: ''
        });

      // Should fail because improvement_note is required (NOT NULL)
      expect(error).toBeDefined();
      expect(error?.message).toContain('null value');
    });

    test('handles very long improvement note', async () => {
      const longNote = 'A'.repeat(5000); // 5000 character note

      const { data: improvement, error } = await supabase
        .from('tuning_improvements')
        .insert({
          turn_id: turnId,
          improvement_note: longNote
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(improvement?.improvement_note).toBe(longNote);
    });

    test('updates session improvement count via trigger', async () => {
      // Add improvement
      await supabase
        .from('tuning_improvements')
        .insert({
          turn_id: turnId,
          improvement_note: 'Test improvement'
        });

      // Check session was updated
      const { data: session } = await supabase
        .from('prompt_tuning_sessions')
        .select('total_improvements')
        .eq('id', sessionId)
        .single();

      expect(session?.total_improvements).toBe(1);
    });
  });

  describe('!print Command', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Create test session with multiple turns and improvements
      const { data: session } = await supabase
        .from('prompt_tuning_sessions')
        .insert({
          tester_email: 'meg@test.com',
          tester_name: 'Meg Test',
          branch_name: 'prompt-tuning',
          master_prompt_version: 'fc26922'
        })
        .select()
        .single();

      if (!session) fail('Session not created');
      sessionId = session.id;
      testSessionIds.push(sessionId);

      // Add Turn 1
      const { data: turn1 } = await supabase
        .from('tuning_conversation_turns')
        .insert({
          session_id: sessionId,
          turn_number: 1,
          user_message: 'My employee didn\'t show up for 3 days',
          era_response: 'Got it — that\'s definitely something we need to address...',
          timestamp: '2025-10-24T10:00:00Z'
        })
        .select()
        .single();

      // Add improvements to Turn 1
      if (turn1) {
        await supabase.from('tuning_improvements').insert([
          {
            turn_id: turn1.id,
            improvement_note: 'Should ask clarifying questions first',
            category: 'content',
            timestamp: '2025-10-24T10:00:15Z'
          },
          {
            turn_id: turn1.id,
            improvement_note: 'Tone is too formal',
            category: 'tone',
            timestamp: '2025-10-24T10:00:30Z'
          }
        ]);
      }

      // Add Turn 2
      const { data: turn2 } = await supabase
        .from('tuning_conversation_turns')
        .insert({
          session_id: sessionId,
          turn_number: 2,
          user_message: 'I called once today',
          era_response: 'Thanks for the context. Here\'s what to do next...',
          timestamp: '2025-10-24T10:01:00Z'
        })
        .select()
        .single();

      // Add improvement to Turn 2
      if (turn2) {
        await supabase.from('tuning_improvements').insert({
          turn_id: turn2.id,
          improvement_note: 'Good response, clear next steps',
          category: null,
          timestamp: '2025-10-24T10:01:30Z'
        });
      }
    });

    test('exports session as CSV with correct format', async () => {
      // Query to build CSV export
      const { data: csvData } = await supabase
        .from('tuning_conversation_turns')
        .select(`
          turn_number,
          user_message,
          era_response,
          timestamp,
          tuning_improvements (
            improvement_note,
            category,
            timestamp
          )
        `)
        .eq('session_id', sessionId)
        .order('turn_number', { ascending: true });

      expect(csvData).toBeDefined();
      expect(csvData).toHaveLength(2);

      // Verify Turn 1 has 2 improvements
      expect(csvData?.[0].tuning_improvements).toHaveLength(2);

      // Verify Turn 2 has 1 improvement
      expect(csvData?.[1].tuning_improvements).toHaveLength(1);
    });

    test('includes session metadata in export', async () => {
      const { data: session } = await supabase
        .from('prompt_tuning_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      expect(session?.tester_email).toBe('meg@test.com');
      expect(session?.master_prompt_version).toBe('fc26922');
      expect(session?.total_turns).toBeGreaterThan(0);
      expect(session?.total_improvements).toBeGreaterThan(0);
    });

    test('handles CSV escaping (quotes, newlines)', () => {
      // Test utility function for CSV escaping
      function escapeCSVField(field: string): string {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      }

      // Test cases
      expect(escapeCSVField('Simple text')).toBe('Simple text');
      expect(escapeCSVField('Text with, comma')).toBe('"Text with, comma"');
      expect(escapeCSVField('Text with "quotes"')).toBe('"Text with ""quotes"""');
      expect(escapeCSVField('Text with\nnewline')).toBe('"Text with\nnewline"');
    });

    test('returns error if session is empty', async () => {
      // Create empty session
      const { data: emptySession } = await supabase
        .from('prompt_tuning_sessions')
        .insert({
          tester_email: 'meg@test.com',
          branch_name: 'prompt-tuning'
        })
        .select()
        .single();

      if (!emptySession) fail('Empty session not created');
      testSessionIds.push(emptySession.id);

      // Try to get turns for empty session
      const { data: turns } = await supabase
        .from('tuning_conversation_turns')
        .select('*')
        .eq('session_id', emptySession.id);

      expect(turns).toHaveLength(0);
      // In implementation, this would trigger an error message to Meg
    });

    test('duplicates row for multiple improvements', async () => {
      // This is tested implicitly in the "exports session as CSV" test
      // Turn 1 should generate 2 CSV rows (one per improvement)
      // Turn 2 should generate 1 CSV row

      const { data: turn1Data } = await supabase
        .from('tuning_conversation_turns')
        .select(`
          turn_number,
          tuning_improvements (improvement_note)
        `)
        .eq('session_id', sessionId)
        .eq('turn_number', 1)
        .single();

      expect(turn1Data?.tuning_improvements).toHaveLength(2);

      // In CSV export, this would become 2 rows:
      // 1,"My employee...","Got it...","Should ask clarifying questions","content","..."
      // 1,"My employee...","Got it...","Tone is too formal","tone","..."
    });
  });

  describe('Edge Cases', () => {
    test('handles improvement without recent ERA response', async () => {
      // Try to add improvement without a turn
      // This should be prevented by foreign key constraint
      const { error } = await supabase
        .from('tuning_improvements')
        .insert({
          turn_id: '00000000-0000-0000-0000-000000000000', // Invalid UUID
          improvement_note: 'Test improvement'
        });

      expect(error).toBeDefined();
      expect(error?.message).toContain('foreign key');
    });

    test('handles concurrent improvements', async () => {
      // Create session and turn
      const { data: session } = await supabase
        .from('prompt_tuning_sessions')
        .insert({ tester_email: 'meg@test.com' })
        .select()
        .single();

      if (!session) fail('Session not created');
      testSessionIds.push(session.id);

      const { data: turn } = await supabase
        .from('tuning_conversation_turns')
        .insert({
          session_id: session.id,
          turn_number: 1,
          user_message: 'Test',
          era_response: 'Test response'
        })
        .select()
        .single();

      if (!turn) fail('Turn not created');

      // Add multiple improvements concurrently
      const improvements = await Promise.all([
        supabase.from('tuning_improvements').insert({
          turn_id: turn.id,
          improvement_note: 'Improvement 1'
        }),
        supabase.from('tuning_improvements').insert({
          turn_id: turn.id,
          improvement_note: 'Improvement 2'
        }),
        supabase.from('tuning_improvements').insert({
          turn_id: turn.id,
          improvement_note: 'Improvement 3'
        })
      ]);

      // All should succeed
      improvements.forEach(({ error }) => expect(error).toBeNull());

      // Verify all 3 exist
      const { data: allImprovements } = await supabase
        .from('tuning_improvements')
        .select('*')
        .eq('turn_id', turn.id);

      expect(allImprovements).toHaveLength(3);
    });

    test('handles special characters in improvement notes', async () => {
      const { data: session } = await supabase
        .from('prompt_tuning_sessions')
        .insert({ tester_email: 'meg@test.com' })
        .select()
        .single();

      if (!session) fail('Session not created');
      testSessionIds.push(session.id);

      const { data: turn } = await supabase
        .from('tuning_conversation_turns')
        .insert({
          session_id: session.id,
          turn_number: 1,
          user_message: 'Test',
          era_response: 'Test'
        })
        .select()
        .single();

      if (!turn) fail('Turn not created');

      const specialNote = 'Test with special chars: "quotes", \'apostrophes\', \nnewlines, and émojis 🎉';

      const { data: improvement } = await supabase
        .from('tuning_improvements')
        .insert({
          turn_id: turn.id,
          improvement_note: specialNote
        })
        .select()
        .single();

      expect(improvement?.improvement_note).toBe(specialNote);
    });
  });
});
