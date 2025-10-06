import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase.js';
import { chunkByStructure } from '../lib/chunker.js';
import { JSONLDocument, PolicyDocument, DocumentChunk } from '../types/index.js';

/**
 * Load and process JSONL policy files into the database
 */
export class PolicyLoader {
  private readonly dataDir: string;

  constructor(dataDir: string = './tenant/fitness_connection') {
    this.dataDir = dataDir;
  }

  /**
   * Load all JSONL files from the data directory
   */
  async loadAllPolicies(): Promise<void> {
    try {
      console.log(`Loading policies from ${this.dataDir}...`);

      if (!fs.existsSync(this.dataDir)) {
        console.error(`Data directory ${this.dataDir} does not exist`);
        return;
      }

      const files = fs.readdirSync(this.dataDir)
        .filter(file => file.endsWith('.jsonl'));

      if (files.length === 0) {
        console.log('No JSONL files found in data directory');
        return;
      }

      console.log(`Found ${files.length} JSONL files: ${files.join(', ')}`);

      for (const file of files) {
        await this.loadFile(path.join(this.dataDir, file));
      }

      console.log('All policies loaded successfully!');
    } catch (error) {
      console.error('Error loading policies:', error);
      throw error;
    }
  }

  /**
   * Load a single JSONL file
   */
  async loadFile(filePath: string): Promise<void> {
    console.log(`Processing file: ${filePath}`);

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());

    for (const [index, line] of lines.entries()) {
      try {
        const jsonlDoc: JSONLDocument = JSON.parse(line);
        await this.processDocument(jsonlDoc, `${path.basename(filePath)}-${index}`);
      } catch (error) {
        console.error(`Error processing line ${index + 1} in ${filePath}:`, error);
      }
    }
  }

  /**
   * Process a single document from JSONL
   */
  private async processDocument(jsonlDoc: JSONLDocument, sourceId: string): Promise<void> {
    try {
      // Insert document
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          title: jsonlDoc.title,
          content: jsonlDoc.content,
          category: jsonlDoc.category,
          metadata: {
            ...jsonlDoc.metadata,
            source_id: sourceId,
            processed_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (docError) {
        console.error('Error inserting document:', docError);
        return;
      }

      console.log(`Inserted document: ${document.title}`);

      // Chunk the document
      const chunks = chunkByStructure(jsonlDoc.content);
      console.log(`Created ${chunks.length} chunks for ${document.title}`);

      // Insert chunks (without embeddings for now)
      const chunkInserts = chunks.map((chunk, index) => ({
        document_id: document.id,
        chunk_text: chunk.text,
        chunk_index: index,
        metadata: {
          ...chunk.metadata,
          word_count: chunk.text.split(' ').length,
          char_count: chunk.text.length
        }
      }));

      const { error: chunkError } = await supabase
        .from('document_chunks')
        .insert(chunkInserts);

      if (chunkError) {
        console.error('Error inserting chunks:', chunkError);
        return;
      }

      console.log(`Inserted ${chunks.length} chunks for ${document.title}`);
    } catch (error) {
      console.error(`Error processing document ${sourceId}:`, error);
    }
  }

  /**
   * Clear all existing documents and chunks
   */
  async clearDatabase(): Promise<void> {
    try {
      console.log('Clearing existing documents...');

      const { error: chunksError } = await supabase
        .from('document_chunks')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (chunksError) {
        console.error('Error clearing chunks:', chunksError);
        return;
      }

      const { error: docsError } = await supabase
        .from('documents')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (docsError) {
        console.error('Error clearing documents:', docsError);
        return;
      }

      console.log('Database cleared successfully');
    } catch (error) {
      console.error('Error clearing database:', error);
      throw error;
    }
  }

  /**
   * Get statistics about loaded documents
   */
  async getStats(): Promise<void> {
    try {
      const { data: docStats } = await supabase
        .from('documents')
        .select('category')
        .order('category');

      const { data: chunkStats } = await supabase
        .from('document_chunks')
        .select('id');

      const categories = docStats?.reduce((acc, doc) => {
        acc[doc.category] = (acc[doc.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      console.log('\n=== Database Statistics ===');
      console.log(`Total documents: ${docStats?.length || 0}`);
      console.log(`Total chunks: ${chunkStats?.length || 0}`);
      console.log('Documents by category:');
      Object.entries(categories).forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
      });
    } catch (error) {
      console.error('Error getting stats:', error);
    }
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'load';
  const dataDir = args[1] || './tenant/fitness_connection';

  const loader = new PolicyLoader(dataDir);

  switch (command) {
    case 'load':
      await loader.loadAllPolicies();
      await loader.getStats();
      break;

    case 'clear':
      await loader.clearDatabase();
      console.log('Database cleared');
      break;

    case 'reload':
      await loader.clearDatabase();
      await loader.loadAllPolicies();
      await loader.getStats();
      break;

    case 'stats':
      await loader.getStats();
      break;

    default:
      console.log('Usage: tsx load-policies.ts [load|clear|reload|stats] [data-directory]');
      console.log('Commands:');
      console.log('  load   - Load JSONL files into database (default)');
      console.log('  clear  - Clear all documents from database');
      console.log('  reload - Clear and reload all documents');
      console.log('  stats  - Show database statistics');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}