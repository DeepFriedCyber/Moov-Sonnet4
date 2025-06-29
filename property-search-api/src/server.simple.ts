// ============================================================================
// Simple Server for Testing Enhanced Search Integration
// ============================================================================

import { app } from './app';

const PORT = process.env.PORT || 3001;

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Property Search API Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🧠 Enhanced search: http://localhost:${PORT}/api/enhanced-search`);
    console.log(`🎯 Ready for integration testing!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Server shutting down gracefully...');
    process.exit(0);
});