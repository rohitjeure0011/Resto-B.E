const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const dbURI = process.env.MONGODB_URI;

    if (!dbURI) {
      throw new Error("MONGODB_URI is not defined in your .env file!");
    }

    const conn = await mongoose.connect(dbURI);

    console.log(`MongoDB Connected Successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Stop the server immediately if connection fails
  }
};

module.exports = connectDB;
