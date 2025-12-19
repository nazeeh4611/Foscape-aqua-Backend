// Controller/PortfolioController.js
import Portfolio from '../Model/ProjectModel.js';
import { getCache, setCache, deleteCache } from "../Utils/Redis.js";

export const getFeaturedPortfolios = async (req, res) => {
  try {
    console.log("🔍 Fetching featured portfolios...");
    const cacheKey = 'portfolios:featured';
    
    // Check cache first
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log("✅ Cache HIT - Returning cached data");
      return res.status(200).json({
        success: true,
        count: cached.length,
        portfolios: cached,
        cached: true
      });
    }
    
    console.log("❌ Cache MISS - Fetching from database");
    
    // Query database with proper error handling
    const portfolios = await Portfolio.find({
      featured: true,
      status: 'Active'
    })
    .select('name description category client duration location completionDate mediaUrls featured status')
    .sort({ featuredAt: -1, createdAt: -1 })
    .limit(6)
    .lean()
    .exec();
    
    console.log(`📊 Found ${portfolios.length} featured portfolios`);
    
    // If no portfolios found, return empty array instead of 404
    if (!portfolios || portfolios.length === 0) {
      console.log("⚠️ No featured portfolios found");
      return res.status(200).json({
        success: true,
        count: 0,
        portfolios: [],
        message: 'No featured portfolios available'
      });
    }
    
    // Cache the results
    await setCache(cacheKey, portfolios, 900);
    console.log("💾 Data cached successfully");
    
    return res.status(200).json({
      success: true,
      count: portfolios.length,
      portfolios,
      cached: false
    });
  } catch (error) {
    console.error('❌ Error fetching featured portfolios:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching featured portfolios',
      error: error.message
    });
  }
};

export const getAllPortfolios = async (req, res) => {
  try {
    const { category, status, page = 1, limit = 10 } = req.query;
    
    const cacheKey = `portfolios:all:${category || 'all'}:${status || 'active'}:${page}:${limit}`;
    
    // Check cache
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        ...cached,
        cached: true
      });
    }
    
    let query = {};
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (status) {
      query.status = status;
    } else {
      query.status = 'Active';
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [portfolios, totalCount] = await Promise.all([
      Portfolio.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean()
        .exec(),
      Portfolio.countDocuments(query)
    ]);
    
    const result = {
      count: portfolios.length,
      totalCount,
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      currentPage: parseInt(page),
      portfolios
    };
    
    // Cache for 5 minutes
    await setCache(cacheKey, result, 300);
    
    res.status(200).json({
      success: true,
      ...result,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolios',
      error: error.message
    });
  }
};

export const getPortfolioById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || id === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Invalid portfolio ID'
      });
    }
    
    const cacheKey = `portfolio:${id}`;
    
    // Check cache
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        portfolio: cached,
        cached: true
      });
    }
    
    const portfolio = await Portfolio.findById(id).lean().exec();
    
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      });
    }
    
    await setCache(cacheKey, portfolio, 900);
    
    res.status(200).json({
      success: true,
      portfolio,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolio',
      error: error.message
    });
  }
};

export const clearPortfolioCache = async () => {
  try {
    await deleteCache('portfolios:featured');
    console.log("✅ Portfolio cache cleared");
  } catch (error) {
    console.error("❌ Error clearing cache:", error);
  }
};

export const clearSinglePortfolioCache = async (id) => {
  try {
    await deleteCache(`portfolio:${id}`);
    console.log(`✅ Cache cleared for portfolio: ${id}`);
  } catch (error) {
    console.error("❌ Error clearing cache:", error);
  }
};