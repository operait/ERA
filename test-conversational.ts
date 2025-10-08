import { DocumentRetriever } from './src/retrieval/search';
import { ResponseGenerator } from './src/templates/generator';
import dotenv from 'dotenv';

dotenv.config();

async function testConversationalResponse() {
  console.log('Testing conversational AI response...\n');

  const retriever = new DocumentRetriever();
  const generator = new ResponseGenerator();

  const query = "What should I do if my employee doesn't show up for 3 days in a row?";

  console.log(`Question: "${query}"\n`);

  try {
    // Get search context
    console.log('Searching for relevant policies...');
    const context = await retriever.getHRContext(query);
    console.log(`Found ${context.totalResults} results\n`);

    if (context.totalResults === 0) {
      console.log('❌ No results found');
      return;
    }

    // Generate conversational response
    console.log('Generating conversational response with Claude...\n');
    const response = await generator.generateResponse(query, context);

    console.log('=== ERA Response ===');
    console.log(response.response);
    console.log('\n=== Metadata ===');
    console.log(`Context chunks used: ${response.context_chunks}`);
    console.log(`Confidence score: ${response.confidence_score.toFixed(3)}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

testConversationalResponse();
