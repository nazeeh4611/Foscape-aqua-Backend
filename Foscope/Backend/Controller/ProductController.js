import Product from "../Model/ProductModel.js";
import Category from "../Model/CategoryModel.js";
import SubCategory from "../Model/SubCategoryModel.js";


// ==========================================
// GET ALL PRODUCTS
// ==========================================
export const getAllProducts = async (req, res) => {
  try {
    const { search, status, category, sortBy } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (status && status !== "All") query.status = status;
    if (category && category !== "All") query.category = category;

    let sortOption = {};

    switch (sortBy) {
      case "name":
        sortOption = { name: 1 };
        break;
      case "price-low":
        sortOption = { price: 1 };
        break;
      case "price-high":
        sortOption = { price: -1 };
        break;
      case "date":
      default:
        sortOption = { createdAt: -1 };
    }

    const products = await Product.find(query)
      .populate("category", "name")
      .populate("subCategory", "name")
      .sort(sortOption);

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// ==========================================
// GET PRODUCT BY ID
// ==========================================
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name")
      .populate("subCategory", "name");

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// ==========================================
// CREATE PRODUCT  (with images)
// ==========================================
export const createProduct = async (req, res) => {
  try {
    const imageUrls = req.files?.map((file) => file.location) || [];

    const newProduct = await Product.create({
      ...req.body,
      images: imageUrls,
    });

    const populated = await Product.findById(newProduct._id)
      .populate("category", "name")
      .populate("subCategory", "name");

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: populated,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ success: false, errors: messages });
    }

    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "SKU already exists" });
    }

    res.status(500).json({ success: false, message: error.message });
  }
};


export const updateProduct = async (req, res) => {
  try {
    let updatedImages = [];

    if (req.files?.length > 0) {
      updatedImages = req.files.map((file) => file.location);
      req.body.images = updatedImages;
    }

    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("category", "name")
      .populate("subCategory", "name");

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ success: false, errors: messages });
    }

    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "SKU already exists" });
    }

    res.status(500).json({ success: false, message: error.message });
  }
};



export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



export const toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    product.status = product.status === "Active" ? "Inactive" : "Active";
    await product.save();

    res.status(200).json({
      success: true,
      message: "Status updated",
      data: product,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSubCategories = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const query = categoryId ? { categoryId: categoryId } : {};
    
    const subCategories = await SubCategory.find(query)
      .populate("categoryId", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      subCategories,
    });
  } catch (error) {
    console.error('❌ Error in getSubCategories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};