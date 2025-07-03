// property-search-api/src/config.ts

// Parse env vars with sensible defaults.
// The '||' operator provides a fallback if the env var is not set.
export const CACHE_TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || '300', 10);
export const SEARCH_RESULT_LIMIT = parseInt(process.env.SEARCH_RESULT_LIMIT || '50', 10);

// Default weights for the ranking algorithm
const defaultRankingWeights = {
    baseScore: 0.5,
    cityMatch: 0.1,
    postcodePrefixMatch: 0.05,
    featureMatch: 0.05, // per feature
    priceInRange: 0.1,
    bedroomMatch: 0.05,
    bathroomMatch: 0.05,
    propertyTypeMatch: 0.1,
    freshnessBoost: 0.05, // < 7 days
    superFreshnessBoost: 0.05, // < 1 day
};

// Allow overriding weights via a JSON string in an environment variable
export const rankingWeights = {
    ...defaultRankingWeights,
    ...(process.env.RANKING_WEIGHTS ? JSON.parse(process.env.RANKING_WEIGHTS) : {}),
};

// We can add more configuration here as the app grows.