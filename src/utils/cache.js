const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

let redis = null;
let redisAvailableFlag = false;

try {
  redis = new Redis(config.redis);
  
  redis.on('connect', () => {
    redisAvailableFlag = true;
    logger.info('🟢 Redis connected successfully');
  });

  redis.on('ready', () => {
    redisAvailableFlag = true;
  });
  
  redis.on('error', (err) => {
    redisAvailableFlag = false;
    logger.warn('Redis error (caching disabled):', err.message);
  });
  
  redis.on('close', () => {
    redisAvailableFlag = false;
    logger.warn('Redis connection closed');
  });
} catch (err) {
  logger.warn('Redis initialization failed, caching disabled:', err.message);
  redisAvailableFlag = false;
}

const isRedisAvailable = () => {
  return Boolean(redis && (redis.status === 'ready' || redis.status === 'connect' || redisAvailableFlag));
};

// Cache wrapper with TTL (gracefully degrades if Redis unavailable)
const cacheSet = async (key, value, ttl = 3600) => {
  if (!isRedisAvailable() || !redis) return;
  try {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await redis.setex(key, ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }
  } catch (error) {
    logger.warn('Cache set error:', error.message);
  }
};

const cacheGet = async (key) => {
  if (!isRedisAvailable() || !redis) return null;
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.warn('Cache get error:', error.message);
    return null;
  }
};

const cacheDel = async (key) => {
  if (!isRedisAvailable() || !redis) return;
  try {
    await redis.del(key);
  } catch (error) {
    logger.warn('Cache delete error:', error.message);
  }
};

const cacheClear = async (pattern) => {
  if (!isRedisAvailable() || !redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.warn('Cache clear error:', error.message);
  }
};

module.exports = {
  redis,
  redisAvailable: isRedisAvailable,
  cacheSet,
  cacheGet,
  cacheDel,
  cacheClear,
};
