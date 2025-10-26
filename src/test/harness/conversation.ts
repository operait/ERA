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
import { isGreeting, resolveQueryForSearch, shouldFallbackToOriginalQuery } from '../../lib/conversation-utils';

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

      // Check if it's a greeting
      if (isGreeting(query)) {
        this.handleGreeting(query);
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

  private handleGreeting(query: string): void {
    const greetingResponses = [
      'Hi Barry! 👋 I\'m ERA, your HR assistant. How can I help you today?',
      'Hello Barry! Ready to help with any HR questions you have.',
      'Hey Barry! What HR situation can I help you with?',
      'Hi Barry! I\'m here to help with policies, procedures, and any HR guidance you need.'
    ];

    const response = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];

    // Add to history
    this.history.push({ role: 'user', content: query });
    this.history.push({ role: 'assistant', content: response });

    console.log(`\n💬 ERA: ${response}\n`);
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

    // Use shared conversation logic to determine which query to use for RAG search
    const queryResolution = resolveQueryForSearch(query, this.history);

    if (this.debugMode) {
      console.log(`\n[DEBUG] Conversation context: reason=${queryResolution.reason}, isFollowUp=${queryResolution.isFollowUp}, isAnsweringQuestion=${queryResolution.isAnsweringQuestion}`);
    }

    // Show typing indicator
    process.stdout.write('🔍 Searching...');

    // Retrieve relevant context using the resolved query
    let searchContext = await this.retriever.getHRContext(queryResolution.queryToUse);

    // Check if we should fallback to original query for follow-ups with no results
    const fallbackQuery = shouldFallbackToOriginalQuery(
      searchContext.results.length > 0,
      queryResolution,
      this.history
    );

    if (fallbackQuery) {
      if (this.debugMode) {
        console.log(`\n[DEBUG] Follow-up with no results. Searching with original question: "${fallbackQuery}"`);
      }
      searchContext = await this.retriever.getHRContext(fallbackQuery);
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
