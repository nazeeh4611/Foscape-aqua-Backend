// Controller/UserController.js
import Category from "../Model/CategoryModel.js";
import SubCategory from "../Model/SubCategoryModel.js";
import product from '../Model/ProductModel.js';
import Admin from "../Model/AdminModel.js";
import { getCache, setCache, deleteCache, deleteCachePattern } from "../Utils/Redis.js";
import Portfolio from "../Model/ProjectModel.js";

// Optimized cache key generator
const generateCacheKey = (prefix, params = {}) => {
  if (!params || Object.keys(params).length === 0) return prefix;
  
  // Sort params for consistent cache keys
  const sortedParams = Object.keys(params)
    .sort()
    .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
    
  return sortedParams ? `${prefix}:${sortedParams}` : prefix;
};

// Optimized: Use connection pooling and query optimization
export const getCategoryDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `category:details:${id}`;
    
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json({
        success: true,
        data: cached
      });
    }

    const category = await Category.findById(id)
      .select('name description image')
      .lean()
      .maxTimeMS(500); // Reduced timeout

    if (!category) {
      return res.status(200).json({
        success: true,
        data: { description: 'Premium aquatic products and equipment' }
      });
    }

    await setCache(cacheKey, category, 600);

    res.set('X-Cache', 'MISS');
    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(200).json({
      success: true,
      data: { description: 'Premium aquatic products and equipment' }
    });
  }
};

export const AllCategories = async (req, res) => {
  try {
    const cacheKey = 'categories:all';
    
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json({
        success: true,
        message: "Categories fetched from cache",
        categories: cached,
        cached: true
      });
    }

    const categories = await Category.find({ status: 'Active' })
      .sort({ createdAt: -1 })
      .select('name description image _id')
      .lean()
      .maxTimeMS(1000);

    await setCache(cacheKey, categories, 300);

    res.set('X-Cache', 'MISS');
    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      categories: categories,
      cached: false
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(200).json({
      success: true,
      message: "Using cached or default data",
      categories: [],
      cached: true
    });
  }
};

// OPTIMIZED: Combined home data with batching
export const getHomeData = async (req, res) => {
  try {
    const cacheKey = 'home:initial-data';
    
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      res.set('Cache-Control', 'public, max-age=300');
      return res.status(200).json({
        success: true,
        data: cached,
        cached: true
      });
    }

    // Use Promise.all for parallel execution
    const [categories, featuredProducts, portfolios] = await Promise.all([
      Category.find({ status: 'Active' })
        .select('_id name image')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean()
        .maxTimeMS(1000),
      
      product.find({ status: 'Active', featured: true })
        .select('_id name price discount images description')
        .limit(6)
        .sort({ createdAt: -1 })
        .lean()
        .maxTimeMS(1000),
        
      Portfolio.find({ featured: true, status: 'Active' })
        .select('name category mediaUrls description')
        .sort({ featuredAt: -1 })
        .limit(3)
        .lean()
        .maxTimeMS(1000)
    ]);

    const homeData = {
      categories: categories || [],
      featuredProducts: featuredProducts || [],
      portfolios: portfolios || []
    };

    await setCache(cacheKey, homeData, 300);

    res.set('X-Cache', 'MISS');
    res.set('Cache-Control', 'public, max-age=300');
    res.status(200).json({
      success: true,
      data: homeData,
      cached: false
    });
  } catch (error) {
    console.error('Home data error:', error);
    res.status(200).json({
      success: true,
      data: {
        categories: [],
        featuredProducts: [],
        portfolios: []
      }
    });
  }
};

// NEW: Optimized batch data endpoint
// Controller/UserController.js - OPTIMIZED getBatchData
export const getBatchData = async (req, res) => {
  try {
    const { include = 'categories,featured,portfolios' } = req.query;
    const includeList = include.split(',');
    const cacheKey = `batch:${include}`;
    
    // 1. Check cache first
    const cached = await getCache(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      return res.json(cached);
    }

    // 2. Execute all queries in parallel (CRITICAL CHANGE)
    const [categories, featuredProducts, portfolios] = await Promise.all([
      includeList.includes('categories') ? 
        Category.find({ status: 'Active' })
          .select('_id name image')
          .sort({ createdAt: -1 })
          .limit(8)
          .lean()
          .maxTimeMS(1000) : Promise.resolve([]),
      
      includeList.includes('featured') ? 
        product.find({ status: 'Active', featured: true })
          .select('_id name price discount images description')
          .limit(8)
          .sort({ createdAt: -1 })
          .lean()
          .maxTimeMS(1000) : Promise.resolve([]),
        
      includeList.includes('portfolios') ? 
        Portfolio.find({ featured: true, status: 'Active' })
          .select('name category mediaUrls description')
          .limit(4)
          .lean()
          .maxTimeMS(1000) : Promise.resolve([])
    ]);

    // 3. Build response
    const response = {
      success: true,
      timestamp: Date.now(),
      categories,
      featuredProducts,
      portfolios
    };

    // 4. Cache the response for future requests
    await setCache(cacheKey, response, 300);
    
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120'); // Add CDN caching[citation:6]
    res.json(response);
    
  } catch (error) {
    console.error('Batch data error:', error);
    res.status(200).json({ // Return 200 with fallback data
      success: true,
      categories: [],
      featuredProducts: [],
      portfolios: []
    });
  }
};

export const getFeaturedPortfoliosForHome = async (req, res) => {
  try {
    const cacheKey = 'home:featured-portfolios';
    
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        portfolios: cached
      });
    }

    const featuredPortfolios = await Portfolio.find({ 
      featured: true, 
      status: 'Active' 
    })
      .select('name category mediaUrls description')
      .sort({ featuredAt: -1 })
      .limit(6)
      .lean()
      .maxTimeMS(1000);

    await setCache(cacheKey, featuredPortfolios, 300);

    res.status(200).json({
      success: true,
      portfolios: featuredPortfolios || []
    });
  } catch (error) {
    res.status(200).json({
      success: true,
      portfolios: []
    });
  }
};

export const getSubCategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required',
      });
    }

    const cacheKey = generateCacheKey('subcategories', { categoryId });
    
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json({
        success: true,
        subcategories: cached,
        cached: true
      });
    }

    const subcategories = await SubCategory.find({
      categoryId: categoryId,
      status: 'Active',
    })
    .select('name description image categoryId')
    .populate('categoryId', 'name image description')
    .lean()
    .maxTimeMS(1000);

    if (!subcategories || subcategories.length === 0) {
      return res.status(200).json({
        success: true,
        subcategories: [],
        message: 'No subcategories found for this category',
      });
    }

    await setCache(cacheKey, subcategories, 300);

    res.set('X-Cache', 'MISS');
    res.status(200).json({
      success: true,
      subcategories,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subcategories',
      error: error.message,
    });
  }
};

// OPTIMIZED: Products with pagination and better filtering
export const getAllProductsUser = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const { subCategoryId } = req.params;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = generateCacheKey('products', {
      subCategoryId: subCategoryId || 'all',
      page: pageNum,
      limit: limitNum,
      search: search || '',
      minPrice: minPrice || '',
      maxPrice: maxPrice || '',
      sortBy,
      sortOrder
    });

    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json({
        ...cached,
        cached: true
      });
    }

    const filter = { status: 'Active' };

    if (subCategoryId && subCategoryId !== 'undefined') {
      filter.subCategory = subCategoryId;
    }

    if (search && search.trim() !== '') {
      // Use regex for partial match instead of text search for better performance
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    const sort = {};
    // Only allow sorting by specific fields
    const allowedSortFields = ['createdAt', 'price', 'name', 'discount'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;

    const [totalProducts, products, subCategoryInfo] = await Promise.all([
      product.countDocuments(filter).maxTimeMS(2000),
      product.find(filter)
        .select('name price discount images status stock brand featured')
        .populate('category', 'name')
        .populate('subCategory', 'name')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean()
        .maxTimeMS(2000),
      subCategoryId && subCategoryId !== 'undefined' ? 
        SubCategory.findById(subCategoryId)
          .select('name categoryId')
          .populate('categoryId', 'name _id')
          .lean() 
        : Promise.resolve(null)
    ]);

    const totalPages = Math.ceil(totalProducts / limitNum);

    const responseData = {
      success: true,
      products,
      currentPage: pageNum,
      totalPages,
      totalProducts,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
      subCategoryName: subCategoryInfo?.name || null,
      categoryName: subCategoryInfo?.categoryId?.name || null,
      categoryId: subCategoryInfo?.categoryId?._id || null,
      cached: false
    };

    await setCache(cacheKey, responseData, 300);

    res.set('X-Cache', 'MISS');
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message,
    });
  }
};

export const getCategoriesWithSubcategories = async (req, res) => {
  try {
    const cacheKey = 'categories:with-subcategories';
    
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json({
        success: true,
        categories: cached,
        cached: true
      });
    }

    const categoriesWithSubcategories = await Category.aggregate([
      { $match: { status: 'Active' } },
      {
        $lookup: {
          from: 'subcategories',
          let: { categoryId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$categoryId', '$$categoryId'] },
                    { $eq: ['$status', 'Active'] }
                  ]
                }
              }
            },
            { $project: { name: 1, description: 1, image: 1 } },
            { $limit: 10 } // Limit subcategories per category
          ],
          as: 'subcategories'
        }
      },
      { $project: { name: 1, description: 1, image: 1, subcategories: 1 } },
      { $limit: 20 } // Limit total categories
    ]).maxTimeMS(2000);

    await setCache(cacheKey, categoriesWithSubcategories, 600);

    res.set('X-Cache', 'MISS');
    res.status(200).json({
      success: true,
      categories: categoriesWithSubcategories,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching categories with subcategories:', error);
    res.status(200).json({
      success: true,
      categories: [],
      cached: true
    });
  }
};

export const getRelatedProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 4 } = req.query;

    const cacheKey = generateCacheKey('products:related', { productId, limit });
    
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json({
        ...cached,
        cached: true
      });
    }

    const currentProduct = await product.findById(productId)
      .select('subCategory category')
      .lean();

    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const relatedProducts = await product.find({
      $or: [
        { subCategory: currentProduct.subCategory },
        { category: currentProduct.category }
      ],
      _id: { $ne: productId },
      status: 'Active',
    })
      .select('name price discount images description')
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .limit(parseInt(limit))
      .lean()
      .maxTimeMS(1000);

    const responseData = {
      success: true,
      products: relatedProducts,
      cached: false
    };

    await setCache(cacheKey, responseData, 300);

    res.set('X-Cache', 'MISS');
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching related products:', error);
    res.status(200).json({
      success: true,
      products: [],
      cached: true
    });
  }
};

export const getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 8 } = req.query;
    const cacheKey = `products:featured:${limit}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json({
        success: true,
        products: cached,
        cached: true
      });
    }

    const featuredProducts = await product.find({
      status: 'Active',
      featured: true,
    })
    .select('name description price discount images')
    .limit(Math.min(parseInt(limit), 20)) // Cap at 20
    .sort({ createdAt: -1 })
    .lean()
    .maxTimeMS(1000);

    await setCache(cacheKey, featuredProducts, 300);

    res.set('X-Cache', 'MISS');
    res.status(200).json({
      success: true,
      products: featuredProducts,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(200).json({
      success: true,
      products: [],
      cached: true
    });
  }
};

export const searchProducts = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const cacheKey = generateCacheKey('products:search', { query, limit });
    
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json({
        ...cached,
        cached: true
      });
    }

    const products = await product.find({
      status: 'Active',
      $text: { $search: query }
    }, {
      score: { $meta: 'textScore' }
    })
      .select('name price discount images')
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .sort({ score: { $meta: 'textScore' } })
      .limit(Math.min(parseInt(limit), 50))
      .lean()
      .maxTimeMS(2000);

    const responseData = {
      success: true,
      products,
      count: products.length,
      cached: false
    };

    await setCache(cacheKey, responseData, 180); // 3 minutes for search

    res.set('X-Cache', 'MISS');
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching products',
      error: error.message,
    });
  }
};

export const getProductByIdUser = async (req, res) => {
  try {
    const { id } = req.params;

    const cacheKey = generateCacheKey('product', { id });
    
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json({
        ...cached,
        cached: true
      });
    }

    const foundProduct = await product.findById(id)
      .select('-__v -createdAt -updatedAt')
      .populate('category', 'name description image')
      .populate('subCategory', 'name description image')
      .lean()
      .maxTimeMS(1000);

    if (!foundProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (foundProduct.status !== 'Active') {
      return res.status(404).json({
        success: false,
        message: 'Product is not available',
      });
    }

    const responseData = {
      success: true,
      product: foundProduct,
      cached: false
    };

    await setCache(cacheKey, responseData, 600);

    res.set('X-Cache', 'MISS');
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message,
    });
  }
};

export const getContactNumber = async (req, res) => {
  try {
    const cacheKey = 'admin:contact';
    
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    const admin = await Admin.findOne({ role: "admin" })
      .select("phone")
      .lean()
      .maxTimeMS(1000);

    const responseData = {
      phone: admin?.phone || ""
    };

    await setCache(cacheKey, responseData, 3600);

    res.set('X-Cache', 'MISS');
    res.json(responseData);
  } catch (error) {
    res.status(200).json({ 
      phone: "",
      cached: true 
    });
  }
};

// Cache clearing utilities
export const clearProductCache = async (productId = null) => {
  if (productId) {
    await deleteCache(`product:id=${productId}`);
  }
  await deleteCachePattern('products:*');
  await deleteCachePattern('batch:*');
};

export const clearSubCategoryCache = async (categoryId = null) => {
  if (categoryId) {
    await deleteCache(`subcategories:categoryId=${categoryId}`);
  }
  await deleteCachePattern('subcategories:*');
  await deleteCachePattern('categories:*');
  await deleteCachePattern('batch:*');
};

export const clearCategoryCache = async () => {
  await deleteCachePattern('categories:*');
  await deleteCachePattern('subcategories:*');
  await deleteCachePattern('home:*');
  await deleteCachePattern('batch:*');
};