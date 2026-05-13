/**
 * incidentHandler.js
 * Modular Socket.IO handler for incident reporting and broadcasting.
 *
 * Handles the event-driven incident pipeline:
 *   1. Driver sends `incident:report` with detection metrics
 *   2. Handler computes severity from PERCLOS/EAR thresholds
 *   3. Incident is created in MongoDB
 *   4. `incident:new` is broadcast to the fleet manager's room
 *   5. Auto-escalation triggers for CRITICAL/EMERGENCY severity
 *
 * This replaces the monolithic `driver_monitoring` handler with a structured
 * incident management flow.
 */

const Incident = require('../../models/Incident');
const Alert = require('../../models/Alert');

// ── Severity Calculation ────────────────────────────────────────────────────

const SEVERITY_THRESHOLDS = {
    // PERCLOS thresholds (proportion of frames with eyes closed)
    PERCLOS_WARNING: 0.3,
    PERCLOS_CRITICAL: 0.5,
    PERCLOS_EMERGENCY: 0.7,
    // EAR thresholds (eye aspect ratio)
    EAR_WARNING: 0.22,
    EAR_CRITICAL: 0.15,
    EAR_EMERGENCY: 0.10,
};

/**
 * Compute incident severity from detection metrics.
 * @param {string} status - Detection status (DROWSY, NO_FACE, etc.)
 * @param {number} perclos - PERCLOS value (0–1)
 * @param {number} ear - Eye Aspect Ratio value
 * @returns {string} Severity level
 */
function computeSeverity(status, perclos = 0, ear = 0.3) {
    if (status === 'ALERT') return 'INFO';
    if (status === 'LOW_LIGHT' || status === 'NO_FACE') return 'WARNING';

    // DROWSY status — grade by metrics
    if (perclos >= SEVERITY_THRESHOLDS.PERCLOS_EMERGENCY ||
        ear <= SEVERITY_THRESHOLDS.EAR_EMERGENCY) {
        return 'EMERGENCY';
    }
    if (perclos >= SEVERITY_THRESHOLDS.PERCLOS_CRITICAL ||
        ear <= SEVERITY_THRESHOLDS.EAR_CRITICAL) {
        return 'CRITICAL';
    }
    if (perclos >= SEVERITY_THRESHOLDS.PERCLOS_WARNING ||
        ear <= SEVERITY_THRESHOLDS.EAR_WARNING) {
        return 'WARNING';
    }

    return 'INFO';
}

/**
 * Determine incident type from detection status.
 */
function getIncidentType(status) {
    switch (status) {
        case 'DROWSY': return 'DROWSINESS';
        case 'NO_FACE': return 'NO_FACE';
        case 'LOW_LIGHT': return 'LOW_LIGHT';
        case 'INACTIVE': return 'INACTIVITY';
        default: return 'DROWSINESS';
    }
}

// ── Deduplication ────────────────────────────────────────────────────────────
// Prevent duplicate incidents from rapid-fire detection events.
// Key: driverId → { lastCreated: timestamp, lastStatus: string }
const recentIncidents = new Map();
const DEDUP_WINDOW_MS = 30_000; // 30 seconds

/**
 * Register incident handler on a Socket.IO namespace.
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @param {import('socket.io').Socket} socket - Connected socket
 */
function registerIncidentHandler(io, socket) {
    /**
     * incident:report
     * Emitted by the driver when detection metrics cross thresholds.
     *
     * Payload: {
     *   driverId, businessId, status, perclos, ear,
     *   monitoringActive, source, timestamp, driverName,
     *   gpsLocation?: { lat, lng }
     * }
     */
    socket.on('incident:report', async (data) => {
        const {
            driverId,
            status,
            perclos = 0,
            ear = 0,
            monitoringActive,
            source,
            timestamp,
            driverName,
            gpsLocation,
        } = data;

        // Normalize businessId from whichever field name the driver sends
        const businessId = data.businessId || data.companyId || data.fleetManagerId;

        if (!driverId || !businessId) {
            console.warn('[incident] Missing driverId or businessId in incident:report. driverId:', driverId, 'businessId:', businessId);
            return;
        }

        try {
            // 1. Always store the raw alert (backward compatible with existing Alert model)
            await Alert.create({
                driverId,
                companyId: businessId,
                status,
                monitoringActive: monitoringActive !== undefined ? monitoringActive : true,
                source: source || 'frame-analysis',
                perclos: perclos || 0,
                ear: ear || 0,
                timestamp: timestamp ? new Date(timestamp) : new Date(),
            }).catch(err => console.error('[incident] Alert store error:', err.message));

            // 2. Broadcast to fleet manager room (real-time telemetry — always send)
            io.to(`fleet-${businessId}`).emit('new-alert', data);

            // 3. Only create an Incident document for actionable statuses
            const isActionable = ['DROWSY', 'NO_FACE', 'LOW_LIGHT'].includes(status);
            if (!isActionable) return;

            // 4. Deduplication: skip if same driver + same status within window
            const dedup = recentIncidents.get(driverId);
            if (dedup && dedup.lastStatus === status &&
                (Date.now() - dedup.lastCreated) < DEDUP_WINDOW_MS) {
                return; // Suppress duplicate
            }

            // 5. Compute severity
            const severity = computeSeverity(status, perclos, ear);

            // 6. Only create incidents for WARNING+ severity
            if (severity === 'INFO') return;

            // 7. Create Incident document
            const incident = await Incident.create({
                driverId,
                businessId,
                severity,
                type: getIncidentType(status),
                status: 'ACTIVE',
                metrics: { ear, perclos },
                gpsLocation: gpsLocation || {},
                driverName: driverName || 'Unknown Driver',
                timeline: [{
                    status: 'ACTIVE',
                    actor: 'system',
                    note: `Auto-generated from ${status} detection (PERCLOS: ${(perclos * 100).toFixed(1)}%, EAR: ${ear.toFixed(3)})`,
                }],
            });

            console.log(`[incident] ✅ Created incident ${incident._id} | severity=${severity} | driver=${driverId}`);

            // 8. Update dedup cache
            recentIncidents.set(driverId, {
                lastCreated: Date.now(),
                lastStatus: status,
            });

            // 9. Broadcast new incident to fleet manager
            io.to(`fleet-${businessId}`).emit('incident:new', {
                _id: incident._id,
                driverId: incident.driverId,
                businessId: incident.businessId,
                severity: incident.severity,
                type: incident.type,
                status: incident.status,
                metrics: incident.metrics,
                driverName: incident.driverName,
                gpsLocation: incident.gpsLocation,
                createdAt: incident.createdAt,
            });

            // 10. Auto-escalation for CRITICAL/EMERGENCY
            if (severity === 'CRITICAL' || severity === 'EMERGENCY') {
                io.to(`fleet-${businessId}`).emit('incident:auto_escalation', {
                    incidentId: incident._id,
                    driverId,
                    severity,
                    message: `⚠️ ${severity} incident detected — live monitoring recommended`,
                });
                console.log(`[incident] 🚨 Auto-escalation triggered for incident ${incident._id}`);
            }
        } catch (err) {
            console.error('[incident] Error processing incident:report:', err.message);
        }
    });
}

// Periodic cleanup of dedup cache (every 60s)
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of recentIncidents.entries()) {
        if (now - val.lastCreated > DEDUP_WINDOW_MS * 2) {
            recentIncidents.delete(key);
        }
    }
}, 60_000);

module.exports = { registerIncidentHandler, computeSeverity };
