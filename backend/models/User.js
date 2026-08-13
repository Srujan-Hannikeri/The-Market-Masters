const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['shopkeeper', 'customer', 'admin'],
      default: 'customer'
    },
    shopName: {
      type: String,
      default: ''
    },
    shopAddress: {
      type: String,
      default: ''
    },
    upiId: {
      type: String,
      default: ''
    },
    upiQrCode: {
      type: String,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    },
    sessionToken: {
      type: String,
      default: null
    },
    sessionDevice: {
      type: String,
      default: null
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Map _id to id virtual property for API JSON responses
userSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
