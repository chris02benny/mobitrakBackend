const express = require('express');
const router = express.Router();
const trackingDeviceController = require('../controllers/trackingDeviceController');
const auth = require('../middleware/authMiddleware');

// Route: POST /api/tracking-device/credentials
// Desc: Save or update live tracking device credentials for a vehicle
// Access: Private (Fleet Manager)
router.post('/credentials', auth, trackingDeviceController.saveDeviceCredentials);

// Route: GET /api/tracking-device/credentials/:vehicleId
// Desc: Get device credentials for a specific vehicle
// Access: Private (Fleet Manager)
router.get('/credentials/:vehicleId', auth, trackingDeviceController.getDeviceCredentials);

// Route: GET /api/tracking-device/credentials/:vehicleId/decrypt
// Desc: Get decrypted device credentials for live tracking
// Access: Private (Fleet Manager)
router.get('/credentials/:vehicleId/decrypt', auth, trackingDeviceController.getDecryptedCredentials);

// Route: DELETE /api/tracking-device/credentials/:vehicleId
// Desc: Delete device credentials for a specific vehicle
// Access: Private (Fleet Manager)
router.delete('/credentials/:vehicleId', auth, trackingDeviceController.deleteDeviceCredentials);

module.exports = router;
