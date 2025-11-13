import bcrypt from "bcrypt";
import UserModel from "../Model/UserModel.js";
import OtpModel from "../Model/OtpModel.js";
import PasswordResetModel from "../Model/PassReset.js";
import sendEmail from "../Utils/SendMail.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";

export const Userlogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(403).json({ message: "Email and password are required" });
    }

    // Ensure password field is fetched
    const user = await UserModel.findOne({ email }).select("+password");
    if (!user) {
      return res.status(409).json({ message: "This user doesn't exist" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email first" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked. Please contact support." });
    }

    // Compare passwords safely
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
    };

    return res.status(200).json({
      message: "Successfully logged in",
      user: userResponse,
      token,
      success: true,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const UserRegister = async (req, res) => {
  try {

    const { username, email, phone, password } = req.body;

    
    if (!username || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(409).json({ message: "This user already exists" });
      } else {
        await UserModel.deleteOne({ email });
        await OtpModel.deleteOne({ email });
      }
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new UserModel({ 
      name: username, 
      email, 
      mobile: phone, 
      password: hashedPassword,
      isVerified: false,
      isBlocked: false
    });
    await newUser.save();
    
    const otp = crypto.randomInt(100000, 999999);
    console.log("=".repeat(50));
    console.log("OTP Generated:", otp);
    console.log("Email:", email);
    console.log("=".repeat(50));
    
    await OtpModel.create({ 
      email, 
      otp, 
      expiresAt: Date.now() + 10 * 60 * 1000 
    });
    
    const emailSubject = "Email Verification OTP";
    const emailMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #144E8C; font-size: 20px; margin-bottom: 20px;">Welcome to ForScape!</h2>
        <p style="font-size: 14px; color: #333;">Hello ${username},</p>
        <p style="font-size: 14px; color: #333;">Thank you for registering. Your verification code is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f7f7f7; border: 2px solid #144E8C; padding: 20px; border-radius: 10px; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; color: #144E8C; letter-spacing: 5px;">${otp}</span>
          </div>
        </div>
        <p style="font-size: 14px; color: #333;">This code will expire in 10 minutes.</p>
        <p style="font-size: 14px; color: #333;">If you didn't request this verification, please ignore this email.</p>
        <p style="font-size: 14px; color: #333;">Best regards,<br>Foscape Team</p>
      </div>
    `;
    
    try {
      await sendEmail(email, emailSubject, emailMessage);
      console.log("Email sent successfully to:", email);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      await UserModel.deleteOne({ email });
      await OtpModel.deleteOne({ email });
      return res.status(500).json({ 
        message: "Failed to send verification email. Please try again.", 
        error: emailError.message 
      });
    }
    
    res.status(201).json({ 
      message: "OTP sent to your email", 
      email,
      success: true 
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const VerifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const otpRecord = await OtpModel.findOne({ email, otp: parseInt(otp) });
    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (otpRecord.expiresAt < Date.now()) {
      await OtpModel.deleteOne({ email });
      return res.status(400).json({ message: "OTP expired" });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isVerified = true;
    await user.save();
    await OtpModel.deleteOne({ email });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
    };

    return res.status(200).json({
      message: "OTP verified, registration successful",
      user: userResponse,
      token,
      success: true,
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



export const ResendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.isVerified) {
      return res.status(400).json({ message: "User already verified" });
    }
    
    const otp = crypto.randomInt(100000, 999999);
    console.log("=".repeat(50));
    console.log("Resend OTP Generated:", otp);
    console.log("Email:", email);
    console.log("=".repeat(50));
    
    await OtpModel.findOneAndUpdate(
      { email }, 
      { otp, expiresAt: Date.now() + 10 * 60 * 1000 }, 
      { upsert: true }
    );
    
    const emailSubject = "Email Verification OTP - Resend";
    const emailMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #144E8C; font-size: 20px; margin-bottom: 20px;">Verification Code Resent</h2>
        <p style="font-size: 14px; color: #333;">Hello ${user.name},</p>
        <p style="font-size: 14px; color: #333;">Your new verification code is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f7f7f7; border: 2px solid #144E8C; padding: 20px; border-radius: 10px; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; color: #144E8C; letter-spacing: 5px;">${otp}</span>
          </div>
        </div>
        <p style="font-size: 14px; color: #333;">This code will expire in 10 minutes.</p>
        <p style="font-size: 14px; color: #333;">Best regards,<br>Foscape Team</p>
      </div>
    `;
    
    try {
      await sendEmail(email, emailSubject, emailMessage);
      console.log("Resend email sent successfully to:", email);
    } catch (emailError) {
      console.error("Resend email failed:", emailError);
      return res.status(500).json({ 
        message: "Failed to send verification email", 
        error: emailError.message 
      });
    }
    
    res.status(200).json({ message: "New OTP sent", success: true });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const ForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    await PasswordResetModel.create({
      email,
      resetToken: resetTokenHash,
      expiresAt: Date.now() + 30 * 60 * 1000
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${email}`;

    const emailSubject = "Password Reset Link";
    const emailMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #144E8C; font-size: 20px; margin-bottom: 20px;">Password Reset Request</h2>
        <p style="font-size: 14px; color: #333;">Hello ${user.name},</p>
        <p style="font-size: 14px; color: #333;">You requested to reset your password. Click the link below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #144E8C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Reset Password</a>
        </div>
        <p style="font-size: 14px; color: #333;">This link will expire in 30 minutes.</p>
        <p style="font-size: 14px; color: #333;">If you didn't request this, ignore this email.</p>
        <p style="font-size: 14px; color: #333;">Best regards,<br>Foscape Team</p>
      </div>
    `;

    try {
      await sendEmail(email, emailSubject, emailMessage);
      res.status(200).json({ message: "Reset link sent to email", success: true });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      return res.status(500).json({ message: "Failed to send reset email", error: emailError.message });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const ResetPassword = async (req, res) => {
  try {
    const { token, email, newPassword, confirmPassword } = req.body;

    if (!token || !email || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const resetRecord = await PasswordResetModel.findOne({
      email,
      resetToken: resetTokenHash,
      expiresAt: { $gt: Date.now() }
    });

    if (!resetRecord) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await PasswordResetModel.deleteOne({ email });

    res.status(200).json({ message: "Password reset successfully", success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const Logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict"
    });

    return res.status(200).json({ message: "Logged out successfully", success: true });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "No token found" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id).select("-password");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked" });
    }

    res.status(200).json({ user, success: true });
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const GoogleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Credential is required" });
    }

    const decoded = jwt.decode(credential);
    const { email, name, picture } = decoded;

    let user = await UserModel.findOne({ email });

    if (!user) {
      user = new UserModel({
        name,
        email,
        password: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
        isVerified: true,
        isBlocked: false
      });
      await user.save();
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
    };

    return res.status(200).json({
      message: "Google authentication successful",
      user: userResponse,
      token,
      success: true,
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};