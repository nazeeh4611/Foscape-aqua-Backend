import Category from "../Model/CategoryModel.js";
import SubCategory from "../Model/SubCategoryModel.js";
import product from '../Model/ProductModel.js';
import Admin from "../Model/AdminModel.js";
import { getCache, setCache } from "../Utils/Redis.js";
import Portfolio from "../Model/ProjectModel.js";

const generateCacheKey = (prefix, params = {}) => {
  if (!params || Object.keys(params).length === 0) return prefix;
  
  const sortedParams = Object.keys(params)
    .sort()
    .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
    
  return sortedParams ? `${prefix}:${sortedParams}` : prefix;
};

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
      .maxTimeMS(500);

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

export const getBatchData = async (req, res) => {
  try {
    const { include = 'categories,featured,portfolios' } = req.query;
    const includeList = include.split(',');
    
    const cacheKey = `batch:${include}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      res.set('X-Cache', 'HIT');
      res.set('Cache-Control', 'public, max-age=300');
      return res.json(cached);
    }

    const promises = [];
    
    if (includeList.includes('categories')) {
      promises.push(
        Category.find({ status: 'Active' })
          .select('_id name image description')
          .sort({ createdAt: -1 })
          .limit(8)
          .lean()
          .maxTimeMS(2000)
          .then(data => ({ categories: data }))
          .catch(() => ({ categories: [] }))
      );
    }
    
    if (includeList.includes('featured')) {
      promises.push(
        product.find({ status: 'Active', featured: true })
          .select('_id name price discount images description')
          .limit(12)
          .sort({ createdAt: -1 })
          .lean()
          .maxTimeMS(2000)
          .then(data => ({ featuredProducts: data }))
          .catch(() => ({ featuredProducts: [] }))
      );
    }
    
    if (includeList.includes('portfolios')) {
      promises.push(
        Portfolio.find({ featured: true, status: 'Active' })
          .select('name category mediaUrls description location completionDate client duration')
          .sort({ featuredAt: -1 })
          .limit(6)
          .lean()
          .maxTimeMS(2000)
          .then(data => ({ portfolios: data }))
          .catch(() => ({ portfolios: [] }))
      );
    }

    const results = await Promise.allSettled(promises);
    const response = {
      success: true,
      timestamp: Date.now()
    };

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        Object.assign(response, result.value);
      }
    });

    if (!response.categories) response.categories = [];
    if (!response.featuredProducts) response.featuredProducts = [];
    if (!response.portfolios) response.portfolios = [];

    await setCache(cacheKey, response, 300);
    
    res.set('X-Cache', 'MISS');
    res.set('Cache-Control', 'public, max-age=300');
    res.json(response);
  } catch (error) {
    console.error('Batch data error:', error);
    res.status(200).json({ 
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
      .select('name category mediaUrls description location completionDate client duration')
      .sort({ featuredAt: -1 })
      .limit(6)
      .lean()
      .maxTimeMS(2000);

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
    .maxTimeMS(2000);

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
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    const sort = {};
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
        .maxTimeMS(3000),
      subCategoryId && subCategoryId !== 'undefined' ? 
        SubCategory.findById(subCategoryId)
          .select('name categoryId')
          .populate('categoryId', 'name _id')
          .lean()
          .maxTimeMS(1000)
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

    // First, get all active categories
    const categories = await Category.find({ status: 'Active' })
      .select('_id name description image')
      .lean()
      .maxTimeMS(2000);

    if (!categories || categories.length === 0) {
      await setCache(cacheKey, [], 600);
      return res.status(200).json({
        success: true,
        categories: [],
        cached: false
      });
    }

    // Then get subcategories for each category
    const categoriesWithSubcategories = await Promise.all(
      categories.map(async (category) => {
        const subcategories = await SubCategory.find({
          categoryId: category._id,
          status: 'Active'
        })
        .select('_id name description image')
        .lean()
        .maxTimeMS(1000);

        return {
          _id: category._id,
          name: category.name,
          description: category.description,
          image: category.image,
          subcategories: subcategories || []
        };
      })
    );

    await setCache(cacheKey, categoriesWithSubcategories, 600);

    res.set('X-Cache', 'MISS');
    res.status(200).json({
      success: true,
      categories: categoriesWithSubcategories,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching categories with subcategories:', error);
    
    // Try to get categories without subcategories as fallback
    try {
      const categories = await Category.find({ status: 'Active' })
        .select('_id name description image')
        .lean()
        .maxTimeMS(1000);

      const categoriesWithEmptySubs = categories.map(cat => ({
        ...cat,
        subcategories: []
      }));

      res.status(200).json({
        success: true,
        categories: categoriesWithEmptySubs || [],
        cached: true
      });
    } catch (fallbackError) {
      res.status(200).json({
        success: true,
        categories: [],
        cached: true
      });
    }
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
      .lean()
      .maxTimeMS(1000);

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
      .maxTimeMS(2000);

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
    const { limit = 12 } = req.query;
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
    .limit(Math.min(parseInt(limit), 20))
    .sort({ createdAt: -1 })
    .lean()
    .maxTimeMS(2000);

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
      name: { $regex: query, $options: 'i' }
    })
      .select('name price discount images')
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .limit(Math.min(parseInt(limit), 50))
      .lean()
      .maxTimeMS(2000);

    const responseData = {
      success: true,
      products,
      count: products.length,
      cached: false
    };

    await setCache(cacheKey, responseData, 180);

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
      .maxTimeMS(2000);

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