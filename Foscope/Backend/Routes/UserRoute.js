import express from "express";
import path from "path";
import dotenv from "dotenv";
import {Userlogin,UserRegister,Logout, getUser, GoogleAuth, ResetPassword, ForgotPassword,VerifyOtp, ResendOtp} from "../Controller/AuthController.js"
import { AllCategories, getSubCategoriesByCategory,getRelatedProducts,getFeaturedProducts,getProductByIdUser,getAllProductsUser,searchProducts, getCategoriesWithSubcategories } from "../Controller/UserController.js";
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart,getWishlist, addToWishlist, removeFromWishlist, clearWishlist } from '../Controller/CartController.js';
import { createRazorpayOrder, verifyRazorpayPayment, createOrder, getUserOrders, getOrderById, cancelOrder } from '../Controller/OrderController.js';
import { getUserProfile, updateUserProfile, changePassword } from '../Controller/UserProfileController.js';
import { getAllGalleries, getGalleryById } from '../Controller/GalleryController.js';
import { authenticateUser } from "../Middleware/Auth.js";
import { contactForm } from "../Controller/ContactController.js";

dotenv.config();

const router = express.Router();

router.post("/login", Userlogin);
router.post("/register", UserRegister);
router.post("/verify-otp", VerifyOtp);
router.post("/resend-otp", ResendOtp);
router.post("/forgot-password", ForgotPassword);
router.post("/reset-password", ResetPassword);
router.post("/logout", Logout);
router.post("/google-auth", GoogleAuth);
router.get("/get-user", getUser);

router.get('/category', AllCategories);
router.get('/subcategory/:categoryId', getSubCategoriesByCategory);
router.get('/categories-with-subcategories', getCategoriesWithSubcategories);

router.get('/products/featured', getFeaturedProducts);
router.get('/products/related/:productId', getRelatedProducts);
router.get('/products/search', searchProducts);
router.get('/products/:subCategoryId', getAllProductsUser);
router.get('/product/:id', getProductByIdUser);

router.get('/cart', authenticateUser, getCart);
router.post('/cart/add', authenticateUser, addToCart);
router.put('/cart/update', authenticateUser, updateCartItem);
router.delete('/cart/remove/:productId', authenticateUser, removeFromCart);
router.delete('/cart/clear', authenticateUser, clearCart);

router.get('/wishlist', authenticateUser, getWishlist);
router.post('/wishlist/add', authenticateUser, addToWishlist);
router.delete('/wishlist/remove/:productId', authenticateUser, removeFromWishlist);
router.delete('/wishlist/clear', authenticateUser, clearWishlist);

router.post('/orders/razorpay/create', authenticateUser, createRazorpayOrder);
router.post('/orders/razorpay/verify', authenticateUser, verifyRazorpayPayment);
router.post('/orders/create', authenticateUser, createOrder);
router.get('/orders', authenticateUser, getUserOrders);
router.get('/orders/:orderId', authenticateUser, getOrderById);
router.put('/orders/:orderId/cancel', authenticateUser, cancelOrder);

router.get('/profile', authenticateUser, getUserProfile);
router.put('/profile/update', authenticateUser, updateUserProfile);
router.put('/profile/change-password', authenticateUser, changePassword);

router.get('/gallery', getAllGalleries);
router.get('/gallery/:id', getGalleryById);

router.post('/contact', contactForm);

export default router;