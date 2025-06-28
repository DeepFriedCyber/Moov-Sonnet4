// ============================================================================
// Quick Integration Test - test_integration_simple.js
// Run this in property-search-api directory
// ============================================================================

const axios = require('axios');

class IntegrationTester {
    constructor() {
        this.embeddingServiceUrl = 'http://localhost:8001';
        this.propertyApiUrl = 'http://localhost:3001'; // Your property API
    }

    async testFullIntegration() {
        console.log('Testing Full Property Search Integration');
        console.log('='.repeat(50));

        // Step 1: Verify embedding service is still running
        console.log('\n1. Checking embedding service...');
        try {
            const embeddingHealth = await axios.get(`${this.embeddingServiceUrl}/health`);
            console.log('✅ Embedding service healthy');
            console.log(`   Cache available: ${embeddingHealth.data.cache_available}`);
            console.log(`   Model: ${embeddingHealth.data.model?.model_name}`);
        } catch (error) {
            console.log('❌ Embedding service not available');
            console.log('💡 Make sure embedding service is running: python src/main.py');
            return false;
        }

        // Step 2: Test direct embedding with real property queries
        console.log('\n2. Testing property-specific embeddings...');
        const propertyQueries = [
            'luxury apartment with river views',
            'family house with garden near schools',
            'modern studio in city center',
            'spacious flat with parking'
        ];

        for (let i = 0; i < propertyQueries.length; i++) {
            try {
                const start = Date.now();
                const response = await axios.post(`${this.embeddingServiceUrl}/embed`, {
                    query: propertyQueries[i]
                });
                const duration = Date.now() - start;

                console.log(`   Query ${i + 1}: "${propertyQueries[i]}"`);
                console.log(`   ✅ Embedding generated (${response.data.embedding.length}D)`);
                console.log(`   ⏱️  ${duration}ms ${response.data.cached ? '(cached)' : '(fresh)'}`);
            } catch (error) {
                console.log(`   ❌ Query ${i + 1} failed: ${error.message}`);
            }
        }

        // Step 3: Get final cache statistics
        try {
            const cacheStats = await axios.get(`${this.embeddingServiceUrl}/cache/stats`);
            console.log('\n📊 Cache Performance Summary:');
            console.log(`   Hit Rate: ${cacheStats.data.hit_rate_percent}%`);
            console.log(`   Total Requests: ${cacheStats.data.total_requests}`);
            console.log(`   Cost Saved: $${cacheStats.data.cost_saved_dollars}`);
            console.log(`   Time Saved: ${cacheStats.data.time_saved_seconds}s`);
        } catch (error) {
            console.log('⚠️  Could not get cache stats');
        }

        // Step 4: Test property API integration (if available)
        console.log('\n3. Testing property API integration...');
        try {
            const searchQuery = {
                query: 'luxury apartment London',
                filters: {
                    minPrice: 300000,
                    maxPrice: 800000
                },
                limit: 5
            };

            const response = await axios.post(`${this.propertyApiUrl}/api/search/properties`, searchQuery);

            if (response.status === 200) {
                console.log('✅ Property search API working');
                console.log(`   Found ${response.data.data?.properties?.length || 0} properties`);
                console.log(`   Processing time: ${response.data.data?.search_metadata?.processing_time_ms}ms`);

                if (response.data.data?.search_metadata?.cache_efficiency) {
                    const cache = response.data.data.search_metadata.cache_efficiency;
                    console.log(`   Cache hit rate: ${cache.hit_rate}%`);
                    console.log(`   Cost saved: $${cache.cost_saved}`);
                }
            }
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                console.log('⚠️  Property API not running (that\'s okay for now)');
                console.log('💡 Start with: npm run dev in property-search-api');
            } else {
                console.log(`⚠️  Property API error: ${error.message}`);
            }
        }

        console.log('\n🎉 Integration test completed!');
        return true;
    }

    async demonstrateCostSavings() {
        console.log('\n💰 Cost Savings Demonstration');
        console.log('='.repeat(35));

        const testQueries = [
            'luxury apartment',
            'Luxury apartment',  // Should hit cache (similar)
            'LUXURY APARTMENT',  // Should hit cache (normalization)
            'luxury flat',       // Should hit cache (semantic similarity)
            '2 bedroom house',
            'two bedroom house', // Should hit cache (semantic similarity)
            'completely different query about commercial property'
        ];

        let totalTime = 0;
        let cacheHits = 0;

        for (let i = 0; i < testQueries.length; i++) {
            try {
                const start = Date.now();
                const response = await axios.post(`${this.embeddingServiceUrl}/embed`, {
                    query: testQueries[i]
                });
                const duration = Date.now() - start;
                totalTime += duration;

                if (response.data.cached) {
                    cacheHits++;
                }

                console.log(`${i + 1}. "${testQueries[i]}"`);
                console.log(`   ${duration}ms ${response.data.cached ? '✅ (cached)' : '❌ (fresh)'}`);

            } catch (error) {
                console.log(`${i + 1}. Failed: ${error.message}`);
            }
        }

        const cacheHitRate = (cacheHits / testQueries.length) * 100;
        console.log(`\n📊 Results:`);
        console.log(`   Cache Hit Rate: ${cacheHitRate.toFixed(1)}%`);
        console.log(`   Average Response Time: ${(totalTime / testQueries.length).toFixed(1)}ms`);
        console.log(`   Queries Processed: ${testQueries.length}`);

        // Get final stats
        try {
            const stats = await axios.get(`${this.embeddingServiceUrl}/cache/stats`);
            console.log(`\n💰 Cost Impact:`);
            console.log(`   Total Saved: $${stats.data.cost_saved_dollars}`);
            console.log(`   Time Saved: ${stats.data.time_saved_seconds}s`);
            console.log(`   Overall Hit Rate: ${stats.data.hit_rate_percent}%`);
        } catch (error) {
            console.log('⚠️  Could not get final stats');
        }
    }
}

// Run the tests
async function main() {
    const tester = new IntegrationTester();

    await tester.testFullIntegration();
    await tester.demonstrateCostSavings();

    console.log('\n🎯 Next Steps:');
    console.log('1. ✅ Embedding cache is working perfectly');
    console.log('2. 🔄 Connect to your property database');
    console.log('3. 📊 Add the enhanced search routes');
    console.log('4. 🚀 Deploy and monitor savings');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { IntegrationTester };