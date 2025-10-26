#!/usr/bin/env node
/**
 * ERA Conversation Test Harness
 *
 * Interactive terminal interface for testing ERA conversation flows.
 * Based on: specs/TEST_HARNESS.md
 */

import * as readline from 'readline';
import { DocumentRetriever } from '../../retrieval/search';
import { ResponseGenerator } from '../../templates/generator';
import { ResponseEvaluator } from '../../metrics/evaluator';

interface ConversationHistory {
  role: 'user' | 'assistant';
  content: string;
}

interface SessionStats {
  startTime: Date;
  turnCount: number;
  totalProcessingTime: number;
}

class ConversationTestHarness {
  private retriever: DocumentRetriever;
  private responseGenerator: ResponseGenerator;
  private evaluator: ResponseEvaluator;
  private history: ConversationHistory[] = [];
  private debugMode: boolean = true;
  private lastSearchContext: any = null;
  private stats: SessionStats;

  constructor() {
    this.retriever = new DocumentRetriever();
    this.responseGenerator = new ResponseGenerator();
    this.evaluator = new ResponseEvaluator();
    this.stats = {
      startTime: new Date(),
      turnCount: 0,
      totalProcessingTime: 0
    };
  }

  async start(): Promise<void> {
    console.log('\n🤖 ERA Terminal Test Harness');
    console.log('━'.repeat(40));
    console.log('Testing conversation flows locally...\n');

    // Test connections
    try {
      await this.testConnections();
    } catch (error) {
      console.error('❌ Failed to initialize:', error);
      process.exit(1);
    }

    console.log('\nCommands:');
    console.log('  !reset    - Clear conversation history');
    console.log('  !debug    - Toggle debug mode (show search results)');
    console.log('  !sources  - Show sources from last response');
    console.log('  !metrics  - Show quality metrics for last response');
    console.log('  !quit     - Exit\n');
    console.log('━'.repeat(40));
    console.log('');

    // Start interactive session
    await this.interactiveSession();
  }

  private async testConnections(): Promise<void> {
    // Test database connection
    try {
      const testSearch = await this.retriever.getHRContext('test');
      console.log('Connected to Supabase: ✓');
    } catch (error) {
      throw new Error(`Supabase connection failed: ${error}`);
    }

    // Test prompt loading (just verify generator exists)
    console.log('Response Generator ready: ✓');
  }

  private async interactiveSession(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'You: '
    });

    rl.prompt();

    rl.on('line', async (input: string) => {
      const query = input.trim();

      if (!query) {
        rl.prompt();
        return;
      }

      // Handle commands
      if (query.toLowerCase() === '!quit' || query.toLowerCase() === '!exit') {
        this.showSessionSummary();
        rl.close();
        process.exit(0);
        return;
      }

      if (query.toLowerCase() === '!reset') {
        this.handleReset();
        rl.prompt();
        return;
      }

      if (query.toLowerCase() === '!debug') {
        this.debugMode = !this.debugMode;
        console.log(`\n🔧 Debug mode: ${this.debugMode ? 'ON' : 'OFF'}\n`);
        rl.prompt();
        return;
      }

      if (query.toLowerCase() === '!sources') {
        this.handleSources();
        rl.prompt();
        return;
      }

      if (query.toLowerCase() === '!metrics') {
        this.handleMetrics();
        rl.prompt();
        return;
      }

      // Process user query
      await this.processQuery(query);

      rl.prompt();
    });

    rl.on('close', () => {
      this.showSessionSummary();
      process.exit(0);
    });
  }

  private handleReset(): void {
    this.history = [];
    this.lastSearchContext = null;
    this.stats.turnCount = 0;
    this.stats.totalProcessingTime = 0;
    this.stats.startTime = new Date();
    console.log('\n🔄 Conversation reset. History cleared.\n');
  }

  private handleSources(): void {
    if (!this.lastSearchContext) {
      console.log('\n⚠️ No search results available yet.\n');
      return;
    }

    console.log('\n📚 Sources from last response:');
    console.log('━'.repeat(40));

    for (let i = 0; i < this.lastSearchContext.results.length; i++) {
      const result = this.lastSearchContext.results[i];
      console.log(`\n[${i + 1}] ${result.document_title} (similarity: ${result.similarity.toFixed(3)})`);
      console.log(`Category: ${result.document_category}`);
      console.log(`\nExcerpt:\n${result.chunk_text.substring(0, 200)}...`);
    }

    console.log('\n' + '━'.repeat(40) + '\n');
  }

  private handleMetrics(): void {
    if (!this.lastSearchContext || !this.history.length) {
      console.log('\n⚠️ No previous response to evaluate.\n');
      return;
    }

    const lastAssistantMessage = this.history
      .slice()
      .reverse()
      .find(m => m.role === 'assistant');

    if (!lastAssistantMessage) {
      console.log('\n⚠️ No assistant response found.\n');
      return;
    }

    const lastUserMessage = this.history
      .slice()
      .reverse()
      .find(m => m.role === 'user');

    if (!lastUserMessage) {
      console.log('\n⚠️ No user query found.\n');
      return;
    }

    // Evaluate the response
    const metrics = this.evaluator.evaluate(
      lastUserMessage.content,
      lastAssistantMessage.content,
      this.lastSearchContext,
      this.stats.totalProcessingTime / this.stats.turnCount, // avg processing time
      this.stats.turnCount === 1 // is first response
    );

    console.log('\n📊 Quality Metrics for Last Response:');
    console.log('━'.repeat(40));

    // Objective metrics
    console.log('\n✓ Objective Metrics:');
    console.log(`  Policy Citation: ${metrics.has_policy_citation ? '✓' : '✗'}`);
    console.log(`  Action Suggested: ${metrics.appropriate_action_suggested ? '✓' : '✗'}`);
    console.log(`  Complete Structure: ${metrics.response_structure_complete ? '✓' : '✗'}`);
    console.log(`  Length Appropriate: ${metrics.response_length_appropriate ? '✓' : '✗'}`);
    console.log(`  Sequential Actions: ${metrics.sequential_action_correct ? '✓' : '✗'}`);
    console.log(`  Clarifying Questions: ${metrics.asks_clarifying_questions === null ? 'N/A' : (metrics.asks_clarifying_questions ? '✓' : '✗')}`);
    console.log(`  Processing Time OK: ${metrics.processing_time_acceptable ? '✓' : '✗'}`);
    console.log(`  Citation Accuracy: ${(metrics.citation_accuracy * 100).toFixed(0)}%`);
    console.log(`  RAG Similarity: ${(metrics.rag_similarity_score * 100).toFixed(0)}%`);

    console.log(`\n📈 Objective Quality Score: ${(metrics.objective_quality_score * 100).toFixed(1)}%`);

    console.log('\n' + '━'.repeat(40) + '\n');
  }

  private async processQuery(query: string): Promise<void> {
    const startTime = Date.now();

    console.log(''); // Blank line before processing

    // Add to history
    this.history.push({ role: 'user', content: query });

    // Check if this is a follow-up in an existing conversation
    const isFollowUp = this.history.length > 2; // At least user + assistant + user

    // Check if the last assistant message was asking a CLARIFYING question
    const lastAssistantMessage = isFollowUp && this.history.length >= 2
      ? this.history[this.history.length - 2]?.content || ''
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
      this.history[this.history.length - 2]?.role === 'assistant';

    // Show typing indicator
    process.stdout.write('🔍 Searching...');

    // Retrieve relevant context
    let searchContext;

    if (isAnsweringQuestion) {
      // This is an answer to ERA's question - use the FIRST NON-GREETING user message (original HR query)
      const previousUserMessages = this.history.filter(m => m.role === 'user');

      // Find the first non-greeting user message (the actual HR query)
      let originalQuery = query;
      for (const msg of previousUserMessages) {
        if (!this.isGreeting(msg.content)) {
          originalQuery = msg.content;
          break;
        }
      }

      if (this.debugMode) {
        console.log(`\n[DEBUG] User is answering ERA's question. Using original query for search: "${originalQuery}"`);
      }
      searchContext = await this.retriever.getHRContext(originalQuery);
    } else {
      // This is a new query or regular follow-up
      searchContext = await this.retriever.getHRContext(query);

      // For regular follow-ups with no/poor results, fall back to original question
      if (isFollowUp && searchContext.results.length === 0) {
        const previousUserMessages = this.history.filter(m => m.role === 'user');
        if (previousUserMessages.length > 1) {
          const originalQuery = previousUserMessages[0].content;
          if (this.debugMode) {
            console.log(`\n[DEBUG] Follow-up with no results. Searching with original question: "${originalQuery}"`);
          }
          searchContext = await this.retriever.getHRContext(originalQuery);
        }
      }
    }

    this.lastSearchContext = searchContext;

    const searchTime = Date.now() - startTime;

    if (this.debugMode) {
      process.stdout.write(` (${searchContext.results.length} results, avg similarity: ${searchContext.avgSimilarity.toFixed(2)}, ${searchTime}ms)\n`);
    } else {
      process.stdout.write(' ✓\n');
    }

    if (searchContext.results.length === 0) {
      console.log('\n⚠️ ERA: I couldn\'t find specific policy information for that query.\n');
      return;
    }

    // Generate response
    process.stdout.write('💬 Generating response...\n');

    const firstName = 'Barry'; // Default test user
    const response = await this.responseGenerator.generateResponse(
      query,
      searchContext,
      undefined,
      this.history,
      firstName
    );

    const processingTime = Date.now() - startTime;
    this.stats.totalProcessingTime += processingTime;
    this.stats.turnCount++;

    // Add to history
    this.history.push({ role: 'assistant', content: response.response });

    // Display response
    console.log('\n' + '━'.repeat(40));
    console.log(`ERA: ${response.response}`);
    console.log('━'.repeat(40));

    // Debug info
    if (this.debugMode) {
      console.log(`\n[DEBUG] Processing time: ${processingTime}ms`);
      console.log(`[DEBUG] RAG results: ${searchContext.results.length} chunks`);

      const topResults = searchContext.results.slice(0, 3);
      for (const result of topResults) {
        console.log(`  - "${result.document_title}" (${result.similarity.toFixed(2)})`);
      }

      console.log('━'.repeat(40));
    }

    console.log(''); // Blank line after response
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

    // STRICT matching: Only treat as greeting if exact match
    return greetings.includes(queryNoPunctuation) ||
           greetings.some(g => queryNoPunctuation === g);
  }

  private showSessionSummary(): void {
    const duration = Date.now() - this.stats.startTime.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log(`\n\n👋 Session ended.`);
    console.log(`   Turns: ${this.stats.turnCount}`);
    console.log(`   Duration: ${minutes}m ${seconds}s`);
    if (this.stats.turnCount > 0) {
      console.log(`   Avg processing time: ${Math.round(this.stats.totalProcessingTime / this.stats.turnCount)}ms`);
    }
    console.log('');
  }
}

// Run the harness
const harness = new ConversationTestHarness();
harness.start().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
