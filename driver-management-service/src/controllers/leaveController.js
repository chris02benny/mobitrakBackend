const Leave = require('../models/Leave');
const Employment = require('../models/Employment');

/**
 * @desc   Apply for leave (Driver only)
 * @route  POST /api/drivers/leaves
 * @access Driver
 */
const applyLeave = async (req, res) => {
    try {
        const driverId = req.user.userId;
        const { startDate, endDate, type, reason } = req.body;

        // Validate required fields
        if (!startDate || !endDate || !type || !reason) {
            return res.status(400).json({
                success: false,
                message: 'startDate, endDate, type, and reason are required'
            });
        }

        if (!['REGULAR', 'SICK'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'type must be REGULAR or SICK'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        if (isNaN(start) || isNaN(end)) {
            return res.status(400).json({ success: false, message: 'Invalid date format' });
        }

        if (end < start) {
            return res.status(400).json({
                success: false,
                message: 'endDate must be on or after startDate'
            });
        }

        // Cannot apply leave in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (start < today) {
            return res.status(400).json({
                success: false,
                message: 'Cannot apply leave for past dates'
            });
        }

        // Resolve companyId from active employment
        const employment = await Employment.findOne({
            driverId,
            status: 'ACTIVE'
        });

        if (!employment) {
            return res.status(400).json({
                success: false,
                message: 'You must have an active employment to apply for leave'
            });
        }

        const companyId = employment.companyId;

        // Check for overlapping PENDING or APPROVED leaves
        const overlap = await Leave.findOne({
            driverId,
            status: { $in: ['PENDING', 'APPROVED'] },
            $or: [
                { startDate: { $lte: end }, endDate: { $gte: start } }
            ]
        });

        if (overlap) {
            return res.status(409).json({
                success: false,
                message: 'You already have a pending or approved leave that overlaps with these dates'
            });
        }

        // Handle optional document upload (Sick leave)
        let documentUrl = null;
        if (req.file) {
            documentUrl = req.file.path; // Cloudinary secure URL via multer-storage-cloudinary
        }

        const leave = await Leave.create({
            driverId,
            companyId,
            startDate: start,
            endDate: end,
            type,
            reason: reason.trim(),
            documentUrl,
            status: 'PENDING'
        });

        return res.status(201).json({
            success: true,
            message: 'Leave application submitted successfully',
            leave
        });
    } catch (error) {
        console.error('applyLeave error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to apply for leave'
        });
    }
};

/**
 * @desc   Get leaves for the authenticated driver
 * @route  GET /api/drivers/leaves/my
 * @access Driver
 */
const getDriverLeaves = async (req, res) => {
    try {
        const driverId = req.user.userId;

        const leaves = await Leave.find({ driverId })
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({ success: true, leaves });
    } catch (error) {
        console.error('getDriverLeaves error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch leaves'
        });
    }
};

/**
 * @desc   Get all leaves for the company (Fleet Manager)
 * @route  GET /api/drivers/leaves/company
 * @access Fleet Manager
 */
const getCompanyLeaves = async (req, res) => {
    try {
        const companyId = req.user.userId;
        const { status } = req.query;

        const filter = { companyId };
        if (status) filter.status = status;

        const leaves = await Leave.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({ success: true, leaves });
    } catch (error) {
        console.error('getCompanyLeaves error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch company leaves'
        });
    }
};

/**
 * @desc   Update leave status (Fleet Manager: approve/reject)
 * @route  PATCH /api/drivers/leaves/:leaveId/status
 * @access Fleet Manager
 */
const updateLeaveStatus = async (req, res) => {
    try {
        const { leaveId } = req.params;
        const { status, managerNote } = req.body;
        const reviewedBy = req.user.userId;

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'status must be APPROVED or REJECTED'
            });
        }

        const leave = await Leave.findById(leaveId);

        if (!leave) {
            return res.status(404).json({ success: false, message: 'Leave not found' });
        }

        // Only company that owns this leave can act on it
        if (leave.companyId.toString() !== reviewedBy) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (leave.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: `Leave is already ${leave.status.toLowerCase()}`
            });
        }

        leave.status = status;
        leave.managerNote = managerNote || null;
        leave.reviewedBy = reviewedBy;
        leave.reviewedAt = new Date();
        await leave.save();

        return res.status(200).json({
            success: true,
            message: `Leave ${status.toLowerCase()} successfully`,
            leave
        });
    } catch (error) {
        console.error('updateLeaveStatus error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update leave status'
        });
    }
};

/**
 * @desc   Cancel a leave application (Driver — only PENDING leaves)
 * @route  PATCH /api/drivers/leaves/:leaveId/cancel
 * @access Driver
 */
const cancelLeave = async (req, res) => {
    try {
        const driverId = req.user.userId;
        const { leaveId } = req.params;

        const leave = await Leave.findOne({ _id: leaveId, driverId });

        if (!leave) {
            return res.status(404).json({ success: false, message: 'Leave not found' });
        }

        if (leave.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel a leave that is already ${leave.status.toLowerCase()}`
            });
        }

        leave.status = 'CANCELLED';
        await leave.save();

        return res.status(200).json({
            success: true,
            message: 'Leave cancelled successfully',
            leave
        });
    } catch (error) {
        console.error('cancelLeave error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to cancel leave'
        });
    }
};

module.exports = {
    applyLeave,
    getDriverLeaves,
    getCompanyLeaves,
    updateLeaveStatus,
    cancelLeave
};
