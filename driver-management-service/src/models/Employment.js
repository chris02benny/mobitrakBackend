const mongoose = require('mongoose');

/**
 * Employment Schema
 * 
 * Stores employment contracts created from accepted job requests.
 * Contains only the essential contract details from job_requests plus userId.
 */

const employmentSchema = new mongoose.Schema({
    // Driver reference (userId from User Service)
    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },

    // Company reference (userId of fleetmanager from User Service)
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },

    // Reference to the job request that created this employment
    sourceJobRequest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'JobRequest'
    },

    // Job Details (from job_requests)
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
        enum: ['Day(s)', 'Week(s)', 'Month(s)', 'Year(s)']
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
    },

    // Salary (from job_requests offeredSalary)
    salary: {
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
            enum: ['PER_KM', 'PER_DAY', 'PER_MONTH']
        }
    },

    // Employment Status
    status: {
        type: String,
        enum: ['ACTIVE', 'TERMINATED', 'RESIGNED'],
        default: 'ACTIVE',
        index: true
    },

    // Dates
    startDate: {
        type: Date,
        required: true,
        default: Date.now
    },

    endDate: {
        type: Date
    },

    // Termination details (if applicable)
    termination: {
        reason: {
            type: String
        },
        details: {
            type: String
        },
        initiatedBy: {
            type: String,
            enum: ['COMPANY', 'DRIVER']
        },
        terminatedAt: {
            type: Date
        }
    }
}, {
    timestamps: true,
    collection: 'employments'
});

// Indexes
employmentSchema.index({ driverId: 1, status: 1 });
employmentSchema.index({ companyId: 1, status: 1 });
employmentSchema.index({ driverId: 1, companyId: 1, status: 1 });

// Virtual for employment duration
employmentSchema.virtual('durationInDays').get(function() {
    const endDate = this.endDate || new Date();
    const diffTime = Math.abs(endDate - this.startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to check if employment is current
employmentSchema.methods.isCurrent = function() {
    return this.status === 'ACTIVE' && !this.endDate;
};

// Static method to get employment history for a driver
employmentSchema.statics.getDriverHistory = function(driverId) {
    return this.find({ driverId })
        .sort({ startDate: -1 })
        .exec();
};

// Static method to get active employees for a company
employmentSchema.statics.getCompanyActiveEmployees = function(companyId) {
    return this.find({ 
        companyId, 
        status: 'ACTIVE' 
    })
    .sort({ startDate: -1 })
    .exec();
};

module.exports = mongoose.model('Employment', employmentSchema);
