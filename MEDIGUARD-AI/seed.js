require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mediguard';

const seedDatabase = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB Connected for Seeding');

        await User.deleteMany({});
        console.log('Cleared existing users');

        const salt = await bcrypt.genSalt(10);
        const hospitalPassword = await bcrypt.hash('hospital123', salt);
        const insurerPassword = await bcrypt.hash('insurer123', salt);

        const hospitalUser = new User({
            username: 'hospital',
            password: hospitalPassword,
            role: 'hospital'
        });

        const insurerUser = new User({
            username: 'insurer',
            password: insurerPassword,
            role: 'insurer'
        });

        await hospitalUser.save();
        await insurerUser.save();

        console.log('✅ Seeded users successfully!');
        console.log('- User: hospital | Pass: hospital123');
        console.log('- User: insurer | Pass: insurer123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding Error:', error);
        process.exit(1);
    }
};

seedDatabase();
