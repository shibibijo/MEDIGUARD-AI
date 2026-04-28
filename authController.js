const User = require('./User');
const logger = require('./logger');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Please provide username and password' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET || 'supersecret',
            { expiresIn: '1d' }
        );

        res.status(200).json({
            success: true,
            token,
            user: { id: user._id, username: user.username, role: user.role }
        });

    } catch (error) {
        logger.error(`Login error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Server processing error.' });
    }
};

exports.register = async (req, res) => {
    try {
        const { username, password, role } = req.body;

        if (!username || !password || !role) {
            return res.status(400).json({ success: false, message: 'Please provide username, password and role' });
        }

        if (!['hospital', 'insurer'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role. Must be hospital or insurer' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Username already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({ username, password: hashedPassword, role });
        await user.save();

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET || 'supersecret',
            { expiresIn: '1d' }
        );

        logger.info(`New user registered: ${username}`);
        res.status(201).json({
            success: true,
            token,
            user: { id: user._id, username: user.username, role: user.role }
        });

    } catch (error) {
        logger.error(`Register error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Server processing error.' });
    }
};

