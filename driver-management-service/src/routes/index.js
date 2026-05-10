const express = require('express');
const router = express.Router();

// const profileRoutes = require('./profileRoutes'); // Disabled - not using DriverProfile
const jobRequestRoutes = require('./jobRequestRoutes');
const employmentRoutes = require('./employmentRoutes');
const ratingRoutes = require('./ratingRoutes');

/**
 * Main Router - combines all routes
 * 
 * Base path: /api/drivers
 */

// Profile management routes - DISABLED (not using DriverProfile collection)
// router.use('/profile', profileRoutes);

// Job request/hiring workflow routes
router.use('/job-requests', jobRequestRoutes);

// Employment management routes
router.use('/employments', employmentRoutes);

// Rating routes
router.use('/ratings', ratingRoutes);

module.exports = router;
