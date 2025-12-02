import Cart from '../Model/CartModel.js';
import Product from '../Model/ProductModel.js';
import Wishlist from '../Model/WishListModel.js';

// Optimized populate configuration
const CART_POPULATE = {
  path: 'items.product',
  select: 'name price images stock status category subCategory',
  populate: [
    { path: 'category', select: 'name' },
    { path: 'subCategory', select: 'name' }
  ]
};

// Lean populate for faster queries (no Mongoose overhead)
const getCartWithLean = async (userId) => {
  return await Cart.findOne({ user: userId })
    .populate(CART_POPULATE)
    .lean();
};



export const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity = 1 } = req.body;

    // Single optimized query with only needed fields
    const product = await Product.findById(productId)
      .select('price stock status')
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (product.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'Product is not available',
      });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock',
      });
    }

    // Find or create cart and update in one operation
    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      // Create new cart with the item
      cart = await Cart.create({
        user: userId,
        items: [{
          product: productId,
          quantity,
          price: product.price,
        }]
      });
    } else {
      const existingItemIndex = cart.items.findIndex(
        item => item.product.toString() === productId
      );

      if (existingItemIndex > -1) {
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;
        
        if (newQuantity > product.stock) {
          return res.status(400).json({
            success: false,
            message: 'Cannot add more than available stock',
          });
        }

        cart.items[existingItemIndex].quantity = newQuantity;
        cart.items[existingItemIndex].price = product.price;
      } else {
        cart.items.push({
          product: productId,
          quantity,
          price: product.price,
        });
      }

      await cart.save();
    }

    // Only populate after save, using lean for faster response
    const populatedCart = await Cart.findOne({ user: userId })
      .populate(CART_POPULATE)
      .lean();

    res.status(200).json({
      success: true,
      message: 'Product added to cart',
      cart: populatedCart,
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding to cart',
      error: error.message,
    });
  }
};

export const updateCartItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1',
      });
    }

    // Optimized product check with only needed fields
    const product = await Product.findById(productId)
      .select('price stock')
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (quantity > product.stock) {
      return res.status(400).json({
        success: false,
        message: 'Requested quantity exceeds available stock',
      });
    }

    // Update using findOneAndUpdate for atomic operation
    const cart = await Cart.findOneAndUpdate(
      { 
        user: userId,
        'items.product': productId 
      },
      {
        $set: {
          'items.$.quantity': quantity,
          'items.$.price': product.price
        }
      },
      { new: true }
    ).populate(CART_POPULATE).lean();

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart or item not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cart updated',
      cart,
    });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating cart',
      error: error.message,
    });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    // Atomic remove operation
    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { $pull: { items: { product: productId } } },
      { new: true }
    ).populate(CART_POPULATE).lean();

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      cart,
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing from cart',
      error: error.message,
    });
  }
};

export const clearCart = async (req, res) => {
  try {
    const userId = req.user._id;

    // Atomic clear operation
    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { items: [] },
      { new: true }
    ).lean();

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cart cleared',
      cart,
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing cart',
      error: error.message,
    });
  }
};

// WISHLIST OPERATIONS (also optimized)

const WISHLIST_POPULATE = {
  path: 'products',
  select: 'name price images stock status category subCategory',
  populate: [
    { path: 'category', select: 'name' },
    { path: 'subCategory', select: 'name' }
  ]
};

export const getWishlist = async (req, res) => {
  try {
    const userId = req.user._id;

    let wishlist = await Wishlist.findOne({ user: userId })
      .populate(WISHLIST_POPULATE)
      .lean();

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [] });
    }

    const validProducts = wishlist.products.filter(product => 
      product && product.status === 'Active'
    );

    if (validProducts.length !== wishlist.products.length) {
      await Wishlist.findOneAndUpdate(
        { user: userId },
        { products: validProducts.map(p => p._id) },
        { new: true }
      );
      wishlist.products = validProducts;
    }

    res.status(200).json({
      success: true,
      wishlist,
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching wishlist',
      error: error.message,
    });
  }
};

export const addToWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.body;

    // Optimized product check
    const product = await Product.findById(productId)
      .select('status')
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (product.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'Product is not available',
      });
    }

    // Check if already exists and add in one operation
    const existingWishlist = await Wishlist.findOne({
      user: userId,
      products: productId
    }).select('_id').lean();

    if (existingWishlist) {
      return res.status(400).json({
        success: false,
        message: 'Product already in wishlist',
      });
    }

    // Atomic add operation
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { $addToSet: { products: productId } },
      { upsert: true, new: true }
    ).populate(WISHLIST_POPULATE).lean();

    res.status(200).json({
      success: true,
      message: 'Product added to wishlist',
      wishlist,
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding to wishlist',
      error: error.message,
    });
  }
};

export const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    // Atomic remove operation
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { $pull: { products: productId } },
      { new: true }
    ).populate(WISHLIST_POPULATE).lean();

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product removed from wishlist',
      wishlist,
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing from wishlist',
      error: error.message,
    });
  }
};

export const clearWishlist = async (req, res) => {
  try {
    const userId = req.user._id;

    // Atomic clear operation
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { products: [] },
      { new: true }
    ).lean();

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Wishlist cleared',
      wishlist,
    });
  } catch (error) {
    console.error('Error clearing wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing wishlist',
      error: error.message,
    });
  }
};
