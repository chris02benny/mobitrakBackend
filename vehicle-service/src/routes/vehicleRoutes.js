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

// Route: GET /api/vehicles
// Desc: Get all vehicles for logged in business
// Access: Private (Business)
router.get('/', auth, vehicleController.getVehicles);

module.exports = router;
