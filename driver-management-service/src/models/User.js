/**
 * User.js (driver-management-service)
 *
 * Read-only reference to the users collection.
 * Both services use the same MONGO_URI and the same 'users' collection,
 * so we can query user details directly instead of making HTTP inter-service calls.
 * This is more reliable than HTTP calls between Lambda functions.
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    role: { type: String },
    companyName: { type: String },
    profileImage: { type: String },
    phone: { type: String },
    assignmentStatus: {
        type: String,
        enum: ['UNASSIGNED', 'ASSIGNED'],
        default: 'UNASSIGNED'
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
    dlFrontImage: { type: String },
    dlBackImage: { type: String },
    isProfileComplete: { type: Boolean },
    isVerifiedBusiness: { type: Boolean },
    verificationStatus: { type: String }
}, { collection: 'users' });

module.exports = mongoose.model('User', userSchema);
