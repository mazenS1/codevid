const express = require('express');
const cors = require('cors');
const path = require('path');
const syntaxRoutes = require('./routes/syntax');
const { logger, requestLogger, getRequestStats } = require('./utils/logger');
const basicAuth = require('express-basic-auth');
const rateLimiter = require('./middleware/Ratelimte');

const app = express();

// Request logging
app.use(requestLogger);

// Rate limiter
app.use(rateLimiter({ maxRequests: 10, windowMs: 60 * 1000 }));

// CORS configuration
app.use(cors({
    origin: ['https://vidcode.fly.dev', 'http://localhost:5173', 'http://localhost:3000'],  
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Body parser
app.use(express.json());

// Serve the temp_videos directory as static
app.use('/temp_videos', express.static(path.join(__dirname, 'controllers/temp_videos')));

// Basic auth middleware for stats endpoint
const statsAuth = basicAuth({
    users: { 'admin': process.env.STATS_PASSWORD || 'changeme' },
    challenge: true
});

// API routes
app.use('/api', rateLimiter({ maxRequests: 50, windowMs: 30000 }) ,syntaxRoutes);

// Stats endpoint (protected)
app.get('/api/stats', statsAuth, (req, res) => {
    logger.info('Stats endpoint accessed', { 
        ip: req.ip,
        user: req.auth.user 
    });
    res.json(getRequestStats());
});

// Static files
app.use(express.static(path.join(__dirname, 'client/dist')));

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    });
    res.status(500).json({ error: 'Internal Server Error' });
});

// Catch-all route - should be last
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist', 'index.html')); 
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
