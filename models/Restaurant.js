const mongoose = require("mongoose");

const FOOD_CATEGORIES = [
  "North Indian", "South Indian", "Chinese", "Fast Food",
  "Pizza", "Burger", "Bakery", "Beverages", "Desserts",
  "Veg", "Non-Veg", "Others",
];

const restaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Restaurant name is required"],
      trim: true,
    },
    description: { type: String, trim: true },

    cuisine: { type: [String], default: [] },
    categories: {
      type: [{ type: String, enum: FOOD_CATEGORIES }],
      default: [],
    },

    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
    },
    addressText: String,

    phone: String,
    email: String,

    image: String,
    logo:  String,

    rating:      { type: Number, default: 0, min: 0, max: 5 },
    isOpen:      { type: Boolean, default: true },
    openingTime: { type: String, default: "09:00" },
    closingTime:  { type: String, default: "22:00" },

    deliveryTime:   { type: String, default: "30-45 mins" },
    gstPercent:     { type: Number, default: 5 },
    deliveryCharge: { type: Number, default: 30 },
    freeDeliveryAbove: { type: Number, default: 0 },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ── Payment / Bank Details (Feature 4, 5, 10) ──────────────────────────
    // Stored per-restaurant so customers see THIS restaurant's payment info.
    bankDetails: {
      bankName:          { type: String, default: "" },
      accountHolderName: { type: String, default: "" },
      accountNumber:     { type: String, default: "" },
      ifscCode:          { type: String, default: "" },
      upiId:             { type: String, default: "" },
      // URL/path of the uploaded QR code image
      qrCodeImage:       { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Restaurant", restaurantSchema);