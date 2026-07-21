const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
    },
    description: { type: String, trim: true },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: 0,
    },
    // Open string so owners can type any category ("North Indian", "Chinese", etc.)
    category: {
      type: String,
      default: "Other",
      trim: true,
    },
    // Food image URL (uploaded or external)
    image: { type: String, default: "" },
    isVegetarian: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true },
    // Sort order on menu
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MenuItem", menuItemSchema);