# Restaurant Online Ordering System — Backend

A complete Node.js + Express + MongoDB (Mongoose) backend for a restaurant online ordering platform: user auth, restaurants, menus, and orders.

## Tech Stack
- Node.js + Express
- MongoDB + Mongoose
- JWT authentication
- bcryptjs for password hashing

## Project Structure
```
restaurant-backend/
├── config/
│   └── db.js                 # MongoDB connection
├── models/
│   ├── User.js
│   ├── Restaurant.js
│   ├── MenuItem.js
│   └── Order.js
├── controllers/
│   ├── authController.js
│   ├── restaurantController.js
│   ├── menuController.js
│   └── orderController.js
├── routes/
│   ├── authRoutes.js
│   ├── restaurantRoutes.js
│   ├── menuRoutes.js
│   └── orderRoutes.js
├── middleware/
│   ├── authMiddleware.js
│   └── errorMiddleware.js
├── .env.example
├── package.json
└── server.js
```

## Setup Instructions

### 1. Install dependencies
```bash
cd restaurant-backend
npm install
```

### 2. Configure environment variables
Copy `.env.example` to `.env` and update values:
```bash
cp .env.example .env
```

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/restaurant_ordering_db
JWT_SECRET=replace_this_with_a_long_random_secret_key
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

- If using **local MongoDB**, start it with `mongod` and keep the URI as is.
- If using **MongoDB Atlas**, replace `MONGO_URI` with your Atlas connection string, e.g.:
  ```
  MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/restaurant_ordering_db?retryWrites=true&w=majority
  ```

### 3. Run the server
```bash
# development (auto-restart with nodemon)
npm run dev

# production
npm start
```

You should see:
```
MongoDB Connected: <host>
Server running in development mode on port 5000
```

## API Endpoints

### Auth (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | /register | Public | Register a new user |
| POST | /login | Public | Login and receive JWT |
| GET | /profile | Private | Get logged-in user profile |
| PUT | /profile | Private | Update logged-in user profile |

### Restaurants (`/api/restaurants`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | / | Public | List restaurants (supports `?search=` and `?cuisine=`) |
| POST | / | Private (owner/admin) | Create restaurant |
| GET | /:id | Public | Get single restaurant |
| PUT | /:id | Private (owner/admin) | Update restaurant |
| DELETE | /:id | Private (owner/admin) | Delete restaurant |

### Menu (`/api/menu`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | /:restaurantId | Public | Get menu for a restaurant (supports `?category=`) |
| POST | /:restaurantId | Private (owner/admin) | Add menu item |
| PUT | /item/:id | Private (owner/admin) | Update menu item |
| DELETE | /item/:id | Private (owner/admin) | Delete menu item |

### Orders (`/api/orders`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | / | Private (customer) | Place a new order |
| GET | /my-orders | Private | Get logged-in user's orders |
| GET | /:id | Private | Get a single order |
| GET | /restaurant/:restaurantId | Private (owner/admin) | Get all orders for a restaurant |
| PUT | /:id/status | Private (owner/admin) | Update order status |
| PUT | /:id/cancel | Private (customer) | Cancel an order |

## Authentication
Protected routes require a header:
```
Authorization: Bearer <your_jwt_token>
```
The token is returned from `/api/auth/register` or `/api/auth/login`.

## Example Requests

**Register**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"123456"}'
```

**Login**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"123456"}'
```

**Create restaurant** (requires owner/admin token)
```bash
curl -X POST http://localhost:5000/api/restaurants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Pizza Palace","description":"Best pizza in town","cuisine":["Italian"]}'
```

**Place an order**
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "restaurant": "<restaurantId>",
    "items": [{"menuItem": "<menuItemId>", "quantity": 2}],
    "deliveryAddress": {"street":"123 Main St","city":"Mumbai","state":"MH","zipCode":"400001"},
    "paymentMethod": "cash_on_delivery"
  }'
```

## Notes
- Order item prices are always re-fetched from the database server-side at order time — never trusted from the client — to prevent price tampering.
- Roles supported: `customer`, `restaurant_owner`, `admin`. Users cannot self-register as `admin`.
- Add an `uploads/` + multer setup if you need image uploads for restaurants/menu items later.
