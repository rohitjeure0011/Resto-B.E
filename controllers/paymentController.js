const Payment    = require("../models/Payment");
const Order      = require("../models/Order");
const Restaurant = require("../models/Restaurant");

// ── Validate card details ─────────────────────────────────────────────────────
const validateCard = ({ cardNumber, expiryDate, cvv, cardHolderName }) => {
  const errors = {};

  if (!cardHolderName?.trim()) errors.cardHolderName = "Card holder name is required";

  const rawNumber = (cardNumber || "").replace(/\s/g, "");
  if (!rawNumber) errors.cardNumber = "Card number is required";
  else if (!/^\d{16}$/.test(rawNumber)) errors.cardNumber = "Card number must be 16 digits";

  if (!expiryDate) {
    errors.expiryDate = "Expiry date is required";
  } else {
    const match = expiryDate.match(/^(\d{2})\/(\d{2})$/);
    if (!match) {
      errors.expiryDate = "Expiry date must be MM/YY format";
    } else {
      const [, mm, yy] = match;
      const month = parseInt(mm, 10);
      const year  = 2000 + parseInt(yy, 10);
      const now   = new Date();
      if (month < 1 || month > 12) errors.expiryDate = "Invalid month";
      else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
        errors.expiryDate = "Card has expired";
      }
    }
  }

  if (!cvv) errors.cvv = "CVV is required";
  else if (!/^\d{3}$/.test(cvv)) errors.cvv = "CVV must be 3 digits";

  return errors;
};

// ── POST /api/payments/card ───────────────────────────────────────────────────
// Process card / net banking payment
const processCardPayment = async (req, res, next) => {
  try {
    const { orderId, cardHolderName, cardNumber, expiryDate, cvv } = req.body;

    // Validate card details
    const errors = validateCard({ cardNumber, expiryDate, cvv, cardHolderName });
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors, message: "Invalid card details" });
    }

    const order = await Order.findById(orderId).populate("restaurant", "name");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // Only store last 4 digits — never persist full card number
    const rawNumber = cardNumber.replace(/\s/g, "");
    const last4     = rawNumber.slice(-4);

    // Create Payment record
    const payment = await Payment.create({
      order:         order._id,
      restaurant:    order.restaurant._id,
      customer:      req.user._id,
      paymentMethod: "card",
      paymentStatus: "paid",           // Demo: instantly mark as paid
      amount:        order.totalAmount,
      cardDetails: { cardHolderName, last4Digits: last4, expiryDate },
      paymentDate:   new Date(),
    });

    // Update order
    order.paymentStatus = "paid";
    order.paymentMethod = "card";
    order.payment       = payment._id;
    order.statusHistory.push({ status: order.orderStatus, note: "Payment completed via card" });
    await order.save();

    // Emit socket event if available
    if (req.io) {
      req.io.to(`restaurant-${order.restaurant._id}`).emit("order-payment-updated", {
        orderId: order._id, paymentStatus: "paid", paymentMethod: "card",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment successful",
      data: {
        transactionId:  payment.transactionId,
        paymentStatus:  "paid",
        paymentMethod:  "card",
        last4Digits:    last4,
        amount:         payment.amount,
        orderId:        order._id,
        orderNumber:    order.orderNumber,
      },
    });
  } catch (err) { next(err); }
};

// ── POST /api/payments/qr ─────────────────────────────────────────────────────
// Customer claims they completed QR/UPI payment
const processQRPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId).populate("restaurant", "name bankDetails");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const payment = await Payment.create({
      order:         order._id,
      restaurant:    order.restaurant._id,
      customer:      req.user._id,
      paymentMethod: "qr",
      // QR payments need manual verification by restaurant owner in real world.
      // Using "paid" for demo mode so the flow continues.
      paymentStatus: "paid",
      amount:        order.totalAmount,
      upiId:         order.restaurant.bankDetails?.upiId || "",
      paymentDate:   new Date(),
      notes:         "Customer confirmed UPI/QR payment",
    });

    order.paymentStatus = "paid";
    order.paymentMethod = "qr";
    order.payment       = payment._id;
    order.statusHistory.push({ status: order.orderStatus, note: "Payment confirmed via UPI/QR" });
    await order.save();

    if (req.io) {
      req.io.to(`restaurant-${order.restaurant._id}`).emit("order-payment-updated", {
        orderId: order._id, paymentStatus: "paid", paymentMethod: "qr",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment recorded. Order is being processed.",
      data: {
        transactionId: payment.transactionId,
        paymentStatus: "paid",
        paymentMethod: "qr",
        amount:        payment.amount,
        orderId:       order._id,
        orderNumber:   order.orderNumber,
      },
    });
  } catch (err) { next(err); }
};

// ── GET /api/payments/order/:orderId ─────────────────────────────────────────
// Get payment details for an order (customer or owner)
const getPaymentByOrder = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({ order: req.params.orderId })
      .populate("order",      "orderNumber totalAmount orderStatus")
      .populate("restaurant", "name bankDetails")
      .populate("customer",   "name email");

    if (!payment) return res.status(404).json({ success: false, message: "No payment found for this order" });

    // Only customer or restaurant owner can see
    const isCustomer = payment.customer._id.toString() === req.user._id.toString();
    if (!isCustomer && req.user.role !== "admin" && req.user.role !== "restaurantOwner") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (err) { next(err); }
};

// ── GET /api/payments/restaurant/:restaurantId/bank-details ──────────────────
// Public endpoint — returns only the payment info customers need for QR/UPI
const getRestaurantBankDetails = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.restaurantId)
      .select("name bankDetails logo");

    if (!restaurant) return res.status(404).json({ success: false, message: "Restaurant not found" });

    res.status(200).json({
      success: true,
      data: {
        restaurantName:    restaurant.name,
        restaurantLogo:    restaurant.logo || "",
        bankName:          restaurant.bankDetails?.bankName || "",
        accountHolderName: restaurant.bankDetails?.accountHolderName || "",
        upiId:             restaurant.bankDetails?.upiId || "",
        qrCodeImage:       restaurant.bankDetails?.qrCodeImage || "",
      },
    });
  } catch (err) { next(err); }
};

// ── PUT /api/payments/restaurant/:restaurantId/bank-details ──────────────────
// Restaurant owner updates their bank / payment details
const updateBankDetails = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.restaurantId);
    if (!restaurant) return res.status(404).json({ success: false, message: "Restaurant not found" });

    if (String(restaurant.owner) !== String(req.user._id) && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const { bankName, accountHolderName, accountNumber, ifscCode, upiId, qrCodeImage } = req.body;

    // UPI ID is the PRIMARY payment identifier customers rely on — required.
    // QR code image is fully OPTIONAL: if the owner doesn't upload one,
    // the frontend auto-generates a scannable QR from this UPI ID instead.
    if (!upiId || !upiId.trim()) {
      return res.status(400).json({ success: false, message: "UPI ID is required so customers can pay you." });
    }
    if (!/^[\w.\-]+@[\w]+$/i.test(upiId)) {
      return res.status(400).json({ success: false, message: "Invalid UPI ID format (e.g. name@upi, 9876543210@paytm)" });
    }

    // Validate IFSC only if provided (optional field)
    if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscCode)) {
      return res.status(400).json({ success: false, message: "Invalid IFSC code format (e.g. SBIN0001234)" });
    }

    // qrCodeImage is intentionally NOT validated as required — fully optional upload

    restaurant.bankDetails = {
      bankName:          bankName          || restaurant.bankDetails?.bankName          || "",
      accountHolderName: accountHolderName || restaurant.bankDetails?.accountHolderName || "",
      accountNumber:     accountNumber     || restaurant.bankDetails?.accountNumber     || "",
      ifscCode:          ifscCode          || restaurant.bankDetails?.ifscCode          || "",
      upiId:             upiId             || restaurant.bankDetails?.upiId             || "",
      qrCodeImage:       qrCodeImage       || restaurant.bankDetails?.qrCodeImage       || "",
    };

    await restaurant.save();

    res.status(200).json({ success: true, message: "Bank details updated successfully", data: restaurant.bankDetails });
  } catch (err) { next(err); }
};

module.exports = {
  processCardPayment,
  processQRPayment,
  getPaymentByOrder,
  getRestaurantBankDetails,
  updateBankDetails,
};