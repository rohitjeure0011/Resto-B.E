const express = require("express");
const router  = express.Router();
const {
  addMenuItem, getMenuByRestaurant, getOwnerMenu,
  updateMenuItem, deleteMenuItem, bulkAddMenuItems,
} = require("../controllers/menuController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// Public: customers see available items
router.get("/:restaurantId",          getMenuByRestaurant);
// Owner: sees all items including unavailable ones
router.get("/:restaurantId/all",      protect, authorizeRoles("restaurantOwner","admin"), getOwnerMenu);
// Add single item
router.post("/:restaurantId",         protect, authorizeRoles("restaurantOwner","admin"), addMenuItem);
// Bulk add during onboarding
router.post("/:restaurantId/bulk",    protect, authorizeRoles("restaurantOwner","admin"), bulkAddMenuItems);
// Update / delete single item
router.put("/item/:id",               protect, authorizeRoles("restaurantOwner","admin"), updateMenuItem);
router.delete("/item/:id",            protect, authorizeRoles("restaurantOwner","admin"), deleteMenuItem);

module.exports = router;