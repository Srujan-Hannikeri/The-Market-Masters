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
        serverSelectionTimeoutMS: 3000, // Fail fast on Vercel
      });
      isConnected = conn.connections[0].readyState === 1;
      console.log(`✓ MongoDB Atlas Connected: ${conn.connection.host}/${conn.connection.name}`);
      return true;
    } catch (error) {
      console.error(`⚠ MongoDB Atlas connection failed (${error.message}).`);
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
        throw new Error('Database connection failed. Please ensure your IP (0.0.0.0/0) is whitelisted in MongoDB Atlas.');
      }
    }
  }

  try {
    const conn = await mongoose.connect(localURI, {
      serverSelectionTimeoutMS: 3000,
    });
    isConnected = conn.connections[0].readyState === 1;
    console.log(`✓ Local MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return true;
  } catch (error) {
    console.error(`✗ MongoDB Connection Error: ${error.message}`);
    console.error('  Note: If using MongoDB Atlas, make sure 0.0.0.0/0 (Allow Access from Anywhere) is enabled in your Atlas Network Access settings.');
    throw new Error('Database connection failed.');
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
