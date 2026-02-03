/**
 * Error Handler Middleware
 * 
 * Centralized error handling for the application
 */

// Custom API Error class
class ApiError extends Error {
    constructor(statusCode, message, errors = []) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = true;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

// Not Found Error
class NotFoundError extends ApiError {
    constructor(resource = 'Resource') {
        super(404, `${resource} not found`);
    }
}

// Validation Error
class ValidationError extends ApiError {
    constructor(message, errors = []) {
        super(400, message, errors);
    }
}

// Unauthorized Error
class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized') {
        super(401, message);
    }
}

// Forbidden Error
class ForbiddenError extends ApiError {
    constructor(message = 'Access forbidden') {
        super(403, message);
    }
}

// Conflict Error (e.g., duplicate)
class ConflictError extends ApiError {
    constructor(message = 'Resource already exists') {
        super(409, message);
    }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => ({
            field: e.path,
            message: e.message
        }));
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors
        });
    }

    // Mongoose CastError (invalid ObjectId)
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format'
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({
            success: false,
            message: `Duplicate value for ${field}`
        });
    }

    // JWT Errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token has expired'
        });
    }

    // Operational errors (expected errors)
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            ...(err.errors.length > 0 && { errors: err.errors })
        });
    }

    // Unhandled errors
    console.error('Unhandled Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error'
    });
};

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    ApiError,
    NotFoundError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
    errorHandler,
    asyncHandler
};
