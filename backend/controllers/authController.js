const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { User } = require('../models');
const { sendOTPViaSMS } = require('../services/smsService');

// In-memory OTP storage
const otpStore = {};

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id || user._id, role: user.role },
    process.env.JWT_SECRET || 'market_masters_secret_key',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, email, password, role, shopName, shopAddress } = req.body;

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this phone number already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      phone,
      email,
      password: hashedPassword,
      role: role || 'customer',
      shopName,
      shopAddress
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: {
        id: user.id || user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        shopName: user.shopName,
        shopAddress: user.shopAddress,
        upiId: user.upiId,
        upiQrCode: user.upiQrCode
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Error registering user.', 
      error: error.message 
    });
  }
};

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phone, password } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated.' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id || user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        shopName: user.shopName,
        shopAddress: user.shopAddress,
        upiId: user.upiId,
        upiQrCode: user.upiQrCode
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Error logging in.', 
      error: error.message 
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Error fetching profile.', error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, email, shopName, shopAddress, upiId, upiQrCode } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (shopName !== undefined) user.shopName = shopName;
    if (shopAddress !== undefined) user.shopAddress = shopAddress;
    if (upiId !== undefined) user.upiId = upiId;
    if (upiQrCode !== undefined) user.upiQrCode = upiQrCode;

    await user.save();

    res.json({
      message: 'Profile updated successfully.',
      user: {
        id: user.id || user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        shopName: user.shopName,
        shopAddress: user.shopAddress,
        upiId: user.upiId,
        upiQrCode: user.upiQrCode
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile.', error: error.message });
  }
};

exports.getShopkeeperProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('name shopName shopAddress upiId upiQrCode role');

    if (!user) {
      return res.status(404).json({ message: 'Shopkeeper not found.' });
    }

    if (user.role !== 'shopkeeper') {
      return res.status(400).json({ message: 'User is not a shopkeeper.' });
    }

    res.json({ 
      message: 'Shopkeeper profile retrieved successfully.',
      user 
    });
  } catch (error) {
    console.error('Get shopkeeper profile error:', error);
    res.status(500).json({ message: 'Error fetching shopkeeper profile.', error: error.message });
  }
};

exports.sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: 'User with this phone number not found.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    otpStore[phone] = {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000
    };

    const smsResult = await sendOTPViaSMS(phone, otp);

    if (!smsResult.success) {
      console.error('Failed to send OTP:', smsResult.error);
    }

    res.json({ 
      message: 'OTP sent successfully to your phone number.',
      debug: { otp }
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Error sending OTP.', error: error.message });
  }
};

exports.verifyOTPAndResetPassword = async (req, res) => {
  try {
    const { phone, otp, newPassword } = req.body;

    const storedOTP = otpStore[phone];
    if (!storedOTP || Date.now() > storedOTP.expiresAt) {
      delete otpStore[phone];
      return res.status(400).json({ message: 'OTP expired or not found. Please request a new OTP.' });
    }

    if (storedOTP.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    delete otpStore[phone];

    res.json({ 
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Error resetting password.', error: error.message });
  }
};
