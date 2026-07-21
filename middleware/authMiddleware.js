

// module.exports = { protect, authorizeRoles };
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return res.status(401).json({ success: false, message: "Not authorized, no token" });
  }

  try {
    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    return next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ success: false, message: "Not authorized, token failed" });
  }
};

// Restrict access to specific roles
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user ? req.user.role : "unknown"}' is not authorized to access this resource`,
      });
    }
    next();
  };
};

module.exports = { protect, authorizeRoles };
