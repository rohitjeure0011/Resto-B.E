const Restaurant = require("../models/Restaurant");

// GET /api/restaurants — public: all restaurants from MongoDB only
const getRestaurants = async (req, res, next) => {
  try {
    const restaurants = await Restaurant.find({ isOpen: true })
      .select("-bankDetails.accountNumber -bankDetails.ifscCode -__v")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: restaurants.length, data: restaurants });
  } catch (err) { next(err); }
};

// GET /api/restaurants/owner/mine — owner: only their own restaurants
const getMyRestaurants = async (req, res, next) => {
  try {
    const restaurants = await Restaurant.find({ owner: req.user._id })
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: restaurants.length, data: restaurants });
  } catch (err) { next(err); }
};

// GET /api/restaurants/:id
const getRestaurantById = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id)
      .select("-bankDetails.accountNumber -bankDetails.ifscCode");
    if (!restaurant)
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    res.status(200).json({ success: true, data: restaurant });
  } catch (err) { next(err); }
};

// POST /api/restaurants — owner creates restaurant with bank details
const createRestaurant = async (req, res, next) => {
  try {
    const {
      name, description, cuisine, categories,
      address, addressText, phone, email,
      deliveryTime, image, logo,
      gstPercent, deliveryCharge, freeDeliveryAbove,
      bankDetails,
    } = req.body;

    if (!name?.trim())
      return res.status(400).json({ success: false, message: "Restaurant name is required" });

    const restaurant = await Restaurant.create({
      name: name.trim(),
      description: description || "",
      cuisine:    cuisine    || [],
      categories: categories || [],
      address:    address    || {},
      addressText: addressText || "",
      phone:  phone  || "",
      email:  email  || "",
      deliveryTime:    deliveryTime    || "30-45 mins",
      image:           image           || "",
      logo:            logo            || "",
      gstPercent:      Number(gstPercent)      || 5,
      deliveryCharge:  Number(deliveryCharge)  || 30,
      freeDeliveryAbove: Number(freeDeliveryAbove) || 0,
      owner:  req.user._id,
      isOpen: true,
      // Bank details collected during restaurant registration (Feature 4)
      bankDetails: {
        bankName:          bankDetails?.bankName          || "",
        accountHolderName: bankDetails?.accountHolderName || "",
        accountNumber:     bankDetails?.accountNumber     || "",
        ifscCode:          bankDetails?.ifscCode          || "",
        upiId:             bankDetails?.upiId             || "",
        qrCodeImage:       bankDetails?.qrCodeImage       || "",
      },
    });

    res.status(201).json({ success: true, data: restaurant });
  } catch (err) { next(err); }
};

// PUT /api/restaurants/:id
const updateRestaurant = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant)
      return res.status(404).json({ success: false, message: "Restaurant not found" });

    if (String(restaurant.owner) !== String(req.user._id) && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Not authorized" });

    const allowed = [
      "name","description","cuisine","categories","address","addressText",
      "phone","email","deliveryTime","image","logo","isOpen",
      "gstPercent","deliveryCharge","freeDeliveryAbove",
    ];
    allowed.forEach(f => { if (req.body[f] !== undefined) restaurant[f] = req.body[f]; });

    // Update bank details if provided
    if (req.body.bankDetails) {
      restaurant.bankDetails = { ...restaurant.bankDetails.toObject(), ...req.body.bankDetails };
    }

    const updated = await restaurant.save();
    res.status(200).json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// DELETE /api/restaurants/:id
const deleteRestaurant = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant)
      return res.status(404).json({ success: false, message: "Restaurant not found" });

    if (String(restaurant.owner) !== String(req.user._id) && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Not authorized" });

    await restaurant.deleteOne();
    res.status(200).json({ success: true, message: "Restaurant deleted" });
  } catch (err) { next(err); }
};

module.exports = {
  getRestaurants,
  getMyRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
};