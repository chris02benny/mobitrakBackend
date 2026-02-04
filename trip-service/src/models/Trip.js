const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    address: String,
    arrivalTime: Date,
    departureTime: Date,
    status: {
        type: String,
        enum: ['pending', 'reached', 'departed'],
        default: 'pending'
    }
});

const tripSchema = new mongoose.Schema({
    tripType: {
        type: String,
        enum: ['commercial', 'passenger'],
        required: true
    },
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        required: true
    },
    fleetManagerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    startDestination: {
        name: {
            type: String,
            required: true
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                required: true
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true
            }
        },
        address: String
    },
    endDestination: {
        name: {
            type: String,
            required: true
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                required: true
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true
            }
        },
        address: String
    },
    stops: [stopSchema],
    startDateTime: {
        type: Date,
        required: true
    },
    endDateTime: {
        type: Date,
        required: true
    },
    route: {
        type: Object, // GeoJSON LineString
        default: null
    },
    distance: {
        type: Number, // in kilometers
        default: 0
    },
    duration: {
        type: Number, // in minutes
        default: 0
    },
    amount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    suggestedStops: [{
        name: String,
        location: {
            type: {
                type: String,
                enum: ['Point']
            },
            coordinates: [Number]
        },
        address: String,
        reason: String
    }]
}, {
    timestamps: true
});

// Index for geospatial queries
tripSchema.index({ 'startDestination.location': '2dsphere' });
tripSchema.index({ 'endDestination.location': '2dsphere' });
tripSchema.index({ 'stops.location': '2dsphere' });

module.exports = mongoose.model('Trip', tripSchema);
