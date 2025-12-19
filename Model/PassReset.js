import mongoose from "mongoose";

const PasswordResetSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true
    },
    resetToken: {
      type: String,
      required: [true, "Reset token is required"]
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration time is required"],
      index: { expires: 0 }
    }
  },
  { timestamps: true }
);

PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("PasswordReset", PasswordResetSchema);