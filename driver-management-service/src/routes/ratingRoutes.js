const express = require('express');
const router = express.Router();

const { authMiddleware, requireDriver, requireCompany } = require('../middleware/authMiddleware');
const { createRatingValidation } = require('../middleware/validationMiddleware');
const {
    createRating,
    getDriverRatings,
    getRatingById,
    updateRating,
    deleteRating,
    respondToRating,
    getCompanyGivenRatings,
    getMyRatings,
    voteHelpful
} = require('../controllers/ratingController');

/**
 * Rating Routes
 * 
 * Base path: /api/drivers/ratings
 */

// ===== Company-only routes =====

// Create rating for driver
router.post('/', authMiddleware, requireCompany, createRatingValidation, createRating);

// Get ratings given by company
router.get('/company', authMiddleware, requireCompany, getCompanyGivenRatings);

// Update rating
router.put('/:ratingId', authMiddleware, requireCompany, updateRating);

// Delete rating
router.delete('/:ratingId', authMiddleware, requireCompany, deleteRating);


// ===== Driver-only routes =====

// Get driver's own ratings
router.get('/my-ratings', authMiddleware, requireDriver, getMyRatings);

// Driver responds to rating
router.post('/:ratingId/respond', authMiddleware, requireDriver, respondToRating);


// ===== Public/Shared routes =====

// Get ratings for a driver (public)
router.get('/driver/:driverId', getDriverRatings);

// Get rating by ID
router.get('/:ratingId', authMiddleware, getRatingById);

// Vote rating as helpful
router.post('/:ratingId/helpful', authMiddleware, voteHelpful);


module.exports = router;
