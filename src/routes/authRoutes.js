const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { schemas } = require('../utils/validation');

// Public routes
router.post('/auth/register', validate(schemas.register), authController.register);
router.post('/auth/login', validate(schemas.login), authController.login);
router.get('/auth/verify-email', authController.verifyEmail);
router.post('/auth/password-reset-request', validate(schemas.passwordReset), authController.requestPasswordReset);
router.post('/auth/password-reset', validate(schemas.passwordResetConfirm), authController.resetPassword);
router.post('/auth/refresh-token', validate(schemas.refreshToken), authController.refreshAccessToken);

// Protected routes
router.post('/auth/logout', authenticate, authController.logout);
router.post('/auth/change-password', authenticate, validate(schemas.changePassword), authController.changePassword);
router.get('/users/profile', authenticate, authController.getProfile);
router.put('/users/profile', authenticate, validate(schemas.updateProfile), authController.updateProfile);

module.exports = router;

