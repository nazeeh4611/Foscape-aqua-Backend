// Utils/Redis.js
import Redis from 'ioredis';
import { promisify } from 'util';
import zlib from 'zlib';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

let redisClient = null;

// Initialize Redis with URL or fallback to in-memory cache
export const initRedis = () => {
  try {
    if (process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        connectTimeout: 10000,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        enableOfflineQueue: true,
        autoResubscribe: true,
        autoResendUnfulfilledCommands: true,
      });

      redisClient.on('connect', () => {
        console.log('✅ Redis connected successfully');
      });

      redisClient.on('error', (err) => {
        console.error('❌ Redis connection error:', err.message);
      });

      redisClient.on('close', () => {
        console.log('⚠️ Redis connection closed');
      });
    } else {
      console.log('⚠️ REDIS_URL not found - using in-memory cache fallback');
      redisClient = null;
    }
  } catch (error) {
    console.error('❌ Redis initialization failed:', error.message);
    redisClient = null;
  }
};



// Initialize on module load
initRedis();

let isConnected = false;

redisClient?.on('ready', () => {
  isConnected = true;
});

redisClient?.on('close', () => {
  isConnected = false;
});

// In-memory cache fallback
const memoryCache = new Map();
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Compress data if it's larger than 1KB
const shouldCompress = (data) => {
  const size = Buffer.byteLength(JSON.stringify(data));
  return size > 1024; // 1KB
};

// Check if Redis is available and connected
const isRedisAvailable = () => {
  return redisClient && isConnected;
};

export const getCache = async (key) => {
  try {
    if (isRedisAvailable()) {
      const cached = await redisClient.get(key);
      if (!cached) return null;

      // Check if data is compressed
      if (cached.startsWith('GZIP:')) {
        const compressed = Buffer.from(cached.slice(5), 'base64');
        const decompressed = await gunzip(compressed);
        return JSON.parse(decompressed.toString());
      }

      return JSON.parse(cached);
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
    console.error(`Cache get error for key ${key}:`, error.message);
    return null;
  }
};

export const setCache = async (key, value, ttl = 300) => {
  try {
    if (isRedisAvailable()) {
      let dataToStore;
      
      if (shouldCompress(value)) {
        // Compress large data
        const compressed = await gzip(JSON.stringify(value));
        dataToStore = 'GZIP:' + compressed.toString('base64');
      } else {
        dataToStore = JSON.stringify(value);
      }

      await redisClient.setex(key, ttl, dataToStore);
      return true;
    } else {
      // Fallback to memory cache
      memoryCache.set(key, {
        data: value,
        timestamp: Date.now()
      });
      
      // Cleanup old entries if cache gets too large
      if (memoryCache.size > 100) {
        const oldestKey = memoryCache.keys().next().value;
        memoryCache.delete(oldestKey);
      }
      
      return true;
    }
  } catch (error) {
    console.error(`Cache set error for key ${key}:`, error.message);
    return false;
  }
};

export const deleteCache = async (key) => {
  try {
    if (isRedisAvailable()) {
      await redisClient.del(key);
    } else {
      memoryCache.delete(key);
    }
    return true;
  } catch (error) {
    console.error(`Cache delete error for key ${key}:`, error.message);
    return false;
  }
};

export const deleteCachePattern = async (pattern) => {
  try {
    if (isRedisAvailable()) {
      const stream = redisClient.scanStream({
        match: pattern,
        count: 100
      });

      const pipeline = redisClient.pipeline();
      let count = 0;

      stream.on('data', (keys) => {
        if (keys.length) {
          keys.forEach(key => pipeline.del(key));
          count += keys.length;
        }
      });

      return new Promise((resolve, reject) => {
        stream.on('end', async () => {
          if (count > 0) {
            await pipeline.exec();
          }
          console.log(`Deleted ${count} keys matching pattern: ${pattern}`);
          resolve(count);
        });

        stream.on('error', (err) => {
          console.error(`Error deleting cache pattern ${pattern}:`, err.message);
          reject(err);
        });
      });
    } else {
      // For memory cache, delete all keys matching pattern
      const patternRegex = new RegExp(pattern.replace(/\*/g, '.*'));
      let count = 0;
      
      for (const key of memoryCache.keys()) {
        if (patternRegex.test(key)) {
          memoryCache.delete(key);
          count++;
        }
      }
      
      console.log(`Deleted ${count} keys from memory cache matching pattern: ${pattern}`);
      return count;
    }
  } catch (error) {
    console.error(`Cache pattern delete error for pattern ${pattern}:`, error.message);
    return 0;
  }
};

// Batch get multiple keys at once
export const batchGet = async (keys) => {
  try {
    if (!keys.length) return {};

    if (isRedisAvailable()) {
      const pipeline = redisClient.pipeline();
      keys.forEach(key => pipeline.get(key));
      
      const results = await pipeline.exec();
      
      const data = {};
      for (let i = 0; i < keys.length; i++) {
        if (results[i][1]) {
          try {
            const value = results[i][1];
            if (value.startsWith('GZIP:')) {
              const compressed = Buffer.from(value.slice(5), 'base64');
              const decompressed = await gunzip(compressed);
              data[keys[i]] = JSON.parse(decompressed.toString());
            } else {
              data[keys[i]] = JSON.parse(value);
            }
          } catch (err) {
            console.error(`Error parsing key ${keys[i]}:`, err.message);
          }
        }
      }
      
      return data;
    } else {
      // Fallback to memory cache
      const data = {};
      for (const key of keys) {
        const cached = memoryCache.get(key);
        if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
          data[key] = cached.data;
        }
      }
      return data;
    }
  } catch (error) {
    console.error('Batch get error:', error.message);
    return {};
  }
};

// Batch set multiple keys at once
export const batchSet = async (items, ttl = 300) => {
  try {
    if (!items.length) return true;

    if (isRedisAvailable()) {
      const pipeline = redisClient.pipeline();
      
      for (const { key, value } of items) {
        let dataToStore;
        
        if (shouldCompress(value)) {
          const compressed = await gzip(JSON.stringify(value));
          dataToStore = 'GZIP:' + compressed.toString('base64');
        } else {
          dataToStore = JSON.stringify(value);
        }
        
        pipeline.setex(key, ttl, dataToStore);
      }
      
      await pipeline.exec();
      return true;
    } else {
      // Fallback to memory cache
      for (const { key, value } of items) {
        memoryCache.set(key, {
          data: value,
          timestamp: Date.now()
        });
      }
      return true;
    }
  } catch (error) {
    console.error('Batch set error:', error.message);
    return false;
  }
};

// Cache warming function - preload commonly accessed data
export const warmCache = async () => {
  try {
    console.log('🔥 Warming up cache...');
    
    // Import models dynamically
    const { default: Category } = await import('../Model/CategoryModel.js');
    const { default: Product } = await import('../Model/ProductModel.js');
    
    // Preload categories
    const categories = await Category.find({ status: 'Active' })
      .select('name description image')
      .lean();
    await setCache('categories:all', categories, 600);
    
    // Preload featured products
    const featured = await Product.find({ status: 'Active', featured: true })
      .select('name price discount images')
      .limit(8)
      .lean();
    await setCache('products:featured:8', featured, 600);
    
    console.log('✅ Cache warmed successfully');
  } catch (error) {
    console.error('❌ Error warming cache:', error.message);
  }
};

// Clear memory cache periodically (every 10 minutes)
if (!isRedisAvailable()) {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryCache.entries()) {
      if (now - value.timestamp > MEMORY_CACHE_TTL) {
        memoryCache.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

// Export Redis client for advanced usage
export { redisClient };

// Default export
export default {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  batchGet,
  batchSet,
  warmCache,
  isRedisAvailable,
};