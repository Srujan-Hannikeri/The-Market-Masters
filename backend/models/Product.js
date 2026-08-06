const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      default: 'General'
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    mrp: {
      type: Number,
      default: 0
    },
    costPrice: {
      type: Number,
      default: 0
    },
    stock: {
      type: Number,
      required: true,
      default: 0
    },
    minStock: {
      type: Number,
      default: 5
    },
    unit: {
      type: String,
      default: 'pcs'
    },
    description: {
      type: String,
      default: ''
    },
    barcode: {
      type: String,
      default: ''
    },
    image: {
      type: String,
      default: ''
    },
    expiryDate: {
      type: Date,
      default: null
    },
    agencyName: {
      type: String,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

productSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Populate shop details helper virtual
productSchema.virtual('User', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

module.exports = Product;
