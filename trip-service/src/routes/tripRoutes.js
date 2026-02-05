const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');
const { authMiddleware, fleetManagerOnly } = require('../middleware/authMiddleware');

// Public health check (no auth required)
router.get('/health', (req, res) => {
    res.json({ status: 'Trip routes OK' });
});

// All routes below require authentication
router.use(authMiddleware);

// Calculate route (for preview) - allow any authenticated user to test
router.post('/calculate-route', tripController.calculateRoute);

// Driver-specific routes (must be before fleetManagerOnly middleware)
router.get('/driver/assigned', tripController.getDriverAssignedTrips);
router.put('/driver/:id/start', tripController.startTrip);
router.put('/driver/:id/stops/:stopIndex', tripController.updateStopStatus);
router.put('/driver/:id/end', tripController.endTrip);

// Fleet manager only routes
router.use(fleetManagerOnly);

// CRUD operations
router.post('/', tripController.createTrip);
router.get('/', tripController.getTrips);
router.get('/:id', tripController.getTripById);
router.put('/:id', tripController.updateTrip);
router.delete('/:id', tripController.deleteTrip);

// Real-time location tracking
router.put('/:tripId/location', tripController.updateLocation);
router.get('/active/locations', tripController.getActiveTripsWithLocations);

module.exports = router;
