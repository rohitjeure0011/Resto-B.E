const express = require("express");
const router  = express.Router();
const {
  processCardPayment,
  processQRPayment,
  getPaymentByOrder,
  getRestaurantBankDetails,
  updateBankDetails,
} = require("../controllers/paymentController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// Card / net banking payment
router.post("/card",  protect, processCardPayment);

// QR / UPI payment confirmation
router.post("/qr",    protect, processQRPayment);

// Get payment record for an order
router.get("/order/:orderId", protect, getPaymentByOrder);

// Public: get restaurant bank/payment details for QR display to customer
router.get("/restaurant/:restaurantId/bank-details", getRestaurantBankDetails);

// Owner: update their bank details
router.put("/restaurant/:restaurantId/bank-details", protect, authorizeRoles("restaurantOwner", "admin"), updateBankDetails);

module.exports = router;