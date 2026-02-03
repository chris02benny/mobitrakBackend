const express = require('express');
const router = express.Router();

const { authMiddleware, requireDriver, requireCompany } = require('../middleware/authMiddleware');
const { 
    terminateEmploymentValidation 
} = require('../middleware/validationMiddleware');
const {
    getEmploymentById,
    getCompanyEmployees,
    getDriverEmploymentHistory,
    getCurrentEmployment,
    terminateEmployment,
    resignFromEmployment
} = require('../controllers/employmentController');

/**
 * Employment Routes
 * 
 * Base path: /api/drivers/employments
 * 
 * Note: Employments are created automatically when drivers accept job requests
 */

// ===== Company-only routes =====

// Get company's employees
router.get('/company', authMiddleware, requireCompany, getCompanyEmployees);

// Terminate employment
router.post('/:employmentId/terminate', authMiddleware, requireCompany, terminateEmploymentValidation, terminateEmployment);


// ===== Driver-only routes =====

// Get driver's employment history
router.get('/history', authMiddleware, requireDriver, getDriverEmploymentHistory);

// Get driver's current employment
router.get('/current', authMiddleware, requireDriver, getCurrentEmployment);

// Driver resigns from employment
router.post('/:employmentId/resign', authMiddleware, requireDriver, resignFromEmployment);


// ===== Shared routes =====

// Get employment by ID
router.get('/:employmentId', authMiddleware, getEmploymentById);


module.exports = router;
