/**
 * Calendar Handler Intent Detection Integration Tests
 *
 * Tests how calendar-handler integrates with IntentDetector service
 * for context-aware calendar booking triggers.
 *
 * Based on specs/INTENT_DETECTION_CALENDAR.md
 */

import { IntentDetector } from '../../../services/intent-detector';
import { CalendarHandler } from '../calendar-handler';
import type { ConversationState } from '../../../services/conversation-state';

describe('Calendar Handler - Intent Detection Integration', () => {
  let detector: IntentDetector;
  let handler: CalendarHandler;

  beforeEach(() => {
    detector = new IntentDetector();
    handler = new CalendarHandler();
  });

  // ========================================
  // Group 1: Clear Recommendations (Should Trigger)
  // ========================================

  describe('Clear Calendar Recommendations', () => {
    const testCases = [
      {
        name: 'explicit next step instruction',
        response: 'The next step is to call your employee to discuss the missed shifts.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'direct recommendation to reach out',
        response: 'You should reach out to them by phone to understand the situation.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'clear instruction to call',
        response: 'Give them a call to check in and see if everything is okay.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'direct contact recommendation',
        response: 'Contact the employee directly to discuss the attendance issue.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'try calling recommendation',
        response: 'Try calling them to see if you can connect.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'reach out instruction',
        response: 'Reach out to your employee to clarify the situation.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'sequenced action with call',
        response: 'First, call them to confirm they received your message.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'necessity statement for calling',
        response: 'You need to call the employee to document their response.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'get in touch recommendation',
        response: 'Get in touch with them to discuss next steps.',
        expectedTrigger: true,
        expectedConfidence: 'medium'
      },
      {
        name: 'make contact recommendation',
        response: 'Make contact with the employee to address the concern.',
        expectedTrigger: true,
        expectedConfidence: 'medium'
      }
    ];

    testCases.forEach(({ name, response, expectedTrigger, expectedConfidence }) => {
      it(`should detect: ${name}`, async () => {
        // Mock LLM response
        const mockDetect = jest.spyOn(detector, 'detectCalendarIntent');
        mockDetect.mockResolvedValue({
          should_trigger: expectedTrigger,
          confidence: expectedConfidence as any,
          reasoning: `Test case: ${name}`,
          method: 'llm',
          processing_time_ms: 100
        });

        const result = await detector.detectCalendarIntent(response);

        expect(result.should_trigger).toBe(expectedTrigger);
        expect(result.confidence).toBe(expectedConfidence);
        expect(result.method).toBe('llm');

        mockDetect.mockRestore();
      });
    });
  });

  // ========================================
  // Group 2: Conditional/Sequenced Recommendations (Should Trigger)
  // ========================================

  describe('Conditional and Sequenced Recommendations', () => {
    const testCases = [
      {
        name: 'sequenced action with call',
        response: 'After documenting this, call them to follow up.',
        expectedTrigger: true
      },
      {
        name: 'conditional recommendation to call',
        response: 'If they don\'t respond to the voicemail, call again.',
        expectedTrigger: true
      },
      {
        name: 'conditional sequencing with call',
        response: 'Once you have all the details, reach out by phone.',
        expectedTrigger: true
      },
      {
        name: 'contextual recommendation to call',
        response: 'Since you haven\'t heard back, call them directly.',
        expectedTrigger: true
      },
      {
        name: 'pre-escalation call recommendation',
        response: 'Before escalating to HR, try calling the employee.',
        expectedTrigger: true
      }
    ];

    testCases.forEach(({ name, response, expectedTrigger }) => {
      it(`should detect: ${name}`, async () => {
        const mockDetect = jest.spyOn(detector, 'detectCalendarIntent');
        mockDetect.mockResolvedValue({
          should_trigger: expectedTrigger,
          confidence: 'high',
          reasoning: `Conditional: ${name}`,
          method: 'llm',
          processing_time_ms: 100
        });

        const result = await detector.detectCalendarIntent(response);

        expect(result.should_trigger).toBe(expectedTrigger);

        mockDetect.mockRestore();
      });
    });
  });

  // ========================================
  // Group 3: Indirect/Natural Language (Should Trigger)
  // ========================================

  describe('Indirect and Natural Language Recommendations', () => {
    const testCases = [
      {
        name: 'soft recommendation',
        response: 'It would be good to connect with them by phone.',
        expectedConfidence: 'medium'
      },
      {
        name: 'suggestion framing',
        response: 'Consider giving them a call to discuss this.',
        expectedConfidence: 'medium'
      },
      {
        name: 'gentle recommendation',
        response: 'You might want to reach out by phone first.',
        expectedConfidence: 'medium'
      },
      {
        name: 'comparative recommendation',
        response: 'Best to call them before taking further action.',
        expectedConfidence: 'medium'
      },
      {
        name: 'explicit recommendation',
        response: 'I\'d recommend calling to get their side of the story.',
        expectedConfidence: 'high'
      }
    ];

    testCases.forEach(({ name, response, expectedConfidence }) => {
      it(`should detect: ${name}`, async () => {
        const mockDetect = jest.spyOn(detector, 'detectCalendarIntent');
        mockDetect.mockResolvedValue({
          should_trigger: true,
          confidence: expectedConfidence as any,
          reasoning: `Indirect: ${name}`,
          method: 'llm',
          processing_time_ms: 100
        });

        const result = await detector.detectCalendarIntent(response);

        expect(result.should_trigger).toBe(true);
        expect(result.confidence).toBe(expectedConfidence);

        mockDetect.mockRestore();
      });
    });
  });

  // ========================================
  // Group 4: Should NOT Trigger (Past Tense)
  // ========================================

  describe('Past Tense - Should Not Trigger', () => {
    const testCases = [
      {
        name: 'past tense action complete',
        response: 'Since you already called them yesterday, wait for a response.',
        reasoning: 'Past tense, action already complete'
      },
      {
        name: 'past tense question',
        response: 'After you called, did they explain the absence?',
        reasoning: 'Past tense question'
      },
      {
        name: 'reference to completed call',
        response: 'Following your call this morning, document what was said.',
        reasoning: 'Refers to completed call'
      }
    ];

    testCases.forEach(({ name, response, reasoning }) => {
      it(`should not trigger: ${name}`, async () => {
        const mockDetect = jest.spyOn(detector, 'detectCalendarIntent');
        mockDetect.mockResolvedValue({
          should_trigger: false,
          confidence: 'high',
          reasoning,
          method: 'llm',
          processing_time_ms: 100
        });

        const result = await detector.detectCalendarIntent(response);

        expect(result.should_trigger).toBe(false);

        mockDetect.mockRestore();
      });
    });
  });

  // ========================================
  // Group 5: Should NOT Trigger (Employee to Manager)
  // ========================================

  describe('Employee-to-Manager Direction - Should Not Trigger', () => {
    const testCases = [
      {
        name: 'waiting for employee call',
        response: 'Wait for them to call you back with an explanation.',
        reasoning: 'Employee calling manager, not reverse'
      },
      {
        name: 'employee responsibility',
        response: 'They should call you to confirm their attendance.',
        reasoning: 'Employee\'s responsibility to call'
      },
      {
        name: 'waiting for employee contact',
        response: 'See if the employee reaches out by end of day.',
        reasoning: 'Waiting for employee contact'
      },
      {
        name: 'requesting employee to call',
        response: 'Ask them to give you a call when they\'re available.',
        reasoning: 'Requesting employee to call'
      }
    ];

    testCases.forEach(({ name, response, reasoning }) => {
      it(`should not trigger: ${name}`, async () => {
        const mockDetect = jest.spyOn(detector, 'detectCalendarIntent');
        mockDetect.mockResolvedValue({
          should_trigger: false,
          confidence: 'high',
          reasoning,
          method: 'llm',
          processing_time_ms: 100
        });

        const result = await detector.detectCalendarIntent(response);

        expect(result.should_trigger).toBe(false);

        mockDetect.mockRestore();
      });
    });
  });

  // ========================================
  // Group 6: Should NOT Trigger (Questions)
  // ========================================

  describe('Questions - Should Not Trigger', () => {
    const testCases = [
      'Have you tried calling them yet?',
      'Did you reach out to the employee by phone?',
      'Were you able to get them on the phone?'
    ];

    testCases.forEach((response) => {
      it(`should not trigger for: "${response}"`, async () => {
        const mockDetect = jest.spyOn(detector, 'detectCalendarIntent');
        mockDetect.mockResolvedValue({
          should_trigger: false,
          confidence: 'high',
          reasoning: 'Question about past action',
          method: 'llm',
          processing_time_ms: 100
        });

        const result = await detector.detectCalendarIntent(response);

        expect(result.should_trigger).toBe(false);

        mockDetect.mockRestore();
      });
    });
  });

  // ========================================
  // Group 7: Should NOT Trigger (Negatives/Mentions)
  // ========================================

  describe('Negatives and Policy Mentions - Should Not Trigger', () => {
    const testCases = [
      {
        name: 'negative instruction',
        response: 'Don\'t call them until you have all the facts.',
        reasoning: 'Negative instruction'
      },
      {
        name: 'delay instruction',
        response: 'Wait before calling to gather more information.',
        reasoning: 'Delay instruction'
      },
      {
        name: 'policy mention',
        response: 'Employees who no-call/no-show should be documented.',
        reasoning: 'Policy mention, not recommendation'
      },
      {
        name: 'policy description',
        response: 'The no-call policy applies when employees don\'t call in.',
        reasoning: 'Policy description'
      },
      {
        name: 'information only',
        response: 'Their phone number is in the employee directory.',
        reasoning: 'Information only, no recommendation'
      }
    ];

    testCases.forEach(({ name, response, reasoning }) => {
      it(`should not trigger: ${name}`, async () => {
        const mockDetect = jest.spyOn(detector, 'detectCalendarIntent');
        mockDetect.mockResolvedValue({
          should_trigger: false,
          confidence: 'high',
          reasoning,
          method: 'llm',
          processing_time_ms: 100
        });

        const result = await detector.detectCalendarIntent(response);

        expect(result.should_trigger).toBe(false);

        mockDetect.mockRestore();
      });
    });
  });

  // ========================================
  // Context-Aware Detection Tests
  // ========================================

  describe('Context-Aware Detection', () => {
    it('should NOT trigger during clarification phase', () => {
      const response = 'Have you tried calling them to discuss the issue?';
      const conversationHistory = [
        { role: 'user' as const, content: 'My employee missed 3 days' }
      ];
      const conversationState: ConversationState = null;

      const shouldTrigger = handler.detectCalendarRecommendationWithContext(
        response,
        conversationHistory,
        conversationState
      );

      expect(shouldTrigger).toBe(false);
    });

    it('should NOT trigger if already in calendar flow', () => {
      const response = 'Give them a call to discuss the issue.';
      const conversationHistory = [
        { role: 'user' as const, content: 'My employee missed 3 days' },
        { role: 'assistant' as const, content: 'Have you tried calling them?' },
        { role: 'user' as const, content: 'Not yet' }
      ];
      const conversationState: ConversationState = {
        type: 'calendar',
        step: 'awaiting_initial_confirmation',
        topic: 'attendance',
        managerEmail: 'manager@test.com'
      };

      const shouldTrigger = handler.detectCalendarRecommendationWithContext(
        response,
        conversationHistory,
        conversationState
      );

      expect(shouldTrigger).toBe(false);
    });

    it('should NOT trigger with insufficient conversation depth', () => {
      const response = 'Give them a call to discuss the issue.';
      const conversationHistory = [
        { role: 'user' as const, content: 'My employee missed work' }
      ];
      const conversationState: ConversationState = null;

      const shouldTrigger = handler.detectCalendarRecommendationWithContext(
        response,
        conversationHistory,
        conversationState
      );

      expect(shouldTrigger).toBe(false);
    });

    it('should NOT trigger before manager answers ERA questions', () => {
      const response = 'Give them a call to discuss.';
      const conversationHistory = [
        { role: 'user' as const, content: 'My employee missed 3 days' },
        { role: 'assistant' as const, content: 'Were these consecutive days?' }
      ];
      const conversationState: ConversationState = null;

      const shouldTrigger = handler.detectCalendarRecommendationWithContext(
        response,
        conversationHistory,
        conversationState
      );

      expect(shouldTrigger).toBe(false);
    });

    it('should TRIGGER after context is gathered', () => {
      const response = 'Give them a call to discuss the attendance issue.';
      const conversationHistory = [
        { role: 'user' as const, content: 'My employee missed 3 days' },
        { role: 'assistant' as const, content: 'Were these consecutive?' },
        { role: 'user' as const, content: 'Yes, all in a row' },
        { role: 'assistant' as const, content: response }
      ];
      const conversationState: ConversationState = null;

      const shouldTrigger = handler.detectCalendarRecommendationWithContext(
        response,
        conversationHistory,
        conversationState
      );

      expect(shouldTrigger).toBe(true);
    });
  });

  // ========================================
  // Edge Cases
  // ========================================

  describe('Edge Cases', () => {
    it('should handle multi-method recommendations (call + email)', async () => {
      const response = 'Call them to discuss, then follow up with a written email summarizing your conversation.';

      const mockDetect = jest.spyOn(detector, 'detectCalendarIntent');
      mockDetect.mockResolvedValue({
        should_trigger: true,
        confidence: 'high',
        reasoning: 'Recommends both calling and emailing',
        method: 'llm',
        processing_time_ms: 100
      });

      const result = await detector.detectCalendarIntent(response);

      expect(result.should_trigger).toBe(true);

      mockDetect.mockRestore();
    });

    it('should handle conditional hypotheticals correctly', async () => {
      const response = 'If you decide to call them, make sure to document it.';

      const mockDetect = jest.spyOn(detector, 'detectCalendarIntent');
      mockDetect.mockResolvedValue({
        should_trigger: false,
        confidence: 'high',
        reasoning: 'Hypothetical without recommendation',
        method: 'llm',
        processing_time_ms: 100
      });

      const result = await detector.detectCalendarIntent(response);

      expect(result.should_trigger).toBe(false);

      mockDetect.mockRestore();
    });

    it('should handle vague contact recommendations', async () => {
      const response = 'You should try to reach them somehow.';

      const mockDetect = jest.spyOn(detector, 'detectCalendarIntent');
      mockDetect.mockResolvedValue({
        should_trigger: true,
        confidence: 'medium',
        reasoning: 'Vague but still recommendation to contact',
        method: 'llm',
        processing_time_ms: 100
      });

      const result = await detector.detectCalendarIntent(response);

      expect(result.should_trigger).toBe(true);
      expect(result.confidence).toBe('medium');

      mockDetect.mockRestore();
    });
  });

  // ========================================
  // Performance Tests
  // ========================================

  describe('Performance', () => {
    it('should complete detection within 200ms', async () => {
      const mockDetect = jest.spyOn(detector, 'detectCalendarIntent');
      mockDetect.mockResolvedValue({
        should_trigger: true,
        confidence: 'high',
        reasoning: 'Performance test',
        method: 'llm',
        processing_time_ms: 150
      });

      const startTime = Date.now();
      await detector.detectCalendarIntent('Call them to discuss.');
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(200);

      mockDetect.mockRestore();
    });
  });
});
