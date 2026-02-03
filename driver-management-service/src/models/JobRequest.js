const mongoose = require('mongoose');

/**
 * Job Request Schema
 * 
 * Manages hiring workflow between companies and drivers:
 * - Job posting/request creation
 * - Application/invitation workflow
 * - Accept/reject/withdraw actions
 * - Interview scheduling
 */

const jobRequestSchema = new mongoose.Schema({
    // Company sending the request (fleetmanager userId from User Service)
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },

    // Driver receiving the request (userId from User Service)
    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },

    // Request Type
    type: {
        type: String,
        enum: ['DIRECT_OFFER', 'APPLICATION_RESPONSE', 'INTERVIEW_INVITE'],
        default: 'DIRECT_OFFER'
    },

    // Status Workflow: PENDING -> VIEWED -> ACCEPTED/REJECTED/WITHDRAWN/EXPIRED -> HIRED
    status: {
        type: String,
        enum: ['PENDING', 'VIEWED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'HIRED', 'CANCELLED'],
        default: 'PENDING',
        index: true
    },

    // Job Details
    jobDetails: {
        serviceType: {
            type: String,
            required: true,
            enum: ['Commercial', 'Passenger']
        },
        vehicleType: {
            type: String,
            required: true
        },
        contractDuration: {
            type: Number,
            required: true,
            min: 1
        },
        contractUnit: {
            type: String,
            required: true,
            enum: ['Day(s)', 'Week(s)', 'Month(s)', 'Year(s)'],
            default: 'Month(s)'
        },
        accommodation: {
            type: Boolean,
            default: false
        },
        healthInsurance: {
            type: Boolean,
            default: false
        },
        description: {
            type: String,
            maxlength: 2000
        }
    },

    // Compensation
    offeredSalary: {
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        currency: {
            type: String,
            default: 'INR'
        },
        frequency: {
            type: String,
            required: true,
            enum: ['PER_KM', 'PER_DAY', 'PER_MONTH'],
            default: 'PER_MONTH'
        }
    },

    // Timeline
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        index: true
    },

    // Status History
    statusHistory: [{
        status: {
            type: String,
            enum: ['PENDING', 'VIEWED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'HIRED', 'CANCELLED']
        },
        changedBy: {
            type: mongoose.Schema.Types.ObjectId
        },
        changedAt: {
            type: Date,
            default: Date.now
        },
        reason: {
            type: String
        }
    }],

    // Company Notes
    companyNotes: {
        type: String,
        maxlength: 2000
    },

    // Driver Response (when accepting/rejecting)
    driverResponse: {
        respondedAt: {
            type: Date
        },
        message: {
            type: String,
            maxlength: 1000
        },
        dlConsentGiven: {
            type: Boolean,
            default: false
        },
        counterOffer: {
            salary: {
                amount: Number,
                currency: String,
                frequency: String
            },
            startDate: Date,
            notes: String
        }
    },

    // Rejection details
    rejection: {
        reason: {
            type: String,
            enum: ['SALARY_LOW', 'LOCATION', 'TIMING', 'BETTER_OFFER', 'PERSONAL', 'QUALIFICATIONS', 'EXPERIENCE', 'OTHER']
        },
        details: {
            type: String,
            maxlength: 1000
        },
        rejectedBy: {
            type: String,
            enum: ['DRIVER', 'COMPANY']
        }
    },

    // Employment reference (when hired)
    resultingEmployment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employment'
    },

    // Interview details
    interview: {
        scheduledAt: Date,
        location: String,
        notes: String,
        status: {
            type: String,
            enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']
        }
    },

    // Proposed start date
    proposedStartDate: {
        type: Date
    },

    // Metadata
    viewedAt: {
        type: Date
    },
    viewCount: {
        type: Number,
        default: 0
    }

}, {
    timestamps: true,
    collection: 'job_requests'
});

// Compound indexes
jobRequestSchema.index({ companyId: 1, status: 1 });
jobRequestSchema.index({ driverId: 1, status: 1 });
jobRequestSchema.index({ status: 1, expiresAt: 1 });
jobRequestSchema.index({ createdAt: -1 });

// Method to update status with history
jobRequestSchema.methods.updateStatus = function(newStatus, changedBy, reason = '') {
    const previousStatus = this.status;
    
    this.statusHistory.push({
        status: previousStatus,
        changedBy: changedBy,
        changedAt: new Date(),
        reason: reason
    });

    this.status = newStatus;

    if (newStatus === 'VIEWED' && !this.viewedAt) {
        this.viewedAt = new Date();
    }

    this.viewCount += 1;

    return { previousStatus, newStatus };
};

// Method to check if request can be modified
jobRequestSchema.methods.canBeModified = function() {
    return ['PENDING', 'VIEWED'].includes(this.status);
};

// Method to check if request is expired
jobRequestSchema.methods.isExpired = function() {
    return this.expiresAt < new Date() || this.status === 'EXPIRED';
};

// Static method to expire old requests
jobRequestSchema.statics.expireOldRequests = async function() {
    const now = new Date();
    return this.updateMany(
        {
            status: { $in: ['PENDING', 'VIEWED'] },
            expiresAt: { $lt: now }
        },
        {
            $set: { status: 'EXPIRED' },
            $push: {
                statusHistory: {
                    status: 'EXPIRED',
                    changedAt: now,
                    reason: 'Auto-expired'
                }
            }
        }
    );
};

// Pre-save middleware
jobRequestSchema.pre('save', function(next) {
    // Set default expiry if not set (30 days)
    if (!this.expiresAt) {
        const thirtyDays = new Date();
        thirtyDays.setDate(thirtyDays.getDate() + 30);
        this.expiresAt = thirtyDays;
    }
    next();
});

module.exports = mongoose.model('JobRequest', jobRequestSchema);
