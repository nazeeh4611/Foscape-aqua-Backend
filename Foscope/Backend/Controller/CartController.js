
import Cart from '../Model/CartModel.js';
import Product from '../Model/ProductModel.js';
import Wishlist from '../Model/WishListModel.js';

export const getCart = async (req, res) => {
  try {
    const userId = req.user._id;

    let cart = await Cart.findOne({ user: userId })
      .populate({
        path: 'items.product',
        select: 'name price images stock status category subCategory',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'subCategory', select: 'name' }
        ]
      });

    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    const validItems = cart.items.filter(item => 
      item.product && item.product.status === 'Active'
    );

    if (validItems.length !== cart.items.length) {
      cart.items = validItems;
      await cart.save();
    }

    res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cart',
      error: error.message,
    });
  }
};

export const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity = 1 } = req.body;

    const product = await Product.findById(productId);

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

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

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
    } else {
      cart.items.push({
        product: productId,
        quantity,
        price: product.price,
      });
    }

    await cart.save();

    cart = await Cart.findOne({ user: userId })
      .populate({
        path: 'items.product',
        select: 'name price images stock status category subCategory',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'subCategory', select: 'name' }
        ]
      });

    res.status(200).json({
      success: true,
      message: 'Product added to cart',
      cart,
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

    const product = await Product.findById(productId);

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

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      });
    }

    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].price = product.price;

    await cart.save();

    cart = await Cart.findOne({ user: userId })
      .populate({
        path: 'items.product',
        select: 'name price images stock status category subCategory',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'subCategory', select: 'name' }
        ]
      });

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

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    cart.items = cart.items.filter(
      item => item.product.toString() !== productId
    );

    await cart.save();

    cart = await Cart.findOne({ user: userId })
      .populate({
        path: 'items.product',
        select: 'name price images stock status category subCategory',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'subCategory', select: 'name' }
        ]
      });

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

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    cart.items = [];
    await cart.save();

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



export const getWishlist = async (req, res) => {
  try {
    const userId = req.user._id;

    let wishlist = await Wishlist.findOne({ user: userId })
      .populate({
        path: 'products',
        select: 'name price images stock status category subCategory',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'subCategory', select: 'name' }
        ]
      });

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [] });
    }

    const validProducts = wishlist.products.filter(product => 
      product && product.status === 'Active'
    );

    if (validProducts.length !== wishlist.products.length) {
      wishlist.products = validProducts.map(p => p._id);
      await wishlist.save();
      wishlist = await Wishlist.findOne({ user: userId })
        .populate({
          path: 'products',
          select: 'name price images stock status category subCategory',
          populate: [
            { path: 'category', select: 'name' },
            { path: 'subCategory', select: 'name' }
          ]
        });
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

    const product = await Product.findById(productId);

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

    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [] });
    }

    if (wishlist.products.includes(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Product already in wishlist',
      });
    }

    wishlist.products.push(productId);
    await wishlist.save();

    wishlist = await Wishlist.findOne({ user: userId })
      .populate({
        path: 'products',
        select: 'name price images stock status category subCategory',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'subCategory', select: 'name' }
        ]
      });

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

    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found',
      });
    }

    wishlist.products = wishlist.products.filter(
      id => id.toString() !== productId
    );

    await wishlist.save();

    wishlist = await Wishlist.findOne({ user: userId })
      .populate({
        path: 'products',
        select: 'name price images stock status category subCategory',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'subCategory', select: 'name' }
        ]
      });

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

    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found',
      });
    }

    wishlist.products = [];
    await wishlist.save();

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


