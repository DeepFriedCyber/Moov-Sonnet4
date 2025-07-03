# Ranking Configuration Examples

This document shows how to tune the search algorithm using environment variables.

## Default Configuration

Without any environment variables, the system uses balanced weights:

```bash
# Default behavior
npm start
```

**Default weights:**
- Base semantic score: 50%
- City match: 10%
- Postcode prefix: 5%
- Feature match: 5% per feature
- Price in range: 10%
- Bedroom match: 5%
- Bathroom match: 5%
- Property type match: 10%
- Freshness boost: 5% (< 7 days)
- Super freshness: 5% (< 1 day)

## Feature-Heavy Configuration

Prioritize properties with specific features (gardens, parking, etc.):

```bash
RANKING_WEIGHTS='{"baseScore":0.2,"featureMatch":0.6,"cityMatch":0.1,"propertyTypeMatch":0.1}' npm start
```

**Result:** Properties with matching features will rank much higher, even with lower semantic similarity.

## Location-First Configuration

Prioritize exact location matches:

```bash
RANKING_WEIGHTS='{"baseScore":0.3,"cityMatch":0.4,"postcodePrefixMatch":0.2,"featureMatch":0.1}' npm start
```

**Result:** Properties in the exact city/postcode area will rank highest.

## Price-Sensitive Configuration

Prioritize properties within budget:

```bash
RANKING_WEIGHTS='{"baseScore":0.4,"priceInRange":0.4,"bedroomMatch":0.1,"bathroomMatch":0.1}' npm start
```

**Result:** Properties within the specified price range get significant boost.

## Fresh Listings Configuration

Prioritize newly listed properties:

```bash
RANKING_WEIGHTS='{"baseScore":0.4,"freshnessBoost":0.3,"superFreshnessBoost":0.3}' npm start
```

**Result:** Recently listed properties (especially < 1 day) rank much higher.

## A/B Testing Example

You can easily A/B test different ranking strategies:

```bash
# Version A: Balanced
RANKING_WEIGHTS='{"baseScore":0.5,"cityMatch":0.1,"featureMatch":0.1,"priceInRange":0.1,"propertyTypeMatch":0.1,"freshnessBoost":0.1}' npm start

# Version B: Feature-focused
RANKING_WEIGHTS='{"baseScore":0.3,"featureMatch":0.4,"cityMatch":0.1,"priceInRange":0.1,"propertyTypeMatch":0.1}' npm start
```

## Production Tuning

Based on user behavior analytics, you might discover:

```bash
# Data shows users prefer exact location matches and recent listings
RANKING_WEIGHTS='{"baseScore":0.3,"cityMatch":0.25,"freshnessBoost":0.15,"superFreshnessBoost":0.15,"featureMatch":0.1,"priceInRange":0.05}' npm start
```

## Invalid Configuration Handling

If invalid JSON is provided, the service will fail to start (fail-fast principle):

```bash
# This will cause startup failure
RANKING_WEIGHTS='invalid-json' npm start
```

This ensures configuration errors are caught early rather than causing runtime issues.