const mongoose = require('mongoose');

/**
 * Driver Rating Schema
 * 
 * Manages driver ratings and reviews from companies:
 * - Multi-dimensional ratings (safety, punctuality, etc.)
 * - Text reviews
 * - Employment-linked ratings
 */

const driverRatingSchema = new mongoose.Schema({
    // Driver being rated (userId from User Service)
    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },

    // Company/Person giving the rating
    ratedBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        role: {
            type: String,
            enum: ['COMPANY', 'FLEET_MANAGER', 'SUPERVISOR'],
            default: 'COMPANY'
        }
    },

    // Related Employment (optional but recommended)
    employmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employment'
    },

    // Overall Rating
    overallRating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },

    // Category-wise Ratings
    categoryRatings: {
        safety: {
            type: Number,
            min: 1,
            max: 5
        },
        punctuality: {
            type: Number,
            min: 1,
            max: 5
        },
        professionalism: {
            type: Number,
            min: 1,
            max: 5
        },
        vehicleCare: {
            type: Number,
            min: 1,
            max: 5
        },
        communication: {
            type: Number,
            min: 1,
            max: 5
        }
    },

    // Review Text
    review: {
        title: {
            type: String,
            maxlength: 100
        },
        content: {
            type: String,
            maxlength: 2000
        }
    },

    // Tags
    tags: [{
        type: String,
        enum: ['HIGHLY_RECOMMENDED', 'RELIABLE', 'SKILLED', 'PROFESSIONAL', 'EXPERIENCED', 
               'NEEDS_IMPROVEMENT', 'PUNCTUAL', 'SAFE_DRIVER', 'GOOD_COMMUNICATOR', 'TEAM_PLAYER']
    }],

    // Would Rehire
    wouldRehire: {
        type: Boolean
    },

    // Rating Context
    context: {
        employmentDuration: {
            type: Number // in days
        },
        vehicleType: {
            type: String
        },
        routeType: {
            type: String
        }
    },

    // Visibility
    isPublic: {
        type: Boolean,
        default: true
    },

    // Moderation
    isApproved: {
        type: Boolean,
        default: true
    },

    moderationStatus: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED'],
        default: 'APPROVED'
    },

    moderationNotes: {
        type: String
    },

    // Driver Response
    driverResponse: {
        content: {
            type: String,
            maxlength: 1000
        },
        respondedAt: {
            type: Date
        }
    },

    // Helpful votes
    helpfulVotes: {
        type: Number,
        default: 0
    },

    // Edit History
    editHistory: [{
        editedAt: {
            type: Date,
            default: Date.now
        },
        previousRating: {
            type: Number
        },
        reason: {
            type: String
        }
    }]

}, {
    timestamps: true,
    collection: 'driver_ratings'
});

// Indexes
driverRatingSchema.index({ driverId: 1, createdAt: -1 });
driverRatingSchema.index({ 'ratedBy.companyId': 1 });
driverRatingSchema.index({ driverId: 1, 'ratedBy.companyId': 1 });
driverRatingSchema.index({ overallRating: -1 });

// Virtual for average category rating
driverRatingSchema.virtual('averageCategoryRating').get(function() {
    const ratings = this.categoryRatings;
    const values = Object.values(ratings).filter(v => v != null);
    if (values.length === 0) return this.overallRating;
    return values.reduce((a, b) => a + b, 0) / values.length;
});

// Static method to calculate aggregate ratings for a driver
driverRatingSchema.statics.calculateAggregateRatings = async function(driverId) {
    const result = await this.aggregate([
        { $match: { driverId: new mongoose.Types.ObjectId(driverId), isApproved: true } },
        {
            $group: {
                _id: '$driverId',
                averageRating: { $avg: '$overallRating' },
                totalRatings: { $sum: 1 },
                avgSafety: { $avg: '$categoryRatings.safety' },
                avgPunctuality: { $avg: '$categoryRatings.punctuality' },
                avgProfessionalism: { $avg: '$categoryRatings.professionalism' },
                avgVehicleCare: { $avg: '$categoryRatings.vehicleCare' },
                avgCommunication: { $avg: '$categoryRatings.communication' }
            }
        }
    ]);

    if (result.length === 0) {
        return {
            averageRating: 0,
            totalRatings: 0,
            breakdown: {
                safety: 0,
                punctuality: 0,
                professionalism: 0,
                vehicleCare: 0,
                communication: 0
            }
        };
    }

    const data = result[0];
    return {
        averageRating: Math.round(data.averageRating * 10) / 10,
        totalRatings: data.totalRatings,
        breakdown: {
            safety: Math.round((data.avgSafety || 0) * 10) / 10,
            punctuality: Math.round((data.avgPunctuality || 0) * 10) / 10,
            professionalism: Math.round((data.avgProfessionalism || 0) * 10) / 10,
            vehicleCare: Math.round((data.avgVehicleCare || 0) * 10) / 10,
            communication: Math.round((data.avgCommunication || 0) * 10) / 10
        }
    };
};

// Static method to check if company already rated driver for employment
driverRatingSchema.statics.hasRatedForEmployment = async function(driverId, companyId, employmentId) {
    const existing = await this.findOne({
        driverId,
        'ratedBy.companyId': companyId,
        employmentId
    });
    return !!existing;
};

module.exports = mongoose.model('DriverRating', driverRatingSchema);
