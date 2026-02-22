const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const authMiddleware = require('../middleware/authMiddleware');
const uploadMaintenance = require('../middleware/maintenanceUploadMiddleware');

// All maintenance routes require authentication
router.use(authMiddleware);

// POST /api/maintenance/regular-service - Schedule a new regular service
router.post('/regular-service', maintenanceController.scheduleRegularService);

// GET /api/maintenance/regular-service - Get maintenance records
router.get('/regular-service', maintenanceController.getMaintenanceRecords);

// PATCH /api/maintenance/regular-service/:id/status - Update maintenance status (e.g. to IN_PROGRESS)
router.patch('/regular-service/:id/status', maintenanceController.updateMaintenanceStatus);

// PATCH /api/maintenance/regular-service/:id/complete - Complete maintenance with file upload
// The middleware handles files and uploads to Cloudinary folder mobitrak/maintenance/{vehicleId}/{maintenanceId}
router.patch('/regular-service/:id/complete', uploadMaintenance.array('bills', 5), maintenanceController.completeRegularService);

module.exports = router;
