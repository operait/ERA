/**
 * Metrics Framework Tests
 *
 * Tests for objective and subjective metrics evaluation.
 * Based on: specs/METRICS_FRAMEWORK.md
 */

import { ResponseEvaluator, ResponseMetrics } from '../evaluator';
import { SearchContext } from '../../retrieval/search';

describe('Metrics Framework', () => {
  let evaluator: ResponseEvaluator;

  beforeAll(() => {
    evaluator = new ResponseEvaluator();
  });

  // Sample search context for testing
  const sampleSearchContext: SearchContext = {
    results: [
      {
        chunk_id: 'chunk-1',
        document_id: 'doc-1',
        document_title: 'No Show Policy',
        document_category: 'attendance',
        chunk_text: 'Employees who fail to show up for three consecutive shifts without calling may be considered to have voluntarily resigned.',
        chunk_index: 0,
        similarity: 0.89,
        metadata: {}
      },
      {
        chunk_id: 'chunk-2',
        document_id: 'doc-2',
        document_title: 'Attendance Policy',
        document_category: 'attendance',
        chunk_text: 'Regular attendance is expected. Unexcused absences are subject to progressive discipline.',
        chunk_index: 0,
        similarity: 0.82,
        metadata: {}
      }
    ],
    query: 'employee missed 3 shifts',
    totalResults: 2,
    avgSimilarity: 0.855,
    categories: ['attendance'],
    retrievalTimeMs: 150
  };

  describe('Objective Metrics', () => {
    describe('has_policy_citation', () => {
      test('detects policy citations', () => {
        const response1 = 'Per our No Call No Show policy, employees who miss three shifts...';
        const response2 = 'According to the Attendance Policy, managers should...';
        const response3 = 'Our policy states that...';

        expect(evaluator.hasPolicyCitation(response1)).toBe(true);
        expect(evaluator.hasPolicyCitation(response2)).toBe(true);
        expect(evaluator.hasPolicyCitation(response3)).toBe(true);
      });

      test('returns false when no citation', () => {
        const response = 'You should call the employee and document the absence.';
        expect(evaluator.hasPolicyCitation(response)).toBe(false);
      });

      test('is case insensitive', () => {
        const response = 'PER OUR POLICY, employees must...';
        expect(evaluator.hasPolicyCitation(response)).toBe(true);
      });
    });

    describe('appropriate_action_suggested', () => {
      test('detects action suggestions', () => {
        const responseEmail = 'I recommend you send an email to document this.';
        const responseCall = 'You should call the employee to discuss this situation.';
        const responseCalendar = 'Would you like me to schedule a call on your calendar?';
        const responseEscalate = 'This should be escalated to HR immediately.';

        expect(evaluator.hasAppropriateAction(responseEmail)).toBe(true);
        expect(evaluator.hasAppropriateAction(responseCall)).toBe(true);
        expect(evaluator.hasAppropriateAction(responseCalendar)).toBe(true);
        expect(evaluator.hasAppropriateAction(responseEscalate)).toBe(true);
      });

      test('returns false when no action suggested', () => {
        const response = 'That\'s a tough situation.';
        expect(evaluator.hasAppropriateAction(response)).toBe(false);
      });
    });

    describe('response_structure_complete', () => {
      test('validates complete structure', () => {
        const completeResponse = `Got it — that's definitely something we need to address.

Here's what to do next:
1. Call the employee
2. Document the conversation
3. Escalate to HR if needed

Would you like me to help with the next step?`;

        expect(evaluator.hasCompleteStructure(completeResponse)).toBe(true);
      });

      test('detects missing acknowledgment', () => {
        const noAcknowledgment = `Here are the steps:
1. Call the employee
2. Document everything`;

        expect(evaluator.hasCompleteStructure(noAcknowledgment)).toBe(false);
      });

      test('detects missing next steps', () => {
        const noNextSteps = 'Got it, that sounds like a difficult situation.';

        expect(evaluator.hasCompleteStructure(noNextSteps)).toBe(false);
      });

      test('accepts various acknowledgment formats', () => {
        const responses = [
          'Got it — here\'s what to do...\n1. Call\n2. Document',
          'Thanks for sharing that. Here are the steps...\n1. Contact\n2. Log',
          'Okay, let me help you with this.\n1. First step\n2. Second step',
          'I understand. Next steps:\n1. Action\n2. Follow-up'
        ];

        responses.forEach(response => {
          expect(evaluator.hasCompleteStructure(response)).toBe(true);
        });
      });
    });

    describe('asks_clarifying_questions', () => {
      test('detects clarifying questions for ACTIVE situations', () => {
        const query = 'My employee didn\'t show up for 3 days';
        const response = `Got it — that's a serious situation.

Just to make sure I have the full picture:
- Have you tried reaching out to them?
- Were these consecutive days?`;

        const result = evaluator.asksClarifyingQuestions(query, response, true);
        expect(result).toBe(true);
      });

      test('returns false if response provides guidance with questions', () => {
        const query = 'My employee didn\'t show up';
        const response = `Here's what to do:
1. Call the employee
2. Document everything

Have you tried calling them yet?`;

        const result = evaluator.asksClarifyingQuestions(query, response, true);
        expect(result).toBe(false); // Provides guidance before asking
      });

      test('returns null for hypothetical questions', () => {
        const query = 'What should I do if an employee doesn\'t show up?';
        const response = 'Here are the steps you should follow...';

        const result = evaluator.asksClarifyingQuestions(query, response, true);
        expect(result).toBeNull(); // Not applicable for hypothetical
      });

      test('returns null for non-first responses', () => {
        const query = 'My employee didn\'t show up';
        const response = 'Based on your answer, here\'s what to do...';

        const result = evaluator.asksClarifyingQuestions(query, response, false);
        expect(result).toBeNull(); // Not first response
      });

      test('detects ACTIVE situations correctly', () => {
        const activeQueries = [
          'My employee didn\'t show up',
          'Our team member is late',
          'John hasn\'t called in'
        ];

        const hypotheticalQueries = [
          'What if an employee doesn\'t show up?',
          'How do I handle someone who is late?',
          'What should I do if employees miss shifts?'
        ];

        activeQueries.forEach(query => {
          expect(evaluator.isActiveSituation(query)).toBe(true);
        });

        hypotheticalQueries.forEach(query => {
          expect(evaluator.isActiveSituation(query)).toBe(false);
        });
      });
    });

    describe('sequential_action_correct', () => {
      test('passes when only call is offered', () => {
        const response = 'You should call the employee to discuss this. Would you like me to schedule that call?';
        expect(evaluator.sequentialActionCorrect(response)).toBe(true);
      });

      test('passes when only email is offered', () => {
        const response = 'Would you like me to help draft an email to HR about this?';
        expect(evaluator.sequentialActionCorrect(response)).toBe(true);
      });

      test('fails when both call and email are offered together', () => {
        const response = 'You should call the employee. Would you also like me to draft a follow-up email?';
        expect(evaluator.sequentialActionCorrect(response)).toBe(false);
      });

      test('passes when neither is offered', () => {
        const response = 'You should document this incident carefully.';
        expect(evaluator.sequentialActionCorrect(response)).toBe(true);
      });
    });

    describe('response_length_appropriate', () => {
      test('passes for 100-500 word responses', () => {
        const words100 = 'word '.repeat(100).trim();
        const words300 = 'word '.repeat(300).trim();
        const words500 = 'word '.repeat(500).trim();

        expect(evaluator.responseLengthAppropriate(words100)).toBe(true);
        expect(evaluator.responseLengthAppropriate(words300)).toBe(true);
        expect(evaluator.responseLengthAppropriate(words500)).toBe(true);
      });

      test('fails for too short responses', () => {
        const words50 = 'word '.repeat(50).trim();
        expect(evaluator.responseLengthAppropriate(words50)).toBe(false);
      });

      test('fails for too long responses', () => {
        const words600 = 'word '.repeat(600).trim();
        expect(evaluator.responseLengthAppropriate(words600)).toBe(false);
      });
    });

    describe('rag_similarity_score', () => {
      test('returns average similarity from search context', () => {
        const score = evaluator.ragSimilarityScore(sampleSearchContext);
        expect(score).toBeCloseTo(0.855, 3);
      });

      test('handles empty search results', () => {
        const emptyContext: SearchContext = {
          ...sampleSearchContext,
          results: [],
          avgSimilarity: 0
        };
        const score = evaluator.ragSimilarityScore(emptyContext);
        expect(score).toBe(0);
      });
    });

    describe('processing_time_acceptable', () => {
      test('passes for < 3000ms', () => {
        expect(evaluator.processingTimeAcceptable(1000)).toBe(true);
        expect(evaluator.processingTimeAcceptable(2999)).toBe(true);
      });

      test('fails for >= 3000ms', () => {
        expect(evaluator.processingTimeAcceptable(3000)).toBe(false);
        expect(evaluator.processingTimeAcceptable(5000)).toBe(false);
      });
    });
  });

  describe('Composite Scoring', () => {
    test('calculates objective quality score', () => {
      const metrics: Partial<ResponseMetrics> = {
        has_policy_citation: true,            // 1
        appropriate_action_suggested: true,   // 1
        response_structure_complete: true,    // 1
        response_length_appropriate: true,    // 1
        sequential_action_correct: true,      // 1
        asks_clarifying_questions: true,      // 1
        processing_time_acceptable: true,     // 1
        rag_similarity_score: 0.85,           // 0.85
        citation_accuracy: 0.9                // 0.9
      };

      const score = evaluator.calculateObjectiveScore(metrics as ResponseMetrics);

      // Average: (1 + 1 + 1 + 1 + 1 + 1 + 1 + 0.85 + 0.9) / 9 = 0.972
      expect(score).toBeCloseTo(0.972, 2);
    });

    test('calculates subjective quality score', () => {
      const metrics: Partial<ResponseMetrics> = {
        professionalism_score: 5,
        empathy_score: 4,
        clarity_score: 5,
        actionability_score: 4,
        compliance_score: 5
      };

      const score = evaluator.calculateSubjectiveScore(metrics as ResponseMetrics);

      // Average: (5 + 4 + 5 + 4 + 5) / 5 / 5 = 23 / 25 = 0.92
      expect(score).toBeCloseTo(0.92, 2);
    });

    test('calculates overall quality score with weighting', () => {
      const metrics: Partial<ResponseMetrics> = {
        objective_quality_score: 0.9,
        subjective_quality_score: 0.85
      };

      const score = evaluator.calculateOverallScore(metrics as ResponseMetrics);

      // Weighted: (0.9 * 0.4) + (0.85 * 0.6) = 0.36 + 0.51 = 0.87
      expect(score).toBeCloseTo(0.87, 2);
    });

    test('handles missing subjective scores gracefully', () => {
      const metrics: Partial<ResponseMetrics> = {
        has_policy_citation: true,
        appropriate_action_suggested: true,
        response_structure_complete: true
        // No subjective scores
      };

      const objectiveScore = evaluator.calculateObjectiveScore(metrics as ResponseMetrics);
      expect(objectiveScore).toBeGreaterThan(0);

      const subjectiveScore = evaluator.calculateSubjectiveScore(metrics as ResponseMetrics);
      expect(subjectiveScore).toBeUndefined();
    });

    test('ignores N/A (null) metrics in averages', () => {
      const metrics: Partial<ResponseMetrics> = {
        has_policy_citation: true,           // 1
        appropriate_action_suggested: true,  // 1
        asks_clarifying_questions: null,     // N/A - should be ignored
        response_structure_complete: true    // 1
      };

      // Should average only non-null values: (1 + 1 + 1) / 3 = 1.0
      const score = evaluator.calculateObjectiveScore(metrics as ResponseMetrics);
      expect(score).toBeCloseTo(1.0, 1);
    });
  });

  describe('Full Evaluation', () => {
    test('evaluates complete response with all metrics', () => {
      const query = 'My employee didn\'t show up for 3 days';
      const response = `Got it — that's definitely something we need to address right away.

Per our No Call No Show policy, when an employee fails to show up for multiple consecutive shifts without notification, this is considered a serious attendance violation. Here's what you should do to handle this situation properly:

1. **Call the employee immediately** to determine the situation. Try to reach them by phone first before taking further action. They may have experienced an emergency or personal crisis that prevented them from calling in.

2. **Document all contact attempts** including dates, times, and methods used (phone, text, email). Keep detailed records of every attempt to reach the employee as this documentation may be important later.

3. **If no response after 3 business days**, this may be considered job abandonment and should be escalated to HR immediately. HR will guide you through the next steps of the termination process if needed.

Would you like me to help schedule that call with the employee on your calendar?`;

      const metrics = evaluator.evaluate(
        query,
        response,
        sampleSearchContext,
        1234,
        true // is first response
      );

      // Verify objective metrics
      expect(metrics.has_policy_citation).toBe(true);
      expect(metrics.appropriate_action_suggested).toBe(true);
      expect(metrics.response_structure_complete).toBe(true);
      expect(metrics.response_length_appropriate).toBe(true);
      expect(metrics.sequential_action_correct).toBe(true);
      expect(metrics.asks_clarifying_questions).toBe(false); // Provides guidance, not questions
      expect(metrics.processing_time_acceptable).toBe(true);
      expect(metrics.rag_similarity_score).toBeCloseTo(0.855, 3);

      // Verify objective score calculated
      expect(metrics.objective_quality_score).toBeGreaterThan(0.8);
    });

    test('evaluates response asking clarifying questions', () => {
      const query = 'My employee didn\'t show up';
      const response = `Got it — that's a serious attendance issue.

Just to make sure I have the full picture:
- Have you tried reaching out to them yet?
- Were these consecutive shifts?`;

      const metrics = evaluator.evaluate(
        query,
        response,
        sampleSearchContext,
        800,
        true // is first response
      );

      expect(metrics.asks_clarifying_questions).toBe(true);
      expect(metrics.response_structure_complete).toBe(true);
      expect(metrics.has_policy_citation).toBe(false); // No citation in clarifying response
    });

    test('evaluates hypothetical policy question', () => {
      const query = 'What should I do if an employee doesn\'t show up for 3 days?';
      const response = `Good question — let me walk you through the process.

According to our attendance policy:
1. First, attempt to contact the employee
2. Document all contact attempts
3. If no response after 3 days, it may be considered job abandonment

This is outlined in our No Call No Show policy.`;

      const metrics = evaluator.evaluate(
        query,
        response,
        sampleSearchContext,
        1100,
        true
      );

      expect(metrics.asks_clarifying_questions).toBeNull(); // N/A for hypothetical
      expect(metrics.has_policy_citation).toBe(true);
      expect(metrics.response_structure_complete).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('handles very short response', () => {
      const response = 'Call them.';
      const metrics = evaluator.evaluate(
        'What should I do?',
        response,
        sampleSearchContext,
        500,
        false
      );

      expect(metrics.response_length_appropriate).toBe(false);
      expect(metrics.response_structure_complete).toBe(false);
      expect(metrics.objective_quality_score).toBeLessThan(0.5);
    });

    test('handles response with special characters', () => {
      const response = `Got it — let's handle this! 🎯

Here's what to do:
1. Call the employee (ASAP!)
2. Document everything — dates, times, etc.
3. Email HR if needed

Questions?`;

      const metrics = evaluator.evaluate(
        'My employee is late',
        response,
        sampleSearchContext,
        900,
        false
      );

      expect(metrics.appropriate_action_suggested).toBe(true);
      expect(metrics.response_structure_complete).toBe(true);
    });

    test('handles empty search context', () => {
      const emptyContext: SearchContext = {
        results: [],
        query: 'test query',
        totalResults: 0,
        avgSimilarity: 0,
        categories: [],
        retrievalTimeMs: 50
      };

      const metrics = evaluator.evaluate(
        'Test query',
        'Test response',
        emptyContext,
        1000,
        false
      );

      expect(metrics.rag_similarity_score).toBe(0);
    });
  });
});
