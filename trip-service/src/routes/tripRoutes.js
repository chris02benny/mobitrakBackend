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

// Fleet manager only routes
router.use(fleetManagerOnly);

// CRUD operations
router.post('/', tripController.createTrip);
router.get('/', tripController.getTrips);
router.get('/:id', tripController.getTripById);
router.put('/:id', tripController.updateTrip);
router.delete('/:id', tripController.deleteTrip);

module.exports = router;
