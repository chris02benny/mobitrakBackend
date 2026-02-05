const Trip = require('../models/Trip');
const mapboxService = require('../services/mapboxService');
const axios = require('axios');
const NotificationClient = require('../services/notificationClient');

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
            customerName,
            customerEmail,
            customerContact,
            startDestination,
            endDestination,
            stops,
            startDateTime,
            endDateTime,
            amountPerKm,
            vehicleRent,
            isTwoWay
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

        // Check for overlapping trips with the same vehicle
        const vehicleOverlap = await Trip.findOne({
            vehicleId,
            status: { $in: ['scheduled', 'in-progress'] },
            $or: [
                // New trip starts during existing trip
                { startDateTime: { $lte: start }, endDateTime: { $gte: start } },
                // New trip ends during existing trip
                { startDateTime: { $lte: end }, endDateTime: { $gte: end } },
                // New trip completely contains existing trip
                { startDateTime: { $gte: start }, endDateTime: { $lte: end } }
            ]
        });

        if (vehicleOverlap) {
            return res.status(400).json({ 
                message: 'Vehicle is already assigned to another trip during these dates',
                conflictingTrip: vehicleOverlap._id
            });
        }

        // Check for overlapping trips with the same driver (if driver is provided)
        if (driverId) {
            const driverOverlap = await Trip.findOne({
                driverId,
                status: { $in: ['scheduled', 'in-progress'] },
                $or: [
                    // New trip starts during existing trip
                    { startDateTime: { $lte: start }, endDateTime: { $gte: start } },
                    // New trip ends during existing trip
                    { startDateTime: { $lte: end }, endDateTime: { $gte: end } },
                    // New trip completely contains existing trip
                    { startDateTime: { $gte: start }, endDateTime: { $lte: end } }
                ]
            });

            if (driverOverlap) {
                return res.status(400).json({ 
                    message: 'Driver is already assigned to another trip during these dates',
                    conflictingTrip: driverOverlap._id
                });
            }
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

            // Apply two-way multiplier if needed
            if (isTwoWay) {
                distance = distance * 2;
                duration = duration * 2;
            }

            // Generate suggested rest stops
            suggestedStops = mapboxService.suggestRestStops(route, distance);
        } catch (error) {
            console.error('Route calculation error:', error);
            // Continue without route data
        }

        // Calculate total amount from provided pricing (distance already multiplied if two-way)
        const calculatedAmount = (distance * (parseFloat(amountPerKm) || 0)) + (parseFloat(vehicleRent) || 0);

        // Create trip
        const trip = new Trip({
            tripType,
            vehicleId,
            driverId,
            fleetManagerId: req.user.id,
            customerName,
            customerEmail,
            customerContact,
            startDestination,
            endDestination,
            stops: stops || [],
            startDateTime,
            endDateTime,
            route,
            distance,
            duration,
            amountPerKm: parseFloat(amountPerKm) || 0,
            vehicleRent: parseFloat(vehicleRent) || 0,
            amount: calculatedAmount,
            isTwoWay: isTwoWay || false,
            suggestedStops
        });

        await trip.save();

        // Update vehicle status to ASSIGNED
        try {
            await axios.patch(
                `http://vehicle-service:5002/api/vehicles/${vehicleId}/status`,
                { status: 'ASSIGNED' },
                { headers: { 'x-user-id': req.user.id } }
            );
        } catch (error) {
            console.error('Error updating vehicle status:', error.message);
            // Continue even if status update fails
        }

        // Update driver assignmentStatus to ASSIGNED (if driver is assigned)
        if (driverId) {
            try {
                // Update employment record
                await axios.patch(
                    `http://driver-management-service:5003/api/drivers/employments/driver/${driverId}/assignment-status`,
                    { assignmentStatus: 'ASSIGNED' },
                    { headers: { 'x-user-id': req.user.id } }
                );

                // Update user record
                const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:5001';
                await axios.put(
                    `${userServiceUrl}/api/admin/users/${driverId}/internal-update`,
                    { assignmentStatus: 'ASSIGNED' },
                    { headers: { 'Content-Type': 'application/json' } }
                );

                console.log(`Updated driver ${driverId} assignment status to ASSIGNED`);
            } catch (error) {
                console.error('Error updating driver assignment status:', error.message);
                // Continue even if status update fails
            }
        }

        // Create notification for trip created
        try {
            const formatDate = (date) => {
                return new Date(date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            };

            await NotificationClient.notifyTripCreated(req.user.id, {
                tripId: trip._id,
                startDestination: trip.startDestination.name,
                endDestination: trip.endDestination.name,
                scheduledDate: formatDate(trip.startDateTime),
                tripType: trip.tripType,
                vehicleId: trip.vehicleId,
                driverId: trip.driverId
            });
        } catch (notifError) {
            console.error('Failed to send notification:', notifError);
        }

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

        // Don't use populate since vehicle and driver data are in different services
        // Just return the trips with IDs - frontend can fetch details if needed
        const trips = await Trip.find(query).sort({ createdAt: -1 });

        res.json({ trips });
    } catch (error) {
        console.error('Get trips error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get single trip
exports.getTripById = async (req, res) => {
    try {
        // Don't use populate since vehicle and driver data are in different services
        const trip = await Trip.findById(req.params.id);

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

        // Track previous status for status change logic
        const previousStatus = trip.status;

        // Don't allow updating completed trips unless changing to completed/cancelled
        if (previousStatus === 'completed' && req.body.status !== 'completed') {
            return res.status(400).json({ 
                message: 'Cannot update completed trip' 
            });
        }

        // Update allowed fields
        const allowedUpdates = [
            'driverId', 'startDateTime', 'endDateTime', 'stops', 'status', 'isTwoWay',
            'customerName', 'customerEmail', 'customerContact', 'vehicleId',
            'startDestination', 'endDestination', 'amountPerKm', 'vehicleRent'
        ];

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                trip[field] = req.body[field];
            }
        });

        // Recalculate route if stops, destinations, or pricing changed
        if (req.body.stops || req.body.startDestination || req.body.endDestination || 
            req.body.amountPerKm !== undefined || req.body.vehicleRent !== undefined || 
            req.body.isTwoWay !== undefined) {
            
            const coordinates = [
                trip.startDestination.location.coordinates,
                ...(trip.stops || []).map(stop => stop.location.coordinates),
                trip.endDestination.location.coordinates
            ];

            try {
                const routeData = await mapboxService.getRoute(coordinates);
                trip.route = routeData.geometry;
                let distance = routeData.distance;
                let duration = routeData.duration;
                
                // Apply two-way multiplier if needed
                if (trip.isTwoWay) {
                    distance = distance * 2;
                    duration = duration * 2;
                }
                
                trip.distance = distance;
                trip.duration = duration;
                
                // Recalculate amount with updated pricing
                trip.amount = (distance * trip.amountPerKm) + trip.vehicleRent;
                
                trip.suggestedStops = mapboxService.suggestRestStops(trip.route, trip.distance);
            } catch (error) {
                console.error('Route recalculation error:', error);
            }
        }

        await trip.save();

        // If status changed to completed or cancelled, reset vehicle and driver statuses
        if (req.body.status && ['completed', 'cancelled'].includes(req.body.status) && 
            previousStatus !== req.body.status) {
            
            // Reset vehicle status to IDLE
            try {
                await axios.patch(
                    `http://vehicle-service:5002/api/vehicles/${trip.vehicleId}/status`,
                    { status: 'IDLE' },
                    { headers: { 'x-user-id': req.user.id } }
                );
            } catch (error) {
                console.error('Error resetting vehicle status:', error.message);
            }

            // Reset driver assignmentStatus to UNASSIGNED (if driver was assigned)
            if (trip.driverId) {
                try {
                    // Update employment record
                    await axios.patch(
                        `http://driver-management-service:5003/api/drivers/employments/driver/${trip.driverId}/assignment-status`,
                        { assignmentStatus: 'UNASSIGNED' },
                        { headers: { 'x-user-id': req.user.id } }
                    );

                    // Update user record
                    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:5001';
                    await axios.put(
                        `${userServiceUrl}/api/admin/users/${trip.driverId}/internal-update`,
                        { assignmentStatus: 'UNASSIGNED' },
                        { headers: { 'Content-Type': 'application/json' } }
                    );

                    console.log(`Updated driver ${trip.driverId} assignment status to UNASSIGNED`);
                } catch (error) {
                    console.error('Error resetting driver assignment status:', error.message);
                }
            }
        }

        // Create notification for trip updated
        try {
            const formatDate = (date) => {
                return new Date(date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            };

            await NotificationClient.notifyTripUpdated(req.user.id, {
                tripId: trip._id,
                startDestination: trip.startDestination.name,
                endDestination: trip.endDestination.name,
                scheduledDate: formatDate(trip.startDateTime),
                tripType: trip.tripType
            });
        } catch (notifError) {
            console.error('Failed to send notification:', notifError);
        }

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

        // Reset vehicle status to IDLE before deleting
        try {
            await axios.patch(
                `http://vehicle-service:5002/api/vehicles/${trip.vehicleId}/status`,
                { status: 'IDLE' },
                { headers: { 'x-user-id': req.user.id } }
            );
        } catch (error) {
            console.error('Error resetting vehicle status:', error.message);
        }

        // Reset driver assignmentStatus to UNASSIGNED before deleting
        if (trip.driverId) {
            try {
                // Update employment record
                await axios.patch(
                    `http://driver-management-service:5003/api/drivers/employments/driver/${trip.driverId}/assignment-status`,
                    { assignmentStatus: 'UNASSIGNED' },
                    { headers: { 'x-user-id': req.user.id } }
                );

                // Update user record
                const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:5001';
                await axios.put(
                    `${userServiceUrl}/api/admin/users/${trip.driverId}/internal-update`,
                    { assignmentStatus: 'UNASSIGNED' },
                    { headers: { 'Content-Type': 'application/json' } }
                );

                console.log(`Updated driver ${trip.driverId} assignment status to UNASSIGNED`);
            } catch (error) {
                console.error('Error resetting driver assignment status:', error.message);
            }
        }

        // Store trip data for notification before deleting
        const tripData = {
            tripId: trip._id,
            startDestination: trip.startDestination.name,
            endDestination: trip.endDestination.name,
            vehicleId: trip.vehicleId,
            driverId: trip.driverId
        };

        await trip.deleteOne();

        // Create notification for trip deleted
        try {
            await NotificationClient.notifyTripDeleted(req.user.id, tripData);
        } catch (notifError) {
            console.error('Failed to send notification:', notifError);
        }

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

// Update trip location (for real-time tracking)
exports.updateLocation = async (req, res) => {
    try {
        const { tripId } = req.params;
        const { longitude, latitude } = req.body;

        if (!longitude || !latitude) {
            return res.status(400).json({ message: 'Longitude and latitude are required' });
        }

        const trip = await Trip.findById(tripId);

        if (!trip) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        // Update current location
        trip.currentLocation = {
            type: 'Point',
            coordinates: [longitude, latitude]
        };
        trip.lastLocationUpdate = new Date();

        await trip.save();

        // Get Socket.IO instance
        const io = req.app.get('io');

        // Broadcast location update to all clients in the fleet manager's room
        const locationUpdate = {
            tripId: trip._id,
            vehicleId: trip.vehicleId,
            driverId: trip.driverId,
            location: {
                longitude,
                latitude
            },
            timestamp: trip.lastLocationUpdate
        };

        io.to(`fleet-${trip.fleetManagerId}`).emit('location-update', locationUpdate);

        res.json({
            message: 'Location updated successfully',
            location: locationUpdate
        });
    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get all active trips with locations (for fleet map)
exports.getActiveTripsWithLocations = async (req, res) => {
    try {
        const trips = await Trip.find({
            fleetManagerId: req.user.id,
            status: 'in-progress'
        })
        .select('vehicleId driverId currentLocation lastLocationUpdate startDestination endDestination')
        .populate('vehicleId', 'regnNo vehicleType')
        .populate('driverId', 'fullName email');

        res.json({ trips });
    } catch (error) {
        console.error('Get active trips error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get assigned trips for driver (exclude pricing details)
exports.getDriverAssignedTrips = async (req, res) => {
    try {
        console.log('getDriverAssignedTrips called');
        console.log('Driver ID from token:', req.user.id);
        console.log('User role:', req.user.role);
        
        // Convert to string for comparison (in case it's stored differently)
        const driverId = req.user.id.toString();
        
        // First, let's see all trips to debug
        const allTrips = await Trip.find({}).select('driverId status').limit(10);
        console.log('Sample trips in DB:', allTrips.map(t => ({ 
            id: t._id, 
            driverId: t.driverId?.toString(), 
            status: t.status 
        })));
        
        // Get trips assigned to this driver
        const trips = await Trip.find({
            driverId: req.user.id,
            status: { $in: ['scheduled', 'in-progress'] }
        })
        .select('-amountPerKm -vehicleRent -amount') // Exclude pricing details
        .sort({ startDateTime: 1 }); // Sort by start date (upcoming first)

        console.log('Found trips count:', trips.length);
        if (trips.length > 0) {
            console.log('First trip driverId:', trips[0].driverId);
        }

        res.json({ trips });
    } catch (error) {
        console.error('Get driver assigned trips error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Start trip (driver)
exports.startTrip = async (req, res) => {
    try {
        const { id } = req.params;
        
        const trip = await Trip.findById(id);
        
        if (!trip) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        // Verify this is the assigned driver
        if (trip.driverId.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: 'Not authorized to start this trip' });
        }

        // Check if trip is in scheduled status
        if (trip.status !== 'scheduled') {
            return res.status(400).json({ message: 'Trip cannot be started. Current status: ' + trip.status });
        }

        // Check if current time is within 3 hours of scheduled start time
        const now = new Date();
        const scheduledStart = new Date(trip.startDateTime);
        const diffMinutes = (scheduledStart - now) / (1000 * 60);
        const threeHoursInMinutes = 3 * 60; // 180 minutes

        if (Math.abs(diffMinutes) > threeHoursInMinutes) {
            const hours = Math.floor(Math.abs(diffMinutes) / 60);
            const minutes = Math.floor(Math.abs(diffMinutes) % 60);
            if (diffMinutes > 0) {
                return res.status(400).json({ 
                    message: `Trip cannot be started yet. It is scheduled to start in ${hours}h ${minutes}m. You can only start the trip within 3 hours of the scheduled start time.` 
                });
            } else {
                return res.status(400).json({ 
                    message: `Trip cannot be started. It was scheduled to start ${hours}h ${minutes}m ago. You can only start the trip within 3 hours of the scheduled start time.` 
                });
            }
        }

        // Update trip status
        trip.status = 'in-progress';
        trip.actualStartDateTime = new Date();
        
        await trip.save();

        res.json({ 
            message: 'Trip started successfully', 
            trip: {
                ...trip.toObject(),
                amountPerKm: undefined,
                vehicleRent: undefined,
                amount: undefined
            }
        });
    } catch (error) {
        console.error('Start trip error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update stop status (driver marks location as reached)
exports.updateStopStatus = async (req, res) => {
    try {
        const { id, stopIndex } = req.params;
        const { location } = req.body;
        
        const trip = await Trip.findById(id);
        
        if (!trip) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        // Verify this is the assigned driver
        if (trip.driverId.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this trip' });
        }

        // Check if trip is in-progress
        if (trip.status !== 'in-progress') {
            return res.status(400).json({ message: 'Trip is not in progress' });
        }

        // Validate stop index
        const stopIndexNum = parseInt(stopIndex);
        if (stopIndexNum < 0 || stopIndexNum >= trip.stops.length) {
            return res.status(400).json({ message: 'Invalid stop index' });
        }

        // Update stop status
        trip.stops[stopIndexNum].status = 'reached';
        trip.stops[stopIndexNum].arrivedAt = new Date();
        
        // Update vehicle location if provided
        if (location && location.coordinates) {
            trip.currentLocation = location;
        }

        await trip.save();

        res.json({ 
            message: 'Stop status updated successfully', 
            trip: {
                ...trip.toObject(),
                amountPerKm: undefined,
                vehicleRent: undefined,
                amount: undefined
            }
        });
    } catch (error) {
        console.error('Update stop status error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// End trip (driver)
exports.endTrip = async (req, res) => {
    try {
        const { id } = req.params;
        
        const trip = await Trip.findById(id);
        
        if (!trip) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        // Verify this is the assigned driver
        if (trip.driverId.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: 'Not authorized to end this trip' });
        }

        // Check if trip is in-progress
        if (trip.status !== 'in-progress') {
            return res.status(400).json({ message: 'Trip is not in progress' });
        }

        // Update trip status
        trip.status = 'completed';
        trip.actualEndDateTime = new Date();

        await trip.save();

        res.json({ 
            message: 'Trip completed successfully', 
            trip: {
                ...trip.toObject(),
                amountPerKm: undefined,
                vehicleRent: undefined,
                amount: undefined
            }
        });
    } catch (error) {
        console.error('End trip error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
