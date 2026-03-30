const mongoose = require('mongoose');

/**
 * Leave Schema
 *
 * Stores leave applications submitted by drivers.
 * Leave dates are validated against assigned trips.
 * Status progresses: PENDING -> APPROVED | REJECTED
 * Fleet manager (identified via Employment.companyId) reviews applications.
 */

const leaveSchema = new mongoose.Schema({
    // Driver submitting leave
    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },

    // Fleet manager / company the driver works for (auto-resolved from active Employment)
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },

    // Leave date range (full days)
    startDate: {
        type: Date,
        required: true
    },

    endDate: {
        type: Date,
        required: true
    },

    // Leave classification
    type: {
        type: String,
        enum: ['REGULAR', 'SICK'],
        required: true
    },

    // Reason provided by driver
    reason: {
        type: String,
        required: true,
        maxlength: 1000,
        trim: true
    },

    // Cloudinary URL for supporting document (Sick Leave only)
    documentUrl: {
        type: String,
        default: null
    },

    // Workflow status — starts PENDING, fleet manager acts on it
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
        default: 'PENDING',
        index: true
    },

    // Optional rejection/approval note from fleet manager
    managerNote: {
        type: String,
        maxlength: 500,
        default: null
    },

    // ID of fleet manager who acted on the request
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },

    reviewedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    collection: 'leaves'
});

// Indexes for common queries
leaveSchema.index({ driverId: 1, status: 1 });
leaveSchema.index({ companyId: 1, status: 1 });
leaveSchema.index({ driverId: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Leave', leaveSchema);
