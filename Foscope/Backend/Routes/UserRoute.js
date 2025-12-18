// Routes/UserRoute.js
import express from 'express';
import compression from 'compression';
import dotenv from 'dotenv'
import { 
  Userlogin, UserRegister, Logout, getUser, GoogleAuth, 
  ResetPassword, ForgotPassword, VerifyOtp, ResendOtp 
} from "../Controller/AuthController.js";
import { 
  AllCategories, getSubCategoriesByCategory, getRelatedProducts,
  getFeaturedProducts, getProductByIdUser, getAllProductsUser,
  searchProducts, getCategoriesWithSubcategories, getContactNumber,
 getFeaturedPortfoliosForHome, getCategoryDetails,
  getBatchData
} from "../Controller/UserController.js";
import { 
  getCart, addToCart, updateCartItem, removeFromCart, clearCart,
  getWishlist, addToWishlist, removeFromWishlist, clearWishlist 
} from '../Controller/CartController.js';
import { 
  createRazorpayOrder, verifyRazorpayPayment, createOrder, 
  getUserOrders, getOrderById, cancelOrder, generateInvoice 
} from '../Controller/OrderController.js';
import { 
  getUserProfile, updateUserProfile, changePassword 
} from '../Controller/UserProfileController.js';
import { getAllGalleries, getGalleryById } from '../Controller/GalleryController.js';
import { authenticateUser } from "../Middleware/Auth.js";
import { contactForm } from "../Controller/ContactController.js";
import { getAllPortfolios, getFeaturedPortfolios, getPortfolioById } from "../Controller/WorksController.js";
import { createPortfolioItem } from "../Controller/PortfolioController.js";
import redisUtils from '../Utils/Redis.js'; // Import the default export

// Destructure cacheMiddleware from the default export
const { cacheMiddleware } = redisUtils;

dotenv.config();

const router = express.Router();

// Apply compression to all routes
router.use(compression());

// Authentication routes (no caching)
router.post("/login", Userlogin);
router.post("/register", UserRegister);
router.post("/verify-otp", VerifyOtp);
router.post("/resend-otp", ResendOtp);
router.post("/forgot-password", ForgotPassword);
router.post("/reset-password", ResetPassword);
router.post("/logout", Logout);
router.post("/google-auth", GoogleAuth);
router.get("/get-user", authenticateUser, getUser);

// Cached public routes
router.get('/category', cacheMiddleware(300), AllCategories);
router.get('/category/:id', cacheMiddleware(600), getCategoryDetails);
router.get('/subcategory/:categoryId', cacheMiddleware(300), getSubCategoriesByCategory);
router.get('/categories-with-subcategories', cacheMiddleware(600), getCategoriesWithSubcategories);

// Product routes with caching
router.get('/products/featured', cacheMiddleware(300), getFeaturedProducts);
router.get('/products/related/:productId', cacheMiddleware(300), getRelatedProducts);
router.get('/products/search', cacheMiddleware(180), searchProducts);
router.get('/products/:subCategoryId', cacheMiddleware(300), getAllProductsUser);
router.get('/product/:id', cacheMiddleware(600), getProductByIdUser);

// Batch data endpoint
router.get('/batch-data', cacheMiddleware(300), getBatchData);

// User-specific routes (authenticated, shorter or no cache)
router.get('/cart', authenticateUser, getCart);
router.post('/cart/add', authenticateUser, addToCart);
router.put('/cart/update', authenticateUser, updateCartItem);
router.delete('/cart/remove/:productId', authenticateUser, removeFromCart);
router.delete('/cart/clear', authenticateUser, clearCart);

router.get('/wishlist', authenticateUser, getWishlist);
router.post('/wishlist/add', authenticateUser, addToWishlist);
router.delete('/wishlist/remove/:productId', authenticateUser, removeFromWishlist);
router.delete('/wishlist/clear', authenticateUser, clearWishlist);

// Order routes (no caching for sensitive data)
router.post('/orders/razorpay/create', authenticateUser, createRazorpayOrder);
router.post('/orders/razorpay/verify', authenticateUser, verifyRazorpayPayment);
router.post('/orders/create', authenticateUser, createOrder);
router.get('/orders', authenticateUser, getUserOrders);
router.get('/orders/:orderId', authenticateUser, getOrderById);
router.put('/orders/:orderId/cancel', authenticateUser, cancelOrder);
router.get("/orders/:orderId/generate-invoice", authenticateUser, generateInvoice);

// Profile routes
router.get('/profile', authenticateUser, getUserProfile);
router.put('/profile/update', authenticateUser, updateUserProfile);
router.put('/profile/change-password', authenticateUser, changePassword);

// Gallery routes with caching
router.get('/gallery', cacheMiddleware(600), getAllGalleries);
router.get('/gallery/:id', cacheMiddleware(600), getGalleryById);

// Contact form (no caching)
router.post('/contact', contactForm);

// Phone number (long cache)
router.get('/phone', cacheMiddleware(3600), getContactNumber);

// Portfolio routes with caching
router.get('/portfolios/featured', cacheMiddleware(300), getFeaturedPortfolios);
router.get('/portfolios', cacheMiddleware(600), getAllPortfolios);
router.get('/portfolio/:id', cacheMiddleware(600), getPortfolioById);
router.post('/portfolio', createPortfolioItem);

// Home data routes with caching
// router.get('/home-data', cacheMiddleware(300), getHomeData);
router.get('/featured-portfolios', cacheMiddleware(300), getFeaturedPortfoliosForHome);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'aquatic-backend'
  });
});

// Redis health check
router.get('/health/redis', async (req, res) => {
  const health = await redisUtils.checkRedisHealth();
  res.json(health);
});

export default router;