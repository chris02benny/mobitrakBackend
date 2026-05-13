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

// ── Incident Queries ────────────────────────────────────────────────────────

/** GET /api/incidents — list incidents for a business */
router.get('/', incidentController.getIncidents);

/** GET /api/incidents/stats — incident statistics */
router.get('/stats', incidentController.getIncidentStats);

/** GET /api/incidents/:id — single incident detail */
router.get('/:id', incidentController.getIncidentById);

// ── Incident Lifecycle Actions ──────────────────────────────────────────────

/** POST /api/incidents/:id/acknowledge — mark as acknowledged */
router.post('/:id/acknowledge', incidentController.acknowledgeIncident);

/** POST /api/incidents/:id/resolve — mark as resolved */
router.post('/:id/resolve', incidentController.resolveIncident);

/** POST /api/incidents/:id/escalate — escalate to live monitoring */
router.post('/:id/escalate', incidentController.escalateIncident);

module.exports = router;
