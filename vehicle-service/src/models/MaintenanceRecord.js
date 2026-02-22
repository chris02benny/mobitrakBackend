const mongoose = require('mongoose');

const maintenanceRecordSchema = new mongoose.Schema({
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        required: true
    },
    businessId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    type: {
        type: String,
        enum: ['REGULAR_SERVICE'],
        default: 'REGULAR_SERVICE',
        required: true
    },
    lastServiceDate: {
        type: Date
    },
    intervalMonths: {
        type: Number
    },
    nextDueDate: {
        type: Date
    },
    schedule: {
        plannedStartDate: {
            type: Date,
            required: true
        },
        plannedEndDate: {
            type: Date,
            required: true
        }
    },
    status: {
        type: String,
        enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'],
        default: 'SCHEDULED'
    },
    notes: {
        type: String
    },
    completion: {
        completedDate: {
            type: Date
        },
        totalCost: {
            type: Number
        },
        notes: {
            type: String
        },
        files: [
            {
                fileName: String,
                fileUrl: String,
                publicId: String,
                resourceType: String,
                uploadedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ]
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    }
}, {
    timestamps: true
});

// Indexes for performance and conflict validation
maintenanceRecordSchema.index({ vehicleId: 1 });
maintenanceRecordSchema.index({ businessId: 1 });
maintenanceRecordSchema.index({ status: 1 });
maintenanceRecordSchema.index({ 'schedule.plannedStartDate': 1 });
maintenanceRecordSchema.index({ 'schedule.plannedEndDate': 1 });

module.exports = mongoose.model('MaintenanceRecord', maintenanceRecordSchema);
