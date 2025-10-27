/**
 * Intent Detector Service Tests
 *
 * Tests LLM-based intent detection for calendar and email workflows,
 * including error handling, fallback, and comparison logging.
 */

import { IntentDetector, IntentDetectionResult } from '../intent-detector';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');

describe('IntentDetector', () => {
  let detector: IntentDetector;
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(() => {
    // Reset environment variables
    process.env.INTENT_DETECTION_ENABLED = 'true';
    process.env.INTENT_DETECTION_LOGGING = 'off'; // Disable logs during tests
    process.env.INTENT_DETECTION_TIMEOUT = '3000';
    process.env.INTENT_DETECTION_FALLBACK = 'keyword';

    // Create mock for the completions.create method
    const mockCreate = jest.fn();

    // Create mock OpenAI instance
    mockOpenAI = {
      chat: {
        completions: {
          create: mockCreate
        }
      }
    } as any;

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI);

    detector = new IntentDetector();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // Calendar Intent Detection Tests
  // ========================================

  describe('detectCalendarIntent', () => {
    describe('LLM Detection (Enabled)', () => {
      it('should detect clear calendar recommendation with LLM', async () => {
        // Mock LLM response
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_calendar: true,
                confidence: 'high',
                reasoning: 'Explicitly recommends calling employee as next step'
              })
            }
          }]
        } as any);

        const result = await detector.detectCalendarIntent(
          'The next step is to call your employee to discuss the missed shifts.'
        );

        expect(result.should_trigger).toBe(true);
        expect(result.confidence).toBe('high');
        expect(result.method).toBe('llm');
        expect(result.reasoning).toContain('calling employee');
      });

      it('should not trigger for past tense calls', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_calendar: false,
                confidence: 'high',
                reasoning: 'Past tense - call already happened'
              })
            }
          }]
        } as any);

        const result = await detector.detectCalendarIntent(
          'Since you already called them yesterday, wait for a response.'
        );

        expect(result.should_trigger).toBe(false);
        expect(result.confidence).toBe('high');
        expect(result.method).toBe('llm');
      });

      it('should not trigger for employee-calling-manager scenarios', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_calendar: false,
                confidence: 'high',
                reasoning: 'Employee is expected to call manager, not reverse'
              })
            }
          }]
        } as any);

        const result = await detector.detectCalendarIntent(
          'Wait for them to call you back with an explanation.'
        );

        expect(result.should_trigger).toBe(false);
        expect(result.method).toBe('llm');
      });

      it('should not trigger for negative instructions', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_calendar: false,
                confidence: 'high',
                reasoning: 'Negative instruction - do not call yet'
              })
            }
          }]
        } as any);

        const result = await detector.detectCalendarIntent(
          'Don\'t call them until you have all the facts.'
        );

        expect(result.should_trigger).toBe(false);
      });

      it('should detect indirect recommendations', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_calendar: true,
                confidence: 'medium',
                reasoning: 'Indirect recommendation to reach out'
              })
            }
          }]
        } as any);

        const result = await detector.detectCalendarIntent(
          'You might want to reach out by phone first.'
        );

        expect(result.should_trigger).toBe(true);
        expect(result.confidence).toBe('medium');
      });
    });

    describe('Keyword Fallback', () => {
      it('should use keyword detection when LLM disabled', async () => {
        process.env.INTENT_DETECTION_ENABLED = 'false';
        detector = new IntentDetector();

        const result = await detector.detectCalendarIntent(
          'You should call them to discuss the issue.'
        );

        expect(result.should_trigger).toBe(true);
        expect(result.method).toBe('keyword_fallback');
        expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
      });

      it('should fallback to keywords when LLM fails', async () => {
        mockOpenAI.chat.completions.create.mockRejectedValue(
          new Error('OpenAI API timeout')
        );

        const result = await detector.detectCalendarIntent(
          'Call them to discuss the absence.'
        );

        expect(result.should_trigger).toBe(true); // Keyword match
        expect(result.method).toBe('keyword_fallback');
        expect(result.reasoning).toContain('Fallback to keyword detection');
      });

      it('should detect all calendar keywords', async () => {
        process.env.INTENT_DETECTION_ENABLED = 'false';
        detector = new IntentDetector();

        const testCases = [
          'schedule a call',
          'call them',
          'reach out to them',
          'contact your employee',
          'give them a call',
          'next step is to call'
        ];

        for (const phrase of testCases) {
          const result = await detector.detectCalendarIntent(
            `You should ${phrase} to discuss the issue.`
          );
          expect(result.should_trigger).toBe(true);
        }
      });
    });

    describe('Error Handling', () => {
      it('should handle invalid JSON from LLM', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: 'This is not valid JSON but contains "should_trigger_calendar":true'
            }
          }]
        } as any);

        const result = await detector.detectCalendarIntent(
          'Call them to discuss the issue.'
        );

        expect(result.should_trigger).toBe(true);
        expect(result.confidence).toBe('low');
        expect(result.reasoning).toContain('non-JSON response');
      });

      it('should handle OpenAI API errors with fallback', async () => {
        mockOpenAI.chat.completions.create.mockRejectedValue(
          new Error('Network error')
        );

        const result = await detector.detectCalendarIntent(
          'Give them a call to check in.'
        );

        expect(result.method).toBe('keyword_fallback');
        expect(result.should_trigger).toBe(true); // Keyword matches
      });

      it('should not trigger on error when fallback disabled', async () => {
        process.env.INTENT_DETECTION_FALLBACK = 'none';
        detector = new IntentDetector();

        mockOpenAI.chat.completions.create.mockRejectedValue(
          new Error('API error')
        );

        const result = await detector.detectCalendarIntent(
          'Call them to discuss.'
        );

        expect(result.should_trigger).toBe(false);
        expect(result.method).toBe('llm');
        expect(result.reasoning).toContain('fallback disabled');
      });

      it('should handle empty LLM response', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: ''
            }
          }]
        } as any);

        const result = await detector.detectCalendarIntent(
          'Call them.'
        );

        expect(result.should_trigger).toBe(false);
        expect(result.confidence).toBe('low');
      });
    });
  });

  // ========================================
  // Email Intent Detection Tests
  // ========================================

  describe('detectEmailIntent', () => {
    describe('LLM Detection (Enabled)', () => {
      it('should detect clear email recommendation with LLM', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_email: true,
                confidence: 'high',
                reasoning: 'Explicitly recommends sending email'
              })
            }
          }]
        } as any);

        const result = await detector.detectEmailIntent(
          'Send them an email documenting the missed shifts.'
        );

        expect(result.should_trigger).toBe(true);
        expect(result.confidence).toBe('high');
        expect(result.method).toBe('llm');
      });

      it('should detect template offers', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_email: true,
                confidence: 'high',
                reasoning: 'Offers email template for sending'
              })
            }
          }]
        } as any);

        const result = await detector.detectEmailIntent(
          'Here\'s an email template you can use to follow up.'
        );

        expect(result.should_trigger).toBe(true);
      });

      it('should detect written documentation recommendations', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_email: true,
                confidence: 'high',
                reasoning: 'Recommends written documentation'
              })
            }
          }]
        } as any);

        const result = await detector.detectEmailIntent(
          'Follow up in writing to create a paper trail.'
        );

        expect(result.should_trigger).toBe(true);
      });

      it('should not trigger for receiving emails', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_email: false,
                confidence: 'high',
                reasoning: 'Refers to receiving email, not sending'
              })
            }
          }]
        } as any);

        const result = await detector.detectEmailIntent(
          'Wait for their email response before proceeding.'
        );

        expect(result.should_trigger).toBe(false);
      });

      it('should not trigger for email addresses', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_email: false,
                confidence: 'high',
                reasoning: 'Email mentioned as contact information only'
              })
            }
          }]
        } as any);

        const result = await detector.detectEmailIntent(
          'Their email address is john@company.com'
        );

        expect(result.should_trigger).toBe(false);
      });

      it('should not trigger for past tense', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_email: false,
                confidence: 'high',
                reasoning: 'Past tense - email already sent'
              })
            }
          }]
        } as any);

        const result = await detector.detectEmailIntent(
          'Since you already emailed them, wait for a response.'
        );

        expect(result.should_trigger).toBe(false);
      });
    });

    describe('Keyword Fallback', () => {
      it('should use keyword detection when LLM disabled', async () => {
        process.env.INTENT_DETECTION_ENABLED = 'false';
        detector = new IntentDetector();

        const result = await detector.detectEmailIntent(
          'Send them an email with the policy details.'
        );

        expect(result.should_trigger).toBe(true);
        expect(result.method).toBe('keyword_fallback');
        expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
      });

      it('should detect all email keywords', async () => {
        process.env.INTENT_DETECTION_ENABLED = 'false';
        detector = new IntentDetector();

        const testCases = [
          'send an email',
          'email them',
          'draft an email',
          'follow up in writing',
          'put it in writing',
          'email documenting'
        ];

        for (const phrase of testCases) {
          const result = await detector.detectEmailIntent(
            `You should ${phrase} the incident.`
          );
          expect(result.should_trigger).toBe(true);
        }
      });

      it('should fallback to keywords when LLM fails', async () => {
        mockOpenAI.chat.completions.create.mockRejectedValue(
          new Error('API timeout')
        );

        const result = await detector.detectEmailIntent(
          'Draft an email to the employee.'
        );

        expect(result.should_trigger).toBe(true);
        expect(result.method).toBe('keyword_fallback');
      });
    });

    describe('Error Handling', () => {
      it('should handle invalid JSON from LLM', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: 'Not JSON but has "should_trigger_email":true'
            }
          }]
        } as any);

        const result = await detector.detectEmailIntent(
          'Email them the details.'
        );

        expect(result.should_trigger).toBe(true);
        expect(result.confidence).toBe('low');
      });

      it('should not trigger on error when fallback disabled', async () => {
        process.env.INTENT_DETECTION_FALLBACK = 'none';
        detector = new IntentDetector();

        mockOpenAI.chat.completions.create.mockRejectedValue(
          new Error('API error')
        );

        const result = await detector.detectEmailIntent(
          'Send them an email.'
        );

        expect(result.should_trigger).toBe(false);
        expect(result.method).toBe('llm');
      });
    });
  });

  // ========================================
  // Parallel Detection Tests
  // ========================================

  describe('detectBothIntents', () => {
    it('should detect both calendar and email intents in parallel', async () => {
      // First call for calendar
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_calendar: true,
                confidence: 'high',
                reasoning: 'Recommends calling'
              })
            }
          }]
        } as any)
        // Second call for email
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_email: true,
                confidence: 'high',
                reasoning: 'Recommends emailing'
              })
            }
          }]
        } as any);

      const result = await detector.detectBothIntents(
        'Call them to discuss, then follow up with a written email summarizing your conversation.'
      );

      expect(result.calendar.should_trigger).toBe(true);
      expect(result.email.should_trigger).toBe(true);
      expect(result.calendar.method).toBe('llm');
      expect(result.email.method).toBe('llm');
    });

    it('should detect only calendar intent', async () => {
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_calendar: true,
                confidence: 'high',
                reasoning: 'Recommends calling only'
              })
            }
          }]
        } as any)
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_email: false,
                confidence: 'high',
                reasoning: 'No email recommendation'
              })
            }
          }]
        } as any);

      const result = await detector.detectBothIntents(
        'You should call them to discuss the issue.'
      );

      expect(result.calendar.should_trigger).toBe(true);
      expect(result.email.should_trigger).toBe(false);
    });

    it('should detect only email intent', async () => {
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_calendar: false,
                confidence: 'high',
                reasoning: 'No call recommendation'
              })
            }
          }]
        } as any)
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_email: true,
                confidence: 'high',
                reasoning: 'Recommends emailing'
              })
            }
          }]
        } as any);

      const result = await detector.detectBothIntents(
        'Send them an email documenting the policy violation.'
      );

      expect(result.calendar.should_trigger).toBe(false);
      expect(result.email.should_trigger).toBe(true);
    });

    it('should detect neither intent', async () => {
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_calendar: false,
                confidence: 'high',
                reasoning: 'No call recommendation'
              })
            }
          }]
        } as any)
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                should_trigger_email: false,
                confidence: 'high',
                reasoning: 'No email recommendation'
              })
            }
          }]
        } as any);

      const result = await detector.detectBothIntents(
        'You should document this in your records for future reference.'
      );

      expect(result.calendar.should_trigger).toBe(false);
      expect(result.email.should_trigger).toBe(false);
    });
  });

  // ========================================
  // Configuration Tests
  // ========================================

  describe('Configuration', () => {
    it('should respect INTENT_DETECTION_ENABLED=false', async () => {
      process.env.INTENT_DETECTION_ENABLED = 'false';
      detector = new IntentDetector();

      const result = await detector.detectCalendarIntent(
        'Call them to discuss.'
      );

      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
      expect(result.method).toBe('keyword_fallback');
    });

    it('should use default timeout when not specified', async () => {
      delete process.env.INTENT_DETECTION_TIMEOUT;
      detector = new IntentDetector();

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              should_trigger_calendar: true,
              confidence: 'high',
              reasoning: 'Test'
            })
          }
        }]
      } as any);

      await detector.detectCalendarIntent('Call them.');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 3000 // Default timeout
        })
      );
    });

    it('should use custom timeout when specified', async () => {
      process.env.INTENT_DETECTION_TIMEOUT = '5000';
      detector = new IntentDetector();

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              should_trigger_calendar: true,
              confidence: 'high',
              reasoning: 'Test'
            })
          }
        }]
      } as any);

      await detector.detectCalendarIntent('Call them.');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000
        })
      );
    });

    it('should disable fallback when INTENT_DETECTION_FALLBACK=none', async () => {
      process.env.INTENT_DETECTION_FALLBACK = 'none';
      detector = new IntentDetector();

      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('API error')
      );

      const result = await detector.detectCalendarIntent(
        'Call them to discuss.'
      );

      expect(result.should_trigger).toBe(false);
      expect(result.method).toBe('llm');
      expect(result.reasoning).toContain('fallback disabled');
    });
  });

  // ========================================
  // Logging Tests
  // ========================================

  describe('Logging', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      (console.log as jest.Mock).mockRestore();
      (console.warn as jest.Mock).mockRestore();
    });

    it('should not log when logging=off', async () => {
      process.env.INTENT_DETECTION_LOGGING = 'off';
      detector = new IntentDetector();

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              should_trigger_calendar: true,
              confidence: 'high',
              reasoning: 'Test'
            })
          }
        }]
      } as any);

      await detector.detectCalendarIntent('Call them.');

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should log comparison when logging=verbose', async () => {
      process.env.INTENT_DETECTION_LOGGING = 'verbose';
      detector = new IntentDetector();

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              should_trigger_calendar: true,
              confidence: 'high',
              reasoning: 'Test'
            })
          }
        }]
      } as any);

      await detector.detectCalendarIntent('Call them to discuss.');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('CALENDAR INTENT DETECTION COMPARISON'));
    });

    it('should log only disagreements when logging=minimal', async () => {
      process.env.INTENT_DETECTION_LOGGING = 'minimal';
      detector = new IntentDetector();

      // LLM says true, but keyword says false (disagreement)
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              should_trigger_calendar: true,
              confidence: 'high',
              reasoning: 'Test disagreement'
            })
          }
        }]
      } as any);

      await detector.detectCalendarIntent('The next step is to contact the employee.');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Disagreement'));
    });
  });

  // ========================================
  // Prompt Construction Tests
  // ========================================

  describe('Prompt Construction', () => {
    it('should construct correct calendar prompt', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              should_trigger_calendar: true,
              confidence: 'high',
              reasoning: 'Test'
            })
          }
        }]
      } as any);

      const response = 'Call them to discuss the issue.';
      await detector.detectCalendarIntent(response);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an intent detection system for HR guidance. Respond only with valid JSON.'
          },
          {
            role: 'user',
            content: expect.stringContaining(response)
          }
        ],
        max_tokens: 100,
        temperature: 0,
        timeout: 3000
      });

      const userMessage = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[0][0].messages[1].content;
      expect(userMessage).toContain('should_trigger_calendar');
      expect(userMessage).toContain('DO NOT trigger for');
    });

    it('should construct correct email prompt', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              should_trigger_email: true,
              confidence: 'high',
              reasoning: 'Test'
            })
          }
        }]
      } as any);

      const response = 'Send them an email with the policy.';
      await detector.detectEmailIntent(response);

      const userMessage = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[0][0].messages[1].content;
      expect(userMessage).toContain('should_trigger_email');
      expect(userMessage).toContain('send an email');
      expect(userMessage).toContain('DO NOT trigger for');
    });

    it('should use temperature=0 for deterministic results', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              should_trigger_calendar: true,
              confidence: 'high',
              reasoning: 'Test'
            })
          }
        }]
      } as any);

      await detector.detectCalendarIntent('Call them.');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0
        })
      );
    });
  });

  // ========================================
  // Performance Tests
  // ========================================

  describe('Performance', () => {
    it('should track processing time', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              should_trigger_calendar: true,
              confidence: 'high',
              reasoning: 'Test'
            })
          }
        }]
      } as any);

      const result = await detector.detectCalendarIntent('Call them.');

      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
      expect(result.processing_time_ms).toBeLessThan(5000); // Should be fast
    });

    it('should run parallel detections concurrently', async () => {
      const startTime = Date.now();

      mockOpenAI.chat.completions.create.mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              choices: [{
                message: {
                  content: JSON.stringify({
                    should_trigger_calendar: true,
                    should_trigger_email: true,
                    confidence: 'high',
                    reasoning: 'Test'
                  })
                }
              }]
            } as any);
          }, 50); // 50ms delay per call
        })
      );

      await detector.detectBothIntents('Call and email them.');

      const elapsed = Date.now() - startTime;

      // Should take ~50ms (parallel), not ~100ms (sequential)
      expect(elapsed).toBeLessThan(100);
    });
  });
});
