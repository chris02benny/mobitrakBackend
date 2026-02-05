const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Route: POST /api/vehicles/extract-rc
// Desc: Extract details from RC Book
// Access: Private (Business)
router.post('/extract-rc', auth, upload.single('rcBook'), vehicleController.extractRC);

// Route: POST /api/vehicles
// Desc: Add a new vehicle (final save)
// Access: Private (Business)
router.post('/', auth, upload.fields([
    { name: 'rcBook', maxCount: 1 },
    { name: 'vehicleImages', maxCount: 5 }
]), vehicleController.createVehicle);

// Route: GET /api/vehicles/available
// Desc: Get available vehicles (not in active trips)
// Access: Private (Business)
router.get('/available', auth, vehicleController.getAvailableVehicles);

// Route: GET /api/vehicles
// Desc: Get all vehicles for logged in business
// Access: Private (Business)
router.get('/', auth, vehicleController.getVehicles);

// Route: GET /api/vehicles/:id
// Desc: Get a single vehicle by ID
// Access: Private
router.get('/:id', auth, vehicleController.getVehicleById);

// Route: PUT /api/vehicles/:id
// Desc: Update a vehicle
// Access: Private (Business)
router.put('/:id', auth, upload.fields([
    { name: 'rcBook', maxCount: 1 },
    { name: 'vehicleImages', maxCount: 5 }
]), vehicleController.updateVehicle);

// Route: DELETE /api/vehicles/:id
// Desc: Delete a vehicle
// Access: Private (Business)
router.delete('/:id', auth, vehicleController.deleteVehicle);

// Route: PATCH /api/vehicles/:id/status
// Desc: Update vehicle status (IDLE/ASSIGNED)
// Access: Internal (service-to-service)
router.patch('/:id/status', vehicleController.updateVehicleStatus);

module.exports = router;
