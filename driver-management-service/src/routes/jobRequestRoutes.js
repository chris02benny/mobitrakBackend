const express = require('express');
const router = express.Router();

const { authMiddleware, requireDriver, requireCompany } = require('../middleware/authMiddleware');
const { 
    createJobRequestValidation, 
    respondToJobRequestValidation 
} = require('../middleware/validationMiddleware');
const {
    getAvailableDrivers,
    createJobRequest,
    getReceivedJobRequests,
    getSentJobRequests,
    getJobRequestById,
    respondToJobRequest,
    withdrawJobRequest,
    finalizeHiring,
    scheduleInterview
} = require('../controllers/jobRequestController');

/**
 * Job Request Routes
 * 
 * Base path: /api/drivers/job-requests
 */

// ===== Company-only routes =====

// Get available drivers (unemployed with complete profile)
router.get('/available-drivers', authMiddleware, requireCompany, getAvailableDrivers);

// Create job request (company -> driver)
router.post('/', authMiddleware, requireCompany, createJobRequestValidation, createJobRequest);

// Get sent job requests
router.get('/sent', authMiddleware, requireCompany, getSentJobRequests);

// Withdraw job request
router.post('/:requestId/withdraw', authMiddleware, requireCompany, withdrawJobRequest);

// Finalize hiring (after driver accepts)
router.post('/:requestId/hire', authMiddleware, requireCompany, finalizeHiring);

// Schedule interview
router.post('/:requestId/schedule-interview', authMiddleware, requireCompany, scheduleInterview);


// ===== Driver-only routes =====

// Get received job requests
router.get('/received', authMiddleware, requireDriver, getReceivedJobRequests);

// Respond to job request (accept/reject/counter)
router.post('/:requestId/respond', authMiddleware, requireDriver, respondToJobRequestValidation, respondToJobRequest);


// ===== Shared routes =====

// Get job request by ID (both company and driver involved)
router.get('/:requestId', authMiddleware, getJobRequestById);


module.exports = router;
