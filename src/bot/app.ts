import { ActivityHandler, MessageFactory, TurnContext, ActivityTypes, CloudAdapter, ConfigurationBotFrameworkAuthentication } from 'botbuilder';
import restify, { Request, Response, Next } from 'restify';
import { DocumentRetriever } from '../retrieval/search';
import { ResponseGenerator } from '../templates/generator';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Conversation state to track message history
 */
interface ConversationState {
  conversationId: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  lastActivity: Date;
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

      if (!userQuery) {
        await context.sendActivity(MessageFactory.text(
          'Hi! I\'m ERA, your HR assistant. Please ask me about Fitness Connection policies and procedures.'
        ));
        return;
      }

      console.log(`Processing query: ${userQuery}`);

      // Show typing indicator
      await context.sendActivities([
        { type: ActivityTypes.Typing },
        { type: 'delay', value: 500 }
      ]);

      // Check for special commands
      if (userQuery.toLowerCase().startsWith('/help')) {
        await this.sendHelpMessage(context);
        return;
      }

      if (userQuery.toLowerCase().startsWith('/stats')) {
        await this.sendStatsMessage(context);
        return;
      }

      // Process HR query
      await this.processHRQuery(context, userQuery);

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
  private async processHRQuery(context: TurnContext, query: string): Promise<void> {
    try {
      const startTime = Date.now();
      const conversationId = context.activity.conversation.id;

      // Get conversation history
      const conversationState = this.getConversationState(conversationId);

      // Add user message to history
      this.addToHistory(conversationId, 'user', query);

      // Check if this is a follow-up in an existing conversation
      const isFollowUp = conversationState.history.length > 1;

      // Detect if this is a short follow-up response (likely answering a clarifying question)
      const isShortFollowUp = isFollowUp && query.length < 100 && (
        query.toLowerCase().startsWith('yes') ||
        query.toLowerCase().startsWith('no') ||
        query.toLowerCase().startsWith('they') ||
        /^(not yet|already|just|i |we |haven't|have )/i.test(query)
      );

      // Retrieve relevant context
      let searchContext;

      if (isShortFollowUp) {
        // For short follow-ups, search using the FIRST user query (original question) for better context
        const previousUserMessages = conversationState.history.filter(m => m.role === 'user');
        if (previousUserMessages.length > 1) {
          // Use the FIRST user message (the original question), not the second-to-last
          const originalQuery = previousUserMessages[0].content;
          console.log(`Short follow-up detected. Searching with original query: "${originalQuery}"`);
          searchContext = await this.retriever.getHRContext(originalQuery);
        } else {
          searchContext = await this.retriever.getHRContext(query);
        }
      } else {
        // For new questions or detailed follow-ups, search normally
        searchContext = await this.retriever.getHRContext(query);

        // If no results found but this is a follow-up, try to use context from conversation
        if (searchContext.results.length === 0 && isFollowUp) {
          const previousUserMessages = conversationState.history.filter(m => m.role === 'user');
          if (previousUserMessages.length > 1) {
            const previousQuery = previousUserMessages[previousUserMessages.length - 2].content;
            console.log(`No results found. Searching with previous context: "${previousQuery}"`);
            searchContext = await this.retriever.getHRContext(previousQuery);
          }
        }
      }

      if (searchContext.results.length === 0) {
        const noResultsMessage = `I couldn't find specific policy information related to "${query}". Please try rephrasing your question or contact HR directly for assistance.`;

        await context.sendActivity(MessageFactory.text(noResultsMessage));

        // Add assistant response to history
        this.addToHistory(conversationId, 'assistant', noResultsMessage);
        return;
      }

      // Generate response with conversation history
      const generatedResponse = await this.responseGenerator.generateResponse(
        query,
        searchContext,
        undefined,
        conversationState.history
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
   * Format response for Teams with rich cards
   */
  private formatResponseForTeams(
    response: any,
    searchContext: any,
    processingTime: number
  ): any {
    // Simple text response to avoid adaptive card type issues
    let formattedText = `🤖 **ERA - HR Assistant**\n\n${response.response}\n\n`;

    // Add confidence information
    if (response.confidence_score > 0.8) {
      formattedText += '✅ High confidence response\n';
    } else if (response.confidence_score > 0.6) {
      formattedText += '⚠️ Medium confidence - please verify with HR\n';
    }

    // Add source information
    if (searchContext.results.length > 0) {
      formattedText += `\n📚 **Sources:** ${searchContext.results.length} policy document(s)\n`;

      const sourceList = searchContext.results.slice(0, 3).map((result: any, index: number) =>
        `${index + 1}. ${result.document_title}`
      ).join('\n');

      formattedText += sourceList + '\n';
    }

    // Add footer
    formattedText += `\n⏱️ Processed in ${processingTime}ms | 💡 /help for commands`;

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