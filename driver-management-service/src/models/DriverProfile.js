const mongoose = require('mongoose');

/**
 * Driver Profile Schema
 * 
 * Manages driver professional profiles including:
 * - Personal info (references userId from User Service)
 * - License details
 * - Professional experience
 * - Skills and certifications
 * - Availability status
 * - Aggregate rating
 */

const driverProfileSchema = new mongoose.Schema({
    // Reference to User Service (loose coupling - no direct ref)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true,
        index: true
    },

    // Professional Information
    professionalSummary: {
        type: String,
        maxlength: 1000
    },

    // Driving License Details (mirrors/extends User Service DL data)
    licenseDetails: {
        licenseNumber: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        licenseType: {
            type: String,
            enum: ['LMV', 'HMV', 'HGMV', 'MCWG', 'TRANS', 'HPMV', 'OTHER'],
            required: true
        },
        vehicleClasses: [{
            type: String,
            enum: ['LMV', 'MCWG', 'MCWOG', 'HMV', 'HGMV', 'HPMV', 'TRANS', 'TRTR', 'OTHER']
        }],
        issueDate: {
            type: Date,
            required: true
        },
        expiryDate: {
            type: Date,
            required: true,
            index: true
        },
        issuingAuthority: {
            type: String
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        verifiedAt: {
            type: Date
        }
    },

    // Experience
    experience: {
        totalYears: {
            type: Number,
            min: 0,
            max: 60,
            default: 0
        },
        commercialYears: {
            type: Number,
            min: 0,
            max: 60,
            default: 0
        },
        vehicleTypesOperated: [{
            type: String,
            enum: ['CAR', 'SUV', 'VAN', 'TRUCK', 'BUS', 'TANKER', 'TRAILER', 'TWO_WHEELER', 'AUTO', 'OTHER']
        }],
        routeTypes: [{
            type: String,
            enum: ['LOCAL', 'INTERSTATE', 'URBAN', 'HIGHWAY', 'MOUNTAIN', 'INTERNATIONAL']
        }]
    },

    // Skills and Certifications
    skills: [{
        name: {
            type: String,
            required: true
        },
        level: {
            type: String,
            enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'],
            default: 'INTERMEDIATE'
        }
    }],

    certifications: [{
        name: {
            type: String,
            required: true
        },
        issuingBody: {
            type: String
        },
        issueDate: {
            type: Date
        },
        expiryDate: {
            type: Date
        },
        certificateUrl: {
            type: String
        },
        isVerified: {
            type: Boolean,
            default: false
        }
    }],

    // Availability
    availability: {
        status: {
            type: String,
            enum: ['AVAILABLE', 'EMPLOYED', 'ON_LEAVE', 'UNAVAILABLE', 'SEEKING'],
            default: 'AVAILABLE',
            index: true
        },
        preferredWorkType: {
            type: String,
            enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'ON_CALL', 'ANY'],
            default: 'ANY'
        },
        preferredLocations: [{
            city: String,
            state: String,
            country: {
                type: String,
                default: 'India'
            }
        }],
        expectedSalary: {
            min: {
                type: Number,
                min: 0
            },
            max: {
                type: Number,
                min: 0
            },
            currency: {
                type: String,
                default: 'INR'
            }
        },
        availableFrom: {
            type: Date
        },
        willingToRelocate: {
            type: Boolean,
            default: false
        }
    },

    // Current Employment Reference (if employed)
    currentEmployment: {
        companyId: {
            type: mongoose.Schema.Types.ObjectId
        },
        employmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employment'
        },
        assignedVehicleId: {
            type: mongoose.Schema.Types.ObjectId
        }
    },

    // Ratings Aggregate
    ratings: {
        averageRating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0
        },
        totalRatings: {
            type: Number,
            default: 0
        },
        breakdown: {
            safety: { type: Number, default: 0 },
            punctuality: { type: Number, default: 0 },
            professionalism: { type: Number, default: 0 },
            vehicleCare: { type: Number, default: 0 },
            communication: { type: Number, default: 0 }
        }
    },

    // Profile Metadata
    isProfileComplete: {
        type: Boolean,
        default: false
    },
    profileCompleteness: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastActiveAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'driver_profiles'
});

// Indexes for efficient queries
driverProfileSchema.index({ 'availability.status': 1, 'ratings.averageRating': -1 });
driverProfileSchema.index({ 'experience.totalYears': -1 });
driverProfileSchema.index({ 'licenseDetails.expiryDate': 1 });
driverProfileSchema.index({ 'availability.preferredLocations.city': 1 });

// Virtual for checking if license is valid
driverProfileSchema.virtual('isLicenseValid').get(function() {
    return this.licenseDetails.expiryDate > new Date();
});

// Method to calculate profile completeness
driverProfileSchema.methods.calculateCompleteness = function() {
    let score = 0;
    const weights = {
        licenseDetails: 25,
        experience: 20,
        skills: 15,
        certifications: 10,
        professionalSummary: 10,
        availability: 20
    };

    if (this.licenseDetails && this.licenseDetails.licenseNumber) score += weights.licenseDetails;
    if (this.experience && this.experience.totalYears > 0) score += weights.experience;
    if (this.skills && this.skills.length > 0) score += weights.skills;
    if (this.certifications && this.certifications.length > 0) score += weights.certifications;
    if (this.professionalSummary) score += weights.professionalSummary;
    if (this.availability && this.availability.status) score += weights.availability;

    this.profileCompleteness = score;
    this.isProfileComplete = score >= 70;
    return score;
};

// Pre-save middleware to update completeness
driverProfileSchema.pre('save', function(next) {
    this.calculateCompleteness();
    this.lastActiveAt = new Date();
    next();
});

module.exports = mongoose.model('DriverProfile', driverProfileSchema);
