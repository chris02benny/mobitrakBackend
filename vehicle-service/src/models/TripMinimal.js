const mongoose = require('mongoose');

// Minimal schema for Trip to allow conflict validation within vehicle-service
// This maps to the same 'trips' collection used by trip-service
const tripMinimalSchema = new mongoose.Schema({
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    status: {
        type: String,
        enum: ['scheduled', 'in-progress', 'completed', 'cancelled']
    },
    startDateTime: {
        type: Date,
        required: true
    },
    endDateTime: {
        type: Date,
        required: true
    }
}, {
    collection: 'trips' // Explicitly point to the trips collection
});

module.exports = mongoose.model('TripMinimal', tripMinimalSchema);
