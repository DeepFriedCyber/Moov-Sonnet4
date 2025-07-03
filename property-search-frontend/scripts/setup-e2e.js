#!/usr/bin/env node

/**
 * Setup script for E2E testing environment
 * This script helps developers get started with E2E testing
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎭 Setting up E2E Testing Environment...\n');

// Check if we're in the right directory
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ Error: package.json not found. Please run this script from the frontend directory.');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
if (packageJson.name !== 'property-search-frontend') {
  console.error('❌ Error: This script should be run from the property-search-frontend directory.');
  process.exit(1);
}

try {
  // Step 1: Install Playwright browsers
  console.log('📦 Installing Playwright browsers...');
  execSync('npx playwright install', { stdio: 'inherit' });
  console.log('✅ Playwright browsers installed\n');

  // Step 2: Check if services are running
  console.log('🔍 Checking if services are running...');
  
  const checkService = async (url, name) => {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`✅ ${name} is running at ${url}`);
        return true;
      } else {
        console.log(`⚠️  ${name} responded with status ${response.status} at ${url}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ ${name} is not running at ${url}`);
      return false;
    }
  };

  // Note: We can't use top-level await in this script, so we'll use promises
  Promise.all([
    checkService('http://localhost:3000', 'Frontend'),
    checkService('http://localhost:3001/health', 'Backend API'),
    checkService('http://localhost:8001/health', 'AI Service')
  ]).then(results => {
    const [frontendRunning, backendRunning, aiServiceRunning] = results;
    
    console.log('\n📋 Service Status Summary:');
    console.log(`Frontend (Next.js): ${frontendRunning ? '✅ Running' : '❌ Not running'}`);
    console.log(`Backend API: ${backendRunning ? '✅ Running' : '❌ Not running'}`);
    console.log(`AI Service: ${aiServiceRunning ? '✅ Running' : '❌ Not running'}`);

    if (!frontendRunning || !backendRunning || !aiServiceRunning) {
      console.log('\n⚠️  Some services are not running. E2E tests may fail.');
      console.log('\n🚀 To start services:');
      if (!frontendRunning) console.log('   Frontend: npm run dev');
      if (!backendRunning) console.log('   Backend: npm run dev --workspace=property-search-api');
      if (!aiServiceRunning) console.log('   AI Service: cd property-embedding-service && python src/main.py');
    }

    // Step 3: Run a simple test to verify setup
    console.log('\n🧪 Running a simple test to verify setup...');
    try {
      execSync('npx playwright test homepage.spec.ts --project=chromium', { stdio: 'inherit' });
      console.log('\n✅ E2E testing setup is complete and working!');
      
      console.log('\n🎉 Next Steps:');
      console.log('   • Run all E2E tests: npm run test:e2e');
      console.log('   • Run tests with UI: npm run test:e2e:ui');
      console.log('   • Debug tests: npm run test:e2e:debug');
      console.log('   • View test report: npx playwright show-report');
      
    } catch (error) {
      console.log('\n⚠️  Test run failed. This might be because:');
      console.log('   • Services are not running');
      console.log('   • Frontend components don\'t match test expectations');
      console.log('   • Network connectivity issues');
      console.log('\n🔧 Try running: npm run test:e2e:debug to investigate');
    }
  });

} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
}

// Helper function to create a simple fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = async (url) => {
    const https = require('https');
    const http = require('http');
    const urlModule = require('url');
    
    return new Promise((resolve, reject) => {
      const parsedUrl = urlModule.parse(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = client.request(parsedUrl, (res) => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage
        });
      });
      
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
  };
}