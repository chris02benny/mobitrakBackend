/**
 * LiveSession.js
 * MongoDB model for WebRTC live monitoring sessions.
 *
 * A LiveSession is created when a fleet manager activates live video monitoring
 * for a specific driver incident. Sessions are short-lived and track the WebRTC
 * connection lifecycle.
 *
 * Key Design Decisions:
 *   - Linked to an Incident document for audit trail.
 *   - Tracks connection state for cleanup on disconnect.
 *   - Records duration for analytics and billing.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const liveSessionSchema = new Schema(
    {
        /** The incident that triggered this session */
        incidentId: {
            type: Schema.Types.ObjectId,
            ref: 'Incident',
            required: true,
            index: true,
        },

        /** The driver being monitored */
        driverId: {
            type: String,
            required: true,
            index: true,
        },

        /** The fleet manager who initiated the session */
        managerId: {
            type: String,
            required: true,
            index: true,
        },

        /** Fleet manager's company ID */
        businessId: {
            type: String,
            required: true,
        },

        /** Session status */
        status: {
            type: String,
            enum: ['PENDING', 'CONNECTING', 'ACTIVE', 'ENDED', 'FAILED'],
            default: 'PENDING',
        },

        /** WebRTC connection metadata */
        connectionMeta: {
            adminSocketId: { type: String },
            driverSocketId: { type: String },
            iceConnectionState: { type: String },
        },

        /** When the session started (WebRTC connected) */
        startedAt: {
            type: Date,
        },

        /** When the session ended */
        endedAt: {
            type: Date,
        },

        /** Duration in seconds (computed on end) */
        durationSeconds: {
            type: Number,
            default: 0,
        },

        /** Reason for ending */
        endReason: {
            type: String,
            enum: ['MANAGER_ENDED', 'DRIVER_DISCONNECTED', 'TIMEOUT', 'INCIDENT_RESOLVED', 'ERROR'],
        },
    },
    {
        timestamps: true,
    }
);

// Active sessions per driver (prevent duplicate sessions)
liveSessionSchema.index({ driverId: 1, status: 1 });

// Analytics: session history per business
liveSessionSchema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.model('LiveSession', liveSessionSchema);
