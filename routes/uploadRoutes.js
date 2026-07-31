const express = require("express");
const router  = express.Router();
const upload  = require("../middleware/uploadMiddleware");
const { protect } = require("../middleware/authMiddleware");

// POST /api/upload  → returns { url: "/uploads/filename.jpg" }
router.post("/", protect, upload.single("image"), (req, res) => {
  if (!req.file)
    return res.status(400).json({ success: false, message: "No image uploaded or invalid file type" });

  // Build the public URL (served by express static in server.js)
  const url = `/uploads/${req.file.filename}`;
  res.status(200).json({ success: true, url, filename: req.file.filename });
});

module.exports = router;