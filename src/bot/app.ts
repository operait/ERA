import { ActivityHandler, MessageFactory, TurnContext, ActivityTypes, CloudAdapter, ConfigurationBotFrameworkAuthentication, TeamsInfo } from 'botbuilder';
import restify, { Request, Response, Next } from 'restify';
import { DocumentRetriever } from '../retrieval/search';
import { ResponseGenerator } from '../templates/generator';
import { emailHandler } from './handlers/email-handler';
import { calendarHandler } from './handlers/calendar-handler';
import { conversationStateManager } from '../services/conversation-state';
import { handleImproveCommand, handlePrintCommand, handleResetCommand, storeTurn } from './handlers/prompt-tuning';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Conversation state to track message history
 */
interface ConversationState {
  conversationId: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  lastActivity: Date;
  lastSearchContext?: any; // Store last search results for !sources command
}

/**
 * ERA - HR Assistant Bot for Microsoft Teams
 */
class ERABot extends ActivityHandler {
  private retriever: DocumentRetriever;
  private responseGenerator: ResponseGenerator;
  private conversationStates: Map<string, ConversationState> = new Map();
  private readonly MAX_HISTORY_LENGTH = 10; // Keep last 10 messages
  private readonly STATE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  constructor() {
    super();

    this.retriever = new DocumentRetriever();
    this.responseGenerator = new ResponseGenerator();

    // Clean up old conversation states periodically
    setInterval(() => this.cleanupOldStates(), 5 * 60 * 1000); // Every 5 minutes

    // Handle when a user sends a message
    this.onMessage(async (context, next) => {
      await this.handleMessage(context);
      await next();
    });

    // Handle when users are added to the conversation
    this.onMembersAdded(async (context, next) => {
      await this.sendWelcomeMessage(context);
      await next();
    });
  }

  /**
   * Get or create conversation state
   */
  private getConversationState(conversationId: string): ConversationState {
    if (!this.conversationStates.has(conversationId)) {
      this.conversationStates.set(conversationId, {
        conversationId,
        history: [],
        lastActivity: new Date()
      });
    }
    const state = this.conversationStates.get(conversationId)!;
    state.lastActivity = new Date();
    return state;
  }

  /**
   * Add message to conversation history
   */
  private addToHistory(conversationId: string, role: 'user' | 'assistant', content: string): void {
    const state = this.getConversationState(conversationId);
    state.history.push({ role, content });

    // Keep only recent history
    if (state.history.length > this.MAX_HISTORY_LENGTH) {
      state.history = state.history.slice(-this.MAX_HISTORY_LENGTH);
    }
  }

  /**
   * Clean up old conversation states
   */
  private cleanupOldStates(): void {
    const now = Date.now();
    const expiredConversations: string[] = [];

    this.conversationStates.forEach((state, conversationId) => {
      if (now - state.lastActivity.getTime() > this.STATE_TIMEOUT_MS) {
        expiredConversations.push(conversationId);
      }
    });

    expiredConversations.forEach(id => {
      this.conversationStates.delete(id);
      console.log(`Cleaned up expired conversation: ${id}`);
    });
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(context: TurnContext): Promise<void> {
    try {
      const userQuery = context.activity.text?.trim();
      const conversationId = context.activity.conversation.id;

      // Extract user's first name and email from Teams
      const userName = context.activity.from?.name || 'there';
      const firstName = userName.split(' ')[0];

      // Get manager email and ID - try to fetch from Teams profile
      let managerEmail = 'unknown@fitnessconnection.com';
      let managerId = context.activity.from?.aadObjectId || context.activity.from?.id || 'unknown';

      try {
        // Try to get the member's profile from Teams using TeamsInfo
        if (context.activity.from?.id) {
          const member = await TeamsInfo.getMember(context, context.activity.from.id);
          // TeamsChannelAccount has email and userPrincipalName properties
          managerEmail = (member as any).email || (member as any).userPrincipalName || managerEmail;
          console.log(`Fetched Teams member info - Email: ${managerEmail}`);
        }
      } catch (error) {
        console.warn(`Failed to fetch Teams member info: ${error}. Falling back to context properties.`);

        // Fallback: Try to get email from activity context
        // @ts-ignore - additional properties might not be in types but exist in Teams
        const userPrincipalName = (context.activity.from as any)?.properties?.email ||
                                  (context.activity.from as any)?.email ||
                                  (context.activity.from as any)?.userPrincipalName;

        if (userPrincipalName) {
          managerEmail = userPrincipalName;
        } else {
          const fromId = context.activity.from?.id || '';
          // Check if id looks like an email (contains @)
          if (fromId.includes('@')) {
            managerEmail = fromId;
          }
        }
      }

      console.log(`User info - Name: ${userName}, Email: ${managerEmail}, ID: ${managerId}`);

      if (!userQuery) {
        await context.sendActivity(MessageFactory.text(
          `Hi${firstName !== 'there' ? ' ' + firstName : ''}! I'm ERA, your HR assistant. Please ask me about Fitness Connection policies and procedures.`
        ));
        return;
      }

      console.log(`Processing query from ${firstName}: ${userQuery}`);

      // Check for special commands FIRST (before checking conversation state)
      // This allows users to escape from multi-turn flows
      if (userQuery.toLowerCase().startsWith('/help')) {
        await this.sendHelpMessage(context);
        return;
      }

      if (userQuery.toLowerCase().startsWith('/stats')) {
        await this.sendStatsMessage(context);
        return;
      }

      if (userQuery.toLowerCase().startsWith('!reset') || userQuery.toLowerCase().startsWith('!restart')) {
        await this.handleReset(context, conversationId, firstName);
        // Also handle prompt tuning session reset
        await handleResetCommand(context);
        return;
      }

      if (userQuery.toLowerCase().startsWith('!sources')) {
        await this.handleSourcesCommand(context, conversationId);
        return;
      }

      // Prompt tuning commands
      if (userQuery.toLowerCase().startsWith('!improve ')) {
        const feedbackText = userQuery.substring('!improve '.length).trim();
        await handleImproveCommand(context, feedbackText);
        return;
      }

      if (userQuery.toLowerCase().startsWith('!print')) {
        await handlePrintCommand(context);
        return;
      }

      if (userQuery.toLowerCase().startsWith('!optimize')) {
        const { handleOptimizeCommand } = await import('./handlers/prompt-tuning');
        const autoMerge = userQuery.toLowerCase().includes('--auto-merge');
        await handleOptimizeCommand(context, autoMerge);
        return;
      }

      // Check if we're in an active email or calendar conversation
      if (conversationStateManager.isActive(conversationId)) {
        const conversationType = conversationStateManager.getType(conversationId);

        if (conversationType === 'email') {
          const handled = await emailHandler.handleEmailStep(
            context,
            conversationId,
            userQuery,
            managerEmail,
            managerId,
            firstName
          );
          if (handled) return;
        } else if (conversationType === 'calendar') {
          const handled = await calendarHandler.handleCalendarStep(
            context,
            conversationId,
            userQuery,
            managerEmail,
            managerId,
            firstName
          );
          if (handled) return;
        }
      }

      // Show typing indicator
      await context.sendActivities([
        { type: ActivityTypes.Typing },
        { type: 'delay', value: 500 }
      ]);

      // Detect conversational endings (thank you, goodbye, etc.)
      if (this.isConversationalEnding(userQuery)) {
        await this.handleConversationalEnding(context, conversationId, userQuery, firstName);
        return;
      }

      // Detect greetings (hi, hello, hey, etc.)
      if (this.isGreeting(userQuery)) {
        await this.handleGreeting(context, conversationId, firstName);
        return;
      }

      // Process HR query
      await this.processHRQuery(context, userQuery, firstName, managerEmail, managerId);

    } catch (error) {
      console.error('Error handling message:', error);
      await context.sendActivity(MessageFactory.text(
        'I encountered an error processing your request. Please try again or contact IT support if the issue persists.'
      ));
    }
  }

  /**
   * Process HR-related queries using RAG
   */
  private async processHRQuery(
    context: TurnContext,
    query: string,
    firstName: string,
    managerEmail: string,
    managerId: string
  ): Promise<void> {
    try {
      const startTime = Date.now();
      const conversationId = context.activity.conversation.id;

      // Get conversation history
      const conversationState = this.getConversationState(conversationId);

      // Add user message to history
      this.addToHistory(conversationId, 'user', query);

      // Check if this is a follow-up in an existing conversation
      const isFollowUp = conversationState.history.length > 1;

      // Check if the last assistant message was asking a CLARIFYING question (not a greeting)
      const lastAssistantMessage = isFollowUp
        ? conversationState.history[conversationState.history.length - 2]?.content || ''
        : '';

      // Only treat as "answering question" if:
      // 1. Last message was from assistant
      // 2. Contains a question mark
      // 3. Is NOT a greeting (greetings like "What can I help you with?" shouldn't count)
      const isGreetingQuestion = lastAssistantMessage.includes('What HR situation can I help') ||
                                  lastAssistantMessage.includes('How can I help you') ||
                                  lastAssistantMessage.includes('What can I help you with') ||
                                  lastAssistantMessage.includes('I\'m here to help');

      const isAnsweringQuestion = isFollowUp &&
        lastAssistantMessage.includes('?') &&
        !isGreetingQuestion &&
        conversationState.history[conversationState.history.length - 2]?.role === 'assistant';

      console.log(`🔍 Conversation context: isFollowUp=${isFollowUp}, isAnsweringQuestion=${isAnsweringQuestion}, isGreeting=${isGreetingQuestion}`);

      // Retrieve relevant context
      let searchContext;

      if (isAnsweringQuestion) {
        // This is an answer to ERA's question - use the FIRST NON-GREETING user message (original HR query)
        const previousUserMessages = conversationState.history.filter(m => m.role === 'user');

        // Find the first non-greeting user message (the actual HR query)
        let originalQuery = query;
        for (const msg of previousUserMessages) {
          if (!this.isGreeting(msg.content)) {
            originalQuery = msg.content;
            break;
          }
        }

        console.log(`📌 User is answering ERA's question. Using original query for search: "${originalQuery}"`);
        searchContext = await this.retriever.getHRContext(originalQuery);
      } else {
        // This is a new query or regular follow-up
        console.log(`🔍 Searching for: "${query}"`);
        searchContext = await this.retriever.getHRContext(query);
        console.log(`📊 Search results: ${searchContext.results.length} results, avg similarity: ${searchContext.avgSimilarity.toFixed(3)}`);

        // For regular follow-ups with no/poor results, fall back to original question
        if (isFollowUp && searchContext.results.length === 0) {
          const previousUserMessages = conversationState.history.filter(m => m.role === 'user');
          if (previousUserMessages.length > 1) {
            const originalQuery = previousUserMessages[0].content;
            console.log(`Follow-up with no results. Searching with original question: "${originalQuery}"`);
            searchContext = await this.retriever.getHRContext(originalQuery);
          }
        }
      }

      if (searchContext.results.length === 0) {
        console.log(`⚠️ No results found for query: "${query}"`);
        const noResultsMessage = `I couldn't find specific policy information related to "${query}". Please try rephrasing your question or contact HR directly for assistance.`;

        await context.sendActivity(MessageFactory.text(noResultsMessage));

        // Add assistant response to history
        this.addToHistory(conversationId, 'assistant', noResultsMessage);
        return;
      }

      console.log(`✅ Proceeding with ${searchContext.results.length} results`);

      // Check if there's completed calendar context to include
      const calendarState = conversationStateManager.getState(conversationId);
      let enrichedHistory = [...conversationState.history];

      if (calendarState && calendarState.type === 'calendar' && calendarState.step === 'completed') {
        // Add calendar context as a system message for Claude's reference
        const calendarContext = `[Calendar Context: Just booked a call with ${calendarState.employeeName} about "${calendarState.topic}" at ${calendarState.bookedTime}${calendarState.employeePhone ? `, phone: ${calendarState.employeePhone}` : ''}]`;
        console.log(`📅 Injecting calendar context into conversation: ${calendarContext}`);
        enrichedHistory.push({
          role: 'assistant',
          content: calendarContext
        });

        // Clear the completed state after injecting context so we don't keep injecting it
        conversationStateManager.clearState(conversationId);
      } else {
        console.log(`📅 No completed calendar state to inject (state: ${calendarState?.step || 'none'})`);
      }

      // Generate response with conversation history (including calendar context if available)
      const generatedResponse = await this.responseGenerator.generateResponse(
        query,
        searchContext,
        undefined,
        enrichedHistory,
        firstName
      );

      const processingTime = Date.now() - startTime;

      // Format response for Teams
      const formattedResponse = this.formatResponseForTeams(
        generatedResponse,
        searchContext,
        processingTime
      );

      await context.sendActivity(formattedResponse);

      // Add assistant response to history
      this.addToHistory(conversationId, 'assistant', generatedResponse.response);

      // Store search context for !sources command
      conversationState.lastSearchContext = searchContext;

      // Store turn in prompt tuning database
      await storeTurn(context, query, generatedResponse.response, {
        processingTime,
        searchResultsCount: searchContext.results.length,
        avgSimilarity: searchContext.avgSimilarity,
        categories: searchContext.categories
      });

      // Check if response recommends sending email or scheduling call
      const response = generatedResponse.response;

      if (emailHandler.detectEmailRecommendation(response)) {
        // Extract email template from response
        const emailTemplate = emailHandler.extractEmailTemplate(response);
        if (emailTemplate) {
          await emailHandler.startEmailFlow(
            context,
            conversationId,
            emailTemplate.subject,
            emailTemplate.body
          );
        }
      } else if (calendarHandler.detectCalendarRecommendation(response)) {
        // Extract topic for calendar booking
        const topic = calendarHandler.extractTopic(response, query);
        await calendarHandler.startCalendarFlow(
          context,
          conversationId,
          managerEmail,
          topic,
          firstName
        );
      }

      // Log successful interaction
      console.log(`Query processed in ${processingTime}ms with ${searchContext.results.length} results`);

    } catch (error) {
      console.error('Error processing HR query:', error);
      await context.sendActivity(MessageFactory.text(
        'I\'m having trouble accessing the policy database right now. Please try again in a moment.'
      ));
    }
  }

  /**
   * Check if message is a greeting
   */
  private isGreeting(query: string): boolean {
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
   * Handle greeting messages
   */
  private async handleGreeting(context: TurnContext, conversationId: string, firstName: string): Promise<void> {
    const greetingResponses = [
      `Hi${firstName !== 'there' ? ' ' + firstName : ''}! 👋 I'm ERA, your HR assistant. How can I help you today?`,
      `Hello${firstName !== 'there' ? ' ' + firstName : ''}! Ready to help with any HR questions you have.`,
      `Hey${firstName !== 'there' ? ' ' + firstName : ''}! What HR situation can I help you with?`,
      `Hi${firstName !== 'there' ? ' ' + firstName : ''}! I'm here to help with policies, procedures, and any HR guidance you need.`
    ];

    const response = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];

    // Add to history
    const userQuery = context.activity.text?.trim() || '';
    this.addToHistory(conversationId, 'user', userQuery);
    this.addToHistory(conversationId, 'assistant', response);

    await context.sendActivity(MessageFactory.text(response));
  }

  /**
   * Check if message is a conversational ending
   */
  private isConversationalEnding(query: string): boolean {
    const lowerQuery = query.toLowerCase().trim();
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
      'talk to you later'
    ];

    return endings.some(ending => lowerQuery.includes(ending)) && query.length < 50;
  }

  /**
   * Handle conversational endings
   */
  private async handleConversationalEnding(context: TurnContext, conversationId: string, query: string, firstName: string): Promise<void> {
    const responses = [
      `You're welcome${firstName !== 'there' ? ', ' + firstName : ''}! Feel free to reach out anytime you need HR guidance. 👍`,
      `Happy to help${firstName !== 'there' ? ', ' + firstName : ''}! Let me know if anything else comes up. 😊`,
      `Glad I could assist! I'm here whenever you need me. ✨`,
      `You got this${firstName !== 'there' ? ', ' + firstName : ''}! Reach out if you need anything else. 💪`
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];

    // Add to history
    this.addToHistory(conversationId, 'user', query);
    this.addToHistory(conversationId, 'assistant', response);

    await context.sendActivity(MessageFactory.text(response));
  }

  /**
   * Handle !reset or !restart command
   */
  private async handleReset(context: TurnContext, conversationId: string, firstName: string): Promise<void> {
    // Clear conversation history
    this.conversationStates.delete(conversationId);

    // Clear email/calendar state
    conversationStateManager.clearState(conversationId);

    await context.sendActivity(MessageFactory.text(
      `🔄 **Conversation Reset**\n\nYour conversation history has been cleared${firstName !== 'there' ? ', ' + firstName : ''}. Feel free to start with a new question!`
    ));
  }

  /**
   * Handle !sources command
   */
  private async handleSourcesCommand(context: TurnContext, conversationId: string): Promise<void> {
    const state = this.conversationStates.get(conversationId);

    if (!state || !state.lastSearchContext || state.lastSearchContext.results.length === 0) {
      await context.sendActivity(MessageFactory.text(
        '📚 No sources available. Ask me an HR policy question first, and then use `!sources` to see what documents I referenced.'
      ));
      return;
    }

    const searchContext = state.lastSearchContext;
    let sourcesText = `📚 **Sources from last response:** ${searchContext.results.length} policy document(s)\n\n`;

    searchContext.results.forEach((result: any, index: number) => {
      sourcesText += `${index + 1}. **${result.document_title}**\n`;
      sourcesText += `   Similarity: ${(result.similarity * 100).toFixed(1)}%\n`;
      if (result.chunk_text) {
        const preview = result.chunk_text.substring(0, 150);
        sourcesText += `   Preview: ${preview}${result.chunk_text.length > 150 ? '...' : ''}\n`;
      }
      sourcesText += '\n';
    });

    await context.sendActivity(MessageFactory.text(sourcesText));
  }

  /**
   * Format response for Teams with rich cards
   */
  private formatResponseForTeams(
    response: any,
    searchContext: any,
    processingTime: number
  ): any {
    // Simple text response without sources section
    let formattedText = `${response.response}`;

    // Add confidence information only if medium/low confidence
    if (response.confidence_score <= 0.6 && response.confidence_score > 0) {
      formattedText += '\n\n⚠️ Medium confidence - please verify with HR';
    }

    return MessageFactory.text(formattedText);
  }

  /**
   * Send welcome message to new users
   */
  private async sendWelcomeMessage(context: TurnContext): Promise<void> {
    const welcomeText = `
👋 **Welcome to ERA - Your HR Assistant!**

I'm here to help Fitness Connection managers with HR policies and procedures.

**What I can help with:**
• Attendance and punctuality policies
• Disciplinary procedures and corrective actions
• Employee termination processes
• Leave policies and procedures
• Performance management guidelines

**How to use me:**
• Just ask your HR question in plain English
• I'll search our policies and provide relevant guidance
• Use /help to see available commands

**Example questions:**
• "Employee missed 3 shifts without calling in, what do I do?"
• "What's the process for documenting tardiness?"
• "How do I issue a written warning?"

Ready to help! 🚀`;

    await context.sendActivity(MessageFactory.text(welcomeText));
  }

  /**
   * Send help message
   */
  private async sendHelpMessage(context: TurnContext): Promise<void> {
    const helpText = `
🆘 **ERA Help Commands**

**Available Commands:**
• **/help** - Show this help message
• **/stats** - Show system statistics
• **!sources** - Show source documents from your last question
• **!reset** or **!restart** - Clear conversation history and start fresh
• **Just ask!** - Ask any HR policy question

**Tips for better results:**
• Be specific about the situation
• Include relevant details (e.g., "employee missed 3 shifts")
• Ask follow-up questions if needed

**Common topics:**
• Attendance issues
• Disciplinary actions
• Termination procedures
• Leave policies
• Performance management

**Need more help?**
Contact HR directly for complex situations or policy interpretations.`;

    await context.sendActivity(MessageFactory.text(helpText));
  }

  /**
   * Send system statistics
   */
  private async sendStatsMessage(context: TurnContext): Promise<void> {
    try {
      const analytics = await this.retriever.getSearchAnalytics(7);

      let statsText = '📊 **ERA System Statistics (Last 7 Days)**\n\n';

      if (analytics) {
        statsText += `• Total queries: ${analytics.totalQueries}\n`;
        statsText += `• Average response time: ${Math.round(analytics.avgResponseTime)}ms\n`;

        if (analytics.commonQueries.length > 0) {
          statsText += '\n**Most common questions:**\n';
          analytics.commonQueries.forEach((query: any, index: number) => {
            statsText += `${index + 1}. "${query.query}" (${query.count}x)\n`;
          });
        }

        if (Object.keys(analytics.categories).length > 0) {
          statsText += '\n**Policy categories accessed:**\n';
          Object.entries(analytics.categories).forEach(([category, count]) => {
            statsText += `• ${category}: ${count} searches\n`;
          });
        }
      } else {
        statsText += 'Statistics temporarily unavailable.';
      }

      await context.sendActivity(MessageFactory.text(statsText));
    } catch (error) {
      console.error('Error getting stats:', error);
      await context.sendActivity(MessageFactory.text(
        'Unable to retrieve statistics at this time.'
      ));
    }
  }
}

// Create and configure the bot
function createBot(): ERABot {
  return new ERABot();
}

// Create bot adapter
function createAdapter(): CloudAdapter {
  const appId = process.env.MICROSOFT_APP_ID;
  const appPassword = process.env.MICROSOFT_APP_PASSWORD;
  const appType = process.env.MICROSOFT_APP_TYPE || 'SingleTenant';
  const tenantId = process.env.MICROSOFT_APP_TENANT_ID;

  // Debug: Log credential status (not values)
  console.log('Bot credentials loaded:', {
    appId: appId ? `${appId.substring(0, 8)}...` : 'MISSING',
    appIdLength: appId?.length || 0,
    appPassword: appPassword ? 'SET' : 'MISSING',
    appPasswordLength: appPassword?.length || 0,
    appType,
    tenantId: tenantId ? `${tenantId.substring(0, 8)}...` : 'not set'
  });

  // Validate credentials
  if (!appId || !appPassword) {
    throw new Error('MICROSOFT_APP_ID and MICROSOFT_APP_PASSWORD must be set');
  }

  const botAuth = new ConfigurationBotFrameworkAuthentication({
    MicrosoftAppId: appId,
    MicrosoftAppPassword: appPassword,
    MicrosoftAppType: appType,
    MicrosoftAppTenantId: tenantId
  });

  const adapter = new CloudAdapter(botAuth);

  // Error handling
  adapter.onTurnError = async (context, error) => {
    console.error('Bot error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));

    try {
      await context.sendActivity(MessageFactory.text(
        'Sorry, an error occurred. Please try again.'
      ));
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
    }
  };

  return adapter;
}

// Create and start the server
async function startServer(): Promise<void> {
  // Create server
  const server = restify.createServer({
    name: 'ERA HR Assistant Bot',
    version: '1.0.0'
  });

  server.use(restify.plugins.bodyParser());

  // Create bot instances
  const adapter = createAdapter();
  const bot = createBot();

  // Health check endpoint
  server.get('/health', (req: Request, res: Response, next: Next) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    return next();
  });

  // Bot messages endpoint
  server.post('/api/messages', async (req: Request, res: Response) => {
    await adapter.process(req, res, async (context) => {
      await bot.run(context);
    });
  });

  // Start server
  const port = process.env.PORT || 3978;
  server.listen(port, () => {
    console.log(`🤖 ERA Bot server listening on port ${port}`);
    console.log(`📋 Health check: http://localhost:${port}/health`);
    console.log(`💬 Bot endpoint: http://localhost:${port}/api/messages`);
  });
}

// Start the application
if (require.main === module) {
  startServer().catch(console.error);
}

export { ERABot, createBot, createAdapter, startServer };