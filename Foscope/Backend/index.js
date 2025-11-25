
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Adminrouter from './Routes/AdminRoute.js';
import Userrouter from './Routes/UserRoute.js';
import databaseConnection from './Utils/Db.js';
import cookieParser from 'cookie-parser';
import nodeCron from 'node-cron';
import { getCache, initRedis, setCache } from './Utils/Redis.js';

initRedis();

// Test Redis connection after server starts
setTimeout(async () => {
    try {
      await setCache('test', { message: 'Hello Redis!' }, 60);
      const result = await getCache('test');
      console.log('✅ Redis test:', result);
    } catch (error) {
      console.error('❌ Redis test failed:', error);
    }
  }, 3000);

dotenv.config();
databaseConnection();

const app = express();
const PORT = 3001;

const allowedOrigins = [
    'https://www.thefoscape.com',
    'http://localhost:5173'
];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.removeHeader("Cross-Origin-Opener-Policy");
  res.removeHeader("Cross-Origin-Embedder-Policy");
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  next();
});

app.use('/api/admin', Adminrouter);
app.use('/api/user', Userrouter);

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
