const express = require("express");
const cors    = require("cors");
const morgan  = require("morgan");
const dotenv  = require("dotenv");
const http    = require("http");
const { Server } = require("socket.io");
const path    = require("path");

dotenv.config();

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

connectDB();

const app    = express();
const server = http.createServer(app);

// ── CORS Configuration ─────────────────────────────────────────────────────────
const corsOptions = {
  origin: [
    "https://resto-deliver-app-1234.web.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

// ── Socket.io ──────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: corsOptions,
});
app.use((req, _res, next) => { req.io = io; next(); });

io.on("connection", (socket) => {
  socket.on("join-restaurant", (id) => socket.join(`restaurant-${id}`));
  socket.on("join-order",      (id) => socket.join(`order-${id}`));
  socket.on("disconnect", () => {});
});

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use("/api/auth",        require("./routes/authRoutes"));
app.use("/api/restaurants", require("./routes/restaurantRoutes"));
app.use("/api/menu",        require("./routes/menuRoutes"));
app.use("/api/orders",      require("./routes/orderRoutes"));
app.use("/api/upload",      require("./routes/uploadRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));

app.get("/", (_req, res) => res.json({ success: true, message: "Restaurant API running" }));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));