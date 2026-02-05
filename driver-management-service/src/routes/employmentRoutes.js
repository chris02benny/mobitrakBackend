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
    assignVehicle,
    unassignVehicle,
    terminateEmployment,
    resignFromEmployment,
    updateDriverAssignmentStatus,
    getAvailableDrivers,
    getMyAssignedVehicle
} = require('../controllers/employmentController');

/**
 * Employment Routes
 * 
 * Base path: /api/drivers/employments
 * 
 * Note: Employments are created automatically when drivers accept job requests
 */

// ===== Company-only routes =====

// Get available drivers (not in active trips)
router.get('/available', authMiddleware, requireCompany, getAvailableDrivers);

// Get company's employees
router.get('/company', authMiddleware, requireCompany, getCompanyEmployees);

// Assign vehicle to employee
router.post('/:employmentId/assign-vehicle', authMiddleware, requireCompany, assignVehicle);

// Unassign vehicle from employee
router.post('/:employmentId/unassign-vehicle', authMiddleware, requireCompany, unassignVehicle);

// Terminate employment
router.post('/:employmentId/terminate', authMiddleware, requireCompany, terminateEmploymentValidation, terminateEmployment);


// ===== Driver-only routes =====

// Get driver's assigned vehicle
router.get('/my-vehicle', authMiddleware, requireDriver, getMyAssignedVehicle);

// Get driver's employment history
router.get('/history', authMiddleware, requireDriver, getDriverEmploymentHistory);

// Get driver's current employment
router.get('/current', authMiddleware, requireDriver, getCurrentEmployment);

// Driver resigns from employment
router.post('/:employmentId/resign', authMiddleware, requireDriver, resignFromEmployment);


// ===== Shared routes =====

// Get employment by ID
router.get('/:employmentId', authMiddleware, getEmploymentById);


// ===== Internal routes (service-to-service) =====

// Update driver assignment status (UNASSIGNED/ASSIGNED)
router.patch('/driver/:driverId/assignment-status', updateDriverAssignmentStatus);


module.exports = router;
