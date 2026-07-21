const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  menuItem:     { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
  name:         { type: String },
  price:        { type: Number },
  quantity:     { type: Number, required: true, min: 1 },
  isVegetarian: { type: Boolean, default: true },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },

    // Reference to Payment document (created after payment step)
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    items:     { type: [orderItemSchema], validate: [(a) => a.length > 0, "At least one item required"] },
    itemCount: { type: Number, default: 0 },

    subtotal:       { type: Number, default: 0 },
    gstPercent:     { type: Number, default: 5 },
    gstAmount:      { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    totalAmount:    { type: Number, required: true, min: 0 },

    orderType: {
      type: String,
      enum: ["pickup", "delivery"],
      default: "pickup",
    },
    deliveryAddress: {
      street: String,
      city:   String,
      state:  String,
      zipCode:String,
    },

    paymentMethod: {
      type: String,
      enum: ["cash_on_delivery", "card", "qr"],
      default: "cash_on_delivery",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "pending_verification", "failed"],
      default: "pending",
    },

    orderStatus: {
      type: String,
      enum: ["placed","confirmed","preparing","ready","out_for_delivery","delivered","cancelled"],
      default: "placed",
    },

    statusHistory: [
      { status: String, updatedAt: { type: Date, default: Date.now }, note: String }
    ],

    acceptedAt:       { type: Date, default: null },
    estimatedReadyAt: { type: Date, default: null },
  },
  { timestamps: true }
);

orderSchema.pre("save", function (next) {
  if (!this.orderNumber) {
    const ts   = Date.now().toString(36).toUpperCase().slice(-5);
    const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
    this.orderNumber = `ORD-${ts}${rand}`;
  }
  if (!this.itemCount && Array.isArray(this.items)) {
    this.itemCount = this.items.reduce((s, i) => s + (i.quantity || 1), 0);
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);