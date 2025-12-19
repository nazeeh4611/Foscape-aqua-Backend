import SubCategory from "../Model/SubCategoryModel.js";
import Category from "../Model/CategoryModel.js";
import { deleteCachePattern, deleteCache } from "../Utils/Redis.js";

// Helper function to clear subcategory-related caches
const clearSubCategoryCaches = async (categoryId = null) => {
  if (categoryId) {
    await deleteCache(`subcategories:categoryId:${categoryId}`);
  }
  await deleteCachePattern('subcategories:*');
  await deleteCachePattern('categories:*');
  await deleteCachePattern('products:*');
};

// ✅ Get all subcategories (Admin) - No cache needed for admin
export const getAllSubCategories = async (req, res) => {
  try {
    const subCategories = await SubCategory.find()
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .lean(); // Add lean() for better performance

    return res.status(200).json({
      success: true,
      message: "SubCategories fetched successfully",
      subCategories: subCategories,
    });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subcategories",
      error: error.message,
    });
  }
};

// ✅ Get subcategory by ID
export const getSubCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const subCategory = await SubCategory.findById(id)
      .populate('categoryId', 'name')
      .lean();

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "SubCategory fetched successfully",
      subCategory,
    });
  } catch (error) {
    console.error("Error fetching subcategory:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subcategory",
      error: error.message,
    });
  }
};

// ✅ Get subcategories by category ID
export const getSubCategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const subCategories = await SubCategory.find({ categoryId: categoryId })
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "SubCategories fetched successfully",
      subCategories,
    });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subcategories",
      error: error.message,
    });
  }
};

// ✅ Create new subcategory (with image upload)
export const createSubCategory = async (req, res) => {
  try {
    const { name, description, status, category } = req.body;

    if (!name || !description || !category) {
      return res.status(400).json({ 
        success: false, 
        message: "Name, description, and category are required" 
      });
    }

    if (!req.file || !req.file.location) {
      return res.status(400).json({ 
        success: false, 
        message: "SubCategory image is required" 
      });
    }

    // Check if category exists
    const categoryExists = await Category.findById(category).lean();
    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if subcategory already exists in this category
    const exists = await SubCategory.findOne({ 
      name: name.trim(), 
      categoryId: category 
    }).lean();
    
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "SubCategory with this name already exists in this category",
      });
    }

    const newSubCategory = new SubCategory({
      name: name.trim(),
      description: description.trim(),
      image: req.file.location,
      categoryId: category,
      status: status || "Active",
    });

    await newSubCategory.save();
    await newSubCategory.populate('categoryId', 'name');

    // Clear subcategory-related caches
    await clearSubCategoryCaches(category);

    return res.status(201).json({
      success: true,
      message: "SubCategory created successfully",
      subCategory: newSubCategory,
    });
  } catch (error) {
    console.error("Error creating subcategory:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create subcategory",
      error: error.message,
    });
  }
};

export const updateSubCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    const categoryId = req.body.category;

    const subCategory = await SubCategory.findById(id);
    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found",
      });
    }

    const oldCategoryId = subCategory.categoryId.toString();

    if (categoryId && categoryId !== oldCategoryId) {
      const categoryExists = await Category.findById(categoryId).lean();
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
      subCategory.categoryId = categoryId;
    }

    // Check duplicate name inside same category
    if (name && name.trim() !== subCategory.name) {
      const existingSubCategory = await SubCategory.findOne({
        name: name.trim(),
        categoryId: categoryId || subCategory.categoryId, 
        _id: { $ne: id },
      }).lean();

      if (existingSubCategory) {
        return res.status(400).json({
          success: false,
          message: "SubCategory with this name already exists in this category",
        });
      }

      subCategory.name = name.trim();
    }

    if (description) subCategory.description = description.trim();
    if (status) subCategory.status = status;

    if (req.file) {
      subCategory.image = req.file.location;
    }

    await subCategory.save();
    await subCategory.populate("categoryId", "name");

    // Clear caches for both old and new category if category changed
    await clearSubCategoryCaches(oldCategoryId);
    if (categoryId && categoryId !== oldCategoryId) {
      await clearSubCategoryCaches(categoryId);
    }

    return res.status(200).json({
      success: true,
      message: "SubCategory updated successfully",
      subCategory,
    });

  } catch (error) {
    console.error("Error updating subcategory:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update subcategory",
      error: error.message,
    });
  }
};

// ✅ Delete subcategory
export const deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const subCategory = await SubCategory.findById(id).lean();
    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found",
      });
    }

    const categoryId = subCategory.categoryId.toString();

    await SubCategory.findByIdAndDelete(id);

    // Clear subcategory-related caches
    await clearSubCategoryCaches(categoryId);

    return res.status(200).json({
      success: true,
      message: "SubCategory deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete subcategory",
      error: error.message,
    });
  }
};

// ✅ Toggle subcategory status (Active/Inactive)
export const toggleSubCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const subCategory = await SubCategory.findById(id);
    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found",
      });
    }

    const categoryId = subCategory.categoryId.toString();

    subCategory.status = status;
    await subCategory.save();
    await subCategory.populate('categoryId', 'name');

    // Clear subcategory-related caches
    await clearSubCategoryCaches(categoryId);

    return res.status(200).json({
      success: true,
      message: "SubCategory status updated successfully",
      subCategory,
    });
  } catch (error) {
    console.error("Error toggling subcategory status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update subcategory status",
      error: error.message,
    });
  }
};