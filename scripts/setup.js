#!/usr/bin/env node

/**
 * ERA Setup Script - Automated setup for development
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🤖 ERA MVP Setup Script');
console.log('========================\n');

// Check if .env file exists
if (!fs.existsSync('.env')) {
  console.log('❌ .env file not found!');
  console.log('📝 Please copy .env.example to .env and configure your API keys');
  process.exit(1);
}

// Read .env file and check for placeholder values
const envContent = fs.readFileSync('.env', 'utf8');
if (envContent.includes('your-project.supabase.co') ||
    envContent.includes('your-openai-api-key')) {
  console.log('⚠️  .env file contains placeholder values');
  console.log('📝 Please update .env with your actual API keys and database URL');
  console.log('\nRequired:');
  console.log('- SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY');
  console.log('- OPENAI_API_KEY');
  process.exit(1);
}

console.log('✅ Environment variables configured');

// Check if data directory exists
if (!fs.existsSync('./data/sample-policies.jsonl')) {
  console.log('❌ Sample data not found!');
  console.log('📁 Please ensure ./data/sample-policies.jsonl exists');
  process.exit(1);
}

console.log('✅ Sample data found');

// Build the project
console.log('\n📦 Building TypeScript...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build successful');
} catch (error) {
  console.log('❌ Build failed');
  process.exit(1);
}

// Load data
console.log('\n📊 Loading HR policies...');
try {
  execSync('npm run ingest', { stdio: 'inherit' });
  console.log('✅ Data loaded successfully');
} catch (error) {
  console.log('❌ Data loading failed - check your database connection');
  console.log('💡 Make sure your Supabase database is set up and migrations are run');
  process.exit(1);
}

// Generate embeddings
console.log('\n🧠 Generating embeddings...');
try {
  execSync('npm run embeddings', { stdio: 'inherit' });
  console.log('✅ Embeddings generated successfully');
} catch (error) {
  console.log('❌ Embedding generation failed - check your OpenAI API key');
  process.exit(1);
}

console.log('\n🎉 Setup completed successfully!');
console.log('\n🚀 Next steps:');
console.log('1. Run: npm run dev');
console.log('2. Test at: http://localhost:3978');
console.log('3. Try query: "Employee missed 3 shifts without calling in"');
console.log('\n📖 See setup.md for Teams bot configuration');