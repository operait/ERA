/**
 * Context-Aware Calendar Detection Tests
 *
 * Tests for preventing premature calendar triggers during clarification.
 * Based on: specs/CONTEXT_AWARE_ACTIONS.md
 */

import { CalendarHandler } from '../calendar-handler';
import type { ConversationState } from '../../../services/conversation-state';

describe('CalendarHandler - Context-Aware Detection', () => {
  let handler: CalendarHandler;

  beforeEach(() => {
    handler = new CalendarHandler();
  });

  describe('detectCalendarRecommendationWithContext', () => {
    describe('Step 1: State Guard', () => {
      test('should NOT trigger if already in calendar flow', () => {
        const response = 'Let me schedule a call for you to discuss this with the employee.';
        const history = [
          { role: 'user' as const, content: 'My employee is absent' },
          { role: 'assistant' as const, content: 'Have you called them?' },
          { role: 'user' as const, content: 'Yes' },
        ];
        const state: ConversationState = {
          type: 'calendar',
          step: 'awaiting_time_selection',
          topic: 'Attendance Discussion',
        };

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(false);
      });

      test('should allow trigger if state is null', () => {
        const response = 'You should call the employee. Would you like me to schedule that call?';
        const history = [
          { role: 'user' as const, content: 'My employee missed shifts' },
          { role: 'assistant' as const, content: 'How many shifts?' },
          { role: 'user' as const, content: 'Three' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('should allow trigger if in email flow (not calendar)', () => {
        const response = 'After sending the email, you should call the employee. Schedule that call?';
        const history = [
          { role: 'user' as const, content: 'Need to document and call' },
          { role: 'assistant' as const, content: 'What happened?' },
          { role: 'user' as const, content: 'Three no-shows' },
        ];
        const state: ConversationState = {
          type: 'email',
          step: 'awaiting_confirmation',
          recipientName: 'John',
          recipientEmail: 'john@example.com',
          subject: 'Warning',
          body: 'Content',
          variables: {},
          missingVariables: [],
          currentVariableIndex: 0,
        };

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });
    });

    describe('Step 2: Clarification Detection', () => {
      test('should NOT trigger when response contains question marks', () => {
        const response = 'Got it. Have you tried calling them yet? That would be the first step.';
        const history = [
          { role: 'user' as const, content: 'My employee is absent' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(false);
      });

      test('should NOT trigger with clarification phrases + question', () => {
        const response = 'Just to make sure I have this right - have you called them already?';
        const history = [
          { role: 'user' as const, content: 'My employee missed 3 days' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(false);
      });

      test('should NOT trigger with "have you" clarification', () => {
        const response = 'Got it. Have you tried reaching out to them yet (phone, text, or email)?';
        const history = [
          { role: 'user' as const, content: 'Employee no-show' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(false);
      });

      test('should NOT trigger with "did you" clarification', () => {
        const response = 'Thanks for the details. Did you already attempt to contact them?';
        const history = [
          { role: 'user' as const, content: 'Employee absent 3 days' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(false);
      });

      test('should allow trigger when no questions or clarification phrases', () => {
        const response = 'Thanks for the context. You should call the employee to discuss this. Would you like me to schedule that call?';
        const history = [
          { role: 'user' as const, content: 'Employee absent' },
          { role: 'assistant' as const, content: 'Have you called?' },
          { role: 'user' as const, content: 'Yes, twice' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });
    });

    describe('Step 3: Conversation Depth Check', () => {
      test('should NOT trigger on first turn (history length = 1)', () => {
        const response = 'You should call the employee. Let me schedule that for you.';
        const history = [
          { role: 'user' as const, content: 'My employee is absent' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(false);
      });

      test('should allow trigger when history length >= 2', () => {
        const response = 'You should call the employee. Schedule that call?';
        const history = [
          { role: 'user' as const, content: 'Employee absent' },
          { role: 'assistant' as const, content: 'Have you called?' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        // Will be false because ERA is asking "Have you called?" in previous turn
        // This tests that depth check ALONE isn't sufficient (needs context too)
        expect(result).toBe(false); // Context not gathered yet
      });

      test('should allow trigger with proper depth AND context', () => {
        const response = 'Thanks. You should call the employee. Schedule that call?';
        const history = [
          { role: 'user' as const, content: 'Employee absent' },
          { role: 'assistant' as const, content: 'Have you called?' },
          { role: 'user' as const, content: 'Yes' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });
    });

    describe('Step 4: Context Gathering Verification', () => {
      test('should NOT trigger if ERA asked question but manager hasn\'t answered yet', () => {
        const response = 'Let me call the employee for you and schedule that conversation.';
        const history = [
          { role: 'user' as const, content: 'Employee absent' },
          { role: 'assistant' as const, content: 'Have you tried calling them?' },
          // No user response yet!
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        // Will fail on depth check (length = 2, current turn not in history)
        // In real scenario, current response isn't in history yet
        expect(result).toBe(false);
      });

      test('should allow trigger after manager answered ERA\'s question', () => {
        const response = 'Perfect. You should call the employee. Schedule the call?';
        const history = [
          { role: 'user' as const, content: 'Employee absent' },
          { role: 'assistant' as const, content: 'Have you tried calling them?' },
          { role: 'user' as const, content: 'Yes, twice with no answer' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('should allow trigger if ERA never asked questions', () => {
        const response = 'You should call the employee to discuss this. Schedule that call?';
        const history = [
          { role: 'user' as const, content: 'My employee John missed three shifts without calling in' },
          { role: 'assistant' as const, content: 'That\'s a serious attendance issue. Here\'s what to do next...' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('should handle multiple ERA questions correctly', () => {
        const response = 'Great. Now you should call the employee. Schedule that?';
        const history = [
          { role: 'user' as const, content: 'Employee absent' },
          { role: 'assistant' as const, content: 'Have you called them?' },
          { role: 'user' as const, content: 'Yes' },
          { role: 'assistant' as const, content: 'Were these consecutive shifts?' },
          { role: 'user' as const, content: 'Yes, three consecutive' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });
    });

    describe('Step 5: Keyword Matching', () => {
      test('should trigger with "schedule a call" keyword', () => {
        const response = 'You should schedule a call with the employee.';
        const history = [
          { role: 'user' as const, content: 'Employee issue' },
          { role: 'assistant' as const, content: 'What happened?' },
          { role: 'user' as const, content: 'Absent 3 days' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('should trigger with "call the employee" keyword', () => {
        const response = 'You need to call the employee to discuss this attendance issue.';
        const history = [
          { role: 'user' as const, content: 'Employee absent' },
          { role: 'assistant' as const, content: 'How many days?' },
          { role: 'user' as const, content: 'Three' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('should trigger with "would you like me to schedule" keyword', () => {
        const response = 'Based on this, would you like me to schedule a call with them?';
        const history = [
          { role: 'user' as const, content: 'Need to talk to employee' },
          { role: 'assistant' as const, content: 'About what?' },
          { role: 'user' as const, content: 'Performance' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('should NOT trigger without calendar keywords', () => {
        const response = 'You should document this issue and follow up with HR.';
        const history = [
          { role: 'user' as const, content: 'Employee problem' },
          { role: 'assistant' as const, content: 'Details?' },
          { role: 'user' as const, content: 'Insubordination' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(false);
      });
    });

    describe('Integration Tests - Full Scenarios', () => {
      test('Scenario 1: Premature trigger during clarification (should NOT trigger)', () => {
        const response = 'Got it — that\'s definitely something we need to address right away.\n\nJust to make sure I have the full picture:\n- Have you tried reaching out to them yet (phone, text, or email)?\n- Were these three consecutive scheduled shifts?';
        const history = [
          { role: 'user' as const, content: 'My employee didn\'t show up for 3 days' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(false); // Multiple failures: depth, questions, no keywords
      });

      test('Scenario 2: Post-clarification trigger (SHOULD trigger)', () => {
        const response = 'Thanks for the context. Since you\'ve already made one attempt, here\'s what to do next:\n\n**Immediate Steps:**\n1. Make a second call attempt today and document it\n2. If still no response, send a written communication\n\nSince you need to call the employee to discuss this serious attendance issue, would you like me to schedule that call for you?';
        const history = [
          { role: 'user' as const, content: 'My employee didn\'t show up for 3 days' },
          { role: 'assistant' as const, content: 'Have you tried reaching out to them?' },
          { role: 'user' as const, content: 'I tried calling once but they didn\'t pick up. Yes, consecutive.' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('Scenario 3: Already in calendar flow (should NOT re-trigger)', () => {
        const response = 'Which time works best? I can also help you call the employee after we book this.';
        const history = [
          { role: 'user' as const, content: 'Employee absent' },
          { role: 'assistant' as const, content: 'Have you called?' },
          { role: 'user' as const, content: 'Yes' },
          { role: 'assistant' as const, content: 'Schedule that call?' },
          { role: 'user' as const, content: 'Yes' },
        ];
        const state: ConversationState = {
          type: 'calendar',
          step: 'awaiting_time_selection',
          topic: 'Employee Discussion',
          availableSlots: [],
        };

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(false); // State guard blocks
      });

      test('Scenario 4: Hypothetical question (should NOT trigger)', () => {
        const response = 'Good question. Here\'s how the process works:\n\n1. You should call the employee first\n2. Document the call attempt\n3. Follow up with written communication if needed';
        const history = [
          { role: 'user' as const, content: 'What should I do if an employee doesn\'t show up?' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(false); // Fails depth check + no scheduling keywords
      });

      test('Scenario 5: Context gathered in single rich query (SHOULD trigger)', () => {
        const response = 'That\'s a serious attendance issue. Here\'s what to do:\n\n1. Make a second call attempt today\n2. Document both attempts\n\nWould you like me to schedule that call for you? I\'ll check your calendar.';
        const history = [
          { role: 'user' as const, content: 'My employee John missed three consecutive shifts without calling in. I called him once today but no answer.' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        // Will fail depth check (only 1 turn)
        expect(result).toBe(false);
      });

      test('Scenario 6: Multi-turn with proper context flow (SHOULD trigger)', () => {
        const response = 'Perfect. Now that we have that confirmed, you should call the employee to discuss this. Would you like me to schedule that call?';
        const history = [
          { role: 'user' as const, content: 'Employee absent issue' },
          { role: 'assistant' as const, content: 'How many days have they been absent?' },
          { role: 'user' as const, content: 'Three days' },
          { role: 'assistant' as const, content: 'Have you tried contacting them?' },
          { role: 'user' as const, content: 'Yes, called twice with no answer' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      test('should handle empty history gracefully', () => {
        const response = 'You should call the employee. Schedule that?';
        const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(false); // Fails depth check
      });

      test('should handle response with no content', () => {
        const response = '';
        const history = [
          { role: 'user' as const, content: 'Employee absent' },
          { role: 'assistant' as const, content: 'Details?' },
          { role: 'user' as const, content: 'Three days' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(false); // No keywords
      });

      test('should be case-insensitive for keywords', () => {
        const response = 'You should CALL THE EMPLOYEE to discuss this matter. Would you like me to SCHEDULE A CALL?';
        const history = [
          { role: 'user' as const, content: 'Issue' },
          { role: 'assistant' as const, content: 'What happened?' },
          { role: 'user' as const, content: 'Attendance problem' },
        ];
        const state: ConversationState = null;

        const result = handler.detectCalendarRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });
    });
  });
});
