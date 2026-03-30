const express = require('express');
const router = express.Router();

const {
    authMiddleware,
    requireDriver,
    requireCompany,
} = require('../middleware/authMiddleware');

const leaveDocumentUpload = require('../middleware/leaveUploadMiddleware');

const {
    applyLeave,
    getDriverLeaves,
    getCompanyLeaves,
    updateLeaveStatus,
    cancelLeave,
} = require('../controllers/leaveController');

// ---- Driver routes ----

// Submit a leave application (optional sick document upload)
router.post(
    '/',
    authMiddleware,
    requireDriver,
    leaveDocumentUpload.single('document'),
    applyLeave
);

// Get all leaves for the authenticated driver
router.get('/my', authMiddleware, requireDriver, getDriverLeaves);

// Cancel a pending leave application
router.patch('/:leaveId/cancel', authMiddleware, requireDriver, cancelLeave);

// ---- Fleet Manager routes ----

// Get all leaves for the company
router.get('/company', authMiddleware, requireCompany, getCompanyLeaves);

// Approve or reject a leave
router.patch('/:leaveId/status', authMiddleware, requireCompany, updateLeaveStatus);

module.exports = router;
