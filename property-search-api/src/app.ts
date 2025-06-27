import express from 'express';

const app = express();

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Basic health check route for testing
app.get('/api/health', (req: express.Request, res: express.Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mock property search endpoint for testing
app.get('/api/properties/search', (req: express.Request, res: express.Response) => {
    // Basic validation
    const { query, price_min, price_max, bedrooms, bathrooms } = req.query;

    // Check for invalid inputs
    if (query === '' ||
        (price_min && isNaN(Number(price_min))) ||
        (price_max && isNaN(Number(price_max))) ||
        (bedrooms && (isNaN(Number(bedrooms)) || Number(bedrooms) > 20)) ||
        (bathrooms && (isNaN(Number(bathrooms)) || Number(bathrooms) > 10))) {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    // Check for malicious inputs
    const queryString = JSON.stringify(req.query).toLowerCase();
    const maliciousPatterns = ['<script', 'select', 'drop', 'insert', 'update', 'delete', 'union', '--'];
    if (maliciousPatterns.some(pattern => queryString.includes(pattern))) {
        return res.status(400).json({ error: 'Invalid characters detected' });
    }

    // Simulate some processing time
    setTimeout(() => {
        res.json({
            properties: [],
            total: 0,
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 20
        });
    }, Math.random() * 100); // Random delay 0-100ms
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

export { app };