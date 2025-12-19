// Utils/Redis.js
import Redis from 'ioredis';
import compression from 'compression';
import { promisify } from 'util';
import zlib from 'zlib';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

let redisClient = null;
let isConnected = false;

// In-memory cache fallback with TTL tracking
const memoryCache = new Map();
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_MEMORY_CACHE_SIZE = 100;
const memoryCacheTimestamps = new Map();

// Initialize Redis
export const initRedis = () => {
  try {
    if (process.env.REDIS_URL) {
      console.log(`🔗 Connecting to Redis...`);
      
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        connectTimeout: 10000,
        retryStrategy: (times) => {
          const delay = Math.min(times * 100, 5000);
          return delay;
        },
        keepAlive: 10000,
        lazyConnect: true
      });

      redisClient.on('connect', () => {
        console.log('✅ Redis connected');
        isConnected = true;
      });

      redisClient.on('ready', () => {
        console.log('✅ Redis ready');
        isConnected = true;
      });

      redisClient.on('error', (err) => {
        console.error('❌ Redis error:', err.message);
        isConnected = false;
      });

      redisClient.on('close', () => {
        console.log('⚠️ Redis connection closed');
        isConnected = false;
      });

      redisClient.connect().catch(err => {
        console.error('❌ Redis connection failed:', err.message);
      });

    } else {
      console.log('⚠️ REDIS_URL not found - using in-memory cache');
      redisClient = null;
      isConnected = false;
    }
  } catch (error) {
    console.error('❌ Redis initialization failed:', error.message);
    redisClient = null;
    isConnected = false;
  }
};

// Initialize on module load
initRedis();

// Check Redis availability
const isRedisAvailable = () => {
  return redisClient && isConnected && redisClient.status === 'ready';
};

// Compress data if larger than 2KB
const shouldCompress = (data) => {
  try {
    const size = Buffer.byteLength(JSON.stringify(data));
    return size > 2048;
  } catch (err) {
    return false;
  }
};

// Compress data
const compressData = async (data) => {
  try {
    const compressed = await gzip(JSON.stringify(data));
    return 'GZIP:' + compressed.toString('base64');
  } catch (err) {
    return JSON.stringify(data);
  }
};

// Decompress data
const decompressData = async (compressedString) => {
  try {
    if (!compressedString.startsWith('GZIP:')) {
      return JSON.parse(compressedString);
    }
    
    const compressed = Buffer.from(compressedString.slice(5), 'base64');
    const decompressed = await gunzip(compressed);
    return JSON.parse(decompressed.toString());
  } catch (err) {
    throw err;
  }
};

// Memory cache management
const manageMemoryCacheSize = () => {
  if (memoryCache.size > MAX_MEMORY_CACHE_SIZE) {
    const entries = Array.from(memoryCacheTimestamps.entries());
    entries.sort((a, b) => a[1] - b[1]);
    
    const toRemove = Math.ceil(MAX_MEMORY_CACHE_SIZE * 0.2);
    for (let i = 0; i < Math.min(toRemove, entries.length); i++) {
      const [key] = entries[i];
      memoryCache.delete(key);
      memoryCacheTimestamps.delete(key);
    }
  }
};

// Memory cache cleanup
const cleanupMemoryCache = () => {
  const now = Date.now();
  for (const [key, timestamp] of memoryCacheTimestamps.entries()) {
    if (now - timestamp > MEMORY_CACHE_TTL) {
      memoryCache.delete(key);
      memoryCacheTimestamps.delete(key);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupMemoryCache, 5 * 60 * 1000);

// Cache middleware for Express routes
export const cacheMiddleware = (ttl = 300) => {
  const compress = compression();
  
  return async (req, res, next) => {
    // Skip caching for non-GET methods
    if (req.method !== 'GET') {
      return next();
    }
    
    // Skip caching for authenticated routes
    if (req.headers.authorization || req.cookies?.token) {
      return next();
    }
    
    const key = `cache:${req.method}:${req.originalUrl}`;
    
    try {
      const cached = await getCache(key);
      if (cached) {
        res.set('X-Cache', 'HIT');
        res.set('Cache-Control', `public, max-age=${ttl}`);
        return compress(req, res, () => {
          res.json(cached);
        });
      }
      
      // Store original json method
      const originalJson = res.json;
      
      res.json = function(data) {
        // Cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setCache(key, data, ttl).catch(console.error);
        }
        
        res.set('X-Cache', 'MISS');
        res.set('Cache-Control', `public, max-age=${ttl}`);
        
        return compress(req, res, () => {
          originalJson.call(this, data);
        });
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error.message);
      next();
    }
  };
};

// Basic cache operations
export const getCache = async (key) => {
  try {
    if (isRedisAvailable()) {
      const cached = await redisClient.get(key);
      if (!cached) return null;
      return await decompressData(cached);
    } else {
      const cached = memoryCache.get(key);
      if (cached) {
        const timestamp = memoryCacheTimestamps.get(key);
        if (timestamp && Date.now() - timestamp < MEMORY_CACHE_TTL) {
          return cached;
        }
        memoryCache.delete(key);
        memoryCacheTimestamps.delete(key);
      }
      return null;
    }
  } catch (error) {
    console.error(`Cache get error for ${key}:`, error.message);
    return null;
  }
};

export const setCache = async (key, value, ttl = 300) => {
  try {
    if (isRedisAvailable()) {
      let dataToStore = shouldCompress(value) 
        ? await compressData(value) 
        : JSON.stringify(value);
      await redisClient.setex(key, ttl, dataToStore);
      return true;
    } else {
      memoryCache.set(key, value);
      memoryCacheTimestamps.set(key, Date.now());
      manageMemoryCacheSize();
      return true;
    }
  } catch (error) {
    console.error(`Cache set error for ${key}:`, error.message);
    return false;
  }
};

export const deleteCache = async (key) => {
  try {
    if (isRedisAvailable()) {
      await redisClient.del(key);
    }
    memoryCache.delete(key);
    memoryCacheTimestamps.delete(key);
    return true;
  } catch (error) {
    console.error(`Cache delete error for ${key}:`, error.message);
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

      let deletedCount = 0;
      
      return new Promise((resolve, reject) => {
        stream.on('data', async (keys) => {
          if (keys.length) {
            try {
              await redisClient.del(...keys);
              deletedCount += keys.length;
              
              // Clear from memory cache too
              keys.forEach(key => {
                memoryCache.delete(key);
                memoryCacheTimestamps.delete(key);
              });
            } catch (err) {
              console.error('Error deleting keys:', err.message);
            }
          }
        });

        stream.on('end', () => {
          console.log(`🗑️ Deleted ${deletedCount} keys matching: ${pattern}`);
          resolve(deletedCount);
        });

        stream.on('error', reject);
      });
    } else {
      const patternRegex = new RegExp(pattern.replace(/\*/g, '.*'));
      let deletedCount = 0;
      
      for (const key of memoryCache.keys()) {
        if (patternRegex.test(key)) {
          memoryCache.delete(key);
          memoryCacheTimestamps.delete(key);
          deletedCount++;
        }
      }
      
      console.log(`🗑️ Deleted ${deletedCount} keys from memory cache`);
      return deletedCount;
    }
  } catch (error) {
    console.error(`Cache pattern delete error:`, error.message);
    return 0;
  }
};

// Batch operations
export const batchGet = async (keys) => {
  try {
    if (!keys || keys.length === 0) return {};

    if (isRedisAvailable()) {
      const pipeline = redisClient.pipeline();
      keys.forEach(key => pipeline.get(key));
      
      const results = await pipeline.exec();
      const data = {};
      
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const result = results[i];
        
        if (result && result[1]) {
          try {
            data[key] = await decompressData(result[1]);
          } catch (err) {
            console.error(`Error processing key ${key}:`, err.message);
          }
        }
      }
      
      return data;
    } else {
      const data = {};
      const now = Date.now();
      
      for (const key of keys) {
        const cached = memoryCache.get(key);
        const timestamp = memoryCacheTimestamps.get(key);
        
        if (cached && timestamp && now - timestamp < MEMORY_CACHE_TTL) {
          data[key] = cached;
        }
      }
      return data;
    }
  } catch (error) {
    console.error('Batch get error:', error.message);
    return {};
  }
};

export const batchSet = async (items, ttl = 300) => {
  try {
    if (!items || items.length === 0) return true;

    if (isRedisAvailable()) {
      const pipeline = redisClient.pipeline();
      
      for (const { key, value } of items) {
        let dataToStore = shouldCompress(value) 
          ? await compressData(value) 
          : JSON.stringify(value);
        pipeline.setex(key, ttl, dataToStore);
      }
      
      await pipeline.exec();
      
      // Update memory cache
      items.forEach(({ key, value }) => {
        memoryCache.set(key, value);
        memoryCacheTimestamps.set(key, Date.now());
      });
      manageMemoryCacheSize();
      
      return true;
    } else {
      items.forEach(({ key, value }) => {
        memoryCache.set(key, value);
        memoryCacheTimestamps.set(key, Date.now());
      });
      manageMemoryCacheSize();
      return true;
    }
  } catch (error) {
    console.error('Batch set error:', error.message);
    return false;
  }
};

// Cache warming
export const warmCache = async () => {
  try {
    console.log('🔥 Warming up cache...');
    
    // Import models
    const { default: Category } = await import('../Model/CategoryModel.js');
    const { default: Product } = await import('../Model/ProductModel.js');
    
    const [categories, featuredProducts] = await Promise.all([
      Category.find({ status: 'Active' })
        .select('name description image')
        .limit(10)
        .lean(),
      
      Product.find({ status: 'Active', featured: true })
        .select('name price discount images')
        .limit(8)
        .lean()
    ]);
    
    await batchSet([
      { key: 'categories:all', value: categories || [] },
      { key: 'products:featured:8', value: featuredProducts || [] },
      { key: 'cache:warmed', value: { timestamp: Date.now() } }
    ], 600);
    
    console.log(`✅ Cache warmed successfully`);
  } catch (error) {
    console.error('❌ Error warming cache:', error.message);
  }
};

// Health check
export const checkRedisHealth = async () => {
  try {
    if (!redisClient || !isConnected) {
      return { 
        status: 'down', 
        message: 'Redis not connected' 
      };
    }
    
    await redisClient.ping();
    
    return { 
      status: 'up', 
      connected: isConnected,
      memoryCacheSize: memoryCache.size
    };
  } catch (error) {
    return { 
      status: 'down', 
      message: error.message
    };
  }
};

// Export for use
export default {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  batchGet,
  batchSet,
  warmCache,
  cacheMiddleware,
  checkRedisHealth,
  isRedisAvailable: () => isRedisAvailable()
};