import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [3, "Product name must be at least 3 characters"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      minlength: [20, "Description must be at least 20 characters"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
    },
    images: [
      {
        type: String,
        required: true,
      },
    ],
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      trim: true,
    },
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    
    // Equipment-specific fields
    waterType: {
      type: String,
      enum: ["Freshwater", "Saltwater", "Both", "N/A"],
      default: "N/A",
    },
    tankSize: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    warranty: {
      type: String,
      trim: true,
    },
    
    // Fish-specific fields
    fishSpecies: {
      type: String,
      trim: true,
    },
    fishSize: {
      type: String,
      enum: ["Small", "Medium", "Large", "Extra Large", "N/A"],
      default: "N/A",
    },
    temperament: {
      type: String,
      enum: ["Peaceful", "Semi-Aggressive", "Aggressive", "N/A"],
      default: "N/A",
    },
    dietType: {
      type: String,
      enum: ["Herbivore", "Carnivore", "Omnivore", "N/A"],
      default: "N/A",
    },
    minimumTankSize: {
      type: String,
      trim: true,
    },
    
    // Fish Feed specific fields
    feedType: {
      type: String,
      enum: ["Pellets", "Flakes", "Frozen", "Live", "Freeze-Dried", "N/A"],
      default: "N/A",
    },
    feedSize: {
      type: String,
      enum: ["Small", "Medium", "Large", "Mixed", "N/A"],
      default: "N/A",
    },
    nutritionInfo: {
      type: String,
      trim: true,
    },
    
    // Service-specific fields
    serviceDuration: {
      type: String,
      trim: true,
    },
    serviceType: {
      type: String,
      enum: ["Maintenance", "Setup", "Cleaning", "Consultation", "Emergency", "N/A"],
      default: "N/A",
    },
    serviceArea: {
      type: String,
      trim: true,
    },
    
    // Common fields
    featured: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
productSchema.index({ name: "text", description: "text" });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ sku: 1 });

// Pre-save validation based on category
productSchema.pre('save', async function(next) {
  if (this.isModified('category') || this.isNew) {
    const Category = mongoose.model('Category');
    const category = await Category.findById(this.category);
    
    if (category) {
      const categoryName = category.name.toLowerCase();
      
      // Validate based on category type
      if (categoryName.includes('fish') && !categoryName.includes('feed')) {
        // Fish products - require fish-specific fields
        if (!this.fishSpecies) {
          return next(new Error('Fish species is required for fish products'));
        }
      } else if (categoryName.includes('equipment') || categoryName.includes('filter') || categoryName.includes('light')) {
        // Equipment products - require brand
        if (!this.brand) {
          return next(new Error('Brand is required for equipment products'));
        }
      } else if (categoryName.includes('feed') || categoryName.includes('food')) {
        // Feed products - require feed type
        if (!this.feedType || this.feedType === 'N/A') {
          return next(new Error('Feed type is required for fish feed products'));
        }
      } else if (categoryName.includes('service')) {
        // Service products - require service type
        if (!this.serviceType || this.serviceType === 'N/A') {
          return next(new Error('Service type is required for service products'));
        }
      }
    }
  }
  next();
});

const Product = mongoose.model("Product", productSchema);
export default Product;