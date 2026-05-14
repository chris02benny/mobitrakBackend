/**
 * incidentRoutes.js
 * REST API routes for incident management.
 *
 * These routes are mounted at /api/incidents in the trip-service app.
 * All routes require authentication (JWT token in x-auth-token header).
 */

const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const auth = require('../middleware/authMiddleware');

// ── Incident Queries ────────────────────────────────────────────────────────

/** GET /api/incidents — list incidents for a business */
router.get('/', auth, incidentController.getIncidents);

/** GET /api/incidents/stats — incident statistics */
router.get('/stats', auth, incidentController.getIncidentStats);

/** GET /api/incidents/:id — single incident detail */
router.get('/:id', auth, incidentController.getIncidentById);

// ── Incident Lifecycle Actions ──────────────────────────────────────────────

/** POST /api/incidents/:id/acknowledge — mark as acknowledged */
router.post('/:id/acknowledge', auth, incidentController.acknowledgeIncident);

/** POST /api/incidents/:id/resolve — mark as resolved */
router.post('/:id/resolve', auth, incidentController.resolveIncident);

/** POST /api/incidents/:id/escalate — escalate to live monitoring */
router.post('/:id/escalate', auth, incidentController.escalateIncident);

module.exports = router;
