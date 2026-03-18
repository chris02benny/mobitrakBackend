/**
 * DriverBehaviorLog.js
 * MongoDB model for persisting driver drowsiness monitoring events.
 * Collection: driver_behavior_logs
 */

const mongoose = require('mongoose');

const driverBehaviorLogSchema = new mongoose.Schema(
    {
        /** The monitored driver's user ID */
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },

        /** The active trip ID at the time of the event */
        tripId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Trip',
            default: null,
            index: true
        },

        /**
         * Drowsiness status at the time of the event.
         * DROWSY = PERCLOS exceeded threshold.
         * ALERT  = Normal state.
         */
        status: {
            type: String,
            enum: ['DROWSY', 'ALERT'],
            required: true,
            index: true
        },

        /**
         * PERCLOS value at time of event (0–1).
         * = proportion of frames in sliding window where eye was closed.
         */
        perclos: {
            type: Number,
            min: 0,
            max: 1,
            default: 0
        },

        /**
         * Eye Aspect Ratio (EAR) at time of event.
         * Lower = more closed. Typical open range: 0.25–0.35.
         */
        ear: {
            type: Number,
            min: 0,
            default: 0
        },

        /** Client-supplied UTC timestamp of the event */
        timestamp: {
            type: Date,
            required: true,
            default: Date.now
        }
    },
    {
        timestamps: true,  // Adds createdAt + updatedAt
        collection: 'driver_behavior_logs'
    }
);

// Compound index for querying driver events over time
driverBehaviorLogSchema.index({ driverId: 1, timestamp: -1 });
// Index for trip-level queries
driverBehaviorLogSchema.index({ tripId: 1, status: 1 });

module.exports = mongoose.model('DriverBehaviorLog', driverBehaviorLogSchema);
