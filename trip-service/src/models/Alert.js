/**
 * Alert.js
 * MongoDB model for driver monitoring alerts.
 * 
 * Schema Design:
 *   - driverId:  the broadcasting driver's user ID
 *   - companyId: the hiring fleet manager's company ID (from employments collection)
 * 
 * This pairing lets any fleet manager poll only alerts from drivers they hired.
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

    /** Fleet manager's company ID (from employments collection) */
    companyId: {
      type: String,
      required: true,
      index: true
    },

    /**
     * Alert status:
     *   ALERT     – normal / eyes open
     *   DROWSY    – drowsiness detected
     *   INACTIVE  – monitoring turned off
     *   LOW_LIGHT – camera feed too dark for analysis
     *   NO_FACE   – face not detected in frame
     *   OFFLINE   – driver went offline (no heartbeat)
     */
    status: {
      type: String,
      required: true,
      enum: ['ALERT', 'DROWSY', 'INACTIVE', 'LOW_LIGHT', 'NO_FACE', 'OFFLINE'],
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

    /** Client-supplied or server timestamp */
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

// Compound index for efficient polling: fleet manager fetches latest alerts by companyId
alertSchema.index({ companyId: 1, timestamp: -1 });

module.exports = mongoose.model('Alert', alertSchema);
