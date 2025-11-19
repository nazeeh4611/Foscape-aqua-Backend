// Controller (portfolioController.js)

import Portfolio from '../Model/ProjectModel.js';

export const getFeaturedPortfolios = async (req, res) => {
  try {
    const portfolios = await Portfolio.find({ 
      featured: true, 
      status: 'Active' 
    })
    .sort({ featuredAt: -1, createdAt: -1 })
    .select('name description category client duration location completionDate mediaUrls featured')
    .lean();

    if (!portfolios || portfolios.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No featured portfolios found'
      });
    }

    res.status(200).json({
      success: true,
      count: portfolios.length,
      portfolios
    });
  } catch (error) {
    console.error('Error fetching featured portfolios:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching featured portfolios',
      error: error.message
    });
  }
};

export const getAllPortfolios = async (req, res) => {
  try {
    const { category, status } = req.query;
    
    let query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (status) {
      query.status = status;
    } else {
      query.status = 'Active';
    }

    const portfolios = await Portfolio.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: portfolios.length,
      portfolios
    });
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolios',
      error: error.message
    });
  }
};

export const getPortfolioById = async (req, res) => {
  try {
    const { id } = req.params;

    const portfolio = await Portfolio.findById(id).lean();

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      });
    }

    res.status(200).json({
      success: true,
      portfolio
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolio',
      error: error.message
    });
  }
};

