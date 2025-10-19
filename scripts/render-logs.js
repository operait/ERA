#!/usr/bin/env node
/**
 * Render Logs Fetcher
 *
 * Fetches logs from Render service using their API
 * Usage: npm run logs [-- --limit=100] [-- --follow] [-- --errors]
 */

const https = require('https');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;
const RENDER_OWNER_ID = process.env.RENDER_OWNER_ID;

if (!RENDER_API_KEY) {
  console.error('❌ Error: RENDER_API_KEY not found in .env file');
  console.error('\nTo set up Render log access:');
  console.error('1. Go to https://dashboard.render.com/account/settings');
  console.error('2. Create an API key under "API Keys"');
  console.error('3. Add to .env: RENDER_API_KEY=rnd_xxx...');
  console.error('4. Run: npm run logs:setup (to auto-configure IDs)');
  process.exit(1);
}

if (!RENDER_SERVICE_ID || !RENDER_OWNER_ID) {
  console.error('❌ Error: RENDER_SERVICE_ID or RENDER_OWNER_ID not found in .env file');
  console.error('\nRun: npm run logs:setup (to auto-configure IDs)');
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
const limitMatch = args.find(arg => arg.startsWith('--limit='));
const limit = limitMatch ? parseInt(limitMatch.split('=')[1]) : 100;
const follow = args.includes('--follow');
const errors = args.includes('--errors');

// Strip ANSI color codes
function stripAnsi(str) {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

function fetchLogs() {
  const options = {
    hostname: 'api.render.com',
    path: `/v1/logs?ownerId=${RENDER_OWNER_ID}&resource=${RENDER_SERVICE_ID}&limit=${limit}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Accept': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const response = JSON.parse(data);
          const logs = response.logs || [];

          if (logs.length === 0) {
            console.log('No logs available');
            return;
          }

          if (!follow) {
            console.log(`\n📋 Render Logs (last ${limit} entries)\n`);
            console.log('='.repeat(80));
          }

          logs.forEach(log => {
            const timestamp = new Date(log.timestamp).toLocaleString();
            const message = stripAnsi(log.message || '');

            // Filter for errors if --errors flag is set
            if (errors) {
              const lowerMsg = message.toLowerCase();
              if (lowerMsg.includes('error') || lowerMsg.includes('exception') || lowerMsg.includes('failed')) {
                console.log(`[${timestamp}] ${message}`);
              }
            } else {
              console.log(`[${timestamp}] ${message}`);
            }
          });

          if (!follow) {
            console.log('='.repeat(80));
            console.log(`\n✅ Fetched ${logs.length} log entries`);
            if (response.hasMore) {
              console.log('⚠️  More logs available (use --limit=N for more)');
            }
            console.log('');
          }
        } catch (e) {
          console.error('Error parsing logs:', e.message);
          console.error('Raw response:', data.substring(0, 500));
        }
      } else {
        console.error(`❌ Error fetching logs (HTTP ${res.statusCode})`);
        console.error('Response:', data.substring(0, 500));

        if (res.statusCode === 401) {
          console.error('\n⚠️  Authentication failed. Check your RENDER_API_KEY in .env');
        } else if (res.statusCode === 404) {
          console.error('\n⚠️  Service not found. Check your RENDER_SERVICE_ID in .env');
        }
      }
    });
  });

  req.on('error', (e) => {
    console.error('Request error:', e.message);
  });

  req.end();
}

// Fetch logs
if (!follow) {
  console.log('🔍 Fetching Render logs...\n');
}
fetchLogs();

if (follow) {
  console.log('\n👁️  Following logs (refreshing every 5 seconds, press Ctrl+C to stop)...\n');
  console.log('='.repeat(80));
  setInterval(fetchLogs, 5000); // Fetch every 5 seconds
}
