const express = require('express');
const router = express.Router();
const authController = require('./authController');
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' }
});

router.post('/login', authLimiter, authController.login);

module.exports = router;
