const Employment = require('../models/Employment');
const driverEventEmitter = require('../config/eventEmitter');
const { asyncHandler, NotFoundError, ValidationError, ForbiddenError } = require('../middleware/errorHandler');
const axios = require('axios');

// Helper to get user details from user-service
const getUserById = async (userId) => {
    try {
        const response = await axios.get(`${process.env.USER_SERVICE_URL || 'http://localhost:5001'}/api/users/${userId}`);
        return response.data.user;
    } catch (error) {
        console.error('Error fetching user:', error.message);
        return null;
    }
};

/**
 * Employment Controller
 * 
 * Handles employment management operations
 * Note: Employments are created automatically when drivers accept job requests
 */

// /**
//  * @desc    Create employment directly (without job request)
//  * @route   POST /api/drivers/employments
//  * @access  Company only
//  * @deprecated Employments should only be created through job request acceptance
//  */
// const createEmployment = asyncHandler(async (req, res) => {
//     ... disabled - use job request flow instead
// });

/**
 * @desc    Get employment by ID
 * @route   GET /api/drivers/employments/:employmentId
 * @access  Company or Driver (involved)
 */
const getEmploymentById = asyncHandler(async (req, res) => {
    const { employmentId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const employment = await Employment.findById(employmentId);
    if (!employment) {
        throw new NotFoundError('Employment record');
    }

    // Verify access
    if (userRole === 'driver') {
        if (employment.driverId.toString() !== userId) {
            throw new ForbiddenError('Access denied');
        }
    } else if (employment.companyId.toString() !== userId) {
        throw new ForbiddenError('Access denied');
    }

    res.json({
        success: true,
        data: employment
    });
});

/**
 * @desc    Get company's employees
 * @route   GET /api/drivers/employments/company
 * @access  Company only
 */
const getCompanyEmployees = asyncHandler(async (req, res) => {
    const companyId = req.user.userId;
    const { status, position, page = 1, limit = 20 } = req.query;

    const query = { companyId };
    if (status) query.status = status;
    if (position) query.position = position;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [employments, total] = await Promise.all([
        Employment.find(query)
            .sort({ startDate: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        Employment.countDocuments(query)
    ]);

    // Fetch user details for each employment
    const employmentsWithUserDetails = await Promise.all(
        employments.map(async (employment) => {
            const empObj = employment.toObject();
            
            // Fetch user details from user-service
            if (empObj.driverId) {
                try {
                    const userDetails = await getUserById(empObj.driverId);
                    
                    if (userDetails) {
                        // Structure to match frontend expectations: driverId.userDetails
                        empObj.driverId = {
                            _id: empObj.driverId,
                            userId: empObj.driverId,
                            userDetails: {
                                firstName: userDetails.firstName,
                                lastName: userDetails.lastName,
                                email: userDetails.email,
                                profileImage: userDetails.profileImage,
                                phone: userDetails.phone
                            },
                            licenseDetails: {
                                licenseNumber: userDetails.dlDetails?.licenseNumber || 'N/A',
                                licenseType: userDetails.dlDetails?.vehicleClasses,
                                issueDate: userDetails.dlDetails?.issueDate,
                                validUpto: userDetails.dlDetails?.validUpto,
                                address: userDetails.dlDetails?.address
                            },
                            dlFrontUrl: userDetails.dlDetails?.dlFrontUrl,
                            dlBackUrl: userDetails.dlDetails?.dlBackUrl,
                            companyName: userDetails.companyName
                        };
                    }
                } catch (error) {
                    console.error('Error fetching user details:', error.message);
                }
            }
            
            return empObj;
        })
    );

    res.json({
        success: true,
        data: {
            employments: employmentsWithUserDetails,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                total
            }
        }
    });
});

/**
 * @desc    Get driver's employment history
 * @route   GET /api/drivers/employments/history
 * @access  Driver only
 */
const getDriverEmploymentHistory = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    const employments = await Employment.getDriverHistory(userId);

    res.json({
        success: true,
        data: employments
    });
});

/**
 * @desc    Get driver's current employment
 * @route   GET /api/drivers/employments/current
 * @access  Driver only
 */
const getCurrentEmployment = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    const employment = await Employment.findOne({
        driverId: userId,
        status: 'ACTIVE'
    });

    if (!employment) {
        return res.json({
            success: true,
            data: null,
            message: 'No active employment'
        });
    }

    res.json({
        success: true,
        data: employment
    });
});

/**
 * @desc    Update employment details
 * @route   PUT /api/drivers/employments/:employmentId
 * @access  Company only
 */
const updateEmployment = asyncHandler(async (req, res) => {
    const { employmentId } = req.params;
    const companyId = req.user.userId;
    const { position, salary, schedule, status } = req.body;

    const employment = await Employment.findById(employmentId);
    if (!employment) {
        throw new NotFoundError('Employment record');
    }

    if (employment.companyId.toString() !== companyId) {
        throw new ForbiddenError('Access denied');
    }

    if (employment.status !== 'ACTIVE') {
        throw new ValidationError('Cannot update inactive employment');
    }

    // Update allowed fields
    if (position) employment.position = position;
    if (salary) employment.salary = salary;
    if (schedule) employment.schedule = schedule;
    if (status && ['ACTIVE', 'ON_LEAVE', 'SUSPENDED'].includes(status)) {
        employment.status = status;
    }

    await employment.save();

    res.json({
        success: true,
        message: 'Employment updated successfully',
        data: employment
    });
});

/**
 * @desc    Assign vehicle to employee
 * @route   POST /api/drivers/employments/:employmentId/assign-vehicle
 * @access  Company only
 */
const assignVehicle = asyncHandler(async (req, res) => {
    const { employmentId } = req.params;
    const companyId = req.user.userId;
    const { vehicleId, notes } = req.body;

    const employment = await Employment.findById(employmentId);
    if (!employment) {
        throw new NotFoundError('Employment record');
    }

    if (employment.companyId.toString() !== companyId) {
        throw new ForbiddenError('Access denied');
    }

    if (employment.status !== 'ACTIVE') {
        throw new ValidationError('Cannot assign vehicle to inactive employment');
    }

    employment.assignVehicle(vehicleId, notes);
    await employment.save();

    res.json({
        success: true,
        message: 'Vehicle assigned successfully',
        data: {
            assignedVehicle: employment.assignedVehicle,
            vehicleAssignmentHistory: employment.vehicleAssignmentHistory
        }
    });
});

/**
 * @desc    Unassign vehicle from employee
 * @route   POST /api/drivers/employments/:employmentId/unassign-vehicle
 * @access  Company only
 */
const unassignVehicle = asyncHandler(async (req, res) => {
    const { employmentId } = req.params;
    const companyId = req.user.userId;
    const { reason } = req.body;

    const employment = await Employment.findById(employmentId);
    if (!employment) {
        throw new NotFoundError('Employment record');
    }

    if (employment.companyId.toString() !== companyId) {
        throw new ForbiddenError('Access denied');
    }

    employment.unassignVehicle(reason);
    await employment.save();

    res.json({
        success: true,
        message: 'Vehicle unassigned successfully'
    });
});

/**
 * @desc    Terminate employment
 * @route   POST /api/drivers/employments/:employmentId/terminate
 * @access  Company only
 */
const terminateEmployment = asyncHandler(async (req, res) => {
    const { employmentId } = req.params;
    const companyId = req.user.userId;
    const { reason, details, rating } = req.body;

    const employment = await Employment.findById(employmentId);
    if (!employment) {
        throw new NotFoundError('Employment record');
    }

    if (employment.companyId.toString() !== companyId) {
        throw new ForbiddenError('Access denied');
    }

    if (!['ACTIVE'].includes(employment.status)) {
        throw new ValidationError('Employment is already terminated');
    }

    // Set termination details
    employment.status = 'TERMINATED';
    employment.endDate = new Date();
    employment.termination = {
        reason,
        details,
        initiatedBy: 'COMPANY',
        terminatedAt: new Date(),
        rating: rating || null
    };

    await employment.save();

    // Update driver's user record to set company name back to 'Unemployed'
    try {
        const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:5001';
        await axios.put(
            `${userServiceUrl}/api/admin/users/${employment.driverId}/internal-update`,
            { companyName: 'Unemployed' },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`Updated driver ${employment.driverId} companyName to Unemployed`);
    } catch (error) {
        console.error('Error updating driver company name:', error.message);
    }

    // Emit DRIVER_RELEASED event
    driverEventEmitter.emitDriverReleased({
        driverId: employment.driverId,
        companyId,
        employmentId: employment._id,
        releasedAt: employment.endDate,
        reason,
        rating
    });

    res.json({
        success: true,
        message: 'Employment terminated successfully',
        data: employment
    });
});

/**
 * @desc    Driver resigns from employment
 * @route   POST /api/drivers/employments/:employmentId/resign
 * @access  Driver only
 */
const resignFromEmployment = asyncHandler(async (req, res) => {
    const { employmentId } = req.params;
    const userId = req.user.userId;
    const { reason, details, lastWorkingDay, noticePeriodDays } = req.body;

    const employment = await Employment.findById(employmentId);
    if (!employment) {
        throw new NotFoundError('Employment record');
    }

    if (employment.driverId.toString() !== userId) {
        throw new ForbiddenError('This is not your employment');
    }

    if (!['ACTIVE'].includes(employment.status)) {
        throw new ValidationError('Cannot resign from this employment');
    }

    // Set resignation details
    employment.status = 'RESIGNED';
    employment.endDate = new Date();
    employment.termination = {
        reason: reason || 'RESIGNATION',
        details,
        initiatedBy: 'DRIVER',
        terminatedAt: new Date()
    };

    await employment.save();

    // Update driver's user record to set company name back to 'Unemployed'
    try {
        const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:5001';
        await axios.put(
            `${userServiceUrl}/api/admin/users/${userId}/internal-update`,
            { companyName: 'Unemployed' },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    } catch (error) {
        console.error('Error updating driver company name:', error.message);
    }

    // Emit DRIVER_RELEASED event
    driverEventEmitter.emitDriverReleased({
        driverId: userId,
        companyId: employment.companyId,
        employmentId: employment._id,
        releasedAt: employment.endDate,
        reason: 'RESIGNATION'
    });

    res.json({
        success: true,
        message: 'Resignation submitted successfully',
        data: employment
    });
});

/**
 * @desc    Add note to employment
 * @route   POST /api/drivers/employments/:employmentId/notes
 * @access  Company only
 */
const addEmploymentNote = asyncHandler(async (req, res) => {
    const { employmentId } = req.params;
    const companyId = req.user.userId;
    const { content } = req.body;

    const employment = await Employment.findById(employmentId);
    if (!employment) {
        throw new NotFoundError('Employment record');
    }

    if (employment.companyId.toString() !== companyId) {
        throw new ForbiddenError('Access denied');
    }

    employment.notes.push({
        content,
        addedBy: companyId,
        addedAt: new Date()
    });

    await employment.save();

    res.json({
        success: true,
        message: 'Note added successfully',
        data: employment.notes
    });
});

module.exports = {
    // createEmployment, // Disabled - use job request flow
    getEmploymentById,
    getCompanyEmployees,
    getDriverEmploymentHistory,
    getCurrentEmployment,
    // updateEmployment, // Disabled - employments are immutable
    // assignVehicle, // Removed - not in simplified schema
    // unassignVehicle, // Removed - not in simplified schema
    terminateEmployment,
    resignFromEmployment
    // addEmploymentNote // Removed - not in simplified schema
};
