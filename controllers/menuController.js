const MenuItem   = require("../models/MenuItem");
const Restaurant = require("../models/Restaurant");

// ── Add menu item ─────────────────────────────────────────────────────────────
const addMenuItem = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const { name, description, price, category, image, isVegetarian, isAvailable, sortOrder } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant)
      return res.status(404).json({ success: false, message: "Restaurant not found" });

    // Only the owner or admin can add items
    if (restaurant.owner?.toString() !== req.user._id.toString() && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Not authorized" });

    const item = await MenuItem.create({
      restaurant: restaurantId, name, description,
      price: Number(price), category: category || "Other",
      image: image || "", isVegetarian: Boolean(isVegetarian),
      isAvailable: isAvailable !== false, sortOrder: sortOrder || 0,
    });

    // Emit to customers browsing this restaurant's menu
    if (req.io) req.io.emit(`menu-updated-${restaurantId}`, { action: "add", item });

    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
};

// ── Get menu by restaurant ────────────────────────────────────────────────────
const getMenuByRestaurant = async (req, res, next) => {
  try {
    const items = await MenuItem.find({
      restaurant: req.params.restaurantId,
      isAvailable: true,
    }).sort({ sortOrder: 1, category: 1, name: 1 });

    res.status(200).json({ success: true, count: items.length, data: items });
  } catch (err) { next(err); }
};

// ── Get ALL items for owner (including unavailable) ───────────────────────────
const getOwnerMenu = async (req, res, next) => {
  try {
    const items = await MenuItem.find({ restaurant: req.params.restaurantId })
      .sort({ category: 1, name: 1 });
    res.status(200).json({ success: true, count: items.length, data: items });
  } catch (err) { next(err); }
};

// ── Update menu item ──────────────────────────────────────────────────────────
const updateMenuItem = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id).populate("restaurant","owner");
    if (!item)
      return res.status(404).json({ success: false, message: "Menu item not found" });

    const isOwner = item.restaurant.owner?.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Not authorized" });

    const allowed = ["name","description","price","category","image","isVegetarian","isAvailable","sortOrder"];
    allowed.forEach(f => { if (req.body[f] !== undefined) item[f] = req.body[f]; });

    const updated = await item.save();

    // Notify customers browsing this restaurant
    if (req.io) req.io.emit(`menu-updated-${item.restaurant._id}`, { action: "update", item: updated });

    res.status(200).json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// ── Delete menu item ──────────────────────────────────────────────────────────
const deleteMenuItem = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id).populate("restaurant","owner");
    if (!item)
      return res.status(404).json({ success: false, message: "Menu item not found" });

    const isOwner = item.restaurant.owner?.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Not authorized" });

    const restaurantId = item.restaurant._id;
    await item.deleteOne();

    if (req.io) req.io.emit(`menu-updated-${restaurantId}`, { action: "delete", itemId: req.params.id });

    res.status(200).json({ success: true, message: "Menu item deleted" });
  } catch (err) { next(err); }
};

// ── Bulk add menu items (used during onboarding) ──────────────────────────────
const bulkAddMenuItems = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const { items } = req.body; // array of item objects

    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ success: false, message: "No items provided" });

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant)
      return res.status(404).json({ success: false, message: "Restaurant not found" });

    const isOwner = restaurant.owner?.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Not authorized" });

    const toInsert = items.map((it, idx) => ({
      restaurant:  restaurantId,
      name:         it.name,
      description:  it.description || "",
      price:        Number(it.price) || 0,
      category:     it.category || "Other",
      image:        it.image || "",
      isVegetarian: Boolean(it.isVegetarian),
      isAvailable:  it.isAvailable !== false,
      sortOrder:    idx,
    }));

    const created = await MenuItem.insertMany(toInsert);

    if (req.io) req.io.emit(`menu-updated-${restaurantId}`, { action: "bulk-add", items: created });

    res.status(201).json({ success: true, count: created.length, data: created });
  } catch (err) { next(err); }
};

module.exports = {
  addMenuItem, getMenuByRestaurant, getOwnerMenu,
  updateMenuItem, deleteMenuItem, bulkAddMenuItems,
};