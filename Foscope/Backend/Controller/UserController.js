import Category from "../Model/CategoryModel.js";
import SubCategory from "../Model/SubCategoryModel.js";
import product from '../Model/ProductModel.js';

export const AllCategories = async (req, res) => {
  try {

    const categories = await Category.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      categories: categories,
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



export const getSubCategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required',
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

    res.status(200).json({
      success: true,
      subcategories,
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

    const filter = { status: 'Active' };

    // Filter by subcategory
    if (subCategoryId) {
      filter.subCategory = subCategoryId;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const totalProducts = await product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limitNum);

    const products = await product.find(filter)
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get subcategory and category info
    let subCategoryInfo = null;
    let categoryInfo = null;

    if (subCategoryId && products.length > 0) {
      const SubCategory = await import('../Model/SubCategoryModel.js');
      subCategoryInfo = await SubCategory.default.findById(subCategoryId)
        .populate('categoryId', 'name')
        .lean();
      
      if (subCategoryInfo) {
        categoryInfo = subCategoryInfo.categoryId;
      }
    }

    res.status(200).json({
      success: true,
      products,
      currentPage: pageNum,
      totalPages,
      totalProducts,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
      subCategoryName: subCategoryInfo?.name || null,
      categoryName: categoryInfo?.name || null,
      categoryId: categoryInfo?._id || null,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message,
    });
  }
};

// Get categories with their subcategories
export const getCategoriesWithSubcategories = async (req, res) => {
  try {
    // 1️⃣ Fetch all active categories
    const categories = await Category.find({ status: 'Active' })
      .select('name description image')
      .lean();

    // 2️⃣ For each category, find its subcategories
    const categoriesWithSubcategories = await Promise.all(
      categories.map(async (category) => {
        const subcategories = await SubCategory.find({
          categoryId: category._id,
          status: 'Active',
        })
          .select('name description image')
          .lean();

        return {
          ...category,
          subcategories, // attach
        };
      })
    );

    // 3️⃣ Send to frontend
    res.status(200).json({
      success: true,
      categories: categoriesWithSubcategories,
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

// Get single product by ID


// Get related products (same subcategory, excluding current product)
export const getRelatedProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 4 } = req.query;

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

    res.status(200).json({
      success: true,
      products: relatedProducts,
    });
  } catch (error) {
    console.error('Error fetching related products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching related products',
      error: error.message,
    });
  }
};

// Get featured products
export const getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 8 } = req.query;

    const featuredProducts = await product.find({
      status: 'Active',
      isFeatured: true,
    })
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      products: featuredProducts,
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

// Search products
export const searchProducts = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const products = await product.find({
      status: 'Active',
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
      ],
    })
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      success: true,
      products,
      count: products.length,
    });
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

    res.status(200).json({
      success: true,
      product: foundProduct,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message,
    });
  }
};
