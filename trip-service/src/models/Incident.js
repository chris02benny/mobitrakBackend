/**
 * Incident.js
 * MongoDB model for driver incidents in the event-driven incident management system.
 *
 * An Incident represents a detected safety event (drowsiness, distraction, etc.)
 * that has crossed a severity threshold. It tracks the full lifecycle from creation
 * through acknowledgement, optional live monitoring, to resolution.
 *
 * Key Design Decisions:
 *   - `businessId` links to the fleet manager (from employments/companyId).
 *   - `timeline` is an append-only audit log of every status transition.
 *   - `severity` is computed from detection metrics at creation time.
 *   - Compound indexes optimize fleet manager dashboard queries.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const timelineEntrySchema = new Schema(
    {
        status: {
            type: String,
            required: true,
            enum: ['ACTIVE', 'ACKNOWLEDGED', 'MONITORING', 'RESOLVED', 'ESCALATED'],
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
        actor: {
            type: String,
            default: 'system',
        },
        note: {
            type: String,
            default: '',
        },
    },
    { _id: false }
);

const incidentSchema = new Schema(
    {
        /** The driver who triggered the incident */
        driverId: {
            type: String,
            required: true,
            index: true,
        },

        /** Fleet manager's company/user ID */
        businessId: {
            type: String,
            required: true,
            index: true,
        },

        /** Incident severity level */
        severity: {
            type: String,
            required: true,
            enum: ['INFO', 'WARNING', 'CRITICAL', 'EMERGENCY'],
            default: 'WARNING',
            index: true,
        },

        /** Type of incident detected */
        type: {
            type: String,
            required: true,
            enum: ['DROWSINESS', 'DISTRACTION', 'INACTIVITY', 'NO_FACE', 'LOW_LIGHT', 'MANUAL_ESCALATION'],
            default: 'DROWSINESS',
        },

        /** Current incident status (state machine) */
        status: {
            type: String,
            required: true,
            enum: ['ACTIVE', 'ACKNOWLEDGED', 'MONITORING', 'RESOLVED', 'ESCALATED'],
            default: 'ACTIVE',
            index: true,
        },

        /** Detection metrics at incident creation */
        metrics: {
            ear: { type: Number, default: 0 },
            perclos: { type: Number, default: 0 },
        },

        /** GPS location at time of incident (optional) */
        gpsLocation: {
            lat: { type: Number },
            lng: { type: Number },
        },

        /** Driver name snapshot (denormalized for fast display) */
        driverName: {
            type: String,
            default: 'Unknown Driver',
        },

        /** Append-only audit trail of status transitions */
        timeline: [timelineEntrySchema],

        /** Whether a live monitoring session is currently active for this incident */
        liveSessionActive: {
            type: Boolean,
            default: false,
        },

        /** Resolved at timestamp */
        resolvedAt: {
            type: Date,
        },

        /** Who resolved the incident */
        resolvedBy: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

// ── Indexes ────────────────────────────────────────────────────────────────────

// Fleet manager dashboard: active incidents sorted by most recent
incidentSchema.index({ businessId: 1, status: 1, createdAt: -1 });

// Driver incident history
incidentSchema.index({ driverId: 1, createdAt: -1 });

// Severity-based queries (for escalation logic)
incidentSchema.index({ severity: 1, status: 1 });

module.exports = mongoose.model('Incident', incidentSchema);
