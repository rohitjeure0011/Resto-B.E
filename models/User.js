const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, "Name is required"],
      trim:     true,
    },
    email: {
      type:      String,
      required:  [true, "Email is required"],
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    password: {
      type:      String,
      required:  [true, "Password is required"],
      minlength: 6,
      select:    false,
    },
    phone: { type: String, trim: true },
    address: {
      street:  String,
      city:    String,
      state:   String,
      zipCode: String,
    },

    // IMPORTANT: must be "restaurantOwner" (camelCase, no underscore).
    // Frontend Register.jsx sends role: "restaurantOwner"
    // If this enum says "restaurant_owner" it will reject and cause 500.
    role: {
      type:    String,
      enum:    ["customer", "admin", "restaurantOwner"],
      default: "customer",
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt   = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with stored hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);