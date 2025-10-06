#!/usr/bin/env node

/**
 * ERA Data Verification Script
 * Check if data is loaded in Supabase database
 */

const { execSync } = require('child_process');

console.log('🔍 ERA Data Verification');
console.log('========================\n');

// Check environment
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

console.log('📋 Checking environment variables...');
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  process.exit(1);
}

console.log('✅ Environment variables present\n');

// Function to run command and return output
function runCommand(command, description) {
  console.log(`📊 ${description}...`);

  try {
    const output = execSync(command, {
      stdio: 'pipe',
      env: process.env,
      encoding: 'utf-8'
    });
    return output;
  } catch (error) {
    console.error(`❌ ${description} failed`);
    console.error(`   Error: ${error.message}`);
    return null;
  }
}

// Check document stats
console.log('🗄️  Database Statistics');
console.log('======================\n');

const docsOutput = runCommand('npx tsx src/ingestion/load-policies.ts stats', 'Checking documents');
if (docsOutput) {
  console.log(docsOutput);
}

// Check embedding stats
console.log('\n🧠 Embedding Statistics');
console.log('=======================\n');

const embeddingsOutput = runCommand('npx tsx src/embeddings/generate.ts stats', 'Checking embeddings');
if (embeddingsOutput) {
  console.log(embeddingsOutput);
}

console.log('\n✅ Data verification complete!');