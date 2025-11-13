import mongoose from "mongoose";

const OtpSchema = new mongoose.Schema(
    {
      email: {
        type: String,
        required: [true, "Email is required"],
        lowercase: true
      },
      otp: {
        type: Number,
        required: [true, "OTP is required"],
        minlength: 6,
        maxlength: 6
      },
      expiresAt: {
        type: Date,
        required: [true, "Expiration time is required"],
        index: { expires: 0 }
      }
    },
    { timestamps: true }
  );
  
  OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  
  export default mongoose.model("Otp", OtpSchema);