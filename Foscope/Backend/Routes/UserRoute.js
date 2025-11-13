import express from "express";
import path from "path";
import dotenv from "dotenv";
import {Userlogin,UserRegister,Logout, getUser, GoogleAuth, ResetPassword, ForgotPassword,VerifyOtp, ResendOtp} from "../Controller/AuthController.js"
import { AllCategories, getSubCategoriesByCategory,getRelatedProducts,getFeaturedProducts,getProductByIdUser,getAllProductsUser,searchProducts, getCategoriesWithSubcategories } from "../Controller/UserController.js";


dotenv.config();

const router = express.Router();

// Auth Routes
router.post("/login", Userlogin);
router.post("/register", UserRegister);
router.post("/verify-otp", VerifyOtp);
router.post("/resend-otp", ResendOtp);
router.post("/forgot-password", ForgotPassword);
router.post("/reset-password", ResetPassword);
router.post("/logout", Logout);
router.post("/google-auth", GoogleAuth);
router.get("/getuser", getUser);

// Category Routes
router.get('/category', AllCategories);
router.get('/subcategory/:categoryId', getSubCategoriesByCategory);
router.get('/categories-with-subcategories', getCategoriesWithSubcategories);

// Product Routes for Users
router.get('/products/:subCategoryId', getAllProductsUser);
router.get('/product/:id', getProductByIdUser);
router.get('/products/related/:productId', getRelatedProducts);
router.get('/products/featured', getFeaturedProducts);
router.get('/products/search', searchProducts);



export default router;