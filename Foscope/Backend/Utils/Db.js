import mongoose from 'mongoose'
import { warmCache } from './Redis.js';

const databaseConnection = async()=>{
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("database is connected")
    await warmCache();

  } catch (error) {
    console.error("databse connection error",error)
    throw error
  }
}

export default databaseConnection