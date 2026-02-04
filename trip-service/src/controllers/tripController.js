const Trip = require('../models/Trip');
const mapboxService = require('../services/mapboxService');
const axios = require('axios');

// Helper function to get employed drivers
const getEmployedDrivers = async (fleetManagerId) => {
    try {
        // Call driver-management-service to get employed drivers
        const response = await axios.get('http://driver-management-service:5003/api/employment', {
            headers: { 'x-fleet-manager-id': fleetManagerId }
        });
        return response.data.employments || [];
    } catch (error) {
        console.error('Error fetching employed drivers:', error.message);
        return [];
    }
};

// Create a new trip
exports.createTrip = async (req, res) => {
    try {
        const {
            tripType,
            vehicleId,
            driverId,
            startDestination,
            endDestination,
            stops,
            startDateTime,
            endDateTime
        } = req.body;

        // Validate dates
        const now = new Date();
        const start = new Date(startDateTime);
        const end = new Date(endDateTime);
        const twoMonthsFromNow = new Date();
        twoMonthsFromNow.setMonth(now.getMonth() + 2);

        if (start < now) {
            return res.status(400).json({ message: 'Start date cannot be in the past' });
        }

        if (start > twoMonthsFromNow) {
            return res.status(400).json({ message: 'Start date cannot be more than 2 months in the future' });
        }

        if (end <= start) {
            return res.status(400).json({ message: 'End date must be after start date' });
        }

        // Build coordinates array for route calculation
        const coordinates = [
            startDestination.location.coordinates,
            ...(stops || []).map(stop => stop.location.coordinates),
            endDestination.location.coordinates
        ];

        // Get route from Mapbox
        let route = null;
        let distance = 0;
        let duration = 0;
        let suggestedStops = [];

        try {
            const routeData = await mapboxService.getRoute(coordinates);
            route = routeData.geometry;
            distance = routeData.distance;
            duration = routeData.duration;

            // Generate suggested rest stops
            suggestedStops = mapboxService.suggestRestStops(route, distance);
        } catch (error) {
            console.error('Route calculation error:', error);
            // Continue without route data
        }

        // Calculate amount
        const amount = mapboxService.calculateAmount(distance, tripType);

        // Create trip
        const trip = new Trip({
            tripType,
            vehicleId,
            driverId,
            fleetManagerId: req.user.id,
            startDestination,
            endDestination,
            stops: stops || [],
            startDateTime,
            endDateTime,
            route,
            distance,
            duration,
            amount,
            suggestedStops
        });

        await trip.save();

        res.status(201).json({
            message: 'Trip created successfully',
            trip
        });
    } catch (error) {
        console.error('Create trip error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get all trips for fleet manager
exports.getTrips = async (req, res) => {
    try {
        const { status, vehicleId, startDate, endDate } = req.query;
        
        const query = { fleetManagerId: req.user.id };

        if (status) {
            query.status = status;
        }

        if (vehicleId) {
            query.vehicleId = vehicleId;
        }

        if (startDate || endDate) {
            query.startDateTime = {};
            if (startDate) {
                query.startDateTime.$gte = new Date(startDate);
            }
            if (endDate) {
                query.startDateTime.$lte = new Date(endDate);
            }
        }

        const trips = await Trip.find(query)
            .populate('vehicleId', 'registrationNumber vehicleType')
            .populate('driverId', 'firstName lastName email')
            .sort({ createdAt: -1 });

        res.json({ trips });
    } catch (error) {
        console.error('Get trips error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get single trip
exports.getTripById = async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id)
            .populate('vehicleId')
            .populate('driverId', 'firstName lastName email phone');

        if (!trip) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        // Check if user is authorized
        if (trip.fleetManagerId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json({ trip });
    } catch (error) {
        console.error('Get trip error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update trip
exports.updateTrip = async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);

        if (!trip) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        // Check authorization
        if (trip.fleetManagerId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Don't allow updating completed or in-progress trips
        if (trip.status !== 'scheduled') {
            return res.status(400).json({ 
                message: 'Cannot update trip that is in progress or completed' 
            });
        }

        // Update allowed fields
        const allowedUpdates = [
            'driverId', 'startDateTime', 'endDateTime', 'stops', 'status'
        ];

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                trip[field] = req.body[field];
            }
        });

        // Recalculate route if stops changed
        if (req.body.stops) {
            const coordinates = [
                trip.startDestination.location.coordinates,
                ...req.body.stops.map(stop => stop.location.coordinates),
                trip.endDestination.location.coordinates
            ];

            try {
                const routeData = await mapboxService.getRoute(coordinates);
                trip.route = routeData.geometry;
                trip.distance = routeData.distance;
                trip.duration = routeData.duration;
                trip.amount = mapboxService.calculateAmount(routeData.distance, trip.tripType);
                trip.suggestedStops = mapboxService.suggestRestStops(trip.route, trip.distance);
            } catch (error) {
                console.error('Route recalculation error:', error);
            }
        }

        await trip.save();

        res.json({
            message: 'Trip updated successfully',
            trip
        });
    } catch (error) {
        console.error('Update trip error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete trip
exports.deleteTrip = async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);

        if (!trip) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        // Check authorization
        if (trip.fleetManagerId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Only allow deleting scheduled trips
        if (trip.status !== 'scheduled') {
            return res.status(400).json({ 
                message: 'Cannot delete trip that is in progress or completed' 
            });
        }

        await trip.deleteOne();

        res.json({ message: 'Trip deleted successfully' });
    } catch (error) {
        console.error('Delete trip error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Calculate route (for preview before creating trip)
exports.calculateRoute = async (req, res) => {
    try {
        const { coordinates, tripType } = req.body;

        if (!coordinates || coordinates.length < 2) {
            return res.status(400).json({ 
                message: 'At least start and end coordinates are required' 
            });
        }

        const routeData = await mapboxService.getRoute(coordinates);
        const suggestedStops = mapboxService.suggestRestStops(
            routeData.geometry, 
            routeData.distance
        );
        const amount = mapboxService.calculateAmount(routeData.distance, tripType);

        res.json({
            route: routeData.geometry,
            distance: routeData.distance,
            duration: routeData.duration,
            amount,
            suggestedStops
        });
    } catch (error) {
        console.error('Calculate route error:', error);
        res.status(500).json({ message: 'Error calculating route', error: error.message });
    }
};
