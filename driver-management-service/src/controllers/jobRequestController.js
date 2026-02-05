const JobRequest = require('../models/JobRequest');
const Employment = require('../models/Employment');
const driverEventEmitter = require('../config/eventEmitter');
const { asyncHandler, NotFoundError, ValidationError, ForbiddenError, ConflictError } = require('../middleware/errorHandler');
const { sendHireRequestEmail, sendHireResponseEmail } = require('../services/emailService');
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
 * Job Request Controller
 * 
 * Handles hiring workflow operations
 */

/**
 * @desc    Get unemployed drivers with complete profiles
 * @route   GET /api/drivers/job-requests/available-drivers
 * @access  Company only
 */
const getAvailableDrivers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    // Fetch unemployed drivers from user-service
    try {
        const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:5001';
        const response = await axios.get(`${userServiceUrl}/api/users/drivers/available`, {
            params: { page, limit }
        });
        
        if (response.data.success && response.data.drivers) {
            // Transform the data to match frontend expectations
            const transformedDrivers = response.data.drivers.map(driver => ({
                _id: driver._id,
                userId: driver._id, // User ID from users collection
                userDetails: {
                    firstName: driver.firstName,
                    lastName: driver.lastName,
                    profileImage: driver.profileImage,
                    email: driver.email
                },
                licenseDetails: {
                    licenseNumber: driver.dlDetails?.licenseNumber,
                    licenseType: driver.dlDetails?.vehicleClasses,
                    issueDate: driver.dlDetails?.issueDate,
                    validUpto: driver.dlDetails?.validUpto,
                    address: driver.dlDetails?.address
                },
                experience: {
                    totalYears: 0, // Will be enhanced when DriverProfile is created
                    vehicleTypesOperated: driver.dlDetails?.vehicleClasses ? [driver.dlDetails.vehicleClasses] : []
                },
                ratings: {
                    averageRating: 0,
                    totalRatings: 0
                },
                availability: {
                    isAvailable: true,
                    preferredWorkType: 'FULL_TIME'
                },
                companyName: driver.companyName || 'Unemployed',
                isProfileComplete: driver.isProfileComplete,
                createdAt: driver.createdAt
            }));

            return res.json({
                success: true,
                data: {
                    drivers: transformedDrivers,
                    pagination: {
                        current: parseInt(page),
                        pages: Math.ceil(response.data.total / parseInt(limit)),
                        total: response.data.total
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error fetching drivers from user-service:', error.message);
        throw new Error('Failed to fetch available drivers');
    }

    res.json({
        success: true,
        data: {
            drivers: [],
            pagination: {
                current: parseInt(page),
                pages: 0,
                total: 0
            }
        }
    });
});

/**
 * @desc    Create job request (Company sends to driver)
 * @route   POST /api/drivers/job-requests
 * @access  Company only
 */
const createJobRequest = asyncHandler(async (req, res) => {
    const companyId = req.user.userId;
    const { driverId, jobDetails, offeredSalary, expiresAt } = req.body;

    // Check if driver exists in user-service
    const driverUser = await getUserById(driverId);
    if (!driverUser) {
        throw new NotFoundError('Driver');
    }
    
    if (driverUser.role !== 'driver') {
        throw new ValidationError('User is not a driver');
    }

    // Check if driver is unemployed (available for hiring)
    if (driverUser.companyName && driverUser.companyName !== 'Unemployed') {
        throw new ValidationError('Driver is currently employed');
    }

    // Check for existing pending request from same company
    const existingRequest = await JobRequest.findOne({
        companyId,
        driverId: driverId,
        status: { $in: ['PENDING', 'VIEWED'] }
    });

    if (existingRequest) {
        throw new ConflictError('A pending job request already exists for this driver');
    }

    // Create job request
    const jobRequest = new JobRequest({
        companyId,
        driverId: driverId,
        jobDetails,
        offeredSalary,
        expiresAt,
        statusHistory: [{
            status: 'PENDING',
            changedBy: companyId,
            changedAt: new Date()
        }]
    });

    await jobRequest.save();

    // Get company details for email notification
    const companyUser = await getUserById(companyId);

    // Send email notification to driver
    if (driverUser?.email) {
        const driverName = `${driverUser.firstName || ''} ${driverUser.lastName || ''}`.trim() || 'Driver';
        const companyName = companyUser?.companyName || 'A company';
        
        await sendHireRequestEmail(driverUser.email, driverName, companyName, {
            serviceType: jobDetails.serviceType,
            vehicleType: jobDetails.vehicleType,
            contractDuration: jobDetails.contractDuration,
            contractUnit: jobDetails.contractUnit,
            accommodation: jobDetails.accommodation,
            healthInsurance: jobDetails.healthInsurance,
            payAmount: offeredSalary?.amount,
            payFrequency: offeredSalary?.frequency,
            description: jobDetails.description
        });
    }

    // Emit event
    driverEventEmitter.emitJobRequestCreated({
        jobRequestId: jobRequest._id,
        driverId: driverId,
        companyId,
        serviceType: jobDetails.serviceType,
        offeredSalary: offeredSalary?.amount
    });

    res.status(201).json({
        success: true,
        message: 'Job request sent successfully',
        data: jobRequest
    });
});

/**
 * @desc    Get job requests for driver
 * @route   GET /api/drivers/job-requests/received
 * @access  Driver only
 */
const getReceivedJobRequests = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { status, page = 1, limit = 20 } = req.query;

    // Build query using userId directly
    const query = { driverId: userId };
    if (status) {
        query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
        JobRequest.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        JobRequest.countDocuments(query)
    ]);

    res.json({
        success: true,
        data: {
            requests,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                total
            }
        }
    });
});

/**
 * @desc    Get job requests sent by company
 * @route   GET /api/drivers/job-requests/sent
 * @access  Company only
 */
const getSentJobRequests = asyncHandler(async (req, res) => {
    const companyId = req.user.userId;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { companyId };
    if (status) {
        query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
        JobRequest.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        JobRequest.countDocuments(query)
    ]);

    console.log('Found requests:', requests.length);
    
    // Fetch user details for each request
    const requestsWithUserDetails = await Promise.all(
        requests.map(async (request) => {
            const reqObj = request.toObject();
            console.log('Processing request:', reqObj._id, 'driverId:', reqObj.driverId);
            
            // Fetch driver details from user-service
            if (reqObj.driverId) {
                try {
                    console.log('Fetching user details for driverId:', reqObj.driverId);
                    const userDetails = await getUserById(reqObj.driverId);
                    console.log('User details received:', userDetails ? `${userDetails.firstName} ${userDetails.lastName}` : 'null');
                    
                    if (userDetails) {
                        // Structure to match frontend expectations: driverId.userDetails
                        reqObj.driverId = {
                            _id: reqObj.driverId,
                            userId: reqObj.driverId,
                            userDetails: {
                                firstName: userDetails.firstName,
                                lastName: userDetails.lastName,
                                email: userDetails.email,
                                profileImage: userDetails.profileImage
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
                            companyName: userDetails.companyName || 'Unemployed'
                        };
                    }
                } catch (error) {
                    console.error('Error fetching user details:', error.message);
                }
            }
            
            return reqObj;
        })
    );

    res.json({
        success: true,
        data: {
            requests: requestsWithUserDetails,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                total
            }
        }
    });
});

/**
 * @desc    Get job request by ID
 * @route   GET /api/drivers/job-requests/:requestId
 * @access  Driver or Company (involved parties)
 */
const getJobRequestById = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const jobRequest = await JobRequest.findById(requestId);
    if (!jobRequest) {
        throw new NotFoundError('Job request');
    }

    // Verify access (must be the company or the driver)
    if (userRole === 'driver') {
        if (jobRequest.driverId.toString() !== userId) {
            throw new ForbiddenError('Access denied to this job request');
        }

        // Mark as viewed if first view by driver
        if (jobRequest.status === 'PENDING') {
            jobRequest.updateStatus('VIEWED', userId, 'Viewed by driver');
            await jobRequest.save();
        }
    } else if (jobRequest.companyId.toString() !== userId) {
        throw new ForbiddenError('Access denied to this job request');
    }

    res.json({
        success: true,
        data: jobRequest
    });
});

/**
 * @desc    Driver responds to job request (accept/reject/counter)
 * @route   POST /api/drivers/job-requests/:requestId/respond
 * @access  Driver only
 */
const respondToJobRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const userId = req.user.userId;
    const { action, message, counterOffer, rejection, dlConsentGiven } = req.body;

    // Get job request
    const jobRequest = await JobRequest.findById(requestId);
    if (!jobRequest) {
        throw new NotFoundError('Job request');
    }

    // Verify this is the driver's request
    if (jobRequest.driverId.toString() !== userId) {
        throw new ForbiddenError('This job request is not for you');
    }

    // Check if can be responded to
    if (!jobRequest.canBeModified()) {
        throw new ValidationError('This job request cannot be modified');
    }

    // Check expiry
    if (jobRequest.isExpired()) {
        jobRequest.status = 'EXPIRED';
        await jobRequest.save();
        throw new ValidationError('This job request has expired');
    }

    const previousStatus = jobRequest.status;
    let newStatus;
    let employment; // Declare outside switch for use in notifications

    switch (action) {
        case 'accept':
            // DL consent is required for acceptance
            if (dlConsentGiven !== true) {
                throw new ValidationError('You must consent to sharing your driving license to accept this offer');
            }

            newStatus = 'ACCEPTED';
            jobRequest.driverResponse = {
                respondedAt: new Date(),
                message,
                dlConsentGiven: true
            };
            
            // Auto-finalize hiring when driver accepts
            // Create employment record with job request details
            employment = new Employment({
                driverId: userId,
                companyId: jobRequest.companyId,
                sourceJobRequest: jobRequest._id,
                // Copy job details from job request
                serviceType: jobRequest.jobDetails.serviceType,
                vehicleType: jobRequest.jobDetails.vehicleType,
                contractDuration: jobRequest.jobDetails.contractDuration,
                contractUnit: jobRequest.jobDetails.contractUnit,
                accommodation: jobRequest.jobDetails.accommodation,
                healthInsurance: jobRequest.jobDetails.healthInsurance,
                description: jobRequest.jobDetails.description,
                // Copy salary from offered salary
                salary: {
                    amount: jobRequest.offeredSalary.amount,
                    currency: jobRequest.offeredSalary.currency,
                    frequency: jobRequest.offeredSalary.frequency
                },
                startDate: new Date(),
                status: 'ACTIVE'
            });
            await employment.save();

            // Update driver's user record with company name and set assignment status to UNASSIGNED
            try {
                const companyUser = await getUserById(jobRequest.companyId);
                if (companyUser && companyUser.companyName) {
                    // Update driver's user record with company name and assignment status
                    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:5001';
                    await axios.put(
                        `${userServiceUrl}/api/admin/users/${userId}/internal-update`,
                        { 
                            companyName: companyUser.companyName,
                            assignmentStatus: 'UNASSIGNED'
                        },
                        {
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    console.log(`Updated driver ${userId} with company name: ${companyUser.companyName} and status: UNASSIGNED`);
                }
            } catch (error) {
                console.error('Error updating driver company name and status:', error.message);
                // Don't fail the acceptance if company name update fails
            }

            // Update job request with employment reference
            jobRequest.resultingEmployment = employment._id;
            newStatus = 'HIRED';
            break;

        case 'reject':
            newStatus = 'REJECTED';
            jobRequest.driverResponse = {
                respondedAt: new Date(),
                message
            };
            jobRequest.rejection = {
                ...rejection,
                rejectedBy: 'DRIVER'
            };
            break;

        case 'counter':
            if (!counterOffer) {
                throw new ValidationError('Counter offer details required');
            }
            newStatus = 'VIEWED'; // Keep as viewed with counter
            jobRequest.driverResponse = {
                respondedAt: new Date(),
                message,
                counterOffer
            };
            break;

        default:
            throw new ValidationError('Invalid action');
    }

    jobRequest.updateStatus(newStatus, userId, `Driver ${action}ed`);
    await jobRequest.save();

    // Send email notification to fleet manager
    const [driverUser, companyUser] = await Promise.all([
        getUserById(userId),
        getUserById(jobRequest.companyId)
    ]);

    const driverName = `${driverUser?.firstName || ''} ${driverUser?.lastName || ''}`.trim() || 'Driver';

    if (companyUser?.email) {
        const companyName = companyUser?.companyName || 'Your Company';
        const rejectionReason = action === 'reject' ? (message || rejection?.details || '') : '';
        
        await sendHireResponseEmail(
            companyUser.email,
            companyName,
            driverName,
            newStatus === 'HIRED' ? 'ACCEPTED' : newStatus,
            rejectionReason
        );
    }

    // Create notification for company
    if (action === 'accept') {
        await NotificationClient.notifyHireRequestAccepted(
            jobRequest.companyId,
            userId,
            driverName,
            jobRequest._id
        );
        
        // Also create driver hired notification
        await NotificationClient.notifyDriverHired(
            jobRequest.companyId,
            userId,
            driverName,
            employment._id
        );
    } else if (action === 'reject') {
        await NotificationClient.notifyHireRequestRejected(
            jobRequest.companyId,
            userId,
            driverName,
            jobRequest._id,
            message || rejection?.details
        );
    }

    // Emit event
    driverEventEmitter.emitJobRequestStatusChanged({
        jobRequestId: jobRequest._id,
        driverId: userId,
        companyId: jobRequest.companyId,
        previousStatus,
        newStatus
    });

    res.json({
        success: true,
        message: `Job request ${action}ed successfully`,
        data: jobRequest
    });
});

/**
 * @desc    Company withdraws job request
 * @route   POST /api/drivers/job-requests/:requestId/withdraw
 * @access  Company only
 */
const withdrawJobRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const companyId = req.user.userId;
    const { reason } = req.body;

    const jobRequest = await JobRequest.findById(requestId);
    if (!jobRequest) {
        throw new NotFoundError('Job request');
    }

    // Verify company owns this request
    if (jobRequest.companyId.toString() !== companyId) {
        throw new ForbiddenError('This job request does not belong to you');
    }

    // Check if can be withdrawn
    if (!['PENDING', 'VIEWED'].includes(jobRequest.status)) {
        throw new ValidationError('This job request cannot be withdrawn');
    }

    const previousStatus = jobRequest.status;
    jobRequest.updateStatus('WITHDRAWN', companyId, reason || 'Withdrawn by company');
    await jobRequest.save();

    // Emit event
    driverEventEmitter.emitJobRequestStatusChanged({
        jobRequestId: jobRequest._id,
        driverId: jobRequest.driverId,
        companyId,
        previousStatus,
        newStatus: 'WITHDRAWN'
    });

    res.json({
        success: true,
        message: 'Job request withdrawn successfully'
    });
});

/**
 * @desc    Company finalizes hiring (after acceptance)
 * @route   POST /api/drivers/job-requests/:requestId/hire
 * @access  Company only
 */
const finalizeHiring = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const companyId = req.user.userId;
    const { startDate, salary, vehicleId, schedule, notes } = req.body;

    const jobRequest = await JobRequest.findById(requestId);
    if (!jobRequest) {
        throw new NotFoundError('Job request');
    }

    // Verify company owns this request
    if (jobRequest.companyId.toString() !== companyId) {
        throw new ForbiddenError('This job request does not belong to you');
    }

    // Check if accepted
    if (jobRequest.status !== 'ACCEPTED') {
        throw new ValidationError('Job request must be accepted before hiring');
    }

    // Get driver profile
    const driverProfile = await DriverProfile.findById(jobRequest.driverId);
    if (!driverProfile) {
        throw new NotFoundError('Driver profile');
    }

    // Create employment record
    const employment = new Employment({
        driverId: driverProfile._id,
        companyId,
        position: jobRequest.jobDetails.position,
        employmentType: jobRequest.jobDetails.employmentType,
        startDate: startDate || jobRequest.proposedStartDate || new Date(),
        salary: salary || jobRequest.offeredSalary,
        schedule,
        sourceJobRequest: jobRequest._id,
        notes: notes ? [{ content: notes, addedBy: companyId }] : []
    });

    // Assign vehicle if provided
    if (vehicleId) {
        employment.assignVehicle(vehicleId, 'Initial assignment upon hiring');
    }

    await employment.save();

    // Update job request
    jobRequest.updateStatus('HIRED', companyId, 'Hiring finalized');
    jobRequest.resultingEmployment = employment._id;
    await jobRequest.save();

    // Update driver profile
    driverProfile.availability.status = 'EMPLOYED';
    driverProfile.currentEmployment = {
        companyId,
        employmentId: employment._id,
        assignedVehicleId: vehicleId
    };
    await driverProfile.save();

    // Emit DRIVER_HIRED event
    driverEventEmitter.emitDriverHired({
        driverId: driverProfile._id,
        companyId,
        employmentId: employment._id,
        assignedVehicleId: vehicleId,
        hiredAt: employment.startDate,
        position: employment.position
    });

    res.status(201).json({
        success: true,
        message: 'Driver hired successfully',
        data: {
            employment,
            jobRequest
        }
    });
});

/**
 * @desc    Schedule interview for job request
 * @route   POST /api/drivers/job-requests/:requestId/schedule-interview
 * @access  Company only
 */
const scheduleInterview = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const companyId = req.user.userId;
    const { scheduledAt, location, mode, notes } = req.body;

    const jobRequest = await JobRequest.findById(requestId);
    if (!jobRequest) {
        throw new NotFoundError('Job request');
    }

    if (jobRequest.companyId.toString() !== companyId) {
        throw new ForbiddenError('This job request does not belong to you');
    }

    if (!['PENDING', 'VIEWED'].includes(jobRequest.status)) {
        throw new ValidationError('Cannot schedule interview for this request status');
    }

    jobRequest.interview = {
        isScheduled: true,
        scheduledAt: new Date(scheduledAt),
        location,
        mode: mode || 'IN_PERSON',
        notes,
        outcome: 'PENDING'
    };

    await jobRequest.save();

    res.json({
        success: true,
        message: 'Interview scheduled successfully',
        data: jobRequest.interview
    });
});

module.exports = {
    getAvailableDrivers,
    createJobRequest,
    getReceivedJobRequests,
    getSentJobRequests,
    getJobRequestById,
    respondToJobRequest,
    withdrawJobRequest,
    finalizeHiring,
    scheduleInterview
};
