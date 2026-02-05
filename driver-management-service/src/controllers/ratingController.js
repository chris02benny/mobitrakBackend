const DriverRating = require('../models/DriverRating');
const DriverProfile = require('../models/DriverProfile');
const Employment = require('../models/Employment');
const driverEventEmitter = require('../config/eventEmitter');
const { asyncHandler, NotFoundError, ValidationError, ForbiddenError, ConflictError } = require('../middleware/errorHandler');

/**
 * Rating Controller
 * 
 * Handles driver ratings and reviews
 */

/**
 * @desc    Create rating for driver
 * @route   POST /api/drivers/ratings
 * @access  Company only
 */
const createRating = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { 
        driverId, 
        employmentId, 
        overallRating, 
        categoryRatings, 
        review, 
        tags, 
        wouldRehire,
        context 
    } = req.body;

    // If employmentId provided, verify it exists and company has access
    let employment = null;
    if (employmentId) {
        employment = await Employment.findById(employmentId);
        if (!employment) {
            throw new NotFoundError('Employment record');
        }

        if (employment.companyId.toString() !== userId) {
            throw new ForbiddenError('You cannot rate for this employment');
        }

        if (employment.driverId.toString() !== driverId) {
            throw new ValidationError('Employment does not belong to this driver');
        }

        // Check if already rated for this employment
        const existingRating = await DriverRating.hasRatedForEmployment(
            driverId,
            userId,
            employmentId
        );

        if (existingRating) {
            throw new ConflictError('You have already rated this driver for this employment');
        }
    }

    // Determine rater role based on user role
    const raterRole = req.user.role === 'fleetmanager' ? 'FLEET_MANAGER' : 
                      req.user.role === 'admin' ? 'COMPANY' : 'COMPANY';

    // Create rating
    const rating = new DriverRating({
        driverId: driverId,
        ratedBy: {
            userId,
            companyId: userId,
            role: raterRole
        },
        employmentId,
        overallRating,
        categoryRatings,
        review,
        tags,
        wouldRehire,
        context: context || (employment ? {
            employmentDuration: employment.durationInDays
        } : {})
    });

    await rating.save();

    // Calculate updated aggregate ratings
    const aggregateRatings = await DriverRating.calculateAggregateRatings(driverId);

    // Emit event
    driverEventEmitter.emitDriverRatingAdded({
        ratingId: rating._id,
        driverId: driverId,
        ratedBy: userId,
        rating: overallRating
    });

    res.status(201).json({
        success: true,
        message: 'Rating submitted successfully',
        data: {
            rating,
            driverAggregateRatings: aggregateRatings
        }
    });
});

/**
 * @desc    Get ratings for a driver
 * @route   GET /api/drivers/ratings/driver/:driverId
 * @access  Public
 */
const getDriverRatings = asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Get driver profile
    const driverProfile = await DriverProfile.findOne({
        $or: [{ _id: driverId }, { userId: driverId }]
    });

    if (!driverProfile) {
        throw new NotFoundError('Driver profile');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [ratings, total, aggregateRatings] = await Promise.all([
        DriverRating.find({ 
            driverId: driverProfile._id, 
            isApproved: true,
            isPublic: true 
        })
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .select('-moderationNotes'),
        DriverRating.countDocuments({ 
            driverId: driverProfile._id, 
            isApproved: true,
            isPublic: true 
        }),
        DriverRating.calculateAggregateRatings(driverProfile._id)
    ]);

    res.json({
        success: true,
        data: {
            aggregateRatings,
            ratings,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                total
            }
        }
    });
});

/**
 * @desc    Get rating by ID
 * @route   GET /api/drivers/ratings/:ratingId
 * @access  Authenticated
 */
const getRatingById = asyncHandler(async (req, res) => {
    const { ratingId } = req.params;

    const rating = await DriverRating.findById(ratingId);
    if (!rating) {
        throw new NotFoundError('Rating');
    }

    res.json({
        success: true,
        data: rating
    });
});

/**
 * @desc    Update rating
 * @route   PUT /api/drivers/ratings/:ratingId
 * @access  Company (owner) only
 */
const updateRating = asyncHandler(async (req, res) => {
    const { ratingId } = req.params;
    const userId = req.user.userId;
    const { overallRating, categoryRatings, review, tags, wouldRehire } = req.body;

    const rating = await DriverRating.findById(ratingId);
    if (!rating) {
        throw new NotFoundError('Rating');
    }

    // Verify owner
    if (rating.ratedBy.userId.toString() !== userId) {
        throw new ForbiddenError('You can only update your own ratings');
    }

    // Store previous rating in history
    rating.editHistory.push({
        editedAt: new Date(),
        previousRating: rating.overallRating,
        reason: 'Updated by reviewer'
    });

    // Update fields
    if (overallRating) rating.overallRating = overallRating;
    if (categoryRatings) rating.categoryRatings = { ...rating.categoryRatings, ...categoryRatings };
    if (review) rating.review = { ...rating.review, ...review };
    if (tags) rating.tags = tags;
    if (wouldRehire !== undefined) rating.wouldRehire = wouldRehire;

    await rating.save();

    // Recalculate aggregate ratings
    const driverProfile = await DriverProfile.findById(rating.driverId);
    if (driverProfile) {
        const aggregateRatings = await DriverRating.calculateAggregateRatings(driverProfile._id);
        driverProfile.ratings = aggregateRatings;
        await driverProfile.save();
    }

    res.json({
        success: true,
        message: 'Rating updated successfully',
        data: rating
    });
});

/**
 * @desc    Delete rating
 * @route   DELETE /api/drivers/ratings/:ratingId
 * @access  Company (owner) only
 */
const deleteRating = asyncHandler(async (req, res) => {
    const { ratingId } = req.params;
    const userId = req.user.userId;

    const rating = await DriverRating.findById(ratingId);
    if (!rating) {
        throw new NotFoundError('Rating');
    }

    // Verify owner
    if (rating.ratedBy.userId.toString() !== userId) {
        throw new ForbiddenError('You can only delete your own ratings');
    }

    const driverId = rating.driverId;
    await rating.deleteOne();

    // Recalculate aggregate ratings
    const driverProfile = await DriverProfile.findById(driverId);
    if (driverProfile) {
        const aggregateRatings = await DriverRating.calculateAggregateRatings(driverId);
        driverProfile.ratings = aggregateRatings;
        await driverProfile.save();
    }

    res.json({
        success: true,
        message: 'Rating deleted successfully'
    });
});

/**
 * @desc    Driver responds to rating
 * @route   POST /api/drivers/ratings/:ratingId/respond
 * @access  Driver only
 */
const respondToRating = asyncHandler(async (req, res) => {
    const { ratingId } = req.params;
    const userId = req.user.userId;
    const { content } = req.body;

    const driverProfile = await DriverProfile.findOne({ userId });
    if (!driverProfile) {
        throw new NotFoundError('Driver profile');
    }

    const rating = await DriverRating.findById(ratingId);
    if (!rating) {
        throw new NotFoundError('Rating');
    }

    // Verify this rating is for this driver
    if (rating.driverId.toString() !== driverProfile._id.toString()) {
        throw new ForbiddenError('This rating is not for you');
    }

    // Check if already responded
    if (rating.driverResponse?.content) {
        throw new ConflictError('You have already responded to this rating');
    }

    rating.driverResponse = {
        content,
        respondedAt: new Date()
    };

    await rating.save();

    res.json({
        success: true,
        message: 'Response added successfully',
        data: rating.driverResponse
    });
});

/**
 * @desc    Get ratings given by company
 * @route   GET /api/drivers/ratings/company
 * @access  Company only
 */
const getCompanyGivenRatings = asyncHandler(async (req, res) => {
    const companyId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [ratings, total] = await Promise.all([
        DriverRating.find({ 'ratedBy.companyId': companyId })
            .populate('driverId', 'userId licenseDetails.licenseNumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        DriverRating.countDocuments({ 'ratedBy.companyId': companyId })
    ]);

    res.json({
        success: true,
        data: {
            ratings,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                total
            }
        }
    });
});

/**
 * @desc    Get driver's own ratings
 * @route   GET /api/drivers/ratings/my-ratings
 * @access  Driver only
 */
const getMyRatings = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    const driverProfile = await DriverProfile.findOne({ userId });
    if (!driverProfile) {
        throw new NotFoundError('Driver profile');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [ratings, total, aggregateRatings] = await Promise.all([
        DriverRating.find({ driverId: driverProfile._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        DriverRating.countDocuments({ driverId: driverProfile._id }),
        DriverRating.calculateAggregateRatings(driverProfile._id)
    ]);

    res.json({
        success: true,
        data: {
            aggregateRatings,
            ratings,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                total
            }
        }
    });
});

/**
 * @desc    Vote rating as helpful
 * @route   POST /api/drivers/ratings/:ratingId/helpful
 * @access  Authenticated
 */
const voteHelpful = asyncHandler(async (req, res) => {
    const { ratingId } = req.params;

    const rating = await DriverRating.findById(ratingId);
    if (!rating) {
        throw new NotFoundError('Rating');
    }

    rating.helpfulVotes += 1;
    await rating.save();

    res.json({
        success: true,
        message: 'Voted as helpful',
        data: {
            helpfulVotes: rating.helpfulVotes
        }
    });
});

module.exports = {
    createRating,
    getDriverRatings,
    getRatingById,
    updateRating,
    deleteRating,
    respondToRating,
    getCompanyGivenRatings,
    getMyRatings,
    voteHelpful
};
