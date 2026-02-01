const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: false
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },

    companyName: {
        type: String
    },
    firstName: {
        type: String
    },
    lastName: {
        type: String
    },
    dlFrontImage: {
        type: String // Cloudinary URL for DL front image
    },
    dlBackImage: {
        type: String // Cloudinary URL for DL back image
    },
    dlDetails: {
        licenseNumber: String,
        name: String,
        fatherSpouseName: String,
        dob: String,
        address: String,
        bloodGroup: String,
        issueDate: String,
        validUpto: String,
        vehicleClasses: String
    },
    rcBookImage: {
        type: String // Cloudinary URL
    },
    rcDetails: {
        type: Map,
        of: String, // Store flexible key-value pairs
        default: {}
    },
    isProfileComplete: {
        type: Boolean,
        default: function () {
            // Only drivers need to complete profile with DL
            if (this.role !== 'driver') return true;
            return !!(this.dlDetails && this.dlDetails.licenseNumber);
        }
    },
    profileImage: {
        type: String // Cloudinary URL
    },
    officeLocation: {
        type: {
            type: String,
            enum: ['Point']
        },
        coordinates: {
            type: [Number] // [longitude, latitude]
        },
        address: {
            type: String
        }
    },
    role: {
        type: String,
        enum: ['fleetmanager', 'admin', 'user', 'driver'],
        default: 'fleetmanager'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    otp: {
        type: String,
        select: false // Do not return OTP in queries by default
    },
    otpExpires: {
        type: Date,
        select: false
    },
    isVerified: {
        type: Boolean,
        default: false
    }
}, { collection: 'users' });

// Create geospatial index for officeLocation
userSchema.index({ officeLocation: '2dsphere' });

module.exports = mongoose.model('User', userSchema);
