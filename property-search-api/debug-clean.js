// Detailed debug of the QueryParser logic
const query = 'family home near good schools with garden safe for children';

console.log('=== DEBUGGING QUERY PARSER ===');
console.log('Query:', query);

// Test the proximity patterns first
const proximityPatterns = [
  /\b(?:near|close to|by|beside|next to|walking distance to|minutes? from)\s+(?:a|an|the)?\s*([^,\.!]+?)(?:\s*,|\s+and\s+|\s*$)/gi,
];

console.log('\n--- Testing proximity patterns ---');
for (const pattern of proximityPatterns) {
  const matches = [...query.matchAll(pattern)];
  console.log('Pattern:', pattern);
  console.log('Matches:', matches);
}

// Test the list patterns
const listPatterns = [
  /near\s+([^\.!\s]+(?:\s+[^\.!\s]+)*?)(?:\s+(?:with|and|for|in|on|at|to|from|by|of|that|which|where|when|while|safe|secure|quiet|peaceful)|\s*[\.]|$)/i,
];

console.log('\n--- Testing list patterns ---');
for (const pattern of listPatterns) {
  const match = query.match(pattern);
  console.log('Pattern:', pattern);
  console.log('Match:', match);
  if (match) {
    console.log('Captured:', match[1]);
    
    // Test cleaning
    const placesText = match[1];
    const commaParts = placesText.split(/\s*,\s*/);
    console.log('Comma parts:', commaParts);
    
    const allPlaces = [];
    for (const part of commaParts) {
      const andParts = part.split(/\s+and\s+/);
      console.log(`And parts for "${part}":`, andParts);
      allPlaces.push(...andParts);
    }
    
    console.log('All places:', allPlaces);
    
    // Test cleaning each place
    for (const place of allPlaces) {
      const cleaned = place
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/^(?:and|or)\s+/i, '')
        .replace(/^(?:good|great|excellent|nice|local)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      console.log(`Cleaned "${place}" to "${cleaned}"`);
    }
  }
}// Detailed debug of the QueryParser logic
const query = 'family home near good schools with garden safe for children';

console.log('=== DEBUGGING QUERY PARSER ===');
console.log('Query:', query);

// Test the proximity patterns first
const proximityPatterns = [
  /\b(?:near|close to|by|beside|next to|walking distance to|minutes? from)\s+(?:a|an|the)?\s*([^,\.!]+?)(?:\s*,|\s+and\s+|\s*$)/gi,
];

console.log('\n--- Testing proximity patterns ---');
for (const pattern of proximityPatterns) {
  const matches = [...query.matchAll(pattern)];
  console.log('Pattern:', pattern);
  console.log('Matches:', matches);
}

// Test the list patterns
const listPatterns = [
  /near\s+([^\.!\s]+(?:\s+[^\.!\s]+)*?)(?:\s+(?:with|and|for|in|on|at|to|from|by|of|that|which|where|when|while|safe|secure|quiet|peaceful)|\s*[\.]|$)/i,
];

console.log('\n--- Testing list patterns ---');
for (const pattern of listPatterns) {
  const match = query.match(pattern);
  console.log('Pattern:', pattern);
  console.log('Match:', match);
  if (match) {
    console.log('Captured:', match[1]);
    
    // Test cleaning
    const placesText = match[1];
    const commaParts = placesText.split(/\s*,\s*/);
    console.log('Comma parts:', commaParts);
    
    const allPlaces = [];
    for (const part of commaParts) {
      const andParts = part.split(/\s+and\s+/);
      console.log(`And parts for "${part}":`, andParts);
      allPlaces.push(...andParts);
    }
    
    console.log('All places:', allPlaces);
    
    // Test cleaning each place
    for (const place of allPlaces) {
      const cleaned = place
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/^(?:and|or)\s+/i, '')
        .replace(/^(?:good|great|excellent|nice|local)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      console.log(`Cleaned "${place}" to "${cleaned}"`);
    }
  }
}