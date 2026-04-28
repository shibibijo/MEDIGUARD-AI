const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadController = require('./uploadController');
const { protect, authorize } = require('./authMiddleware');
const Claim = require('./Claim');
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: { success: false, message: 'Too many upload requests from this IP, please try again after an hour' }
});

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, JPEG, and PNG are allowed.'));
        }
    }
});

router.post('/upload', protect, authorize('hospital'), uploadLimiter, (req, res, next) => {
    upload.single('claimDocument')(req, res, function (err) {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
}, uploadController.processClaim);

router.get('/claims', protect, authorize('insurer'), async (req, res) => {
    try {
        const claims = await Claim.find().sort({ timestamp: -1 });
        res.status(200).json({ success: true, count: claims.length, data: claims });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;
