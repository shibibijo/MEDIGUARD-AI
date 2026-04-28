require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const uploadRoutes = require('./uploadRoutes');
const authRoutes = require('./authRoutes');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mediguard';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(MONGO_URI)
    .then(() => logger.info('✅ MongoDB Connected'))
    .catch(err => logger.error('❌ MongoDB Connection Error: ' + err));

app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes);

app.listen(PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`);
});
