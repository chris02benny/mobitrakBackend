/**
 * Models Index
 * 
 * Export all models from a single entry point
 */

const DriverProfile = require('./DriverProfile');
const Employment = require('./Employment');
const JobRequest = require('./JobRequest');
const DriverRating = require('./DriverRating');

module.exports = {
    DriverProfile,
    Employment,
    JobRequest,
    DriverRating
};
