const Employment = require('../models/Employment');
const driverEventEmitter = require('../config/eventEmitter');
const { asyncHandler, NotFoundError, ValidationError, ForbiddenError } = require('../middleware/errorHandler');
const axios = require('axios');
const NotificationClient = require('../services/notificationClient');

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
    const { status, position, assignmentStatus, page = 1, limit = 20 } = req.query;

    const query = { companyId };
    if (status) query.status = status;
    if (position) query.position = position;
    if (assignmentStatus) query.assignmentStatus = assignmentStatus;

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

            // Add driverDetails field for easier frontend access
            empObj.driverDetails = null;

            // Fetch user details from user-service
            if (empObj.driverId) {
                try {
                    const userDetails = await getUserById(empObj.driverId);

                    if (userDetails) {
                        // Add driverDetails for easier access
                        empObj.driverDetails = {
                            firstName: userDetails.firstName,
                            lastName: userDetails.lastName,
                            email: userDetails.email,
                            profileImage: userDetails.profileImage,
                            phone: userDetails.phone,
                            assignmentStatus: userDetails.assignmentStatus || 'UNASSIGNED'
                        };

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
                            companyName: userDetails.companyName,
                            assignmentStatus: userDetails.assignmentStatus || 'UNASSIGNED'
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

    // Get driver user details for notification
    const driverUser = await getUserById(employment.driverId);
    const driverName = driverUser ? `${driverUser.firstName || ''} ${driverUser.lastName || ''}`.trim() || 'Driver' : 'Driver';

    // Create notifications for both company and driver
    await NotificationClient.notifyContractTerminated(
        [companyId, employment.driverId],
        driverName,
        reason,
        employment._id
    );

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

/**
 * @desc    Update driver assignment status (UNASSIGNED/ASSIGNED)
 * @route   PATCH /api/employment/driver/:driverId/assignment-status
 * @access  Internal (service-to-service)
 */
const updateDriverAssignmentStatus = asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const { assignmentStatus } = req.body;

    // Validate assignment status
    if (!['UNASSIGNED', 'ASSIGNED'].includes(assignmentStatus)) {
        throw new ValidationError('Invalid assignment status. Must be UNASSIGNED or ASSIGNED');
    }

    // Find active employment for driver
    const employment = await Employment.findOne({
        driverId,
        status: 'ACTIVE'
    });

    if (!employment) {
        throw new NotFoundError('Active employment record for driver');
    }

    // Update assignment status
    employment.assignmentStatus = assignmentStatus;
    await employment.save();

    res.json({
        success: true,
        message: 'Driver assignment status updated successfully',
        data: {
            driverId,
            employmentId: employment._id,
            assignmentStatus: employment.assignmentStatus
        }
    });
});

/**
 * @desc    Get available drivers (not in active trips)
 * @route   GET /api/drivers/employments/available
 * @access  Company only
 */
const getAvailableDrivers = asyncHandler(async (req, res) => {
    const companyId = req.user.userId;
    const { startDateTime, endDateTime } = req.query;

    // Get all active employments for this company
    const employments = await Employment.find({
        companyId,
        status: 'ACTIVE'
    });

    // Fetch trip data from trip-service to check availability
    let busyDriverIds = [];
    try {
        const tripServiceUrl = process.env.TRIP_SERVICE_URL || 'http://trip-service:5004';
        const tripResponse = await axios.get(`${tripServiceUrl}/api/trips`, {
            headers: { 'x-user-id': companyId }
        });

        const activeTrips = tripResponse.data.trips || [];

        // Filter trips that are scheduled or in-progress
        const relevantTrips = activeTrips.filter(trip =>
            trip.status === 'scheduled' || trip.status === 'in-progress'
        );

        // If date range is provided, check for overlaps
        if (startDateTime && endDateTime) {
            const requestStart = new Date(startDateTime);
            const requestEnd = new Date(endDateTime);

            busyDriverIds = relevantTrips
                .filter(trip => {
                    if (!trip.driverId) return false;

                    const tripStart = new Date(trip.startDateTime);
                    const tripEnd = new Date(trip.endDateTime);

                    // Check if trips overlap
                    return (
                        (requestStart <= tripEnd && requestEnd >= tripStart) ||
                        (tripStart <= requestEnd && tripEnd >= requestStart)
                    );
                })
                .map(trip => trip.driverId.toString());
        } else {
            // No date range provided, just check if driver has any active trip
            busyDriverIds = relevantTrips
                .filter(trip => trip.driverId)
                .map(trip => trip.driverId.toString());
        }
    } catch (error) {
        console.error('Error fetching trip data:', error.message);
        // Continue without trip filtering if service is unavailable
    }

    // Fetch user details and filter out busy drivers
    const availableEmployments = await Promise.all(
        employments.map(async (employment) => {
            const empObj = employment.toObject();
            const driverIdStr = empObj.driverId.toString();

            // Skip drivers who are busy
            if (busyDriverIds.includes(driverIdStr)) {
                return null;
            }

            empObj.driverDetails = null;

            try {
                const userDetails = await getUserById(empObj.driverId);

                if (userDetails) {
                    empObj.driverDetails = {
                        firstName: userDetails.firstName,
                        lastName: userDetails.lastName,
                        email: userDetails.email,
                        profileImage: userDetails.profileImage,
                        phone: userDetails.phone,
                        assignmentStatus: userDetails.assignmentStatus || 'UNASSIGNED'
                    };

                    // Keep driverId as string ObjectId, not as nested object
                    // This is important for frontend to properly use it
                    empObj.driverId = empObj.driverId.toString();
                }
            } catch (error) {
                console.error('Error fetching user details:', error.message);
            }

            return empObj;
        })
    );

    // Filter out null entries (busy drivers)
    const filteredEmployments = availableEmployments.filter(emp => emp !== null);

    res.json({
        success: true,
        data: {
            employments: filteredEmployments,
            total: filteredEmployments.length
        }
    });
});

/**
 * @desc    Get assigned vehicle for driver
 * @route   GET /api/drivers/employments/my-vehicle
 * @access  Driver only
 */
const getMyAssignedVehicle = asyncHandler(async (req, res) => {
    const driverId = req.user.userId;

    // Find active employment for driver
    const employment = await Employment.findOne({
        driverId,
        status: 'ACTIVE'
    });

    if (!employment) {
        return res.json({
            success: true,
            data: null,
            message: 'No active employment found'
        });
    }

    // Check if vehicle is assigned
    if (!employment.assignedVehicle || !employment.assignedVehicle.vehicleId) {
        return res.json({
            success: true,
            data: null,
            message: 'No vehicle assigned'
        });
    }

    const vehicleId = employment.assignedVehicle.vehicleId;

    try {
        // Fetch vehicle details from vehicle-service
        const vehicleServiceUrl = process.env.VEHICLE_SERVICE_URL || 'http://localhost:5002';
        const vehicleResponse = await axios.get(
            `${vehicleServiceUrl}/api/vehicles/${vehicleId}`,
            {
                headers: {
                    'x-auth-token': req.headers['x-auth-token'],
                    'x-user-id': employment.companyId.toString() // Use company ID for vehicle access
                }
            }
        );

        const vehicle = vehicleResponse.data;

        // Fetch trips from trip-service for this vehicle
        let trips = [];
        try {
            const tripServiceUrl = process.env.TRIP_SERVICE_URL || 'http://localhost:5004';
            const tripResponse = await axios.get(
                `${tripServiceUrl}/api/trips?vehicleId=${vehicleId}`,
                {
                    headers: {
                        'x-user-id': employment.companyId.toString()
                    }
                }
            );

            // Filter trips for this driver and sort by start date (most recent first)
            trips = (tripResponse.data.trips || [])
                .filter(trip => trip.driverId && trip.driverId.toString() === driverId.toString())
                .sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime));
        } catch (tripError) {
            console.error('Error fetching trips:', tripError.message);
            // Continue without trips if service is unavailable
        }

        res.json({
            success: true,
            data: {
                vehicle: vehicle,
                assignment: {
                    assignedOn: employment.assignedVehicle.assignedOn,
                    notes: employment.assignedVehicle.notes
                },
                employment: {
                    position: employment.position,
                    startDate: employment.startDate,
                    companyId: employment.companyId
                },
                trips: trips,
                tripStats: {
                    total: trips.length,
                    scheduled: trips.filter(t => t.status === 'scheduled').length,
                    inProgress: trips.filter(t => t.status === 'in-progress').length,
                    completed: trips.filter(t => t.status === 'completed').length,
                    cancelled: trips.filter(t => t.status === 'cancelled').length
                }
            }
        });
    } catch (error) {
        console.error('Error fetching vehicle details:', error.message);
        throw new Error('Failed to fetch vehicle details');
    }
});

module.exports = {
    // createEmployment, // Disabled - use job request flow
    getEmploymentById,
    getCompanyEmployees,
    getDriverEmploymentHistory,
    getCurrentEmployment,
    updateEmployment,
    assignVehicle,
    unassignVehicle,
    terminateEmployment,
    resignFromEmployment,
    updateDriverAssignmentStatus,
    getAvailableDrivers,
    getMyAssignedVehicle
    // addEmploymentNote // Removed - not in simplified schema
};
