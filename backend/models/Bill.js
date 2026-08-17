const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
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
    mrp: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    }
  },
  { _id: true }
);

const billSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      required: true,
      unique: true
    },
    shopkeeperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    customerName: {
      type: String,
      required: true
    },
    customerPhone: {
      type: String,
      required: true
    },
    items: [billItemSchema],
    subtotal: {
      type: Number,
      required: true
    },
    tax: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    paidAmount: {
      type: Number,
      default: 0
    },
    balanceAmount: {
      type: Number,
      default: 0
    },
    paymentMode: {
      type: String,
      enum: ['Cash', 'COD', 'UPI', 'Card', 'Net Banking', 'Pending'],
      default: 'Cash'
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Partially Paid', 'Pending', 'Verification Pending'],
      default: 'Pending'
    },
    notes: {
      type: String,
      default: ''
    },
    pdfPath: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

billSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

billSchema.virtual('BillItems').get(function () {
  return this.items;
});

billSchema.index({ shopkeeperId: 1, created_at: -1 });
billSchema.index({ customerId: 1, created_at: -1 });
billSchema.index({ customerPhone: 1, created_at: -1 });

const Bill = mongoose.models.Bill || mongoose.model('Bill', billSchema);

module.exports = Bill;
