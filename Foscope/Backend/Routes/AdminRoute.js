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
import { createSubCategory, deleteSubCategory, getAllSubCategories, getSubCategoriesByCategory, getSubCategoryById, toggleSubCategoryStatus, updateSubCategory } from "../Controller/SubCategoryController.js";
import { createProduct, deleteProduct, getAllProducts, getCategories, getProductById, getSubCategories, toggleProductStatus, updateProduct } from "../Controller/ProductController.js";

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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

// Category Routes
Adminrouter.get("/categories", getAllCategories);
Adminrouter.post("/add-category",categoryUpload.single("image"),createCategory);
Adminrouter.put("/edit-category/:id",categoryUpload.single("image"),updateCategory);
Adminrouter.delete("/delete-category/:id", deleteCategory);
Adminrouter.patch("/categories/:id/status", toggleCategoryStatus);

// Sub Category Routes

Adminrouter.get('/subcategories', getAllSubCategories);
Adminrouter.get('/subcategories/:id', getSubCategoryById);
Adminrouter.get('/subcategories/category/:categoryId', getSubCategoriesByCategory);
Adminrouter.post('/add-subcategory',categoryUpload.single('image'), createSubCategory);
Adminrouter.put('/edit-subcategory/:id', categoryUpload.single('image'), updateSubCategory);
Adminrouter.delete('/delete-subcategory/:id', deleteSubCategory);
Adminrouter.patch('/subcategories/:id/status', toggleSubCategoryStatus);



// PRODUCT ROUTES
Adminrouter.get("/products", getAllProducts);
Adminrouter.post("/add-product", propertyUpload.array("images", 10), createProduct);
Adminrouter.get("/products/:id", getProductById);
Adminrouter.put("/edit-product/:id", propertyUpload.array("images", 10), updateProduct);
Adminrouter.delete("/products/:id", deleteProduct);
Adminrouter.patch("/products/:id/toggle-status", toggleProductStatus);

Adminrouter.get("/categories", getCategories);
Adminrouter.get('/subcategory/:categoryId', getSubCategories);


// Adminrouter.use((error, req, res, next) => {
//   if (error.name === "CredentialsProviderError") {
//     return res.status(500).json({
//       success: false,
//       message:
//         "AWS credentials not configured. Check AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (and AWS_SESSION_TOKEN if using temp creds).",
//     });
//   }

//   if (error.code === "SignatureDoesNotMatch") {
//     return res.status(400).json({
//       success: false,
//       message:
//         "S3 signature mismatch. Ensure bucket region matches AWS_REGION and credentials are correct.",
//     });
//   }

//   if (error instanceof multer.MulterError) {
//     if (error.code === "LIMIT_FILE_SIZE") {
//       return res
//         .status(400)
//         .json({ success: false, message: "File too large (max 5MB)." });
//     }
//     if (error.code === "LIMIT_FILE_COUNT") {
//       return res
//         .status(400)
//         .json({ success: false, message: "Too many files uploaded." });
//     }
//     if (error.code === "LIMIT_UNEXPECTED_FILE") {
//       return res
//         .status(400)
//         .json({ success: false, message: "Unexpected file field." });
//     }
//   }

//   return res.status(400).json({
//     success: false,
//     message: error.message || "Upload error.",
//   });
// });

export default Adminrouter;
