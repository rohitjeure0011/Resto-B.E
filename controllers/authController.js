const jwt  = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// ── Register ──────────────────────────────────────────────────────────────────
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, phone, address, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "An account already exists with this email",
      });
    }

    // Only allow these two roles to self-register.
    // "admin" can never be set via the public register endpoint.
    const allowedRoles  = ["customer", "restaurantOwner"];
    const resolvedRole  = allowedRoles.includes(role) ? role : "customer";

    const user = await User.create({
      name,
      email,
      password,
      phone:   phone   || "",
      address: address || {},
      role:    resolvedRole,
    });

    res.status(201).json({
      success: true,
      data: {
        _id:   user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id:   user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Get profile ───────────────────────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// ── Update profile ────────────────────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    user.name  = req.body.name  || user.name;
    user.phone = req.body.phone || user.phone;
    if (req.body.address) user.address = req.body.address;
    if (req.body.password) user.password = req.body.password;

    const updated = await user.save();

    res.status(200).json({
      success: true,
      data: {
        _id:   updated._id,
        name:  updated.name,
        email: updated.email,
        role:  updated.role,
        token: generateToken(updated._id),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerUser, loginUser, getProfile, updateProfile };