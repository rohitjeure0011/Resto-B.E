const express = require("express");
const router  = express.Router();
const {
  placeOrder, getMyOrders, getOrderById,
  getRestaurantOrders, getAllOrdersForOwner,
  updateOrderStatus, acceptOrder, cancelOrder,
  getDashboardStats,
} = require("../controllers/orderController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.post("/",                    protect, placeOrder);
router.get("/my-orders",            protect, getMyOrders);
router.get("/all",                  protect, authorizeRoles("restaurantOwner","admin"), getAllOrdersForOwner);
router.get("/dashboard-stats",      protect, authorizeRoles("restaurantOwner","admin"), getDashboardStats);
router.get("/restaurant/:restaurantId", protect, authorizeRoles("restaurantOwner","admin"), getRestaurantOrders);
router.get("/:id",                  protect, getOrderById);
router.put("/:id/accept",           protect, authorizeRoles("restaurantOwner","admin"), acceptOrder);
router.put("/:id/status",           protect, authorizeRoles("restaurantOwner","admin"), updateOrderStatus);
router.put("/:id/cancel",           protect, cancelOrder);

module.exports = router;