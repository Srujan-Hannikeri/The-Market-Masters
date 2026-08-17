const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true
    },
    total: {
      type: Number,
      required: true
    }
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    shopkeeperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    items: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      default: 0
    },
    finalAmount: {
      type: Number,
      required: true
    },
    paymentMode: {
      type: String,
      enum: ['COD', 'UPI', 'Card', 'Net Banking', 'Cash'],
      default: 'COD'
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Partially Paid', 'Failed', 'Verification Pending'],
      default: 'Pending'
    },
    orderStatus: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Pending'
    },
    shippingAddress: {
      type: String,
      required: true
    },
    customerPhone: {
      type: String,
      required: true
    },
    notes: {
      type: String,
      default: ''
    },
    refundStatus: {
      type: String,
      default: ''
    },
    refundAmount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

orderSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

orderSchema.virtual('OrderItems').get(function () {
  return this.items;
});

orderSchema.virtual('Customer', {
  ref: 'User',
  localField: 'customerId',
  foreignField: '_id',
  justOne: true
});

orderSchema.virtual('Shopkeeper', {
  ref: 'User',
  localField: 'shopkeeperId',
  foreignField: '_id',
  justOne: true
});

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

module.exports = Order;
