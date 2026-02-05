const mongoose = require('mongoose');

const liveTrackingDeviceSchema = new mongoose.Schema({
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Vehicle',
        unique: true // One device credential per vehicle
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastSynced: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Index for faster lookups
liveTrackingDeviceSchema.index({ vehicleId: 1 });

module.exports = mongoose.model('LiveTrackingDevice', liveTrackingDeviceSchema);
