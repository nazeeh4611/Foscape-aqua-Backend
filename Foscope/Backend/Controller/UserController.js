import Category from "../Model/CategoryModel.js";
import SubCategory from "../Model/SubCategoryModel.js";
import product from '../Model/ProductModel.js';
import Admin from "../Model/AdminModel.js";
import { getCache, setCache, deleteCache, deleteCachePattern } from "../Utils/Redis.js";
import Portfolio from "../Model/ProjectModel.js";

const generateCacheKey = (prefix, params = {}) => {
  const paramString = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join(':');
  return paramString ? `${prefix}:${paramString}` : prefix;
};

export const AllCategories = async (req, res) => {
  try {
    const cacheKey = 'categories:all';
    
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        message: "Categories fetched from cache",
        categories: cached,
        cached: true
      });
    }

    const categories = await Category.find({ status: 'Active' })
      .sort({ createdAt: -1 })
      .select('name description image')
      .lean();

    await setCache(cacheKey, categories, 300); // 5 minutes

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      categories: categories,
      cached: false
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    });
  }
};

export const clearCategoryCache = async () => {
  await deleteCachePattern('categories:*');
  await deleteCachePattern('subcategories:*');
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
      return res.status(200).json({
        success: true,
        subcategories: cached,
        cached: true
      });
    }

    const subcategories = await SubCategory.find({
      categoryId: categoryId,
      status: 'Active',
    }).populate('categoryId', 'name image description');

    if (!subcategories || subcategories.length === 0) {
      return res.status(200).json({
        success: true,
        subcategories: [],
        message: 'No subcategories found for this category',
      });
    }

    await setCache(cacheKey, subcategories, 300); // 5 minutes

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

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = generateCacheKey('products', {
      subCategoryId,
      page: pageNum,
      limit: limitNum,
      search,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder
    });

    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        ...cached,
        cached: true
      });
    }

    const filter = { status: 'Active' };

    if (subCategoryId) {
      filter.subCategory = subCategoryId;
    }

    if (search) {
      filter.$text = { $search: search }; 
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Use Promise.all for parallel execution
    const [totalProducts, products, subCategoryInfo] = await Promise.all([
      product.countDocuments(filter),
      product.find(filter)
        .select('name price discount images status') 
        .populate('category', 'name')
        .populate('subCategory', 'name')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      subCategoryId ? 
        SubCategory.findById(subCategoryId)
          .select('name categoryId')
          .populate('categoryId', 'name _id')
          .lean() 
        : null
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

    // Increase cache time to 10 minutes for product lists
    await setCache(cacheKey, responseData, 600);

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
      return res.status(200).json({
        success: true,
        categories: cached,
        cached: true
      });
    }

    // Use aggregation pipeline for better performance
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
            { $project: { name: 1, description: 1, image: 1 } }
          ],
          as: 'subcategories'
        }
      },
      { $project: { name: 1, description: 1, image: 1, subcategories: 1 } }
    ]);

    await setCache(cacheKey, categoriesWithSubcategories, 600);

    res.status(200).json({
      success: true,
      categories: categoriesWithSubcategories,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching categories with subcategories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message,
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
      return res.status(200).json({
        ...cached,
        cached: true
      });
    }

    const products = await product.findById(productId);

    if (!products) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const relatedProducts = await product.find({
      subCategory: products.subCategory,
      _id: { $ne: productId },
      status: 'Active',
    })
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .limit(parseInt(limit))
      .lean();

    const responseData = {
      success: true,
      products: relatedProducts,
      cached: false
    };

    await setCache(cacheKey, responseData, 600); // 10 minutes

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching related products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching related products',
      error: error.message,
    });
  }
};

export const getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 8 } = req.query;
    const cacheKey = `products:featured:${limit}`;

    const cached = await getCache(cacheKey);
    if (cached) {
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
    .limit(parseInt(limit))
    .sort({ createdAt: -1 })
    .lean();

    await setCache(cacheKey, featuredProducts, 600); // 10 minutes

    res.status(200).json({
      success: true,
      products: featuredProducts,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching featured products',
      error: error.message,
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
      return res.status(200).json({
        ...cached,
        cached: true
      });
    }

    // Use text index for better search performance
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
      .limit(parseInt(limit))
      .lean();

    const responseData = {
      success: true,
      products,
      count: products.length,
      cached: false
    };

    await setCache(cacheKey, responseData, 300);

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
      return res.status(200).json({
        ...cached,
        cached: true
      });
    }

    const foundProduct = await product.findById(id)
      .populate('category', 'name description image')
      .populate('subCategory', 'name description image')
      .lean();

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

    await setCache(cacheKey, responseData, 600); // 10 minutes

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
      return res.json(cached);
    }

    const admin = await Admin.findOne({ role: "admin" })
      .select("phone");

    const responseData = {
      phone: admin?.phone || ""
    };

    await setCache(cacheKey, responseData, 3600); // 1 hour

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Cache invalidation helper - call this when products/categories are updated
export const clearProductCache = async (productId = null) => {
  if (productId) {
    await deleteCache(`product:id:${productId}`);
  }
  await deleteCachePattern('products:*');
};

export const clearSubCategoryCache = async (categoryId = null) => {
  if (categoryId) {
    await deleteCache(`subcategories:categoryId:${categoryId}`);
  }
  await deleteCachePattern('subcategories:*');
  await deleteCachePattern('categories:*');
};

export const getBatchHomeData = async (req, res) => {
  try {
    const cacheKey = 'home:batch-data';
    
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
        cached: true
      });
    }

    // Fetch all home page data in parallel
    const [categories, featuredProducts, stats] = await Promise.all([
      Category.find({ status: 'Active' })
        .select('name image')
        .limit(8)
        .lean(),
      product.find({ status: 'Active', featured: true })
        .select('name price discount images')
        .limit(8)
        .sort({ createdAt: -1 })
        .lean(),
      product.aggregate([
        { $match: { status: 'Active' } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            avgPrice: { $avg: '$price' }
          }
        }
      ])
    ]);

    const batchData = {
      categories,
      featuredProducts,
      stats: stats[0] || { totalProducts: 0, avgPrice: 0 }
    };

    await setCache(cacheKey, batchData, 600);

    res.status(200).json({
      success: true,
      data: batchData,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching batch data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching data',
      error: error.message,
    });
  }
};

export const getHomeData = async (req, res) => {
  try {
    const cacheKey = 'home:initial-data';
    
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
        cached: true
      });
    }

    const [categories, featuredProducts, featuredPortfolios] = await Promise.all([
      Category.find({ status: 'Active' })
        .select('name description image')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      
      product.find({ status: 'Active', featured: true })
        .select('name description price discount images')
        .limit(8)
        .sort({ createdAt: -1 })
        .lean(),
      
      Portfolio.find({ featured: true, status: 'Active' })
        .select('name description category mediaUrls')
        .sort({ featuredAt: -1 })
        .limit(6)
        .lean()
    ]);

    const homeData = {
      categories,
      featuredProducts,
      featuredPortfolios
    };

    await setCache(cacheKey, homeData, 600);

    res.status(200).json({
      success: true,
      data: homeData,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching home data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching data',
      error: error.message,
    });
  }
};