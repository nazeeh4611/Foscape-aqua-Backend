import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../Model/AdminModel.js";

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
 console.log(email,password,"l;l;")
    if (!email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const admin = await Admin.findOne({ email });
    if (!admin)
      return res.status(404).json({ message: "Admin not found" });

    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword)
      return res.status(401).json({ message: "Incorrect password" });

    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        role: admin.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};


// const createAdmin = async () => {
//   const hashed = await bcrypt.hash("foscape@2025", 10);

//   await Admin.create({
//     name: "Foscape",
//     email: "info@foscape.com",
//     password: hashed,
//   });

//   console.log("Admin created");
// };

// createAdmin();



export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.admin.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const validPassword = await bcrypt.compare(currentPassword, admin.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    await admin.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};