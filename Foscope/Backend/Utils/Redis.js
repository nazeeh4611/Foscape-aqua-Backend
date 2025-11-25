// config/redis.js
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

let redisClient = null;

export const initRedis = () => {
  try {
    // For production, use Redis
    if (process.env.NODE_ENV === 'production' && process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      redisClient.on('connect', () => {
        console.log('✅ Redis connected successfully');
      });

      redisClient.on('error', (err) => {
        console.error('❌ Redis error:', err);
      });
    } else {
      // For development, use in-memory cache fallback
      console.log('⚠️ Redis not configured, using in-memory cache');
      redisClient = null;
    }
  } catch (error) {
    console.error('❌ Redis initialization failed:', error);
    redisClient = null;
  }
};

// In-memory cache fallback
const memoryCache = new Map();
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const getCache = async (key) => {
  try {
    if (redisClient && redisClient.status === 'ready') {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } else {
      // Fallback to memory cache
      const cached = memoryCache.get(key);
      if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
        return cached.data;
      }
      memoryCache.delete(key);
      return null;
    }
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

export const setCache = async (key, data, ttl = 300) => {
  try {
    if (redisClient && redisClient.status === 'ready') {
      await redisClient.setex(key, ttl, JSON.stringify(data));
    } else {
      // Fallback to memory cache
      memoryCache.set(key, {
        data,
        timestamp: Date.now()
      });
      
      // Cleanup old entries
      if (memoryCache.size > 100) {
        const firstKey = memoryCache.keys().next().value;
        memoryCache.delete(firstKey);
      }
    }
  } catch (error) {
    console.error('Cache set error:', error);
  }
};

export const deleteCache = async (key) => {
  try {
    if (redisClient && redisClient.status === 'ready') {
      await redisClient.del(key);
    } else {
      memoryCache.delete(key);
    }
  } catch (error) {
    console.error('Cache delete error:', error);
  }
};

export const deleteCachePattern = async (pattern) => {
  try {
    if (redisClient && redisClient.status === 'ready') {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } else {
      // For memory cache, delete all keys matching pattern
      for (const key of memoryCache.keys()) {
        if (key.includes(pattern.replace('*', ''))) {
          memoryCache.delete(key);
        }
      }
    }
  } catch (error) {
    console.error('Cache pattern delete error:', error);
  }
};

export { redisClient };