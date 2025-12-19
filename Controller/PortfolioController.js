import Portfolio from '../Model/ProjectModel.js';

export const getPortfolioItems = async (req, res) => {
  try {
    const {
      search,
      category,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 12
    } = req.query;

    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category && category !== 'All') {
      filter.category = category;
    }
    
    if (status && status !== 'All') {
      filter.status = status;
    }

    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [items, totalCount] = await Promise.all([
      Portfolio.find(filter)
        .sort(sortConfig)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Portfolio.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: items,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalItems: totalCount,
        itemsPerPage: limitNum
      }
    });
  } catch (error) {
    console.error('Get portfolio items error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolio items',
      error: error.message
    });
  }
};

export const getPortfolioItem = async (req, res) => {
  try {
    const item = await Portfolio.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Get portfolio item error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolio item',
      error: error.message
    });
  }
};

export const createPortfolioItem = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      client,
      duration,
      features,
      location,
      completionDate,
      status,
      featured
    } = req.body;

    // Validate required fields
    if (!name || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, and category are required fields'
      });
    }

    // Get image URLs from S3 upload - FIXED
    let mediaUrls = [];
    if (req.files && req.files.length > 0) {
      mediaUrls = req.files.map(file => file.location);
    }

    // Validate at least one image
    if (mediaUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required'
      });
    }

    // Handle featured logic
    const isFeatured = featured === 'true' || featured === true;
    if (isFeatured) {
      await enforceFeaturedLimit();
    }

    const portfolioItem = new Portfolio({
      name,
      description,
      category,
      client: client || '',
      duration: duration || '',
      features: features || '',
      location: location || '',
      completionDate: completionDate || null,
      status: status || 'Active',
      featured: isFeatured,
      featuredAt: isFeatured ? new Date() : null,
      mediaUrls
    });

    const savedItem = await portfolioItem.save();

    res.status(201).json({
      success: true,
      message: 'Portfolio item created successfully',
      data: savedItem
    });
  } catch (error) {
    console.error('Create portfolio item error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating portfolio item',
      error: error.message
    });
  }
};

export const updatePortfolioItem = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      client,
      duration,
      features,
      location,
      completionDate,
      status,
      featured,
      existingImages
    } = req.body;

    // Find existing item
    const existingItem = await Portfolio.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }

    // Parse existing images to keep
    let imagesToKeep = [];
    try {
      imagesToKeep = existingImages ? JSON.parse(existingImages) : [];
    } catch (e) {
      imagesToKeep = [];
    }

    // Get new uploaded images
    let newMediaUrls = [];
    if (req.files && req.files.length > 0) {
      newMediaUrls = req.files.map(file => file.location);
    }

    // Filter existing images that should be kept
    const keptExistingImages = existingItem.mediaUrls.filter(url => 
      imagesToKeep.includes(url)
    );
    
    // Combine kept existing images with new uploads
    let mediaUrls = [...keptExistingImages, ...newMediaUrls];

    // Limit to 10 images
    if (mediaUrls.length > 10) {
      mediaUrls = mediaUrls.slice(0, 10);
    }

    // Validate at least one image
    if (mediaUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required'
      });
    }

    // Handle featured logic
    let featuredUpdate = {};
    const newFeaturedStatus = featured === 'true' || featured === true;
    
    if (newFeaturedStatus && !existingItem.featured) {
      await enforceFeaturedLimit();
      featuredUpdate = {
        featured: true,
        featuredAt: new Date()
      };
    } else if (!newFeaturedStatus && existingItem.featured) {
      featuredUpdate = {
        featured: false,
        featuredAt: null
      };
    } else if (newFeaturedStatus) {
      featuredUpdate = {
        featured: true
      };
    } else {
      featuredUpdate = {
        featured: false
      };
    }

    const updateData = {
      name,
      description,
      category,
      client: client || '',
      duration: duration || '',
      features: features || '',
      location: location || '',
      completionDate: completionDate || null,
      status,
      mediaUrls,
      updatedAt: new Date(),
      ...featuredUpdate
    };

    const updatedItem = await Portfolio.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Portfolio item updated successfully',
      data: updatedItem
    });
  } catch (error) {
    console.error('Update portfolio item error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating portfolio item',
      error: error.message
    });
  }
};

export const deletePortfolioItem = async (req, res) => {
  try {
    const item = await Portfolio.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }

    await Portfolio.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Portfolio item deleted successfully'
    });
  } catch (error) {
    console.error('Delete portfolio item error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting portfolio item',
      error: error.message
    });
  }
};

export const togglePortfolioStatus = async (req, res) => {
  try {
    const item = await Portfolio.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }

    const newStatus = item.status === 'Active' ? 'Inactive' : 'Active';
    const updatedItem = await Portfolio.findByIdAndUpdate(
      req.params.id,
      { status: newStatus, updatedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `Portfolio item ${newStatus.toLowerCase()} successfully`,
      data: updatedItem
    });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling portfolio item status',
      error: error.message
    });
  }
};

export const getPortfolioStats = async (req, res) => {
  try {
    const stats = await Portfolio.aggregate([
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          activeProjects: {
            $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] }
          },
          featuredProjects: {
            $sum: { $cond: [{ $eq: ['$featured', true] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalProjects: 0,
      activeProjects: 0,
      featuredProjects: 0,
      inactiveProjects: 0
    };

    result.inactiveProjects = result.totalProjects - result.activeProjects;

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get portfolio stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolio statistics',
      error: error.message
    });
  }
};

// Helper function to enforce featured limit
const enforceFeaturedLimit = async () => {
  const featuredCount = await Portfolio.countDocuments({ featured: true });
  
  if (featuredCount >= 3) {
    const oldestFeatured = await Portfolio.findOne({ featured: true })
      .sort({ featuredAt: 1 })
      .limit(1);
    
    if (oldestFeatured) {
      await Portfolio.findByIdAndUpdate(oldestFeatured._id, {
        featured: false,
        featuredAt: null
      });
    }
  }
};

export const toggleFeaturedStatus = async (req, res) => {
  try {
    const item = await Portfolio.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }

    const newFeaturedStatus = !item.featured;
    let updateData = {};

    if (newFeaturedStatus) {
      await enforceFeaturedLimit();
      updateData = {
        featured: true,
        featuredAt: new Date()
      };
    } else {
      updateData = {
        featured: false,
        featuredAt: null
      };
    }

    const updatedItem = await Portfolio.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `Project ${newFeaturedStatus ? 'featured' : 'unfeatured'} successfully`,
      data: updatedItem
    });
  } catch (error) {
    console.error('Toggle featured status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling featured status',
      error: error.message
    });
  }
};