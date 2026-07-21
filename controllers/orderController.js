const Order      = require("../models/Order");
const MenuItem   = require("../models/MenuItem");
const Restaurant = require("../models/Restaurant");

// ── Place Order ───────────────────────────────────────────────────────────────
const placeOrder = async (req, res, next) => {
  try {
    const { restaurant: restaurantId, items, orderType, deliveryAddress, paymentMethod } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ success: false, message: "Order must contain at least one item" });

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant)
      return res.status(404).json({ success: false, message: "Restaurant not found" });

    let subtotal = 0, itemCount = 0;
    const orderItems = [];

    for (const ordered of items) {
      const menuItem = await MenuItem.findById(ordered.menuItem);
      if (!menuItem || !menuItem.isAvailable)
        return res.status(400).json({ success: false, message: `Item "${ordered.menuItem}" is not available` });

      const qty = ordered.quantity || 1;
      subtotal  += menuItem.price * qty;
      itemCount += qty;
      orderItems.push({
        menuItem: menuItem._id, name: menuItem.name,
        price: menuItem.price, quantity: qty, isVegetarian: menuItem.isVegetarian,
      });
    }

    const gstPercent     = restaurant.gstPercent     ?? 5;
    const gstAmount      = Math.round(subtotal * gstPercent / 100);
    const deliveryCharge = (orderType === "delivery") ? (restaurant.deliveryCharge ?? 30) : 0;
    const totalAmount    = subtotal + gstAmount + deliveryCharge;

    // Allowed payment methods (cod = immediate, card/qr = separate payment step)
    const validMethods = ["cash_on_delivery", "card", "qr"];
    const resolvedMethod = validMethods.includes(paymentMethod) ? paymentMethod : "cash_on_delivery";

    // COD orders are marked pending; card/qr orders start as pending too
    // (payment is confirmed in a separate /api/payments/card or /qr call)
    const paymentStatus = resolvedMethod === "cash_on_delivery" ? "pending" : "pending";

    const order = await Order.create({
      user:          req.user._id,
      restaurant:    restaurantId,
      items:         orderItems,
      itemCount,
      subtotal,
      gstPercent,
      gstAmount,
      deliveryCharge,
      totalAmount,
      orderType:     ["pickup","delivery"].includes(orderType) ? orderType : "pickup",
      deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
      paymentMethod: resolvedMethod,
      paymentStatus,
      statusHistory: [{ status: "placed", note: "Order placed by customer" }],
    });

    const populated = await Order.findById(order._id)
      .populate("user",       "name email phone")
      .populate("restaurant", "name logo owner bankDetails");

    if (req.io) req.io.to(`restaurant-${restaurantId}`).emit("new-order", populated);

    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate("restaurant", "name logo image")
      .populate("payment")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (err) { next(err); }
};

const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("restaurant", "name logo image gstPercent deliveryCharge owner bankDetails")
      .populate("user",       "name email phone")
      .populate("payment");

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const isCustomer = order.user._id.toString() === req.user._id.toString();
    const isOwner    = order.restaurant?.owner?.toString() === req.user._id.toString();
    if (!isCustomer && !isOwner && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Not authorized" });

    res.status(200).json({ success: true, data: order });
  } catch (err) { next(err); }
};

const getRestaurantOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ restaurant: req.params.restaurantId })
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (err) { next(err); }
};

const getAllOrdersForOwner = async (req, res, next) => {
  try {
    let filter = {};
    if (req.user.role !== "admin") {
      const owned = await Restaurant.find({ owner: req.user._id }).select("_id");
      filter = { restaurant: { $in: owned.map(r => r._id) } };
    }
    const orders = await Order.find(filter)
      .populate("restaurant", "name logo image")
      .populate("user",       "name email phone")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (err) { next(err); }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderStatus, note } = req.body;
    const valid = ["confirmed","preparing","ready","out_for_delivery","delivered","cancelled"];
    if (!valid.includes(orderStatus))
      return res.status(400).json({ success: false, message: "Invalid order status" });

    const order = await Order.findById(req.params.id).populate("restaurant","owner name");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const isOwner = order.restaurant?.owner?.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Not authorized" });

    order.orderStatus = orderStatus;
    order.statusHistory.push({ status: orderStatus, note: note || "" });
    if (orderStatus === "delivered" && order.paymentMethod === "cash_on_delivery")
      order.paymentStatus = "paid";
    await order.save();

    if (req.io) req.io.to(`order-${order._id}`).emit("order-status-update", {
      orderId: order._id, orderStatus, paymentStatus: order.paymentStatus, statusHistory: order.statusHistory,
    });

    res.status(200).json({ success: true, data: order });
  } catch (err) { next(err); }
};

const acceptOrder = async (req, res, next) => {
  try {
    const { estimatedMinutes = 30 } = req.body;
    const order = await Order.findById(req.params.id).populate("restaurant","owner");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    const isOwner = order.restaurant?.owner?.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Not authorized" });
    order.orderStatus      = "confirmed";
    order.acceptedAt       = new Date();
    order.estimatedReadyAt = new Date(Date.now() + estimatedMinutes * 60000);
    order.statusHistory.push({ status: "confirmed", note: `ETA: ${estimatedMinutes} mins` });
    await order.save();
    if (req.io) req.io.to(`order-${order._id}`).emit("order-status-update", { orderId: order._id, orderStatus: "confirmed", estimatedReadyAt: order.estimatedReadyAt });
    res.status(200).json({ success: true, data: order });
  } catch (err) { next(err); }
};

const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.user.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "Not authorized" });
    if (["delivered","cancelled"].includes(order.orderStatus))
      return res.status(400).json({ success: false, message: "Cannot cancel this order" });
    order.orderStatus = "cancelled";
    order.statusHistory.push({ status: "cancelled", note: "Cancelled by customer" });
    await order.save();
    if (req.io) req.io.to(`restaurant-${order.restaurant}`).emit("order-cancelled", { orderId: order._id });
    res.status(200).json({ success: true, data: order });
  } catch (err) { next(err); }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const ownedRestaurants = await Restaurant.find({ owner: req.user._id }).select("_id");
    const restaurantIds    = ownedRestaurants.map(r => r._id);
    const today = new Date(); today.setHours(0,0,0,0);
    const [total, todayOrders, pending, completed, revenue, menuCount] = await Promise.all([
      Order.countDocuments({ restaurant: { $in: restaurantIds } }),
      Order.countDocuments({ restaurant: { $in: restaurantIds }, createdAt: { $gte: today } }),
      Order.countDocuments({ restaurant: { $in: restaurantIds }, orderStatus: { $in: ["placed","confirmed","preparing","ready"] } }),
      Order.countDocuments({ restaurant: { $in: restaurantIds }, orderStatus: "delivered" }),
      Order.aggregate([{ $match: { restaurant: { $in: restaurantIds }, orderStatus: "delivered" } }, { $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
      require("../models/MenuItem").countDocuments({ restaurant: { $in: restaurantIds } }),
    ]);
    res.status(200).json({ success: true, data: { totalOrders: total, todayOrders, pendingOrders: pending, completedOrders: completed, totalRevenue: revenue[0]?.total || 0, totalMenuItems: menuCount } });
  } catch (err) { next(err); }
};

module.exports = { placeOrder, getMyOrders, getOrderById, getRestaurantOrders, getAllOrdersForOwner, updateOrderStatus, acceptOrder, cancelOrder, getDashboardStats };