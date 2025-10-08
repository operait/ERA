import { DocumentRetriever } from './src/retrieval/search';
import dotenv from 'dotenv';

dotenv.config();

async function testSearch() {
  console.log('Testing RAG search...\n');

  const retriever = new DocumentRetriever();
  const query = "What should I do if my employee doesn't show up for 3 days in a row?";

  console.log(`Query: "${query}"\n`);

  try {
    // Test with different thresholds
    console.log('Testing with threshold 0.70 (HR Context):');
    let context = await retriever.getHRContext(query);
    console.log(`Results: ${context.totalResults}, Avg similarity: ${context.avgSimilarity.toFixed(3)}\n`);

    if (context.totalResults === 0) {
      console.log('Testing with threshold 0.50:');
      context = await retriever.search(query, {
        maxResults: 5,
        similarityThreshold: 0.50,
        includeMetadata: true
      });
      console.log(`Results: ${context.totalResults}, Avg similarity: ${context.avgSimilarity.toFixed(3)}\n`);
    }

    if (context.totalResults === 0) {
      console.log('Testing with threshold 0.30:');
      context = await retriever.search(query, {
        maxResults: 5,
        similarityThreshold: 0.30,
        includeMetadata: true
      });
      console.log(`Results: ${context.totalResults}, Avg similarity: ${context.avgSimilarity.toFixed(3)}\n`);
    }

    console.log('=== Search Results ===');
    console.log(`Total results: ${context.totalResults}`);
    console.log(`Average similarity: ${context.avgSimilarity.toFixed(3)}`);
    console.log(`Categories: ${context.categories.join(', ')}`);
    console.log(`Retrieval time: ${context.retrievalTimeMs}ms\n`);

    if (context.results.length > 0) {
      console.log('Top results:');
      context.results.forEach((result, i) => {
        console.log(`\n${i + 1}. ${result.document_title}`);
        console.log(`   Similarity: ${result.similarity?.toFixed(3)}`);
        console.log(`   Category: ${result.category}`);
        console.log(`   Content preview: ${result.content.substring(0, 150)}...`);
      });
    } else {
      console.log('⚠️ No results found!');
    }
  } catch (error) {
    console.error('Error during search:', error);
  }
}

testSearch();
