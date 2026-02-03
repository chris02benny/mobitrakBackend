const DriverProfile = require('../models/DriverProfile');
const DriverRating = require('../models/DriverRating');
const driverEventEmitter = require('../config/eventEmitter');
const { asyncHandler, NotFoundError, ConflictError, ValidationError } = require('../middleware/errorHandler');

/**
 * Driver Profile Controller
 * 
 * Handles all driver profile management operations
 */

/**
 * @desc    Create driver profile
 * @route   POST /api/drivers/profile
 * @access  Driver only
 */
const createProfile = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    // Check if profile already exists
    const existingProfile = await DriverProfile.findOne({ userId });
    if (existingProfile) {
        throw new ConflictError('Driver profile already exists');
    }

    // Create profile
    const profileData = {
        userId,
        ...req.body
    };

    const profile = new DriverProfile(profileData);
    await profile.save();

    res.status(201).json({
        success: true,
        message: 'Driver profile created successfully',
        data: profile
    });
});

/**
 * @desc    Get own profile (for driver)
 * @route   GET /api/drivers/profile/me
 * @access  Driver only
 */
const getMyProfile = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    const profile = await DriverProfile.findOne({ userId });
    if (!profile) {
        throw new NotFoundError('Driver profile');
    }

    res.json({
        success: true,
        data: profile
    });
});

/**
 * @desc    Get driver profile by ID
 * @route   GET /api/drivers/profile/:driverId
 * @access  Authenticated
 */
const getProfileById = asyncHandler(async (req, res) => {
    const { driverId } = req.params;

    const profile = await DriverProfile.findOne({ 
        $or: [{ _id: driverId }, { userId: driverId }]
    });

    if (!profile) {
        throw new NotFoundError('Driver profile');
    }

    res.json({
        success: true,
        data: profile
    });
});

/**
 * @desc    Update driver profile
 * @route   PUT /api/drivers/profile
 * @access  Driver only
 */
const updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    const profile = await DriverProfile.findOne({ userId });
    if (!profile) {
        throw new NotFoundError('Driver profile');
    }

    // Fields that can be updated
    const allowedUpdates = [
        'professionalSummary',
        'licenseDetails',
        'experience',
        'skills',
        'certifications',
        'availability'
    ];

    const updates = {};
    const updatedFields = [];

    allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
            if (typeof req.body[field] === 'object' && !Array.isArray(req.body[field])) {
                // Merge nested objects
                updates[field] = { ...profile[field]?.toObject?.() || profile[field], ...req.body[field] };
            } else {
                updates[field] = req.body[field];
            }
            updatedFields.push(field);
        }
    });

    Object.assign(profile, updates);
    await profile.save();

    // Emit profile updated event
    if (updatedFields.length > 0) {
        driverEventEmitter.emitProfileUpdated({
            driverId: profile._id,
            updatedFields
        });
    }

    res.json({
        success: true,
        message: 'Profile updated successfully',
        data: profile
    });
});

/**
 * @desc    Update availability status
 * @route   PATCH /api/drivers/profile/availability
 * @access  Driver only
 */
const updateAvailability = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { status, preferredWorkType, availableFrom, willingToRelocate, expectedSalary, preferredLocations } = req.body;

    const profile = await DriverProfile.findOne({ userId });
    if (!profile) {
        throw new NotFoundError('Driver profile');
    }

    // Update availability fields
    if (status) profile.availability.status = status;
    if (preferredWorkType) profile.availability.preferredWorkType = preferredWorkType;
    if (availableFrom) profile.availability.availableFrom = availableFrom;
    if (willingToRelocate !== undefined) profile.availability.willingToRelocate = willingToRelocate;
    if (expectedSalary) profile.availability.expectedSalary = expectedSalary;
    if (preferredLocations) profile.availability.preferredLocations = preferredLocations;

    await profile.save();

    res.json({
        success: true,
        message: 'Availability updated successfully',
        data: {
            availability: profile.availability
        }
    });
});

/**
 * @desc    Add/Update skills
 * @route   PUT /api/drivers/profile/skills
 * @access  Driver only
 */
const updateSkills = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { skills } = req.body;

    if (!skills || !Array.isArray(skills)) {
        throw new ValidationError('Skills must be an array');
    }

    const profile = await DriverProfile.findOne({ userId });
    if (!profile) {
        throw new NotFoundError('Driver profile');
    }

    profile.skills = skills;
    await profile.save();

    res.json({
        success: true,
        message: 'Skills updated successfully',
        data: {
            skills: profile.skills
        }
    });
});

/**
 * @desc    Add certification
 * @route   POST /api/drivers/profile/certifications
 * @access  Driver only
 */
const addCertification = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const certification = req.body;

    const profile = await DriverProfile.findOne({ userId });
    if (!profile) {
        throw new NotFoundError('Driver profile');
    }

    profile.certifications.push(certification);
    await profile.save();

    res.status(201).json({
        success: true,
        message: 'Certification added successfully',
        data: {
            certifications: profile.certifications
        }
    });
});

/**
 * @desc    Remove certification
 * @route   DELETE /api/drivers/profile/certifications/:certId
 * @access  Driver only
 */
const removeCertification = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { certId } = req.params;

    const profile = await DriverProfile.findOne({ userId });
    if (!profile) {
        throw new NotFoundError('Driver profile');
    }

    profile.certifications = profile.certifications.filter(
        cert => cert._id.toString() !== certId
    );
    await profile.save();

    res.json({
        success: true,
        message: 'Certification removed successfully'
    });
});

/**
 * @desc    Search available drivers
 * @route   GET /api/drivers/search
 * @access  Company only
 */
const searchDrivers = asyncHandler(async (req, res) => {
    const {
        status = 'AVAILABLE',
        minExperience,
        maxExperience,
        minRating,
        licenseType,
        vehicleTypes,
        city,
        state,
        workType,
        page = 1,
        limit = 20,
        sortBy = 'ratings.averageRating',
        sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { isActive: true };

    if (status) {
        query['availability.status'] = status;
    }

    if (minExperience || maxExperience) {
        query['experience.totalYears'] = {};
        if (minExperience) query['experience.totalYears'].$gte = parseInt(minExperience);
        if (maxExperience) query['experience.totalYears'].$lte = parseInt(maxExperience);
    }

    if (minRating) {
        query['ratings.averageRating'] = { $gte: parseFloat(minRating) };
    }

    if (licenseType) {
        query['licenseDetails.licenseType'] = licenseType;
    }

    if (vehicleTypes) {
        const types = vehicleTypes.split(',');
        query['experience.vehicleTypesOperated'] = { $in: types };
    }

    if (city) {
        query['availability.preferredLocations.city'] = new RegExp(city, 'i');
    }

    if (state) {
        query['availability.preferredLocations.state'] = new RegExp(state, 'i');
    }

    if (workType) {
        query['availability.preferredWorkType'] = { $in: [workType, 'ANY'] };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [drivers, total] = await Promise.all([
        DriverProfile.find(query)
            .select('-__v')
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit)),
        DriverProfile.countDocuments(query)
    ]);

    res.json({
        success: true,
        data: {
            drivers,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                total,
                limit: parseInt(limit)
            }
        }
    });
});

/**
 * @desc    Get driver statistics
 * @route   GET /api/drivers/profile/:driverId/stats
 * @access  Authenticated
 */
const getDriverStats = asyncHandler(async (req, res) => {
    const { driverId } = req.params;

    const profile = await DriverProfile.findOne({
        $or: [{ _id: driverId }, { userId: driverId }]
    });

    if (!profile) {
        throw new NotFoundError('Driver profile');
    }

    // Get rating statistics
    const ratingStats = await DriverRating.calculateAggregateRatings(profile._id);

    res.json({
        success: true,
        data: {
            profile: {
                id: profile._id,
                userId: profile.userId,
                experience: profile.experience,
                availability: profile.availability,
                profileCompleteness: profile.profileCompleteness,
                isLicenseValid: profile.licenseDetails.expiryDate > new Date()
            },
            ratings: ratingStats
        }
    });
});

module.exports = {
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
};
