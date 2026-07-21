const express = require("express");
const router  = express.Router();
const {
  getRestaurants, getMyRestaurants,
  getRestaurantById, createRestaurant,
  updateRestaurant, deleteRestaurant,
} = require("../controllers/restaurantController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// Public routes
router.get("/",                getRestaurants);

// Owner only - must come BEFORE /:id to avoid conflict
router.get("/owner/mine",      protect, authorizeRoles("restaurantOwner","admin"), getMyRestaurants);

// Public single restaurant
router.get("/:id",             getRestaurantById);

// Protected routes
router.post("/",               protect, authorizeRoles("restaurantOwner","admin"), createRestaurant);
router.put("/:id",             protect, authorizeRoles("restaurantOwner","admin"), updateRestaurant);
router.delete("/:id",          protect, authorizeRoles("restaurantOwner","admin"), deleteRestaurant);

module.exports = router;