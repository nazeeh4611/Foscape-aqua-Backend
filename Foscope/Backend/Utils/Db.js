import mongoose from 'mongoose'

const databaseConnection = async()=>{
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("database is connected")
  } catch (error) {
    console.error("databse connection error",error)
    throw error
  }
}

export default databaseConnection