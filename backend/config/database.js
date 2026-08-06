const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return true;
  }

  const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
  const localURI = 'mongodb://127.0.0.1:27017/market_masters';

  if (mongoURI) {
    try {
      const conn = await mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 5000,
      });
      isConnected = conn.connections[0].readyState === 1;
      console.log(`✓ MongoDB Atlas Connected: ${conn.connection.host}/${conn.connection.name}`);
      return true;
    } catch (error) {
      console.warn(`⚠ MongoDB Atlas connection failed (${error.message}). Trying local fallback...`);
    }
  }

  try {
    const conn = await mongoose.connect(localURI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = conn.connections[0].readyState === 1;
    console.log(`✓ Local MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return true;
  } catch (error) {
    console.error(`✗ MongoDB Connection Error: ${error.message}`);
    console.error('  Note: If using MongoDB Atlas, make sure 0.0.0.0/0 (Allow Access from Anywhere) is enabled in your Atlas Network Access settings.');
    return false;
  }
};

const testConnection = async () => {
  return await connectDB();
};

module.exports = {
  connectDB,
  testConnection,
  mongoose
};
