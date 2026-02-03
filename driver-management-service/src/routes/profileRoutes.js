const express = require('express');
const router = express.Router();

const { authMiddleware, requireDriver, requireCompany, requireDriverOrCompany } = require('../middleware/authMiddleware');
const { 
    createProfileValidation, 
    updateProfileValidation, 
    searchDriversValidation 
} = require('../middleware/validationMiddleware');
const {
    createProfile,
    getMyProfile,
    getProfileById,
    updateProfile,
    updateAvailability,
    updateSkills,
    addCertification,
    removeCertification,
    searchDrivers,
    getDriverStats
} = require('../controllers/profileController');

/**
 * Driver Profile Routes
 * 
 * Base path: /api/drivers/profile
 */

// ===== Driver-only routes =====

// Create own profile
router.post('/', authMiddleware, requireDriver, createProfileValidation, createProfile);

// Get own profile
router.get('/me', authMiddleware, requireDriver, getMyProfile);

// Update own profile
router.put('/', authMiddleware, requireDriver, updateProfileValidation, updateProfile);

// Update availability status
router.patch('/availability', authMiddleware, requireDriver, updateAvailability);

// Update skills
router.put('/skills', authMiddleware, requireDriver, updateSkills);

// Add certification
router.post('/certifications', authMiddleware, requireDriver, addCertification);

// Remove certification
router.delete('/certifications/:certId', authMiddleware, requireDriver, removeCertification);


// ===== Company-only routes =====

// Search available drivers
router.get('/search', authMiddleware, requireCompany, searchDriversValidation, searchDrivers);


// ===== Shared routes (both driver and company) =====

// Get driver profile by ID
router.get('/:driverId', authMiddleware, requireDriverOrCompany, getProfileById);

// Get driver statistics
router.get('/:driverId/stats', authMiddleware, requireDriverOrCompany, getDriverStats);


module.exports = router;
