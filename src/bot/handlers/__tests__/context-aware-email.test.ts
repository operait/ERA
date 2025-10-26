/**
 * Context-Aware Email Detection Tests
 *
 * Tests for preventing premature email triggers during clarification.
 * Based on: specs/CONTEXT_AWARE_ACTIONS.md
 */

import { EmailHandler } from '../email-handler';
import type { ConversationState } from '../../../services/conversation-state';

describe('EmailHandler - Context-Aware Detection', () => {
  let handler: EmailHandler;

  beforeEach(() => {
    handler = new EmailHandler();
  });

  describe('detectEmailRecommendationWithContext', () => {
    describe('Step 1: State Guard', () => {
      test('should NOT trigger if already in email flow', () => {
        const response = 'Let me draft an email for you to send to the employee.';
        const history = [
          { role: 'user' as const, content: 'Need to send warning' },
          { role: 'assistant' as const, content: 'What type of warning?' },
          { role: 'user' as const, content: 'Written warning for attendance' },
        ];
        const state: ConversationState = {
          type: 'email',
          step: 'awaiting_employee_name',
          subject: 'Warning',
          body: 'Content',
          variables: {},
          missingVariables: [],
          currentVariableIndex: 0,
        };

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(false);
      });

      test('should allow trigger if state is null', () => {
        const response = 'You should send an email documenting this issue.';
        const history = [
          { role: 'user' as const, content: 'Employee missed shifts' },
          { role: 'assistant' as const, content: 'How many?' },
          { role: 'user' as const, content: 'Three' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('should allow trigger if in calendar flow (not email)', () => {
        const response = 'Before the call, send an email documenting the issue.';
        const history = [
          { role: 'user' as const, content: 'Need to document and call' },
          { role: 'assistant' as const, content: 'What happened?' },
          { role: 'user' as const, content: 'Three no-shows' },
        ];
        const state: ConversationState = {
          type: 'calendar',
          step: 'awaiting_time_selection',
          topic: 'Employee Discussion',
        };

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });
    });

    describe('Step 2: Clarification Detection', () => {
      test('should NOT trigger when response contains question marks', () => {
        const response = 'I can help with that. What type of warning are you issuing - verbal or written?';
        const history = [
          { role: 'user' as const, content: 'Need to send warning email' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(false);
      });

      test('should NOT trigger with clarification phrases', () => {
        const response = 'Just to confirm - have you already documented this incident in writing?';
        const history = [
          { role: 'user' as const, content: 'Employee policy violation' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(false);
      });

      test('should allow trigger when no questions or clarification phrases', () => {
        const response = 'Thanks for confirming. You should send an email documenting this attendance issue.';
        const history = [
          { role: 'user' as const, content: 'Employee absent' },
          { role: 'assistant' as const, content: 'Have you called them?' },
          { role: 'user' as const, content: 'Yes, no answer' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });
    });

    describe('Step 3: Conversation Depth Check', () => {
      test('should NOT trigger on first turn (history length = 1)', () => {
        const response = 'You should send an email documenting this. Let me draft it for you.';
        const history = [
          { role: 'user' as const, content: 'Need to send warning' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(false);
      });

      test('should allow trigger when history length >= 2', () => {
        const response = 'You should send an email. Want me to draft it?';
        const history = [
          { role: 'user' as const, content: 'Employee issue' },
          { role: 'assistant' as const, content: 'What happened?' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(false); // Context not gathered (ERA still asking)
      });

      test('should allow trigger with proper depth AND context', () => {
        const response = 'Perfect. You should send an email documenting this. Draft it?';
        const history = [
          { role: 'user' as const, content: 'Employee issue' },
          { role: 'assistant' as const, content: 'What happened?' },
          { role: 'user' as const, content: 'Policy violation' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });
    });

    describe('Step 4: Context Gathering Verification', () => {
      test('should NOT trigger if ERA asked question but manager hasn\'t answered yet', () => {
        const response = 'Let me send an email to the employee about this issue.';
        const history = [
          { role: 'user' as const, content: 'Employee problem' },
          { role: 'assistant' as const, content: 'What type of issue is this?' },
          // No user response yet
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(false);
      });

      test('should allow trigger after manager answered ERA\'s question', () => {
        const response = 'Got it. You should send an email documenting this violation. Would you like me to draft it?';
        const history = [
          { role: 'user' as const, content: 'Employee violated policy' },
          { role: 'assistant' as const, content: 'Which policy did they violate?' },
          { role: 'user' as const, content: 'Dress code policy' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('should allow trigger if ERA never asked questions', () => {
        const response = 'You should send an email documenting this. Let me help draft it.';
        const history = [
          { role: 'user' as const, content: 'My employee John violated the dress code three times this week.' },
          { role: 'assistant' as const, content: 'That requires documentation. Here\'s what to do...' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });
    });

    describe('Step 5: Keyword Matching', () => {
      test('should trigger with "send an email" keyword', () => {
        const response = 'You should send an email to document this incident.';
        const history = [
          { role: 'user' as const, content: 'Employee issue' },
          { role: 'assistant' as const, content: 'What happened?' },
          { role: 'user' as const, content: 'Insubordination' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('should trigger with "email the employee" keyword', () => {
        const response = 'You need to email the employee with a formal warning.';
        const history = [
          { role: 'user' as const, content: 'Need to warn employee' },
          { role: 'assistant' as const, content: 'About what?' },
          { role: 'user' as const, content: 'Attendance' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('should trigger with "would you like me to draft" keyword', () => {
        const response = 'Based on this situation, would you like me to draft an email warning?';
        const history = [
          { role: 'user' as const, content: 'Employee violated policy' },
          { role: 'assistant' as const, content: 'Which policy?' },
          { role: 'user' as const, content: 'Safety policy' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('should trigger with "written warning via email" keyword', () => {
        const response = 'This requires a written warning via email to document the violation.';
        const history = [
          { role: 'user' as const, content: 'Employee problem' },
          { role: 'assistant' as const, content: 'What happened?' },
          { role: 'user' as const, content: 'Repeated tardiness' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('should NOT trigger without email keywords', () => {
        const response = 'You should document this issue and follow up with a call.';
        const history = [
          { role: 'user' as const, content: 'Employee problem' },
          { role: 'assistant' as const, content: 'Details?' },
          { role: 'user' as const, content: 'Attendance issue' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(false);
      });
    });

    describe('Integration Tests - Full Scenarios', () => {
      test('Scenario 1: Premature trigger during clarification (should NOT trigger)', () => {
        const response = 'I can help with that. First, I need to know:\n- What type of warning is this?\n- Have you already spoken to the employee about this?\n- Do you have documentation of the incident?';
        const history = [
          { role: 'user' as const, content: 'I need to send a warning email to my employee' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(false); // Has questions, fails depth, no trigger keywords
      });

      test('Scenario 2: Post-clarification trigger (SHOULD trigger)', () => {
        const response = 'Thanks for providing those details. Based on this being the third violation, you should send an email with a formal written warning. Would you like me to help draft that email?';
        const history = [
          { role: 'user' as const, content: 'Need to send warning email' },
          { role: 'assistant' as const, content: 'What type of warning?' },
          { role: 'user' as const, content: 'Written warning for third dress code violation' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('Scenario 3: Already in email flow (should NOT re-trigger)', () => {
        const response = 'Perfect. Let me send an email with those details to the employee.';
        const history = [
          { role: 'user' as const, content: 'Send warning' },
          { role: 'assistant' as const, content: 'What happened?' },
          { role: 'user' as const, content: 'Policy violation' },
          { role: 'assistant' as const, content: 'Draft email?' },
          { role: 'user' as const, content: 'Yes' },
        ];
        const state: ConversationState = {
          type: 'email',
          step: 'awaiting_employee_name',
          subject: 'Warning',
          body: 'Content',
          variables: {},
          missingVariables: [],
          currentVariableIndex: 0,
        };

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(false); // State guard blocks
      });

      test('Scenario 4: General email mention (should NOT trigger)', () => {
        const response = 'You can reach out via email or phone to discuss this matter with the employee.';
        const history = [
          { role: 'user' as const, content: 'How should I contact employee?' },
          { role: 'assistant' as const, content: 'What do you need to discuss?' },
          { role: 'user' as const, content: 'Schedule change' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(false); // Mention of email but no trigger keywords
      });

      test('Scenario 5: Documentation email after context gathered (SHOULD trigger)', () => {
        const response = 'Perfect. Now that we have all the details, you should send an email documenting this conversation and the next steps. Would you like me to draft that for you?';
        const history = [
          { role: 'user' as const, content: 'Had performance discussion with employee' },
          { role: 'assistant' as const, content: 'What was discussed?' },
          { role: 'user' as const, content: 'Productivity concerns and improvement plan' },
          { role: 'assistant' as const, content: 'Did the employee agree to the plan?' },
          { role: 'user' as const, content: 'Yes, they agreed' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      test('should handle empty history gracefully', () => {
        const response = 'You should send an email. Let me draft it.';
        const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(false); // Fails depth check
      });

      test('should handle response with no content', () => {
        const response = '';
        const history = [
          { role: 'user' as const, content: 'Employee issue' },
          { role: 'assistant' as const, content: 'Details?' },
          { role: 'user' as const, content: 'Policy violation' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(false); // No keywords
      });

      test('should be case-insensitive for keywords', () => {
        const response = 'You should SEND AN EMAIL to the employee documenting this issue. Would you like me to DRAFT AN EMAIL?';
        const history = [
          { role: 'user' as const, content: 'Issue' },
          { role: 'assistant' as const, content: 'What happened?' },
          { role: 'user' as const, content: 'Violation' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(true);
      });

      test('should NOT trigger on casual email mention in question', () => {
        const response = 'Have you tried emailing them about this issue?';
        const history = [
          { role: 'user' as const, content: 'Employee not responding' },
        ];
        const state: ConversationState = null;

        const result = handler.detectEmailRecommendationWithContext(response, history, state);

        expect(result).toBe(false); // Has question mark (clarifying)
      });
    });
  });
});
