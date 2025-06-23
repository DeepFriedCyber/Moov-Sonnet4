#!/usr/bin/env node

/**
 * Test script for Moov Property Search Platform
 * This script tests the complete semantic search pipeline
 */

const axios = require('axios');

const API_BASE = 'http://localhost:8000';
const EMBEDDING_SERVICE = 'http://localhost:8001';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testEmbeddingService() {
    console.log('🔧 Testing Embedding Service...');

    try {
        // Test health endpoint
        const healthResponse = await axios.get(`${EMBEDDING_SERVICE}/health`);
        console.log('✅ Embedding service health:', healthResponse.data);

        // Test embedding generation
        const embeddingResponse = await axios.post(`${EMBEDDING_SERVICE}/embed`, {
            texts: ["Modern flat with balcony near tube station"],
            model: "primary"
        });

        console.log('✅ Embedding generated:', {
            model_used: embeddingResponse.data.model_used,
            cached: embeddingResponse.data.cached,
            embedding_length: embeddingResponse.data.embeddings[0].length
        });

        return true;
    } catch (error) {
        console.error('❌ Embedding service test failed:', error.message);
        return false;
    }
}

async function testAPIService() {
    console.log('🔧 Testing API Service...');

    try {
        // Test health endpoint
        const healthResponse = await axios.get(`${API_BASE}/health`);
        console.log('✅ API service health:', healthResponse.data);

        return true;
    } catch (error) {
        console.error('❌ API service test failed:', error.message);
        return false;
    }
}

async function testSemanticSearch() {
    console.log('🔧 Testing Semantic Search...');

    try {
        const searchResponse = await axios.post(`${API_BASE}/api/search/semantic-v2`, {
            query: "Modern apartment with garden near good schools",
            page: 1,
            limit: 5,
            filters: {
                minPrice: 200000,
                maxPrice: 800000,
                propertyType: "flat"
            }
        });

        console.log('✅ Semantic search result:', {
            success: searchResponse.data.success,
            resultsFound: searchResponse.data.data?.length || 0,
            searchType: searchResponse.data.searchType,
            searchTime: searchResponse.data.searchMetadata?.searchTime
        });

        return true;
    } catch (error) {
        console.error('❌ Semantic search test failed:', error.response?.data || error.message);
        return false;
    }
}

async function testSearchSuggestions() {
    console.log('🔧 Testing Search Suggestions...');

    try {
        const suggestionsResponse = await axios.get(`${API_BASE}/api/search/suggestions?q=modern`);

        console.log('✅ Search suggestions:', {
            success: suggestionsResponse.data.success,
            suggestions: suggestionsResponse.data.data?.suggestions || []
        });

        return true;
    } catch (error) {
        console.error('❌ Search suggestions test failed:', error.response?.data || error.message);
        return false;
    }
}

async function runTests() {
    console.log('🚀 Starting Moov Property Search Platform Tests\n');

    const tests = [
        { name: 'Embedding Service', fn: testEmbeddingService },
        { name: 'API Service', fn: testAPIService },
        { name: 'Semantic Search', fn: testSemanticSearch },
        { name: 'Search Suggestions', fn: testSearchSuggestions },
    ];

    const results = [];

    for (const test of tests) {
        console.log(`\n--- ${test.name} ---`);
        const start = Date.now();
        const passed = await test.fn();
        const duration = Date.now() - start;

        results.push({ name: test.name, passed, duration });

        if (passed) {
            console.log(`✅ ${test.name} passed (${duration}ms)`);
        } else {
            console.log(`❌ ${test.name} failed (${duration}ms)`);
        }

        await delay(1000); // Wait between tests
    }

    console.log('\n📊 Test Results Summary:');
    console.log('========================');

    results.forEach(result => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${result.name} (${result.duration}ms)`);
    });

    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;

    console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);

    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! The system is ready for use.');
    } else {
        console.log('⚠️  Some tests failed. Please check the services and try again.');
    }
}

// Check if script is run directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests };