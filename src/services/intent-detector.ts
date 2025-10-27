/**
 * Intent Detector Service
 *
 * Uses LLM (GPT-4o-mini) to intelligently detect when ERA's responses
 * recommend actions requiring calendar booking or email sending.
 *
 * Replaces keyword-matching with context-aware NLP detection.
 *
 * @see specs/INTENT_DETECTION.md
 * @see specs/INTENT_DETECTION_CALENDAR.md
 * @see specs/INTENT_DETECTION_EMAIL.md
 */

import OpenAI from 'openai';

/**
 * Result from intent detection
 */
export interface IntentDetectionResult {
  should_trigger: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  method: 'llm' | 'keyword_fallback';
  processing_time_ms: number;
}

/**
 * Comparison log between LLM and keyword methods
 */
export interface IntentComparisonLog {
  timestamp: Date;
  conversation_id?: string;
  intent_type: 'calendar' | 'email';
  response: string;
  keyword_result: boolean;
  keyword_matches: string[];
  keyword_time_ms: number;
  llm_result: boolean;
  llm_confidence?: 'high' | 'medium' | 'low';
  llm_reasoning?: string;
  llm_time_ms: number;
  agreement: boolean;
  final_decision: boolean;
  error?: string;
}

/**
 * Configuration for Intent Detector
 */
interface IntentDetectorConfig {
  enabled: boolean;
  logging: 'verbose' | 'minimal' | 'off';
  timeout_ms: number;
  use_fallback: boolean;
}

/**
 * Intent Detector Service
 *
 * Detects calendar and email intents using LLM with keyword fallback
 */
export class IntentDetector {
  private openai: OpenAI;
  private config: IntentDetectorConfig;

  // Keyword lists for fallback detection
  private calendarKeywords = [
    'schedule a call',
    'schedule that call',
    'schedule the call',
    'call the employee',
    'call your employee',
    'call them',
    'phone call',
    'schedule a meeting',
    'set up a call',
    'arrange a call',
    'would you like me to schedule',
    'i can schedule',
    'check your calendar',
    'find available times',
    'you should call',
    'you need to call',
    'make a second call',
    'schedule that',
    'reach out to them',
    'reach out to your employee',
    'contact them',
    'contact your employee',
    'give them a call',
    'try calling',
    'next step is to call',
    'reach them',
    'get in touch with them',
  ];

  private emailKeywords = [
    'send an email',
    'send them an email',
    'email them',
    'email the employee',
    'draft an email',
    'draft a message',
    'follow up in writing',
    'send written notice',
    'written documentation',
    'document via email',
    'put it in writing',
    'send a written',
    'here\'s an email template',
    'want me to draft',
    'i can help you write',
    'would you like me to draft',
    'follow up with an email',
    'then email them',
    'send an email summary',
    'email after the call',
    'shoot them an email',
    'send them written',
    'email documenting',
    'email to confirm',
    'email outlining',
  ];

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.config = {
      enabled: process.env.INTENT_DETECTION_ENABLED === 'true',
      logging: (process.env.INTENT_DETECTION_LOGGING as any) || 'verbose',
      timeout_ms: parseInt(process.env.INTENT_DETECTION_TIMEOUT || '3000'),
      use_fallback: process.env.INTENT_DETECTION_FALLBACK !== 'none'
    };
  }

  /**
   * Detect calendar booking intent (parallel with keyword comparison)
   */
  async detectCalendarIntent(
    response: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<IntentDetectionResult> {
    // If LLM detection is disabled, use keyword only
    if (!this.config.enabled) {
      return this.detectCalendarIntentWithKeywords(response);
    }

    // Run LLM and keyword detection in parallel for comparison
    const startTime = Date.now();
    const keywordStart = Date.now();
    const keywordResult = this.detectWithKeywords(response, this.calendarKeywords);
    const keywordTime = Date.now() - keywordStart;

    try {
      const llmStart = Date.now();
      const llmResult = await this.detectCalendarIntentWithLLM(response);
      const llmTime = Date.now() - llmStart;

      // Log comparison if enabled
      if (this.config.logging !== 'off') {
        this.logComparison({
          timestamp: new Date(),
          intent_type: 'calendar',
          response,
          keyword_result: keywordResult.detected,
          keyword_matches: keywordResult.matches,
          keyword_time_ms: keywordTime,
          llm_result: llmResult.should_trigger,
          llm_confidence: llmResult.confidence,
          llm_reasoning: llmResult.reasoning,
          llm_time_ms: llmTime,
          agreement: keywordResult.detected === llmResult.should_trigger,
          final_decision: llmResult.should_trigger
        });
      }

      return {
        should_trigger: llmResult.should_trigger,
        confidence: llmResult.confidence,
        reasoning: llmResult.reasoning,
        method: 'llm',
        processing_time_ms: Date.now() - startTime
      };

    } catch (error: any) {
      console.warn(`⚠️ Calendar intent LLM detection failed: ${error.message}`);

      if (this.config.use_fallback) {
        console.log(`   Fallback: Using keyword detection`);
        console.log(`   Keyword Result: ${keywordResult.detected} (matches: ${keywordResult.matches.join(', ') || 'none'})`);

        return {
          should_trigger: keywordResult.detected,
          confidence: 'low',
          reasoning: `Fallback to keyword detection due to LLM error: ${error.message}`,
          method: 'keyword_fallback',
          processing_time_ms: Date.now() - startTime
        };
      } else {
        // No fallback - don't trigger on error
        return {
          should_trigger: false,
          confidence: 'low',
          reasoning: `LLM detection failed and fallback disabled: ${error.message}`,
          method: 'llm',
          processing_time_ms: Date.now() - startTime
        };
      }
    }
  }

  /**
   * Detect email sending intent (parallel with keyword comparison)
   */
  async detectEmailIntent(
    response: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<IntentDetectionResult> {
    // If LLM detection is disabled, use keyword only
    if (!this.config.enabled) {
      return this.detectEmailIntentWithKeywords(response);
    }

    // Run LLM and keyword detection in parallel for comparison
    const startTime = Date.now();
    const keywordStart = Date.now();
    const keywordResult = this.detectWithKeywords(response, this.emailKeywords);
    const keywordTime = Date.now() - keywordStart;

    try {
      const llmStart = Date.now();
      const llmResult = await this.detectEmailIntentWithLLM(response);
      const llmTime = Date.now() - llmStart;

      // Log comparison if enabled
      if (this.config.logging !== 'off') {
        this.logComparison({
          timestamp: new Date(),
          intent_type: 'email',
          response,
          keyword_result: keywordResult.detected,
          keyword_matches: keywordResult.matches,
          keyword_time_ms: keywordTime,
          llm_result: llmResult.should_trigger,
          llm_confidence: llmResult.confidence,
          llm_reasoning: llmResult.reasoning,
          llm_time_ms: llmTime,
          agreement: keywordResult.detected === llmResult.should_trigger,
          final_decision: llmResult.should_trigger
        });
      }

      return {
        should_trigger: llmResult.should_trigger,
        confidence: llmResult.confidence,
        reasoning: llmResult.reasoning,
        method: 'llm',
        processing_time_ms: Date.now() - startTime
      };

    } catch (error: any) {
      console.warn(`⚠️ Email intent LLM detection failed: ${error.message}`);

      if (this.config.use_fallback) {
        console.log(`   Fallback: Using keyword detection`);
        console.log(`   Keyword Result: ${keywordResult.detected} (matches: ${keywordResult.matches.join(', ') || 'none'})`);

        return {
          should_trigger: keywordResult.detected,
          confidence: 'low',
          reasoning: `Fallback to keyword detection due to LLM error: ${error.message}`,
          method: 'keyword_fallback',
          processing_time_ms: Date.now() - startTime
        };
      } else {
        // No fallback - don't trigger on error
        return {
          should_trigger: false,
          confidence: 'low',
          reasoning: `LLM detection failed and fallback disabled: ${error.message}`,
          method: 'llm',
          processing_time_ms: Date.now() - startTime
        };
      }
    }
  }

  /**
   * Detect both calendar and email intents in parallel
   */
  async detectBothIntents(
    response: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{ calendar: IntentDetectionResult; email: IntentDetectionResult }> {
    const [calendar, email] = await Promise.all([
      this.detectCalendarIntent(response, conversationHistory),
      this.detectEmailIntent(response, conversationHistory)
    ]);

    return { calendar, email };
  }

  /**
   * Detect calendar intent using LLM (GPT-4o-mini)
   */
  private async detectCalendarIntentWithLLM(response: string): Promise<{
    should_trigger: boolean;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  }> {
    const prompt = `Analyze if this HR guidance recommends that the manager should call or contact the employee directly.

Response: "${response}"

Consider as TRIGGERS:
- Direct recommendations: "call them", "reach out to them", "contact the employee"
- Indirect suggestions: "try contacting", "get in touch", "give them a call"
- Next steps: "the next step is to call", "you should call"
- Action guidance: "reach out by phone", "schedule a call"

DO NOT trigger for:
- Employee calling IN: "wait for them to call you back"
- Past tense: "you called them yesterday"
- Hypotheticals: "if you call them" (without recommendation)
- Negative: "don't call them yet"
- Questions about calling: "have you tried calling?"

Answer in JSON:
{
  "should_trigger_calendar": true/false,
  "confidence": "high/medium/low",
  "reasoning": "brief explanation in one sentence"
}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an intent detection system for HR guidance. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 100,
      temperature: 0, // Deterministic for consistent results
    }, {
      timeout: this.config.timeout_ms
    });

    const result = completion.choices[0].message.content || '{}';

    // Parse JSON response
    try {
      const parsed = JSON.parse(result);
      return {
        should_trigger: parsed.should_trigger_calendar === true,
        confidence: parsed.confidence || 'medium',
        reasoning: parsed.reasoning || 'No reasoning provided'
      };
    } catch (error) {
      // Try to extract boolean from non-JSON response
      const lowerResult = result.toLowerCase();
      if (lowerResult.includes('true') || lowerResult.includes('"should_trigger_calendar":true')) {
        return {
          should_trigger: true,
          confidence: 'low',
          reasoning: 'Parsed from non-JSON response'
        };
      } else {
        return {
          should_trigger: false,
          confidence: 'low',
          reasoning: 'Could not parse JSON response'
        };
      }
    }
  }

  /**
   * Detect email intent using LLM (GPT-4o-mini)
   */
  private async detectEmailIntentWithLLM(response: string): Promise<{
    should_trigger: boolean;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  }> {
    const prompt = `Analyze if this HR guidance recommends that the manager should send an email or written documentation to the employee.

Response: "${response}"

Consider as TRIGGERS:
- Direct recommendations: "send an email", "email them", "draft a message"
- Documentation: "follow up in writing", "send written notice", "document via email"
- Templates offered: "here's an email template", "want me to draft"
- Next steps: "then email them", "follow up with email", "send them an email"
- Written communication: "put it in writing", "written documentation"

DO NOT trigger for:
- Receiving emails: "wait for their email response"
- Email as contact: "their email is john@company.com"
- Past tense: "you already emailed them"
- Email mentions only: "email is one way to reach them"
- Questions: "have you sent an email?"
- Negatives: "don't email them yet"

Answer in JSON:
{
  "should_trigger_email": true/false,
  "confidence": "high/medium/low",
  "reasoning": "brief explanation in one sentence"
}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an intent detection system for HR guidance. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 100,
      temperature: 0, // Deterministic for consistent results
    }, {
      timeout: this.config.timeout_ms
    });

    const result = completion.choices[0].message.content || '{}';

    // Parse JSON response
    try {
      const parsed = JSON.parse(result);
      return {
        should_trigger: parsed.should_trigger_email === true,
        confidence: parsed.confidence || 'medium',
        reasoning: parsed.reasoning || 'No reasoning provided'
      };
    } catch (error) {
      // Try to extract boolean from non-JSON response
      const lowerResult = result.toLowerCase();
      if (lowerResult.includes('true') || lowerResult.includes('"should_trigger_email":true')) {
        return {
          should_trigger: true,
          confidence: 'low',
          reasoning: 'Parsed from non-JSON response'
        };
      } else {
        return {
          should_trigger: false,
          confidence: 'low',
          reasoning: 'Could not parse JSON response'
        };
      }
    }
  }

  /**
   * Detect intent using keyword matching (fallback method)
   */
  private detectWithKeywords(response: string, keywords: string[]): {
    detected: boolean;
    matches: string[];
  } {
    const lowerResponse = response.toLowerCase();
    const matches = keywords.filter(keyword => lowerResponse.includes(keyword));

    return {
      detected: matches.length > 0,
      matches
    };
  }

  /**
   * Calendar detection with keywords only (when LLM disabled)
   */
  private detectCalendarIntentWithKeywords(response: string): IntentDetectionResult {
    const startTime = Date.now();
    const result = this.detectWithKeywords(response, this.calendarKeywords);

    return {
      should_trigger: result.detected,
      confidence: result.detected ? 'medium' : 'low',
      reasoning: result.detected
        ? `Keyword matches: ${result.matches.join(', ')}`
        : 'No keyword matches found',
      method: 'keyword_fallback',
      processing_time_ms: Date.now() - startTime
    };
  }

  /**
   * Email detection with keywords only (when LLM disabled)
   */
  private detectEmailIntentWithKeywords(response: string): IntentDetectionResult {
    const startTime = Date.now();
    const result = this.detectWithKeywords(response, this.emailKeywords);

    return {
      should_trigger: result.detected,
      confidence: result.detected ? 'medium' : 'low',
      reasoning: result.detected
        ? `Keyword matches: ${result.matches.join(', ')}`
        : 'No keyword matches found',
      method: 'keyword_fallback',
      processing_time_ms: Date.now() - startTime
    };
  }

  /**
   * Log comparison between LLM and keyword methods
   */
  private logComparison(log: IntentComparisonLog): void {
    if (this.config.logging === 'off') return;

    const type = log.intent_type.toUpperCase();
    const agreement = log.agreement ? '✅ AGREEMENT' : '⚠️ DISAGREEMENT';
    const keywordResult = log.keyword_result ? '✅ TRUE' : '❌ FALSE';
    const llmResult = log.llm_result ? '✅ TRUE' : '❌ FALSE';
    const finalDecision = log.final_decision ? '✅ TRIGGER' : '❌ NO TRIGGER';

    if (this.config.logging === 'verbose') {
      console.log('═'.repeat(63));
      console.log(`📊 ${type} INTENT DETECTION COMPARISON`);
      console.log('═'.repeat(63));
      if (log.conversation_id) {
        console.log(`Conversation ID: ${log.conversation_id}`);
      }
      console.log(`Response: "${log.response.substring(0, 100)}${log.response.length > 100 ? '...' : ''}"`);
      console.log('─'.repeat(63));
      console.log('Keyword Detection:');
      console.log(`  Result: ${keywordResult}`);
      console.log(`  Matches: ${log.keyword_matches.length > 0 ? log.keyword_matches.join(', ') : 'none'}`);
      console.log(`  Time: ${log.keyword_time_ms}ms`);
      console.log('─'.repeat(63));
      console.log('LLM Detection (GPT-4o-mini):');
      console.log(`  Result: ${llmResult}`);
      if (log.llm_confidence) {
        console.log(`  Confidence: ${log.llm_confidence.toUpperCase()}`);
      }
      if (log.llm_reasoning) {
        console.log(`  Reasoning: "${log.llm_reasoning}"`);
      }
      console.log(`  Time: ${log.llm_time_ms}ms`);
      console.log('─'.repeat(63));
      console.log(`Agreement: ${agreement}`);
      console.log(`Final Decision: ${finalDecision}`);
      console.log('═'.repeat(63));
      console.log('');
    } else if (this.config.logging === 'minimal') {
      // Only log disagreements
      if (!log.agreement) {
        console.log(`⚠️ ${type} Intent Disagreement: Keyword=${keywordResult}, LLM=${llmResult} → Decision: ${finalDecision}`);
      }
    }
  }
}

// Export singleton instance
export const intentDetector = new IntentDetector();
