/**
 * incidentController.js
 * Handles incident CRUD and lifecycle state transitions.
 *
 * All status transitions are validated against the state machine:
 *   ACTIVE → ACKNOWLEDGED → MONITORING → RESOLVED
 *   ACTIVE → ESCALATED
 *   ACKNOWLEDGED → RESOLVED
 *   MONITORING → RESOLVED
 *
 * Every transition is recorded in the incident timeline for audit.
 */

const Incident = require('../models/Incident');
const LiveSession = require('../models/LiveSession');

// Valid status transitions
const VALID_TRANSITIONS = {
    ACTIVE: ['ACKNOWLEDGED', 'ESCALATED', 'RESOLVED'],
    ACKNOWLEDGED: ['MONITORING', 'RESOLVED', 'ESCALATED'],
    MONITORING: ['RESOLVED'],
    ESCALATED: ['ACKNOWLEDGED', 'RESOLVED'],
    RESOLVED: [], // terminal state
};

/**
 * GET /api/incidents
 * Fetch incidents for a fleet manager's business.
 * Query params: businessId, status, severity, limit, skip
 */
exports.getIncidents = async (req, res) => {
    try {
        const { businessId, status, severity, limit = 50, skip = 0 } = req.query;

        if (!businessId) {
            return res.status(400).json({ error: 'businessId is required' });
        }

        const query = { businessId };
        if (status) {
            // Support comma-separated statuses: "ACTIVE,ACKNOWLEDGED"
            const statuses = status.split(',').map(s => s.trim());
            query.status = { $in: statuses };
        }
        if (severity) {
            const severities = severity.split(',').map(s => s.trim());
            query.severity = { $in: severities };
        }

        const [incidents, total] = await Promise.all([
            Incident.find(query)
                .sort({ createdAt: -1 })
                .limit(Number(limit))
                .skip(Number(skip))
                .lean(),
            Incident.countDocuments(query),
        ]);

        res.json({
            success: true,
            data: incidents,
            total,
            hasMore: Number(skip) + incidents.length < total,
        });
    } catch (err) {
        console.error('[incidents] getIncidents error:', err.message);
        res.status(500).json({ error: 'Failed to fetch incidents' });
    }
};

/**
 * GET /api/incidents/:id
 * Fetch a single incident by ID.
 */
exports.getIncidentById = async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id).lean();
        if (!incident) {
            return res.status(404).json({ error: 'Incident not found' });
        }
        res.json({ success: true, data: incident });
    } catch (err) {
        console.error('[incidents] getIncidentById error:', err.message);
        res.status(500).json({ error: 'Failed to fetch incident' });
    }
};

/**
 * POST /api/incidents/:id/acknowledge
 * Transition: ACTIVE → ACKNOWLEDGED
 */
exports.acknowledgeIncident = async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: 'Incident not found' });
        }

        if (!VALID_TRANSITIONS[incident.status]?.includes('ACKNOWLEDGED')) {
            return res.status(400).json({
                error: `Cannot acknowledge incident in ${incident.status} status`,
            });
        }

        const actor = req.body.actor || 'fleet_manager';
        incident.status = 'ACKNOWLEDGED';
        incident.timeline.push({
            status: 'ACKNOWLEDGED',
            actor,
            note: req.body.note || 'Incident acknowledged by fleet manager',
        });
        await incident.save();

        // Emit real-time update
        const io = req.app.get('io');
        if (io) {
            io.to(`fleet-${incident.businessId}`).emit('incident:status_update', {
                incidentId: incident._id,
                status: 'ACKNOWLEDGED',
                actor,
            });
        }

        res.json({ success: true, data: incident });
    } catch (err) {
        console.error('[incidents] acknowledgeIncident error:', err.message);
        res.status(500).json({ error: 'Failed to acknowledge incident' });
    }
};

/**
 * POST /api/incidents/:id/resolve
 * Transition: any non-RESOLVED → RESOLVED
 */
exports.resolveIncident = async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: 'Incident not found' });
        }

        if (incident.status === 'RESOLVED') {
            return res.status(400).json({ error: 'Incident is already resolved' });
        }

        const actor = req.body.actor || 'fleet_manager';
        incident.status = 'RESOLVED';
        incident.resolvedAt = new Date();
        incident.resolvedBy = actor;
        incident.liveSessionActive = false;
        incident.timeline.push({
            status: 'RESOLVED',
            actor,
            note: req.body.note || 'Incident resolved',
        });
        await incident.save();

        // End any active live sessions for this incident
        await LiveSession.updateMany(
            { incidentId: incident._id, status: { $in: ['PENDING', 'CONNECTING', 'ACTIVE'] } },
            { $set: { status: 'ENDED', endedAt: new Date(), endReason: 'INCIDENT_RESOLVED' } }
        );

        // Emit real-time update
        const io = req.app.get('io');
        if (io) {
            io.to(`fleet-${incident.businessId}`).emit('incident:status_update', {
                incidentId: incident._id,
                status: 'RESOLVED',
                actor,
            });
        }

        res.json({ success: true, data: incident });
    } catch (err) {
        console.error('[incidents] resolveIncident error:', err.message);
        res.status(500).json({ error: 'Failed to resolve incident' });
    }
};

/**
 * POST /api/incidents/:id/escalate
 * Transition: ACTIVE → ESCALATED
 * Also triggers live monitoring session creation.
 */
exports.escalateIncident = async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: 'Incident not found' });
        }

        if (!VALID_TRANSITIONS[incident.status]?.includes('ESCALATED')) {
            return res.status(400).json({
                error: `Cannot escalate incident in ${incident.status} status`,
            });
        }

        const actor = req.body.actor || 'fleet_manager';
        incident.status = 'ESCALATED';
        incident.timeline.push({
            status: 'ESCALATED',
            actor,
            note: req.body.note || 'Incident escalated — live monitoring requested',
        });
        await incident.save();

        // Emit real-time update
        const io = req.app.get('io');
        if (io) {
            io.to(`fleet-${incident.businessId}`).emit('incident:status_update', {
                incidentId: incident._id,
                status: 'ESCALATED',
                actor,
            });
        }

        res.json({ success: true, data: incident });
    } catch (err) {
        console.error('[incidents] escalateIncident error:', err.message);
        res.status(500).json({ error: 'Failed to escalate incident' });
    }
};

/**
 * GET /api/incidents/stats
 * Get incident statistics for a business.
 */
exports.getIncidentStats = async (req, res) => {
    try {
        const { businessId } = req.query;
        if (!businessId) {
            return res.status(400).json({ error: 'businessId is required' });
        }

        const [
            activeCount,
            acknowledgedCount,
            resolvedToday,
            criticalActive,
        ] = await Promise.all([
            Incident.countDocuments({ businessId, status: 'ACTIVE' }),
            Incident.countDocuments({ businessId, status: 'ACKNOWLEDGED' }),
            Incident.countDocuments({
                businessId,
                status: 'RESOLVED',
                resolvedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            }),
            Incident.countDocuments({
                businessId,
                status: { $in: ['ACTIVE', 'ESCALATED'] },
                severity: { $in: ['CRITICAL', 'EMERGENCY'] },
            }),
        ]);

        res.json({
            success: true,
            data: {
                active: activeCount,
                acknowledged: acknowledgedCount,
                resolvedToday,
                criticalActive,
            },
        });
    } catch (err) {
        console.error('[incidents] getIncidentStats error:', err.message);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
};
