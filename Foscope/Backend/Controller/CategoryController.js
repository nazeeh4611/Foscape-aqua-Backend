import Category from "../Model/CategoryModel.js";

// ✅ Get all categories (Admin)
export const getAllCategories = async (req, res) => {
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

// ✅ Get category by ID
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category fetched successfully",
      category,
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch category",
      error: error.message,
    });
  }
};

// ✅ Create new category (with image upload)
export const createCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;

    if (!name || !description) {
      return res
        .status(400)
        .json({ success: false, message: "Name and description are required" });
    }

    if (!req.file || !req.file.location) {
      return res
        .status(400)
        .json({ success: false, message: "Category image is required" });
    }

    const exists = await Category.findOne({ name: name.trim() });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists",
      });
    }

    const newCategory = new Category({
      name: name.trim(),
      description: description.trim(),
      image: req.file.location, // multer-s3 puts the full https URL here
      status: status || "Active",
    });

    await newCategory.save();

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      category: newCategory,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: error.message,
    });
  }
};


// ✅ Update category (with optional image upload)
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if name is being changed and if it already exists
    if (name && name.trim() !== category.name) {
      const existingCategory = await Category.findOne({ name: name.trim() });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists",
        });
      }
      category.name = name.trim();
    }

    // Update fields if provided
    if (description) category.description = description.trim();
    if (status) category.status = status;

    // Update image if new file was uploaded
    if (req.file) {
      category.image = req.file.location;
    }

    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message,
    });
  }
};

// ✅ Delete category
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    await Category.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: error.message,
    });
  }
};

// ✅ Toggle category status (Active/Inactive)
export const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    category.status = status;
    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category status updated successfully",
      category,
    });
  } catch (error) {
    console.error("Error toggling category status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update category status",
      error: error.message,
    });
  }
};


