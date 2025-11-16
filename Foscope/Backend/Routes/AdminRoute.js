import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { fromEnv } from "@aws-sdk/credential-provider-env";

import {
  createCategory,
  deleteCategory,
  getAllCategories,
  toggleCategoryStatus,
  updateCategory,
} from "../Controller/CategoryController.js";

import {
  createSubCategory,
  deleteSubCategory,
  getAllSubCategories,
  getSubCategoriesByCategory,
  getSubCategoryById,
  toggleSubCategoryStatus,
  updateSubCategory,
} from "../Controller/SubCategoryController.js";

import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getCategories,
  getProductById,
  getSubCategories,
  toggleProductStatus,
  updateProduct,
} from "../Controller/ProductController.js";

import {
  addGalleryItem,
  deleteGalleryItem,
  deleteOrder,
  deleteUser,
  getAllGallery,
  getAllOrders,
  getAllUsers,
  getOrderById,
  getOrderStats,
  getOrdersByUser,
  getUserById,
  searchOrders,
  toggleUserBlockStatus,
  updateGalleryItem,
  updateGalleryStatus,
  updateOrderStatus,
  updatePaymentStatus,
  updateUser,
} from "../Controller/AdminController.js";

import {
  downloadSalesReportExcel,
  downloadSalesReportPDF,
  getSalesReport,
} from "../Controller/SalesController.js";

import { adminLogin, changePassword } from "../Controller/AdminAuthController.js";
import { authenticate, authorizeAdmin } from "../Middleware/Auth.js";


dotenv.config();

const Adminrouter = express.Router();

/* ------------------------------ AWS CONFIG ------------------------------ */

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env variable: ${name}`);
  return v;
};

const region = required("AWS_REGION");
const categoryBucket = required("AWS_CATEGORY_BUCKET");
const propertyBucket = required("AWS_PROPERTY_BUCKET");
const galleryBucket = "foscape-gallery";

const s3Client = new S3Client({
  region,
  credentials: fromEnv(),
});

const isAllowedImage = (mimetype) =>
  ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimetype);

/* ------------------------------ MULTER UPLOADS ------------------------------ */

const categoryUpload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: categoryBucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
      cb(null, `category-${unique}-${file.originalname.replace(/\s+/g, "-")}`);
    },
  }),
  fileFilter: (req, file, cb) =>
    isAllowedImage(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only valid image formats allowed")),
});

const propertyUpload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: propertyBucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
      cb(null, `property-${unique}-${file.originalname.replace(/\s+/g, "-")}`);
    },
  }),
  limits: { files: 10 },
  fileFilter: (req, file, cb) =>
    isAllowedImage(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Invalid image type")),
});

const galleryUpload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: galleryBucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
      const prefix = file.fieldname === "thumbnail" ? "thumbnail" : "gallery";
      cb(null, `${prefix}-${unique}-${file.originalname.replace(/\s+/g, "-")}`);
    },
  }),
  fileFilter: (req, file, cb) =>
    isAllowedImage(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Invalid image type")),
});

/* ------------------------------ AUTH ROUTE ------------------------------ */

// PUBLIC — Admin Login
Adminrouter.post("/login", adminLogin);

/* ------------------------------ PROTECTED ROUTES ------------------------------ */
Adminrouter.use(authenticate, authorizeAdmin);

/* ---------------------- CATEGORY ---------------------- */
Adminrouter.get("/categories", getAllCategories);
Adminrouter.post("/add-category", categoryUpload.single("image"), createCategory);
Adminrouter.put("/edit-category/:id", categoryUpload.single("image"), updateCategory);
Adminrouter.delete("/delete-category/:id", deleteCategory);
Adminrouter.put("/categories/:id/status", toggleCategoryStatus);

/* ---------------------- SUB CATEGORY ---------------------- */
Adminrouter.get("/subcategories", getAllSubCategories);
Adminrouter.get("/subcategories/:id", getSubCategoryById);
Adminrouter.get("/subcategories/category/:categoryId", getSubCategoriesByCategory);
Adminrouter.post("/add-subcategory", categoryUpload.single("image"), createSubCategory);
Adminrouter.put("/edit-subcategory/:id", categoryUpload.single("image"), updateSubCategory);
Adminrouter.delete("/delete-subcategory/:id", deleteSubCategory);
Adminrouter.put("/subcategories/:id/status", toggleSubCategoryStatus);

/* ---------------------- PRODUCTS ---------------------- */
Adminrouter.get("/products", getAllProducts);
Adminrouter.post("/add-product", propertyUpload.array("images", 10), createProduct);
Adminrouter.get("/products/:id", getProductById);
Adminrouter.put("/edit-product/:id", propertyUpload.array("images", 10), updateProduct);
Adminrouter.delete("/products/:id", deleteProduct);
Adminrouter.put("/products/:id/toggle-status", toggleProductStatus);
Adminrouter.get("/categories-list", getCategories);
Adminrouter.get("/subcategory/:categoryId", getSubCategories);

/* ---------------------- USERS ---------------------- */
Adminrouter.get("/users", getAllUsers);
Adminrouter.get("/users/:id", getUserById);
Adminrouter.delete("/users/:id", deleteUser);
Adminrouter.put("/users/:id/toggle-block", toggleUserBlockStatus);
Adminrouter.put("/users/:id", updateUser);

/* ---------------------- ORDERS ---------------------- */
Adminrouter.get("/orders", getAllOrders);
Adminrouter.get("/orders/stats", getOrderStats);
Adminrouter.get("/orders/search", searchOrders);
Adminrouter.get("/orders/user/:userId", getOrdersByUser);
Adminrouter.get("/orders/:id", getOrderById);
Adminrouter.put("/orders/:id/status", updateOrderStatus);
Adminrouter.put("/orders/:id/payment-status", updatePaymentStatus);
Adminrouter.delete("/orders/:id", deleteOrder);

/* ---------------------- GALLERY ---------------------- */
Adminrouter.get("/gallery", getAllGallery);
Adminrouter.post(
  "/add-gallery",
  galleryUpload.fields([
    { name: "images", maxCount: 3 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  addGalleryItem
);
Adminrouter.put(
  "/edit-gallery/:id",
  galleryUpload.fields([
    { name: "images", maxCount: 3 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  updateGalleryItem
);
Adminrouter.delete("/delete-gallery/:id", deleteGalleryItem);
Adminrouter.put("/gallery/:id/status", updateGalleryStatus);

/* ---------------------- SALES REPORTS ---------------------- */
Adminrouter.get("/sales-report", getSalesReport);
Adminrouter.get("/sales-report/download-pdf", downloadSalesReportPDF);
Adminrouter.get("/sales-report/download-excel", downloadSalesReportExcel);
Adminrouter.put('/admin/change-password',changePassword);

export default Adminrouter;
