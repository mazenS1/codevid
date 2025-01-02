const winston = require('winston');
const { format } = winston;

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    defaultMeta: { service: 'vidcode-server' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

// If we're not in production, log to the console with colors
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: format.combine(
            format.colorize(),
            format.simple()
        )
    }));
}

// Request counter
let requestCount = {
    total: 0,
    byEndpoint: {},
    byMethod: {},
    byStatus: {}
};

// Create a function to get stats
const getRequestStats = () => ({
    ...requestCount,
    timestamp: new Date().toISOString()
});

// Reset stats function (useful for periodic resets if needed)
const resetRequestStats = () => {
    requestCount = {
        total: 0,
        byEndpoint: {},
        byMethod: {},
        byStatus: {}
    };
};

// Request logging middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    // Increment counters before processing
    requestCount.total++;
    
    // Track by endpoint - group static assets
    let endpoint = req.path;
    if (endpoint.startsWith('/assets/')) {
        endpoint = '/assets/*';
    } else if (endpoint.startsWith('/temp_videos/')) {
        endpoint = '/temp_videos/*';
    }
    requestCount.byEndpoint[endpoint] = (requestCount.byEndpoint[endpoint] || 0) + 1;
    
    // Track by method
    requestCount.byMethod[req.method] = (requestCount.byMethod[req.method] || 0) + 1;
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        
        // Track by status code
        const status = res.statusCode;
        requestCount.byStatus[status] = (requestCount.byStatus[status] || 0) + 1;
        
        // Skip logging for static assets in non-production
        const isStaticAsset = endpoint === '/assets/*' || endpoint === '/favicon.ico';
        if (process.env.NODE_ENV === 'production' || !isStaticAsset) {
            logger.info('Request processed', {
                method: req.method,
                url: req.url,
                endpoint,
                status: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip,
                userAgent: req.get('user-agent'),
                requestStats: getRequestStats()
            });
        }
    });
    next();
};

// Log stats periodically (every hour)
setInterval(() => {
    logger.info('Hourly request statistics', {
        stats: getRequestStats()
    });
}, 3600000);

module.exports = { 
    logger, 
    requestLogger,
    getRequestStats,
    resetRequestStats 
};
