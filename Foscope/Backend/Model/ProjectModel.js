import mongoose from 'mongoose';

const portfolioSchema = new mongoose.Schema({
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [100, 'Project name cannot exceed 100 characters']
    },
    description: {
      type: String,
      required: [true, 'Project description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    category: {
      type: String,
      required: true,
      enum: {
        values: ['pond', 'landscape', 'fountain', 'pool', 'design'],
        message: 'Category must be one of: pond, landscape, fountain, pool, design'
      },
      default: 'pond'
    },
    client: {
      type: String,
      trim: true,
      maxlength: [100, 'Client name cannot exceed 100 characters']
    },
    duration: {
      type: String,
      trim: true,
      maxlength: [50, 'Duration cannot exceed 50 characters']
    },
    features: {
      type: String,
      trim: true,
      maxlength: [500, 'Features cannot exceed 500 characters']
    },
    location: {
      type: String,
      trim: true,
      maxlength: [100, 'Location cannot exceed 100 characters']
    },
    completionDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    },
    featured: {
      type: Boolean,
      default: false
    },
    featuredAt: {
      type: Date
    },
    mediaUrls: [{
      type: String,
      required: true
    }],
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }, {
    timestamps: true
  });
  
  portfolioSchema.index({ name: 'text', description: 'text' });
  portfolioSchema.index({ category: 1, status: 1 });
  portfolioSchema.index({ createdAt: -1 });
  portfolioSchema.index({ featured: 1,status:1, featuredAt: -1 }); 

const Portfolio = mongoose.model('Portfolio', portfolioSchema);

export default Portfolio