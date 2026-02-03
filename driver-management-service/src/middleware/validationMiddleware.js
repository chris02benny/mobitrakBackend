const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation Middleware
 * 
 * Provides validation rules for all endpoints
 */

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

// Common validators
const mongoIdValidator = (field, location = 'param') => {
    const validator = location === 'param' ? param(field) : 
                      location === 'body' ? body(field) : query(field);
    return validator
        .isMongoId()
        .withMessage(`${field} must be a valid MongoDB ObjectId`);
};

// ========================
// Driver Profile Validators
// ========================

const createProfileValidation = [
    body('licenseDetails.licenseNumber')
        .trim()
        .notEmpty()
        .withMessage('License number is required')
        .isLength({ min: 5, max: 30 })
        .withMessage('License number must be 5-30 characters'),
    
    body('licenseDetails.licenseType')
        .isIn(['LMV', 'HMV', 'HGMV', 'MCWG', 'TRANS', 'HPMV', 'OTHER'])
        .withMessage('Invalid license type'),
    
    body('licenseDetails.issueDate')
        .isISO8601()
        .withMessage('Issue date must be a valid date'),
    
    body('licenseDetails.expiryDate')
        .isISO8601()
        .withMessage('Expiry date must be a valid date')
        .custom((value, { req }) => {
            if (new Date(value) <= new Date(req.body.licenseDetails?.issueDate)) {
                throw new Error('Expiry date must be after issue date');
            }
            return true;
        }),
    
    body('experience.totalYears')
        .optional()
        .isInt({ min: 0, max: 60 })
        .withMessage('Total years must be between 0 and 60'),
    
    handleValidationErrors
];

const updateProfileValidation = [
    body('professionalSummary')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Professional summary must be under 1000 characters'),
    
    body('experience.totalYears')
        .optional()
        .isInt({ min: 0, max: 60 })
        .withMessage('Total years must be between 0 and 60'),
    
    body('availability.status')
        .optional()
        .isIn(['AVAILABLE', 'EMPLOYED', 'ON_LEAVE', 'UNAVAILABLE', 'SEEKING'])
        .withMessage('Invalid availability status'),
    
    body('availability.preferredWorkType')
        .optional()
        .isIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'ON_CALL', 'ANY'])
        .withMessage('Invalid work type'),
    
    handleValidationErrors
];

// ========================
// Job Request Validators
// ========================

const createJobRequestValidation = [
    mongoIdValidator('driverId', 'body'),
    
    body('jobDetails.serviceType')
        .isIn(['Commercial', 'Passenger'])
        .withMessage('Service type must be Commercial or Passenger'),
    
    body('jobDetails.vehicleType')
        .trim()
        .notEmpty()
        .withMessage('Vehicle type is required'),
    
    body('jobDetails.contractDuration')
        .isInt({ min: 1 })
        .withMessage('Contract duration must be at least 1'),
    
    body('jobDetails.contractUnit')
        .isIn(['Day(s)', 'Week(s)', 'Month(s)', 'Year(s)'])
        .withMessage('Invalid contract unit'),
    
    body('jobDetails.accommodation')
        .optional()
        .isBoolean()
        .withMessage('Accommodation must be a boolean'),
    
    body('jobDetails.healthInsurance')
        .optional()
        .isBoolean()
        .withMessage('Health insurance must be a boolean'),
    
    body('jobDetails.description')
        .optional()
        .isLength({ max: 2000 })
        .withMessage('Description must be under 2000 characters'),
    
    body('offeredSalary.amount')
        .isFloat({ min: 0 })
        .withMessage('Salary amount is required and must be a positive number'),
    
    body('offeredSalary.frequency')
        .isIn(['PER_KM', 'PER_DAY', 'PER_MONTH'])
        .withMessage('Salary frequency must be PER_KM, PER_DAY, or PER_MONTH'),
    
    body('expiresAt')
        .optional()
        .isISO8601()
        .withMessage('Expiry date must be a valid date'),
    
    handleValidationErrors
];

const respondToJobRequestValidation = [
    mongoIdValidator('requestId'),
    
    body('action')
        .isIn(['accept', 'reject', 'counter'])
        .withMessage('Action must be accept, reject, or counter'),
    
    body('message')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Message must be under 1000 characters'),
    
    body('counterOffer')
        .optional()
        .isObject()
        .withMessage('Counter offer must be an object'),
    
    body('rejection.reason')
        .optional()
        .isIn(['SALARY_LOW', 'LOCATION', 'TIMING', 'BETTER_OFFER', 'PERSONAL', 'QUALIFICATIONS', 'EXPERIENCE', 'OTHER'])
        .withMessage('Invalid rejection reason'),
    
    handleValidationErrors
];

// ========================
// Employment Validators
// ========================

const createEmploymentValidation = [
    mongoIdValidator('driverId', 'body'),
    
    body('position')
        .isIn(['PRIMARY_DRIVER', 'BACKUP_DRIVER', 'TRAINEE', 'SENIOR_DRIVER', 'FLEET_SUPERVISOR'])
        .withMessage('Invalid position'),
    
    body('employmentType')
        .optional()
        .isIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY'])
        .withMessage('Invalid employment type'),
    
    body('salary.amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Salary amount must be a positive number'),
    
    body('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid date'),
    
    handleValidationErrors
];

const terminateEmploymentValidation = [
    mongoIdValidator('employmentId'),
    
    body('reason')
        .isIn(['RESIGNATION', 'TERMINATION', 'CONTRACT_END', 'MUTUAL_AGREEMENT', 'PERFORMANCE', 'MISCONDUCT', 'REDUNDANCY', 'OTHER'])
        .withMessage('Invalid termination reason'),
    
    body('details')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Details must be under 1000 characters'),
    
    body('lastWorkingDay')
        .optional()
        .isISO8601()
        .withMessage('Last working day must be a valid date'),
    
    handleValidationErrors
];

const assignVehicleValidation = [
    mongoIdValidator('employmentId'),
    mongoIdValidator('vehicleId', 'body'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Notes must be under 500 characters'),
    
    handleValidationErrors
];

// ========================
// Rating Validators
// ========================

const createRatingValidation = [
    mongoIdValidator('driverId', 'body'),
    
    body('overallRating')
        .isFloat({ min: 1, max: 5 })
        .withMessage('Overall rating must be between 1 and 5'),
    
    body('categoryRatings.safety')
        .optional()
        .isFloat({ min: 1, max: 5 })
        .withMessage('Safety rating must be between 1 and 5'),
    
    body('categoryRatings.punctuality')
        .optional()
        .isFloat({ min: 1, max: 5 })
        .withMessage('Punctuality rating must be between 1 and 5'),
    
    body('categoryRatings.professionalism')
        .optional()
        .isFloat({ min: 1, max: 5 })
        .withMessage('Professionalism rating must be between 1 and 5'),
    
    body('categoryRatings.vehicleCare')
        .optional()
        .isFloat({ min: 1, max: 5 })
        .withMessage('Vehicle care rating must be between 1 and 5'),
    
    body('categoryRatings.communication')
        .optional()
        .isFloat({ min: 1, max: 5 })
        .withMessage('Communication rating must be between 1 and 5'),
    
    body('review.content')
        .optional()
        .isLength({ max: 2000 })
        .withMessage('Review content must be under 2000 characters'),
    
    body('employmentId')
        .optional()
        .isMongoId()
        .withMessage('Employment ID must be a valid MongoDB ObjectId'),
    
    handleValidationErrors
];

// ========================
// Query Validators
// ========================

const searchDriversValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    
    query('status')
        .optional()
        .isIn(['AVAILABLE', 'EMPLOYED', 'ON_LEAVE', 'UNAVAILABLE', 'SEEKING'])
        .withMessage('Invalid status'),
    
    query('minExperience')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Minimum experience must be a non-negative integer'),
    
    query('minRating')
        .optional()
        .isFloat({ min: 0, max: 5 })
        .withMessage('Minimum rating must be between 0 and 5'),
    
    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    mongoIdValidator,
    createProfileValidation,
    updateProfileValidation,
    createJobRequestValidation,
    respondToJobRequestValidation,
    createEmploymentValidation,
    terminateEmploymentValidation,
    assignVehicleValidation,
    createRatingValidation,
    searchDriversValidation
};
