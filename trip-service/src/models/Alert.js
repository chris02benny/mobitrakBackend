/**
 * Alert.js
 * MongoDB model for driver monitoring alerts (Pusher replacement).
 * Supports write-on-every-update + polling fetch pattern.
 */

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    /** The monitored driver's user ID */
    driverId: {
      type: String,
      required: true,
      index: true
    },

    /** Fleet manager ID (who receives the alert) */
    fleetManagerId: {
      type: String,
      required: true,
      index: true
    },

    /**
     * Alert status: ALERT (normal), DROWSY (drowsy detected), INACTIVE (monitoring off)
     */
    status: {
      type: String,
      required: true,
      enum: ['ALERT', 'DROWSY', 'INACTIVE'],
      index: true
    },

    /** Whether live monitoring is active */
    monitoringActive: {
      type: Boolean,
      default: true
    },

    /** Source of the alert (frame-analysis, session-start, session-stop) */
    source: {
      type: String,
      default: 'frame-analysis'
    },

    /** PERCLOS value (0-1, proportion of frames with eyes closed) */
    perclos: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },

    /** Eye Aspect Ratio value */
    ear: {
      type: Number,
      min: 0,
      default: 0
    },

    /** For deduplication / idempotency (optional) */
    eventHash: {
      type: String,
      index: true
    },

    /** Client-supplied or server timestamp */
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

// Compound index for efficient polling queries
alertSchema.index({ fleetManagerId: 1, timestamp: -1 });

module.exports = mongoose.model('Alert', alertSchema);
