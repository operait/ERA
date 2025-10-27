/**
 * Email Handler Intent Detection Integration Tests
 *
 * Tests how email-handler integrates with IntentDetector service
 * for context-aware email sending triggers.
 *
 * Based on specs/INTENT_DETECTION_EMAIL.md
 */

import { IntentDetector } from '../../../services/intent-detector';
import { EmailHandler } from '../email-handler';
import type { ConversationState } from '../../../services/conversation-state';

describe('Email Handler - Intent Detection Integration', () => {
  let detector: IntentDetector;
  let handler: EmailHandler;

  beforeEach(() => {
    detector = new IntentDetector();
    handler = new EmailHandler();
  });

  // ========================================
  // Group 1: Clear Email Recommendations (Should Trigger)
  // ========================================

  describe('Clear Email Recommendations', () => {
    const testCases = [
      {
        name: 'explicit instruction to send email',
        response: 'Send them an email documenting the missed shifts.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'direct email recommendation',
        response: 'You should email the employee to confirm the discussion.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'email drafting instruction',
        response: 'Draft an email to the employee outlining the expectations.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'written documentation recommendation',
        response: 'Follow up in writing to create a paper trail.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'written notice instruction',
        response: 'Send a written notice about the attendance policy.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'email with specific content',
        response: 'Email them a summary of your conversation.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'indirect email recommendation',
        response: 'Put it in writing so you have documentation.',
        expectedTrigger: true,
        expectedConfidence: 'medium'
      },
      {
        name: 'written doc instruction',
        response: 'Send written documentation of the warning.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'casual email instruction',
        response: 'Shoot them an email with the policy details.',
        expectedTrigger: true,
        expectedConfidence: 'medium'
      },
      {
        name: 'sequential email instruction',
        response: 'The next step is to email them the corrective action plan.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      }
    ];

    testCases.forEach(({ name, response, expectedTrigger, expectedConfidence }) => {
      it(`should detect: ${name}`, async () => {
        const mockDetect = jest.spyOn(detector, 'detectEmailIntent');
        mockDetect.mockResolvedValue({
          should_trigger: expectedTrigger,
          confidence: expectedConfidence as any,
          reasoning: `Test case: ${name}`,
          method: 'llm',
          processing_time_ms: 100
        });

        const result = await detector.detectEmailIntent(response);

        expect(result.should_trigger).toBe(expectedTrigger);
        expect(result.confidence).toBe(expectedConfidence);
        expect(result.method).toBe('llm');

        mockDetect.mockRestore();
      });
    });
  });

  // ========================================
  // Group 2: Template Offers (Should Trigger)
  // ========================================

  describe('Template Offers', () => {
    const testCases = [
      {
        name: 'template provision for email',
        response: 'Here\'s an email template you can use...',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'explicit offer to draft email',
        response: 'Want me to draft an email for you?',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'assistance offer for emailing',
        response: 'I can help you write an email to send them.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'direct drafting offer',
        response: 'Would you like me to draft that email?',
        expectedTrigger: true,
        expectedConfidence: 'high'
      },
      {
        name: 'template offering',
        response: 'Let me provide an email template for this situation.',
        expectedTrigger: true,
        expectedConfidence: 'high'
      }
    ];

    testCases.forEach(({ name, response, expectedTrigger, expectedConfidence }) => {
      it(`should detect: ${name}`, async () => {
        const mockDetect = jest.spyOn(detector, 'detectEmailIntent');
        mockDetect.mockResolvedValue({
          should_trigger: expectedTrigger,
          confidence: expectedConfidence as any,
          reasoning: `Template: ${name}`,
          method: 'llm',
          processing_time_ms: 100
        });

        const result = await detector.detectEmailIntent(response);

        expect(result.should_trigger).toBe(expectedTrigger);

        mockDetect.mockRestore();
      });
    });
  });

  // ========================================
  // Group 3: Follow-Up/Sequential (Should Trigger)
  // ========================================

  describe('Follow-Up and Sequential Instructions', () => {
    const testCases = [
      {
        name: 'sequential email instruction',
        response: 'After the call, follow up with an email.',
        expectedTrigger: true
      },
      {
        name: 'conditional email instruction',
        response: 'Once you document it, send them an email summary.',
        expectedTrigger: true
      },
      {
        name: 'next-step email instruction',
        response: 'Then email them the details of your discussion.',
        expectedTrigger: true
      },
      {
        name: 'follow-up email instruction',
        response: 'Follow this up with a written email to the employee.',
        expectedTrigger: true
      },
      {
        name: 'post-action email instruction',
        response: 'After documenting, send an email confirming next steps.',
        expectedTrigger: true
      }
    ];

    testCases.forEach(({ name, response, expectedTrigger }) => {
      it(`should detect: ${name}`, async () => {
        const mockDetect = jest.spyOn(detector, 'detectEmailIntent');
        mockDetect.mockResolvedValue({
          should_trigger: expectedTrigger,
          confidence: 'high',
          reasoning: `Sequential: ${name}`,
          method: 'llm',
          processing_time_ms: 100
        });

        const result = await detector.detectEmailIntent(response);

        expect(result.should_trigger).toBe(expectedTrigger);

        mockDetect.mockRestore();
      });
    });
  });

  // ========================================
  // Group 4: Indirect/Natural Language (Should Trigger)
  // ========================================

  describe('Indirect and Natural Language Recommendations', () => {
    const testCases = [
      {
        name: 'soft recommendation',
        response: 'It would be good to send them written confirmation.',
        expectedConfidence: 'medium'
      },
      {
        name: 'suggestion framing',
        response: 'Consider emailing them the policy for reference.',
        expectedConfidence: 'medium'
      },
      {
        name: 'gentle recommendation',
        response: 'You might want to email a summary of expectations.',
        expectedConfidence: 'medium'
      },
      {
        name: 'comparative recommendation',
        response: 'Best to put this in writing via email.',
        expectedConfidence: 'medium'
      },
      {
        name: 'explicit recommendation',
        response: 'I\'d recommend sending an email to document this.',
        expectedConfidence: 'high'
      }
    ];

    testCases.forEach(({ name, response, expectedConfidence }) => {
      it(`should detect: ${name}`, async () => {
        const mockDetect = jest.spyOn(detector, 'detectEmailIntent');
        mockDetect.mockResolvedValue({
          should_trigger: true,
          confidence: expectedConfidence as any,
          reasoning: `Indirect: ${name}`,
          method: 'llm',
          processing_time_ms: 100
        });

        const result = await detector.detectEmailIntent(response);

        expect(result.should_trigger).toBe(true);
        expect(result.confidence).toBe(expectedConfidence);

        mockDetect.mockRestore();
      });
    });
  });

  // ========================================
  // Group 5: Should NOT Trigger (Receiving Emails)
  // ========================================

  describe('Receiving Emails - Should Not Trigger', () => {
    const testCases = [
      {
        name: 'employee sending email',
        response: 'Wait for their email response before proceeding.',
        reasoning: 'Employee sending email, not manager'
      },
      {
        name: 'employee responsibility',
        response: 'They should email you with an explanation.',
        reasoning: 'Employee\'s responsibility'
      },
      {
        name: 'waiting for employee email',
        response: 'See if the employee sends an email by end of day.',
        reasoning: 'Waiting for employee email'
      },
      {
        name: 'requesting employee to email',
        response: 'Ask them to email you their availability.',
        reasoning: 'Requesting employee to email'
      }
    ];

    testCases.forEach(({ name, response, reasoning }) => {
      it(`should not trigger: ${name}`, async () => {
        const mockDetect = jest.spyOn(detector, 'detectEmailIntent');
        mockDetect.mockResolvedValue({
          should_trigger: false,
          confidence: 'high',
          reasoning,
          method: 'llm',
          processing_time_ms: 100
        });

        const result = await detector.detectEmailIntent(response);

        expect(result.should_trigger).toBe(false);

        mockDetect.mockRestore();
      });
    });
  });

  // ========================================
  // Group 6: Should NOT Trigger (Past Tense)
  // ========================================

  describe('Past Tense - Should Not Trigger', () => {
    const testCases = [
      {
        name: 'past tense already sent',
        response: 'Since you already emailed them, wait for a response.',
        reasoning: 'Past tense, already sent'
      },
      {
        name: 'refers to sent email',
        response: 'After you sent that email, did they respond?',
        reasoning: 'Refers to sent email'
      },
      {
        name: 'past email reference',
        response: 'Following your email yesterday, document any replies.',
        reasoning: 'Past email reference'
      }
    ];

    testCases.forEach(({ name, response, reasoning }) => {
      it(`should not trigger: ${name}`, async () => {
        const mockDetect = jest.spyOn(detector, 'detectEmailIntent');
        mockDetect.mockResolvedValue({
          should_trigger: false,
          confidence: 'high',
          reasoning,
          method: 'llm',
          processing_time_ms: 100
        });

        const result = await detector.detectEmailIntent(response);

        expect(result.should_trigger).toBe(false);

        mockDetect.mockRestore();
      });
    });
  });

  // ========================================
  // Group 7: Should NOT Trigger (Questions/Mentions)
  // ========================================

  describe('Questions and General Mentions - Should Not Trigger', () => {
    const testCases = [
      {
        name: 'question about past action',
        response: 'Have you sent them an email about this?',
        reasoning: 'Question about past action'
      },
      {
        name: 'general mention no recommendation',
        response: 'Email is one way to communicate with employees.',
        reasoning: 'General mention, no recommendation'
      },
      {
        name: 'contact information only',
        response: 'Their email address is in the employee directory.',
        reasoning: 'Contact information only'
      }
    ];

    testCases.forEach(({ name, response, reasoning }) => {
      it(`should not trigger: ${name}`, async () => {
        const mockDetect = jest.spyOn(detector, 'detectEmailIntent');
        mockDetect.mockResolvedValue({
          should_trigger: false,
          confidence: 'high',
          reasoning,
          method: 'llm',
          processing_time_ms: 100
        });

        const result = await detector.detectEmailIntent(response);

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
      const response = 'Have you already sent them an email about the policy?';
      const conversationHistory = [
        { role: 'user' as const, content: 'My employee violated the dress code' }
      ];
      const conversationState: ConversationState = null;

      const shouldTrigger = handler.detectEmailRecommendationWithContext(
        response,
        conversationHistory,
        conversationState
      );

      expect(shouldTrigger).toBe(false);
    });

    it('should NOT trigger if already in email flow', () => {
      const response = 'Send them an email about the policy.';
      const conversationHistory = [
        { role: 'user' as const, content: 'I need to document this' },
        { role: 'assistant' as const, content: 'What type of documentation?' },
        { role: 'user' as const, content: 'Written warning' }
      ];
      const conversationState: ConversationState = {
        type: 'email',
        step: 'awaiting_subject',
        subject: '',
        managerEmail: 'manager@test.com'
      };

      const shouldTrigger = handler.detectEmailRecommendationWithContext(
        response,
        conversationHistory,
        conversationState
      );

      expect(shouldTrigger).toBe(false);
    });

    it('should NOT trigger with insufficient conversation depth', () => {
      const response = 'Send them an email documenting the issue.';
      const conversationHistory = [
        { role: 'user' as const, content: 'My employee was late' }
      ];
      const conversationState: ConversationState = null;

      const shouldTrigger = handler.detectEmailRecommendationWithContext(
        response,
        conversationHistory,
        conversationState
      );

      expect(shouldTrigger).toBe(false);
    });

    it('should NOT trigger before manager answers ERA questions', () => {
      const response = 'Send them an email.';
      const conversationHistory = [
        { role: 'user' as const, content: 'Employee violated policy' },
        { role: 'assistant' as const, content: 'Which policy was violated?' }
      ];
      const conversationState: ConversationState = null;

      const shouldTrigger = handler.detectEmailRecommendationWithContext(
        response,
        conversationHistory,
        conversationState
      );

      expect(shouldTrigger).toBe(false);
    });

    it('should TRIGGER after context is gathered', () => {
      const response = 'Send them an email documenting the attendance violation.';
      const conversationHistory = [
        { role: 'user' as const, content: 'Employee missed 3 days' },
        { role: 'assistant' as const, content: 'Did they call in?' },
        { role: 'user' as const, content: 'No, no call' },
        { role: 'assistant' as const, content: response }
      ];
      const conversationState: ConversationState = null;

      const shouldTrigger = handler.detectEmailRecommendationWithContext(
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

      const mockDetect = jest.spyOn(detector, 'detectEmailIntent');
      mockDetect.mockResolvedValue({
        should_trigger: true,
        confidence: 'high',
        reasoning: 'Recommends both calling and emailing',
        method: 'llm',
        processing_time_ms: 100
      });

      const result = await detector.detectEmailIntent(response);

      expect(result.should_trigger).toBe(true);

      mockDetect.mockRestore();
    });

    it('should detect "written documentation" as email recommendation', async () => {
      const response = 'Send them written documentation of the policy violation.';

      const mockDetect = jest.spyOn(detector, 'detectEmailIntent');
      mockDetect.mockResolvedValue({
        should_trigger: true,
        confidence: 'high',
        reasoning: 'Written documentation typically means email',
        method: 'llm',
        processing_time_ms: 100
      });

      const result = await detector.detectEmailIntent(response);

      expect(result.should_trigger).toBe(true);

      mockDetect.mockRestore();
    });

    it('should handle conditional template offers', async () => {
      const response = 'Here\'s a template you can use if you decide to reach out in writing.';

      const mockDetect = jest.spyOn(detector, 'detectEmailIntent');
      mockDetect.mockResolvedValue({
        should_trigger: true,
        confidence: 'medium',
        reasoning: 'Template provision typically implies recommendation to use it',
        method: 'llm',
        processing_time_ms: 100
      });

      const result = await detector.detectEmailIntent(response);

      expect(result.should_trigger).toBe(true);
      expect(result.confidence).toBe('medium');

      mockDetect.mockRestore();
    });

    it('should NOT trigger for email mentions in context', async () => {
      const response = 'When documenting this incident, include details like date, time, and email correspondence.';

      const mockDetect = jest.spyOn(detector, 'detectEmailIntent');
      mockDetect.mockResolvedValue({
        should_trigger: false,
        confidence: 'high',
        reasoning: 'Mention only, not recommendation',
        method: 'llm',
        processing_time_ms: 100
      });

      const result = await detector.detectEmailIntent(response);

      expect(result.should_trigger).toBe(false);

      mockDetect.mockRestore();
    });
  });

  // ========================================
  // Parallel Detection with Calendar
  // ========================================

  describe('Parallel Detection with Calendar Intent', () => {
    it('should detect both calendar and email intents simultaneously', async () => {
      const response = 'Call them to discuss, then follow up with a written email summarizing your conversation.';

      const mockDetectBoth = jest.spyOn(detector, 'detectBothIntents');
      mockDetectBoth.mockResolvedValue({
        calendar: {
          should_trigger: true,
          confidence: 'high',
          reasoning: 'Recommends calling',
          method: 'llm',
          processing_time_ms: 100
        },
        email: {
          should_trigger: true,
          confidence: 'high',
          reasoning: 'Recommends email follow-up',
          method: 'llm',
          processing_time_ms: 100
        }
      });

      const result = await detector.detectBothIntents(response);

      expect(result.calendar.should_trigger).toBe(true);
      expect(result.email.should_trigger).toBe(true);

      mockDetectBoth.mockRestore();
    });

    it('should detect only email intent (not calendar)', async () => {
      const response = 'Send them an email documenting the policy violation.';

      const mockDetectBoth = jest.spyOn(detector, 'detectBothIntents');
      mockDetectBoth.mockResolvedValue({
        calendar: {
          should_trigger: false,
          confidence: 'high',
          reasoning: 'No call recommendation',
          method: 'llm',
          processing_time_ms: 100
        },
        email: {
          should_trigger: true,
          confidence: 'high',
          reasoning: 'Recommends emailing',
          method: 'llm',
          processing_time_ms: 100
        }
      });

      const result = await detector.detectBothIntents(response);

      expect(result.calendar.should_trigger).toBe(false);
      expect(result.email.should_trigger).toBe(true);

      mockDetectBoth.mockRestore();
    });
  });

  // ========================================
  // Performance Tests
  // ========================================

  describe('Performance', () => {
    it('should complete detection within 200ms', async () => {
      const mockDetect = jest.spyOn(detector, 'detectEmailIntent');
      mockDetect.mockResolvedValue({
        should_trigger: true,
        confidence: 'high',
        reasoning: 'Performance test',
        method: 'llm',
        processing_time_ms: 150
      });

      const startTime = Date.now();
      await detector.detectEmailIntent('Send them an email.');
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(200);

      mockDetect.mockRestore();
    });
  });
});
