

// import Category from '../Model/CategoryModel.js';
// import path from 'path';
// import fs from 'fs'
// // Get all categories
// export const getAllCategories = async (req, res) => {
//   try {
//     const categories = await Category.find().sort({ createdAt: -1 });
    
//     // Format the response to match frontend expectations
//     const formattedCategories = categories.map(category => ({
//       _id: category._id,
//       name: category.name,
//       image: category.image,
//       status: category.status,
//       description: category.description || '',
//       createdAt: new Date(category.createdAt).toLocaleDateString('en-US', {
//         year: 'numeric',
//         month: 'short',
//         day: 'numeric'
//       })
//     }));

//     res.status(200).json({
//       success: true,
//       categories: formattedCategories
//     });
//   } catch (error) {
//     console.error('Error fetching categories:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch categories',
//       error: error.message
//     });
//   }
// };

// // Add new category
// export const addCategory = async (req, res) => {
//   console.log("may here")
//   try {
//     const { name, status, description } = req.body;

//     // Validation
//     if (!name || !name.trim()) {
//       return res.status(400).json({
//         success: false,
//         message: 'Category name is required'
//       });
//     }

//     if (name.trim().length < 3) {
//       return res.status(400).json({
//         success: false,
//         message: 'Category name must be at least 3 characters'
//       });
//     }

//     if (!description || !description.trim()) {
//       return res.status(400).json({
//         success: false,
//         message: 'Category description is required'
//       });
//     }

//     if (description.trim().length < 10) {
//       return res.status(400).json({
//         success: false,
//         message: 'Description must be at least 10 characters'
//       });
//     }

//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: 'Category image is required'
//       });
//     }

//     // Check if category name already exists
//     const existingCategory = await Category.findOne({ 
//       name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
//     });

//     if (existingCategory) {
//       return res.status(400).json({
//         success: false,
//         message: 'Category with this name already exists'
//       });
//     }

//     // Create image URL (adjust based on your setup)
//     const imageUrl = req.file?.location;  

//     // Create new category
//     const newCategory = new Category({
//       name: name.trim(),
//       image: imageUrl,
//       status: status || 'Active',
//       description: description.trim()
//     });

//     await newCategory.save();

//     res.status(201).json({
//       success: true,
//       message: 'Category created successfully',
//       category: newCategory
//     });
//   } catch (error) {
//     console.error('Error adding category:', error);
    
//     // Delete uploaded file if category creation fails
//     if (req.file) {
//       try {
//         await fs.unlink(req.file.path);
//       } catch (unlinkError) {
//         console.error('Error deleting file:', unlinkError);
//       }
//     }

//     res.status(500).json({
//       success: false,
//       message: 'Failed to create category',
//       error: error.message
//     });
//   }
// };

// // Edit category
// export const editCategory = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { name, status, description } = req.body;

//     // Find existing category
//     const category = await Category.findById(id);
//     if (!category) {
//       return res.status(404).json({
//         success: false,
//         message: 'Category not found'
//       });
//     }

//     // Validation
//     if (!name || !name.trim()) {
//       return res.status(400).json({
//         success: false,
//         message: 'Category name is required'
//       });
//     }

//     if (name.trim().length < 3) {
//       return res.status(400).json({
//         success: false,
//         message: 'Category name must be at least 3 characters'
//       });
//     }

//     if (!description || !description.trim()) {
//       return res.status(400).json({
//         success: false,
//         message: 'Category description is required'
//       });
//     }

//     if (description.trim().length < 10) {
//       return res.status(400).json({
//         success: false,
//         message: 'Description must be at least 10 characters'
//       });
//     }

//     // Check if new name conflicts with existing category
//     if (name.trim().toLowerCase() !== category.name.toLowerCase()) {
//       const existingCategory = await Category.findOne({ 
//         name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
//         _id: { $ne: id }
//       });

//       if (existingCategory) {
//         return res.status(400).json({
//           success: false,
//           message: 'Category with this name already exists'
//         });
//       }
//     }

//     // Update fields
//     category.name = name.trim();
//     category.status = status || category.status;
//     category.description = description.trim();

//     // Update image if new one is uploaded
//     if (req.file) {
//       // Delete old image file
//       if (category.image) {
//         const oldImagePath = path.join(__dirname, '..', category.image);
//         try {
//           await fs.unlink(oldImagePath);
//         } catch (error) {
//           console.error('Error deleting old image:', error);
//         }
//       }
      
//       category.image = `/uploads/categories/${req.file.filename}`;
//     }

//     await category.save();

//     res.status(200).json({
//       success: true,
//       message: 'Category updated successfully',
//       category
//     });
//   } catch (error) {
//     console.error('Error editing category:', error);
    
//     // Delete uploaded file if update fails
//     if (req.file) {
//       try {
//         await fs.unlink(req.file.path);
//       } catch (unlinkError) {
//         console.error('Error deleting file:', unlinkError);
//       }
//     }

//     res.status(500).json({
//       success: false,
//       message: 'Failed to update category',
//       error: error.message
//     });
//   }
// };

// // Delete category
// export const deleteCategory = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const category = await Category.findById(id);
//     if (!category) {
//       return res.status(404).json({
//         success: false,
//         message: 'Category not found'
//       });
//     }

//     // Delete image file
//     if (category.image) {
//       const imagePath = path.join(__dirname, '..', category.image);
//       try {
//         await fs.unlink(imagePath);
//       } catch (error) {
//         console.error('Error deleting image:', error);
//       }
//     }

//     await Category.findByIdAndDelete(id);

//     res.status(200).json({
//       success: true,
//       message: 'Category deleted successfully'
//     });
//   } catch (error) {
//     console.error('Error deleting category:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to delete category',
//       error: error.message
//     });
//   }
// };

// // Toggle category status
// export const toggleCategoryStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status } = req.body;

//     if (!status || !['Active', 'Inactive'].includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid status. Must be "Active" or "Inactive"'
//       });
//     }

//     const category = await Category.findById(id);
//     if (!category) {
//       return res.status(404).json({
//         success: false,
//         message: 'Category not found'
//       });
//     }

//     category.status = status;
//     await category.save();

//     res.status(200).json({
//       success: true,
//       message: `Category ${status === 'Active' ? 'activated' : 'deactivated'} successfully`,
//       category
//     });
//   } catch (error) {
//     console.error('Error toggling category status:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to update category status',
//       error: error.message
//     });
//   }
// };