#!/usr/bin/env node

/**
 * ERA Data Deployment Script
 * Loads Fitness Connection HR policies and generates embeddings
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 ERA Data Deployment Script');
console.log('===============================\n');

// Check environment
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY'
];

console.log('📋 Checking environment variables...');
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\n💡 Set these in Render dashboard → Environment');
  process.exit(1);
}

console.log('✅ All required environment variables present\n');

// Check if data directory exists
const dataDir = './tenant/fitness_connection';
if (!fs.existsSync(dataDir)) {
  console.error(`❌ Data directory not found: ${dataDir}`);
  console.error('💡 Ensure the tenant folder is included in your deployment');
  process.exit(1);
}

// Count JSONL files
const jsonlFiles = fs.readdirSync(dataDir)
  .filter(file => file.endsWith('.jsonl'));

console.log(`📁 Found ${jsonlFiles.length} policy files in ${dataDir}:`);
jsonlFiles.forEach(file => {
  const filePath = path.join(dataDir, file);
  const stats = fs.statSync(filePath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  console.log(`   - ${file} (${sizeKB} KB)`);
});
console.log('');

// Function to run command with streaming output
function runCommand(command, description) {
  console.log(`📊 ${description}...`);
  console.log(`   Running: ${command}\n`);

  try {
    execSync(command, {
      stdio: 'inherit',
      env: process.env
    });
    console.log(`✅ ${description} completed\n`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed`);
    console.error(`   Error: ${error.message}\n`);
    return false;
  }
}

// Step 1: Clear existing data (optional - commented out for safety)
// console.log('⚠️  Would you like to clear existing data? (Skipping for safety)\n');

// Step 2: Load policy documents
console.log('📥 Step 1: Loading HR Policy Documents');
console.log('========================================\n');

if (!runCommand('npx tsx src/ingestion/load-policies.ts load', 'Document ingestion')) {
  console.error('💥 Failed to load documents. Check Supabase connection.');
  process.exit(1);
}

// Step 3: Generate embeddings
console.log('🧠 Step 2: Generating OpenAI Embeddings');
console.log('==========================================\n');
console.log('⏱️  This may take several minutes for ~900KB of content...\n');

if (!runCommand('npx tsx src/embeddings/generate.ts generate', 'Embedding generation')) {
  console.error('💥 Failed to generate embeddings. Check OpenAI API key and quota.');
  process.exit(1);
}

// Step 4: Verify deployment
console.log('✅ Step 3: Verifying Deployment');
console.log('==================================\n');

if (!runCommand('npx tsx src/ingestion/load-policies.ts stats', 'Data verification')) {
  console.error('⚠️  Warning: Could not verify deployment stats');
}

if (!runCommand('npx tsx src/embeddings/generate.ts stats', 'Embedding verification')) {
  console.error('⚠️  Warning: Could not verify embedding stats');
}

// Success!
console.log('\n🎉 Data Deployment Complete!');
console.log('============================\n');
console.log('✅ Fitness Connection HR policies loaded');
console.log('✅ Vector embeddings generated');
console.log('✅ ERA is ready to answer manager questions\n');
console.log('🧪 Test queries:');
console.log('   - "Employee missed 3 shifts without calling in"');
console.log('   - "How do I issue a written warning?"');
console.log('   - "What\'s the termination process?"\n');
console.log('📱 Next: Configure Teams bot in Azure');
console.log('   Messaging endpoint: https://your-app.onrender.com/api/messages\n');