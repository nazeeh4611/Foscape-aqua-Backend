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

categorySchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.createdAt = ret.createdAt ? new Date(ret.createdAt).toLocaleDateString() : '';
    ret.updatedAt = ret.updatedAt ? new Date(ret.updatedAt).toLocaleDateString() : '';
    return ret;
  }
});

const Category = mongoose.model('Category', categorySchema);

export default Category