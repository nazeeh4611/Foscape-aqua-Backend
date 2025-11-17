import bcrypt from "bcrypt";
import UserModel from "../Model/UserModel.js";
import OtpModel from "../Model/OtpModel.js";
import PasswordResetModel from "../Model/PassReset.js";
import sendEmail from "../Utils/SendMail.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";


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
    <div style="
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      background: #F0FAF8;
      padding: 30px;
      border-radius: 16px;
      border: 1px solid #e0f2ef;
    ">
  
      <!-- Header -->
      <div style="
        background: linear-gradient(to right, #144E8C, #78CDD1);
        padding: 25px;
        border-radius: 12px;
        text-align: center;
        color: white;
      ">
        <h2 style="margin: 0; font-size: 24px; font-weight: 700;">
          Welcome to Foscape!
        </h2>
        <p style="color: #e8f7f5; font-size: 14px; margin-top: 8px;">
          Your gateway to world-class aquatic care
        </p>
      </div>
  
      <!-- Body -->
      <div style="padding: 25px; color: #333;">
        <p style="font-size: 15px;">Hello <strong>${username}</strong>,</p>
  
        <p style="font-size: 15px;">
          Thank you for registering with Foscape. Please use the verification code 
          below to complete your signup:
        </p>
  
        <!-- OTP Box -->
        <div style="text-align: center; margin: 25px 0;">
          <div style="
            background: #ffffff;
            border: 2px solid #144E8C;
            border-radius: 14px;
            padding: 22px 30px;
            display: inline-block;
            box-shadow: 0 6px 14px rgba(20, 78, 140, 0.15);
          ">
            <span style="
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #144E8C;
            ">
              ${otp}
            </span>
          </div>
        </div>
  
        <p style="font-size: 14px; color: #555;">
          This code will expire in <strong>10 minutes</strong>.
        </p>
  
        <p style="font-size: 14px; color: #555; margin-top: 14px;">
          If you didn’t request this verification, you can safely ignore this email.
        </p>
  
        <!-- Footer -->
        <p style="font-size: 14px; margin-top: 25px; color: #144E8C; font-weight: 600;">
          Best regards,<br/>
          <span style="color: #333; font-weight: 500;">The Foscape Team</span>
        </p>
      </div>
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
    <div style="
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      background: #F0FAF8;
      padding: 30px;
      border-radius: 16px;
      border: 1px solid #e0f2ef;
    ">
  
      <!-- Header -->
      <div style="
        background: linear-gradient(to right, #144E8C, #78CDD1);
        padding: 25px;
        border-radius: 12px;
        text-align: center;
        color: white;
      ">
        <h2 style="margin: 0; font-size: 22px; font-weight: 700;">
          Verification Code Resent
        </h2>
        <p style="color: #e8f7f5; margin-top: 6px; font-size: 14px;">
          Your updated verification code is below
        </p>
      </div>
  
      <!-- Body -->
      <div style="padding: 25px; color: #333;">
        <p style="font-size: 15px;">Hello <strong>${user.name}</strong>,</p>
  
        <p style="font-size: 15px;">
          Your new verification code has been generated. Please use the code below to continue:
        </p>
  
        <!-- OTP Box -->
        <div style="text-align: center; margin: 25px 0;">
          <div style="
            background: #ffffff;
            border: 2px solid #144E8C;
            padding: 22px 30px;
            border-radius: 14px;
            display: inline-block;
            box-shadow: 0 6px 14px rgba(20, 78, 140, 0.15);
          ">
            <span style="
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #144E8C;
            ">
              ${otp}
            </span>
          </div>
        </div>
  
        <p style="font-size: 14px; color: #555;">
          This code will expire in <strong>10 minutes</strong>.
        </p>
  
        <p style="font-size: 14px; margin-top: 25px; color: #144E8C; font-weight: 600;">
          Best regards,<br/>
          <span style="color: #333; font-weight: 500;">Foscape Team</span>
        </p>
      </div>
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
    <div style="
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      background: #F0FAF8;
      padding: 30px;
      border-radius: 16px;
      border: 1px solid #e0f2ef;
    ">
  
      <!-- Header -->
      <div style="
        background: linear-gradient(to right, #144E8C, #78CDD1);
        padding: 25px;
        border-radius: 12px;
        text-align: center;
        color: white;
      ">
        <h2 style="margin: 0; font-size: 22px; font-weight: 700;">
          Password Reset Request
        </h2>
        <p style="color: #e8f7f5; margin-top: 6px; font-size: 14px;">
          Securely reset your password below
        </p>
      </div>
  
      <!-- Body -->
      <div style="padding: 25px; color: #333;">
        <p style="font-size: 15px;">Hello <strong>${user.name}</strong>,</p>
  
        <p style="font-size: 15px;">
          We received a request to reset your password. Please click the button below to continue:
        </p>
  
        <!-- Reset Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}"
            style="
              background: linear-gradient(to right, #144E8C, #78CDD1);
              color: white;
              padding: 14px 32px;
              font-size: 15px;
              font-weight: bold;
              border-radius: 10px;
              text-decoration: none;
              display: inline-block;
              box-shadow: 0 6px 14px rgba(20, 78, 140, 0.15);
            "
          >
            Reset Password
          </a>
        </div>
  
        <p style="font-size: 14px; color: #555;">
          This link will expire in <strong>30 minutes</strong>.
        </p>
  
        <p style="font-size: 14px; color: #555;">
          If you didn’t request this reset, please ignore this message.
        </p>
  
        <p style="font-size: 14px; margin-top: 25px; color: #144E8C; font-weight: 600;">
          Best regards,<br/>
          <span style="color: #333; font-weight: 500;">Foscape Team</span>
        </p>
      </div>
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


const client = new OAuth2Client("418114033455-nu2odpsacsi4vb0sjrgsoebqcpfb9ai9.apps.googleusercontent.com");


export const GoogleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    console.log("=== GOOGLE AUTH DEBUG ===");
    console.log("Backend Client ID:", process.env.GOOGLE_CLIENT_ID);
    console.log("Credential length:", credential?.length);
    console.log("Credential first 50 chars:", credential?.substring(0, 50));

    if (!credential) {
      return res.status(400).json({ message: "Credential is required" });
    }

    // Create a new OAuth2Client instance for each request

    // Verify Google ID Token with more options
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
      // Add these for better validation
      clockTolerance: 10, // 10 seconds tolerance
    });

    const payload = ticket.getPayload();
    
    console.log("=== TOKEN PAYLOAD ===");
    console.log("Audience:", payload.aud);
    console.log("Issuer:", payload.iss);
    console.log("Email:", payload.email);
    console.log("Email verified:", payload.email_verified);
    console.log("Issued at:", new Date(payload.iat * 1000));
    console.log("Expires at:", new Date(payload.exp * 1000));

    // Validate issuer more specifically
    const validIssuers = [
      'accounts.google.com', 
      'https://accounts.google.com'
    ];
    
    if (!validIssuers.includes(payload.iss)) {
      throw new Error(`Invalid issuer: ${payload.iss}`);
    }

    // Check if audience matches
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw new Error(`Audience mismatch. Expected: ${process.env.GOOGLE_CLIENT_ID}, Got: ${payload.aud}`);
    }

    const { email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ message: "Invalid Google token - no email" });
    }

    // Continue with your existing user logic...
    let user = await UserModel.findOne({ email });

    if (!user) {
      user = new UserModel({
        name,
        email,
        picture,
        password: await bcrypt.hash(
          crypto.randomBytes(16).toString("hex"),
          10
        ),
        isVerified: true,
        isBlocked: false,
      });
      await user.save();
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      picture: user.picture,
    };

    console.log("=== SUCCESS ===");
    return res.status(200).json({
      success: true,
      message: "Google authentication successful",
      user: userResponse,
      token,
    });

  } catch (error) {
    console.error("=== GOOGLE AUTH ERROR ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    return res.status(400).json({
      success: false,
      message: "Google authentication failed",
      error: error.message,
      clientIdUsed: process.env.GOOGLE_CLIENT_ID
    });
  }
};
