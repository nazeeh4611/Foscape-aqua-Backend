// ========== OPTIMIZED CATEGORY MODEL ==========
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

// ✅ CRITICAL INDEXES FOR PERFORMANCE
categorySchema.index({ status: 1, createdAt: -1 }); // Already exists ✓
categorySchema.index({ status: 1, name: 1 }); // NEW - for name sorting
categorySchema.index({ _id: 1, status: 1 }); // NEW - for quick lookups

categorySchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.createdAt = ret.createdAt ? new Date(ret.createdAt).toLocaleDateString() : '';
    ret.updatedAt = ret.updatedAt ? new Date(ret.updatedAt).toLocaleDateString() : '';
    return ret;
  }
});

const Category = mongoose.model('Category', categorySchema);
export default Category;