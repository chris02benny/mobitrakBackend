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

        /**
         * Whether live monitoring was active at time of this event.
         * true = driver was actively monitoring; false = stopped or inactive.
         */
        monitoringActive: {
            type: Boolean,
            default: true,
            index: true
        },

        /**
         * Extended health status including environmental conditions.
         * DROWSY  = High PERCLOS (driver drowsy).
         * ALERT   = Normal state (eyes open, good light).
         * LOW_LIGHT = Ambient light insufficient for face detection.
         * NO_FACE = No face detected in frame (>2s).
         * INACTIVE = Driver explicitly stopped monitoring.
         * OFFLINE = Driver disconnected (timeout-driven, not in payload).
         */
        healthStatus: {
            type: String,
            enum: ['DROWSY', 'ALERT', 'LOW_LIGHT', 'NO_FACE', 'INACTIVE', 'OFFLINE'],
            default: 'ALERT',
            index: true
        },

        /**
         * Source of the telemetry event.
         * 'driver-monitoring' = from DriverMonitoring component.
         * 'session-start' = explicit monitoring session started.
         * 'session-stop' = explicit monitoring session stopped.
         */
        source: {
            type: String,
            enum: ['driver-monitoring', 'session-start', 'session-stop'],
            default: 'driver-monitoring'
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
