/**
 * BillItem is stored as an embedded sub-document inside Bill.items (see Bill.js).
 * This file exports the sub-document schema so it can be reused if needed,
 * and keeps a named export for backward compatibility.
 */
const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null
    },
    productName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      default: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      default: 0
    },
    mrp: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true,
      default: 0
    }
  },
  {
    _id: true,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

module.exports = billItemSchema;
