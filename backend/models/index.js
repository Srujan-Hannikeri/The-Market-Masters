const { connectDB, testConnection, mongoose } = require('../config/database');
const User = require('./User');
const Product = require('./Product');
const Bill = require('./Bill');
const Expense = require('./Expense');
const Payment = require('./Payment');
const Order = require('./Order');
const Cart = require('./Cart');

const syncDatabase = async () => {
  return await connectDB();
};

module.exports = {
  connectDB,
  testConnection,
  syncDatabase,
  mongoose,
  User,
  Product,
  Bill,
  Expense,
  Payment,
  Order,
  Cart
};
