/**
 * Shared conversation logic used by both the Teams bot and test harness.
 * This ensures consistent behavior across production and testing environments.
 */

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QueryResolution {
  queryToUse: string;
  reason: 'new_query' | 'answering_question' | 'followup_fallback' | 'regular_followup';
  isFollowUp: boolean;
  isAnsweringQuestion: boolean;
}

/**
 * Check if a message is a conversational ending (thank you, goodbye, etc.).
 *
 * @param query - The user's message
 * @param conversationHistory - Optional conversation history for context
 * @returns true if the message is a conversational ending
 */
export function isConversationalEnding(query: string, conversationHistory?: ConversationMessage[]): boolean {
  const lowerQuery = query.toLowerCase().trim();

  // Check for "no" or "nope" ONLY if it's a response to "anything else"
  if ((lowerQuery === 'no' || lowerQuery === 'nope' || lowerQuery === 'no thanks' || lowerQuery === 'nah') && conversationHistory) {
    const lastAssistantMessage = conversationHistory
      .slice()
      .reverse()
      .find(m => m.role === 'assistant')?.content.toLowerCase() || '';

    // If last assistant message asked "anything else", treat "no" as ending
    if (lastAssistantMessage.includes('anything else') ||
        lastAssistantMessage.includes('help you with') ||
        lastAssistantMessage.includes('let me know if')) {
      return true;
    }
  }

  const endings = [
    'thank',
    'thanks',
    'got it',
    'perfect',
    'sounds good',
    'looks good',
    'appreciate',
    'that helps',
    'that\'s helpful',
    'ok',
    'okay',
    'great',
    'awesome',
    'bye',
    'goodbye',
    'see you',
    'talk to you later',
    'all set',
    'i\'m good',
    'im good'
  ];

  return endings.some(ending => lowerQuery.includes(ending)) && query.length < 50;
}

/**
 * Check if a message is a greeting.
 *
 * Uses strict matching to avoid false positives:
 * - Exact match to a greeting phrase, OR
 * - Starts with greeting AND is very short (10 chars or less) AND has no question words
 */
export function isGreeting(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();
  const greetings = [
    'hi',
    'hello',
    'hey',
    'hi there',
    'hello there',
    'hey there',
    'hi era',
    'hello era',
    'hey era',
    'good morning',
    'good afternoon',
    'good evening',
    'howdy',
    'greetings',
    'what\'s up',
    'whats up',
    'sup'
  ];

  // Remove punctuation for matching
  const queryNoPunctuation = lowerQuery.replace(/[!?.]/g, '').trim();

  // STRICT matching: Only treat as greeting if:
  // 1. Exact match to a greeting phrase, OR
  // 2. Starts with greeting AND is very short (10 chars or less) AND has no question words
  const questionWords = ['what', 'how', 'when', 'where', 'why', 'who', 'which', 'should', 'can', 'could', 'would', 'do', 'does', 'is', 'are'];
  const hasQuestionWord = questionWords.some(qw => queryNoPunctuation.includes(qw));

  // If it contains a question word, it's NOT a greeting - it's a query
  if (hasQuestionWord) {
    return false;
  }

  // Check for exact greeting match
  if (greetings.includes(queryNoPunctuation)) {
    return true;
  }

  // Only allow very short messages (10 chars or less) starting with greetings
  if (queryNoPunctuation.length <= 10 && greetings.some(g => queryNoPunctuation.startsWith(g))) {
    return true;
  }

  return false;
}

/**
 * Determines which query to use for RAG search based on conversation context.
 *
 * This handles three scenarios:
 * 1. User is answering ERA's clarifying question → use original query
 * 2. User sent a follow-up but got no results → fallback to original query
 * 3. New query or regular follow-up → use current query
 *
 * @param currentQuery - The user's current message
 * @param history - Full conversation history (including the current message)
 * @returns Query resolution with the query to use and metadata
 */
export function resolveQueryForSearch(
  currentQuery: string,
  history: ConversationMessage[]
): QueryResolution {
  // Check if this is a follow-up in an existing conversation
  const isFollowUp = history.length > 1;

  if (!isFollowUp) {
    // First message in conversation - use it as-is
    return {
      queryToUse: currentQuery,
      reason: 'new_query',
      isFollowUp: false,
      isAnsweringQuestion: false
    };
  }

  // Check if the last assistant message was asking a CLARIFYING question (not a greeting)
  const lastAssistantMessage = history.length >= 2
    ? history[history.length - 2]?.content || ''
    : '';

  // Only treat as "answering question" if:
  // 1. Last message was from assistant
  // 2. Contains a question mark
  // 3. Is NOT a greeting question
  const isGreetingQuestion = lastAssistantMessage.includes('What HR situation can I help') ||
                              lastAssistantMessage.includes('How can I help you') ||
                              lastAssistantMessage.includes('What can I help you with') ||
                              lastAssistantMessage.includes('I\'m here to help');

  const isAnsweringQuestion = isFollowUp &&
    lastAssistantMessage.includes('?') &&
    !isGreetingQuestion &&
    history[history.length - 2]?.role === 'assistant';

  if (isAnsweringQuestion) {
    // This is an answer to ERA's question - use the FIRST NON-GREETING user message (original HR query)
    const previousUserMessages = history.filter(m => m.role === 'user');

    // Find the first non-greeting user message (the actual HR query)
    let originalQuery = currentQuery;
    for (const msg of previousUserMessages) {
      if (!isGreeting(msg.content)) {
        originalQuery = msg.content;
        break;
      }
    }

    return {
      queryToUse: originalQuery,
      reason: 'answering_question',
      isFollowUp,
      isAnsweringQuestion: true
    };
  }

  // Regular follow-up - use current query
  return {
    queryToUse: currentQuery,
    reason: 'regular_followup',
    isFollowUp,
    isAnsweringQuestion: false
  };
}

/**
 * Determines if we should fallback to the original query when a follow-up gets no results.
 *
 * @param hasResults - Whether the current RAG search returned any results
 * @param resolution - The query resolution from resolveQueryForSearch
 * @param history - Full conversation history
 * @returns The original query if fallback is needed, null otherwise
 */
export function shouldFallbackToOriginalQuery(
  hasResults: boolean,
  resolution: QueryResolution,
  history: ConversationMessage[]
): string | null {
  // Only fallback if:
  // 1. We got no results
  // 2. This is a follow-up
  // 3. We're not already using the original query (not answering a question)
  if (!hasResults && resolution.isFollowUp && !resolution.isAnsweringQuestion) {
    const previousUserMessages = history.filter(m => m.role === 'user');
    if (previousUserMessages.length > 1) {
      return previousUserMessages[0].content;
    }
  }

  return null;
}
