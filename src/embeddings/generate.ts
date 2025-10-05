import OpenAI from 'openai';
import { supabase } from '../lib/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * OpenAI Embeddings Generator
 */
export class EmbeddingsGenerator {
  private openai: OpenAI;
  private model: string;
  private dimensions: number;
  private batchSize: number;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({ apiKey });
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
    this.dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '3072');
    this.batchSize = 50; // Process in batches to avoid rate limits
  }

  /**
   * Generate embeddings for all chunks without embeddings
   */
  async generateAllEmbeddings(): Promise<void> {
    try {
      console.log('Starting embedding generation...');

      // Get chunks without embeddings
      const { data: chunks, error } = await supabase
        .from('document_chunks')
        .select('id, chunk_text, document_id')
        .is('embedding', null)
        .order('created_at');

      if (error) {
        throw new Error(`Error fetching chunks: ${error.message}`);
      }

      if (!chunks || chunks.length === 0) {
        console.log('No chunks found that need embeddings');
        return;
      }

      console.log(`Found ${chunks.length} chunks to process`);

      // Process in batches
      const batches = this.createBatches(chunks, this.batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} chunks)`);

        try {
          await this.processBatch(batch);
          console.log(`✓ Completed batch ${i + 1}`);

          // Small delay to respect rate limits
          if (i < batches.length - 1) {
            await this.delay(1000);
          }
        } catch (error) {
          console.error(`Error processing batch ${i + 1}:`, error);
          // Continue with next batch rather than failing completely
        }
      }

      console.log('Embedding generation completed!');
      await this.getEmbeddingStats();
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Process a batch of chunks
   */
  private async processBatch(chunks: Array<{ id: string; chunk_text: string; document_id: string }>): Promise<void> {
    try {
      // Generate embeddings for all texts in the batch
      const texts = chunks.map(chunk => chunk.chunk_text);
      const embeddings = await this.generateEmbeddings(texts);

      // Update chunks with embeddings
      const updates = chunks.map((chunk, index) => ({
        id: chunk.id,
        embedding: embeddings[index]
      }));

      // Update in parallel for better performance
      const updatePromises = updates.map(update =>
        supabase
          .from('document_chunks')
          .update({ embedding: update.embedding })
          .eq('id', update.id)
      );

      const results = await Promise.all(updatePromises);

      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        console.error('Some updates failed:', errors.map(e => e.error));
      }
    } catch (error) {
      console.error('Error processing batch:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: texts,
        dimensions: this.dimensions
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get embedding statistics
   */
  async getEmbeddingStats(): Promise<void> {
    try {
      const { count: totalChunks } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true });

      const { count: embeddedChunks } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .not('embedding', 'is', null);

      const { count: missingChunks } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .is('embedding', null);

      console.log('\n=== Embedding Statistics ===');
      console.log(`Total chunks: ${totalChunks || 0}`);
      console.log(`Chunks with embeddings: ${embeddedChunks || 0}`);
      console.log(`Chunks missing embeddings: ${missingChunks || 0}`);

      if (embeddedChunks && totalChunks) {
        const percentage = totalChunks > 0
          ? ((embeddedChunks / totalChunks) * 100).toFixed(1)
          : '0';
        console.log(`Completion: ${percentage}%`);
      }
    } catch (error) {
      console.error('Error getting stats:', error);
    }
  }

  /**
   * Regenerate embeddings for all chunks (useful for model changes)
   */
  async regenerateAllEmbeddings(): Promise<void> {
    try {
      console.log('Clearing existing embeddings...');

      // Clear all embeddings
      const { error: clearError } = await supabase
        .from('document_chunks')
        .update({ embedding: null })
        .not('id', 'is', null);

      if (clearError) {
        throw new Error(`Error clearing embeddings: ${clearError.message}`);
      }

      console.log('Existing embeddings cleared');

      // Generate new embeddings
      await this.generateAllEmbeddings();
    } catch (error) {
      console.error('Error regenerating embeddings:', error);
      throw error;
    }
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'generate';

  const generator = new EmbeddingsGenerator();

  switch (command) {
    case 'generate':
      await generator.generateAllEmbeddings();
      break;

    case 'regenerate':
      await generator.regenerateAllEmbeddings();
      break;

    case 'stats':
      await generator.getEmbeddingStats();
      break;

    default:
      console.log('Usage: tsx generate.ts [generate|regenerate|stats]');
      console.log('Commands:');
      console.log('  generate   - Generate embeddings for chunks without them (default)');
      console.log('  regenerate - Clear and regenerate all embeddings');
      console.log('  stats      - Show embedding statistics');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}