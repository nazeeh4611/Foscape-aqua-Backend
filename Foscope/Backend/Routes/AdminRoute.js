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
  updateSubCategory 
} from "../Controller/SubCategoryController.js";
import { 
  createProduct, 
  deleteProduct, 
  getAllProducts, 
  getCategories, 
  getProductById, 
  getSubCategories, 
  toggleProductStatus, 
  updateProduct 
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
  updateUser 
} from "../Controller/AdminController.js";
import { downloadSalesReportExcel, downloadSalesReportPDF, getSalesReport } from "../Controller/SalesCaontroller.js";


dotenv.config();

const Adminrouter = express.Router();

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
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
  ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"].includes(
    mimetype
  );

const categoryUpload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: categoryBucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const safeName = file.originalname.replace(/\s+/g, "-");
      cb(null, `category-${unique}-${safeName}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    isAllowedImage(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only JPEG/PNG/GIF/WebP images are allowed")),
});

const propertyUpload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: propertyBucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const safeName = file.originalname.replace(/\s+/g, "-");
      cb(null, `property-${unique}-${safeName}`);
    },
  }),
  limits: {
    files: 10,
    fileSize: 20 * 1024 * 1024,
    fieldSize: 25 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) =>
    isAllowedImage(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only JPEG/PNG/GIF/WebP images are allowed")),
});

// Updated gallery upload configuration with support for both images and thumbnail
const galleryUpload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: galleryBucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const safeName = file.originalname.replace(/\s+/g, "-");
      const prefix = file.fieldname === 'thumbnail' ? 'thumbnail' : 'gallery';
      cb(null, `${prefix}-${unique}-${safeName}`);
    },
  }),
  limits: {
    files: 4, // 3 images + 1 thumbnail
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) =>
    isAllowedImage(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only JPEG/PNG/GIF/WebP images are allowed")),
});

Adminrouter.get("/categories", getAllCategories);
Adminrouter.post("/add-category", categoryUpload.single("image"), createCategory);
Adminrouter.put("/edit-category/:id", categoryUpload.single("image"), updateCategory);
Adminrouter.delete("/delete-category/:id", deleteCategory);
Adminrouter.put("/categories/:id/status", toggleCategoryStatus);

Adminrouter.get('/subcategories', getAllSubCategories);
Adminrouter.get('/subcategories/:id', getSubCategoryById);
Adminrouter.get('/subcategories/category/:categoryId', getSubCategoriesByCategory);
Adminrouter.post('/add-subcategory', categoryUpload.single('image'), createSubCategory);
Adminrouter.put('/edit-subcategory/:id', categoryUpload.single('image'), updateSubCategory);
Adminrouter.delete('/delete-subcategory/:id', deleteSubCategory);
Adminrouter.put('/subcategories/:id/status', toggleSubCategoryStatus);

Adminrouter.get("/products", getAllProducts);
Adminrouter.post("/add-product", propertyUpload.array("images", 10), createProduct);
Adminrouter.get("/products/:id", getProductById);
Adminrouter.put("/edit-product/:id", propertyUpload.array("images", 10), updateProduct);
Adminrouter.delete("/products/:id", deleteProduct);
Adminrouter.put("/products/:id/toggle-status", toggleProductStatus);
Adminrouter.get("/categories", getCategories);
Adminrouter.get('/subcategory/:categoryId', getSubCategories);

Adminrouter.get("/users", getAllUsers);
Adminrouter.get("/users/:id", getUserById);
Adminrouter.delete("/users/:id", deleteUser);
Adminrouter.put("/users/:id/toggle-block", toggleUserBlockStatus);
Adminrouter.put("/users/:id", updateUser);

Adminrouter.get("/orders", getAllOrders);
Adminrouter.get("/orders/stats", getOrderStats);
Adminrouter.get("/orders/search", searchOrders);
Adminrouter.get("/orders/user/:userId", getOrdersByUser);
Adminrouter.get("/orders/:id", getOrderById);
Adminrouter.put("/orders/:id/status", updateOrderStatus);
Adminrouter.put("/orders/:id/payment-status", updatePaymentStatus);
Adminrouter.delete("/orders/:id", deleteOrder);

// Updated gallery routes with fields for both images and thumbnail
Adminrouter.get('/gallery', getAllGallery);
Adminrouter.post('/add-gallery', galleryUpload.fields([
  { name: 'images', maxCount: 3 },
  { name: 'thumbnail', maxCount: 1 }
]), addGalleryItem);
Adminrouter.put('/edit-gallery/:id', galleryUpload.fields([
  { name: 'images', maxCount: 3 },
  { name: 'thumbnail', maxCount: 1 }
]), updateGalleryItem);
Adminrouter.delete('/delete-gallery/:id', deleteGalleryItem);
Adminrouter.put('/gallery/:id/status', updateGalleryStatus);



Adminrouter.get('/sales-report', getSalesReport);
Adminrouter.get('/sales-report/download-pdf', downloadSalesReportPDF);
Adminrouter.get('/sales-report/download-excel', downloadSalesReportExcel);

export default Adminrouter;