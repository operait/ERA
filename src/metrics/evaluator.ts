/**
 * Response Metrics Evaluator
 *
 * Evaluates ERA responses using objective and subjective metrics.
 * Based on: specs/METRICS_FRAMEWORK.md
 */

import { SearchContext } from '../retrieval/search';

export interface ResponseMetrics {
  // Objective metrics (automated)
  has_policy_citation: boolean;
  appropriate_action_suggested: boolean;
  response_structure_complete: boolean;
  citation_accuracy: number;
  response_length_appropriate: boolean;
  asks_clarifying_questions: boolean | null; // null = N/A
  sequential_action_correct: boolean;
  rag_similarity_score: number;
  processing_time_acceptable: boolean;

  // Calculated objective score
  objective_quality_score: number;

  // Subjective metrics (set by human scorer)
  professionalism_score?: number; // 1-5
  empathy_score?: number; // 1-5
  clarity_score?: number; // 1-5
  actionability_score?: number; // 1-5
  compliance_score?: number; // 1-5

  // Calculated subjective score
  subjective_quality_score?: number;

  // Overall composite score
  overall_quality_score?: number;
}

export class ResponseEvaluator {
  /**
   * Evaluate a complete response with all metrics
   */
  evaluate(
    query: string,
    response: string,
    searchContext: SearchContext,
    processingTimeMs: number,
    isFirstResponse: boolean
  ): ResponseMetrics {
    // Calculate all objective metrics
    const metrics: ResponseMetrics = {
      has_policy_citation: this.hasPolicyCitation(response),
      appropriate_action_suggested: this.hasAppropriateAction(response),
      response_structure_complete: this.hasCompleteStructure(response),
      citation_accuracy: this.citationAccuracy(response, searchContext),
      response_length_appropriate: this.responseLengthAppropriate(response),
      asks_clarifying_questions: this.asksClarifyingQuestions(query, response, isFirstResponse),
      sequential_action_correct: this.sequentialActionCorrect(response),
      rag_similarity_score: this.ragSimilarityScore(searchContext),
      processing_time_acceptable: this.processingTimeAcceptable(processingTimeMs),
      objective_quality_score: 0 // Will be calculated below
    };

    // Calculate objective quality score
    metrics.objective_quality_score = this.calculateObjectiveScore(metrics);

    return metrics;
  }

  /**
   * Check if response cites a policy
   */
  hasPolicyCitation(response: string): boolean {
    const citationPatterns = [
      /policy:/i,
      /per our.*policy/i,
      /according to.*policy/i,
      /fitness connection policy/i,
      /our.*policy/i,
      /policy states/i,
      /\[policy reference:/i
    ];

    return citationPatterns.some(pattern => pattern.test(response));
  }

  /**
   * Check if response suggests appropriate action
   */
  hasAppropriateAction(response: string): boolean {
    const actionKeywords = {
      email: /email|send.*message|written communication/i,
      call: /call|phone|speak.*directly|contact.*employee/i,
      calendar: /schedule|calendar|book.*call|set up.*meeting/i,
      escalate: /escalate|contact hr|reach out.*hr/i,
      document: /document|record|log|track/i
    };

    // At least one action keyword should be present
    return Object.values(actionKeywords).some(pattern => pattern.test(response));
  }

  /**
   * Check if response has complete structure (acknowledgment + guidance + next steps)
   */
  hasCompleteStructure(response: string): boolean {
    // Check for acknowledgment (first ~100 chars should have one)
    const acknowledgmentPatterns = [
      /^(got it|thanks|okay|i understand|that's|this is)/i,
      /^hi\s+\w+|^hello\s+\w+/i,
      /^(good|let|perfect|great)/i
    ];

    const hasAcknowledgment = acknowledgmentPatterns.some(pattern =>
      pattern.test(response.substring(0, 100))
    );

    // Check for next steps (should have actionable language or lists)
    const nextStepPatterns = [
      /next step/i,
      /here's what/i,
      /here are/i,
      /would you like/i,
      /\d+\.\s/, // Numbered lists
      /^[\s]*-\s/m // Bullet points
    ];

    const hasNextSteps = nextStepPatterns.some(pattern => pattern.test(response));

    // Check for guidance content (substantive length OR has lists)
    const hasList = /\d+\.\s/.test(response) || /^[\s]*-\s/m.test(response);
    const hasGuidance = response.length > 100 || hasList;

    return hasAcknowledgment && hasGuidance && hasNextSteps;
  }

  /**
   * Measure citation accuracy (0-1)
   * Simple implementation: checks if response contains text from search results
   */
  citationAccuracy(response: string, searchContext: SearchContext): number {
    if (searchContext.results.length === 0) {
      return 0;
    }

    // Find the best match between response and policy chunks
    let maxSimilarity = 0;

    for (const result of searchContext.results) {
      const chunkText = result.chunk_text.toLowerCase();
      const responseText = response.toLowerCase();

      // Simple word overlap similarity
      const chunkWords = new Set(chunkText.split(/\s+/));
      const responseWords = responseText.split(/\s+/);

      const overlap = responseWords.filter(word => chunkWords.has(word)).length;
      const similarity = overlap / Math.min(chunkWords.size, responseWords.length);

      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
  }

  /**
   * Check if response asks clarifying questions for ACTIVE situations
   */
  asksClarifyingQuestions(
    query: string,
    response: string,
    isFirstResponse: boolean
  ): boolean | null {
    // Only applicable for ACTIVE situations and first responses
    const isActive = this.isActiveSituation(query);
    if (!isActive || !isFirstResponse) {
      return null; // N/A
    }

    // Check if response asks questions
    const questionCount = (response.match(/\?/g) || []).length;
    const hasClarifyingQuestion = questionCount >= 1;

    // Check if response ALSO provides guidance (should NOT for clarifying questions)
    const providesGuidance = /immediate steps|here's what|next steps/i.test(response);

    // Should ask questions WITHOUT providing guidance yet
    return hasClarifyingQuestion && !providesGuidance;
  }

  /**
   * Check if query represents an ACTIVE situation (my, our, specific name)
   */
  isActiveSituation(query: string): boolean {
    // Contains possessive pronouns
    if (/\b(my|our)\b/i.test(query)) {
      return true;
    }

    // Contains proper name (capitalized word that isn't a common word)
    const words = query.split(/\s+/);
    const commonWords = new Set([
      'I', 'The', 'A', 'An', 'What', 'How', 'When', 'Where', 'Why',
      'Who', 'Which', 'Should', 'Can', 'Could', 'Would', 'Do', 'Does',
      'Is', 'Are', 'Policy', 'Fitness', 'Connection'
    ]);

    for (const word of words) {
      // Check if word starts with capital letter and isn't a common word
      if (
        word.length > 0 &&
        /^[A-Z]/.test(word) && // Starts with uppercase letter
        !commonWords.has(word)
      ) {
        return true; // Likely a name
      }
    }

    return false;
  }

  /**
   * Check if response offers ONE action at a time (not call + email together)
   */
  sequentialActionCorrect(response: string): boolean {
    const hasCallOffer = /call|phone|speak.*directly/i.test(response);
    const hasEmailOffer = /draft.*email|help.*email|send.*email/i.test(response);

    // If both are offered in same response, it's WRONG (should be sequential)
    if (hasCallOffer && hasEmailOffer) {
      return false;
    }

    // If only one is offered (or neither), it's correct
    return true;
  }

  /**
   * Check if response length is appropriate (100-500 words)
   */
  responseLengthAppropriate(response: string): boolean {
    const wordCount = response.split(/\s+/).length;
    return wordCount >= 100 && wordCount <= 500;
  }

  /**
   * Get RAG similarity score from search context
   */
  ragSimilarityScore(searchContext: SearchContext): number {
    return searchContext.avgSimilarity;
  }

  /**
   * Check if processing time is acceptable (< 3000ms)
   */
  processingTimeAcceptable(processingTimeMs: number): boolean {
    return processingTimeMs < 3000;
  }

  /**
   * Calculate objective quality score (0-1)
   * Average of all objective metrics
   */
  calculateObjectiveScore(metrics: ResponseMetrics): number {
    const scores: number[] = [];

    // Boolean metrics (convert to 0 or 1, only if defined)
    if (metrics.has_policy_citation !== undefined) {
      scores.push(metrics.has_policy_citation ? 1 : 0);
    }
    if (metrics.appropriate_action_suggested !== undefined) {
      scores.push(metrics.appropriate_action_suggested ? 1 : 0);
    }
    if (metrics.response_structure_complete !== undefined) {
      scores.push(metrics.response_structure_complete ? 1 : 0);
    }
    if (metrics.response_length_appropriate !== undefined) {
      scores.push(metrics.response_length_appropriate ? 1 : 0);
    }
    if (metrics.sequential_action_correct !== undefined) {
      scores.push(metrics.sequential_action_correct ? 1 : 0);
    }
    if (metrics.processing_time_acceptable !== undefined) {
      scores.push(metrics.processing_time_acceptable ? 1 : 0);
    }

    // Nullable boolean (only include if not null and not undefined)
    if (metrics.asks_clarifying_questions !== null && metrics.asks_clarifying_questions !== undefined) {
      scores.push(metrics.asks_clarifying_questions ? 1 : 0);
    }

    // Float metrics (already 0-1, only if defined)
    if (metrics.rag_similarity_score !== undefined) {
      scores.push(metrics.rag_similarity_score);
    }
    if (metrics.citation_accuracy !== undefined) {
      scores.push(metrics.citation_accuracy);
    }

    // Calculate average (return 0 if no scores)
    if (scores.length === 0) return 0;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Calculate subjective quality score (0-1)
   * Average of all subjective scores (1-5) normalized to 0-1
   */
  calculateSubjectiveScore(metrics: ResponseMetrics): number | undefined {
    const scores: number[] = [];

    if (metrics.professionalism_score !== undefined) scores.push(metrics.professionalism_score);
    if (metrics.empathy_score !== undefined) scores.push(metrics.empathy_score);
    if (metrics.clarity_score !== undefined) scores.push(metrics.clarity_score);
    if (metrics.actionability_score !== undefined) scores.push(metrics.actionability_score);
    if (metrics.compliance_score !== undefined) scores.push(metrics.compliance_score);

    if (scores.length === 0) {
      return undefined; // No subjective scores provided
    }

    // Average scores (1-5) and normalize to 0-1
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return average / 5; // Normalize from 1-5 scale to 0-1 scale
  }

  /**
   * Calculate overall quality score with weighting
   * Objective: 40%, Subjective: 60%
   */
  calculateOverallScore(metrics: ResponseMetrics): number | undefined {
    if (metrics.subjective_quality_score === undefined) {
      return undefined; // Can't calculate without subjective scores
    }

    return (metrics.objective_quality_score * 0.4) + (metrics.subjective_quality_score * 0.6);
  }
}
