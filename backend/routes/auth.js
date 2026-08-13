const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('phone').trim().notEmpty().withMessage('Phone is required.'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  body('role').optional().isIn(['shopkeeper', 'customer']).withMessage('Invalid role.')
], authController.register);

router.post('/login', [
  body('phone').trim().notEmpty().withMessage('Phone is required.'),
  body('password').notEmpty().withMessage('Password is required.')
], authController.login);

router.post('/forgot-password/send-otp', [
  body('phone').trim().notEmpty().withMessage('Phone is required.')
], authController.sendOTP);

router.post('/forgot-password/verify-otp', [
  body('phone').trim().notEmpty().withMessage('Phone is required.'),
  body('otp').trim().notEmpty().withMessage('OTP is required.'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.')
], authController.verifyOTPAndResetPassword);

router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.get('/shopkeeper/:id', authController.getShopkeeperProfile);
router.post('/check-session', authMiddleware, authController.checkSession);

module.exports = router;
