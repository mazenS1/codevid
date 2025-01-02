const { Redis } = require('@upstash/redis');
require('dotenv').config();

// Initialize Redis client with Upstash
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Rate limiter middleware using Upstash Redis
 * @param {Object} options - Configuration options
 * @param {number} options.maxRequests - Maximum number of requests allowed in the window
 * @param {number} options.windowMs - Time window in milliseconds
 */
const rateLimiter = (options = {}) => {
  const maxRequests = options.maxRequests || 10; // default 100 requests
  const windowMs = options.windowMs || 60000; // default 1 minute

  return async (req, res, next) => {
    try {
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const key = `ratelimit:${ip}`;

      // Get the current count and timestamp
      const [count, timestamp] = await redis.mget([key, `${key}:timestamp`]);
      const currentTime = Date.now();

      // If this is the first request or the window has expired
      if (!count || !timestamp || currentTime - parseInt(timestamp) >= windowMs) {
        await redis.mset({
          [key]: 1,
          [`${key}:timestamp`]: currentTime,
        });
        await redis.expire(key, Math.ceil(windowMs / 1000)); // Convert ms to seconds
        await redis.expire(`${key}:timestamp`, Math.ceil(windowMs / 1000));

        // Set rate limit headers
        setRateLimitHeaders(res, maxRequests, maxRequests - 1, Math.ceil((parseInt(timestamp) + windowMs - currentTime) / 1000));
        return next();
      }

      const currentCount = parseInt(count);

      if (currentCount >= maxRequests) {
        // Set rate limit headers
        setRateLimitHeaders(res, maxRequests, 0, Math.ceil((parseInt(timestamp) + windowMs - currentTime) / 1000));
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
        });
      }

      // Increment the counter
      await redis.incr(key);

      // Set rate limit headers
      setRateLimitHeaders(res, maxRequests, maxRequests - currentCount - 1, Math.ceil((parseInt(timestamp) + windowMs - currentTime) / 1000));
      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // If Redis fails, we'll skip rate limiting rather than blocking all requests
      next();
    }
  };
};

/**
 * Set rate limit headers
 * @param {Object} res - Express response object
 * @param {number} limit - Maximum requests allowed
 * @param {number} remaining - Remaining requests
 * @param {number} reset - Seconds until reset
 */
function setRateLimitHeaders(res, limit, remaining, reset) {
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
  res.setHeader('X-RateLimit-Reset', reset);
}

module.exports = rateLimiter;