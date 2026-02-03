/**
 * Admin User Seeder Script
 * Run this script to create an admin user in the database
 * 
 * Usage:
 *   cd user-service
 *   node seedAdmin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// User Schema (simplified for seeding)
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    companyName: { type: String },
    role: { type: String, enum: ['fleetmanager', 'admin', 'user', 'driver'], default: 'fleetmanager' },
    isVerified: { type: Boolean, default: false },
    isVerifiedBusiness: { type: Boolean, default: false },
    verificationStatus: { type: String, default: 'none' },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mobitrak_users';

// Admin credentials - CHANGE THESE IN PRODUCTION
const ADMIN_EMAIL = 'admin@mobitrak.com';
const ADMIN_PASSWORD = 'Admin@123'; // Change this!
const ADMIN_FIRST_NAME = 'Mobitrak';
const ADMIN_LAST_NAME = 'Admin';

async function seedAdmin() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
        
        if (existingAdmin) {
            console.log('Admin user already exists!');
            console.log('Email:', existingAdmin.email);
            console.log('Role:', existingAdmin.role);
            
            // Update role if not admin
            if (existingAdmin.role !== 'admin') {
                existingAdmin.role = 'admin';
                await existingAdmin.save();
                console.log('Updated user role to admin');
            }
        } else {
            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

            // Create admin user
            const adminUser = new User({
                email: ADMIN_EMAIL,
                password: hashedPassword,
                firstName: ADMIN_FIRST_NAME,
                lastName: ADMIN_LAST_NAME,
                role: 'admin',
                isVerified: true,
                createdAt: new Date()
            });

            await adminUser.save();
            console.log('✅ Admin user created successfully!');
            console.log('Email:', ADMIN_EMAIL);
            console.log('Password:', ADMIN_PASSWORD);
            console.log('Role: admin');
        }

        console.log('\nYou can now login with these credentials at the login page.');
        
    } catch (error) {
        console.error('Error seeding admin:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
        process.exit(0);
    }
}

seedAdmin();
