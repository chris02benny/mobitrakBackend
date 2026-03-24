/**
 * trip-service/handler.js
 * AWS Lambda entry point for trip-service.
 *
 * Uses Pusher for real-time events instead of Socket.IO.
 * Socket.IO cannot work reliably on AWS Lambda due to its stateless/ephemeral nature.
 * Pusher is a managed WebSocket service that handles connections externally.
 *
 * Pusher channels used:
 *   - "fleet-{fleetManagerId}"  → admin_monitoring events for specific fleet manager
 *   - "monitoring-driver-{driverId}" → webrtc-start events for a specific driver
 *   - "global-monitoring"        → broadcast admin_monitoring to all fleet managers
 *
 * WebRTC Signaling channels (private, keyed by target socket concept replaced with Pusher channels):
 *   - "webrtc-{driverId}"       → webrtc-offer / webrtc-answer / webrtc-ice-candidate between driver and admin
 */

'use strict';

const serverless = require('serverless-http');
const Pusher = require('pusher');
const app = require('./app');
const connectDB = require('./src/config/db');

let Trip = null;
let DriverBehaviorLog = null;
let isConnected = false;

// ── Initialize Pusher Server SDK ──────────────────────────────────────────────
const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER || 'ap2',
    useTLS: true,
});

// Expose pusher instance to Express routes via app locals
app.locals.pusher = pusher;

// ── REST endpoint for driver monitoring telemetry ──────────────────────────────
// Drivers POST telemetry here; Lambda triggers Pusher to broadcast to fleet managers.
// This replaces the socket.on('driver_monitoring') handler.
app.post('/api/realtime/driver-monitoring', async (req, res) => {
    try {
        const { driverId, tripId, status, perclos, ear, timestamp, driverName } = req.body;
        if (!driverId) return res.status(400).json({ error: 'driverId required' });

        // Lazy-load models
        if (!Trip) Trip = require('./src/models/Trip');

        // Trigger to global channel so ALL fleet managers receive it
        await pusher.trigger('global-monitoring', 'admin_monitoring', {
            driverId,
            tripId: tripId || null,
            status,
            perclos: perclos ?? 0,
            ear: ear ?? 0,
            timestamp: timestamp || new Date().toISOString(),
            driverName: driverName || null,
        });

        // Also trigger to the specific fleet manager's channel if there's an active trip
        if (tripId) {
            try {
                const trip = await Trip.findById(tripId).select('fleetManagerId').lean();
                if (trip?.fleetManagerId) {
                    await pusher.trigger(`fleet-${trip.fleetManagerId}`, 'admin_monitoring', {
                        driverId,
                        tripId,
                        status,
                        perclos: perclos ?? 0,
                        ear: ear ?? 0,
                        timestamp: timestamp || new Date().toISOString(),
                        driverName: driverName || null,
                    });
                }
            } catch (tripErr) {
                console.error('[monitoring] Error fetching trip for fleet-room trigger:', tripErr.message);
            }
        }

        // Persist to MongoDB (non-blocking)
        if (!DriverBehaviorLog) {
            try { DriverBehaviorLog = require('./src/models/DriverBehaviorLog'); } catch (_) { }
        }
        if (DriverBehaviorLog) {
            DriverBehaviorLog.create({
                driverId,
                tripId: tripId || null,
                status,
                perclos: perclos || 0,
                ear: ear || 0,
                timestamp: timestamp ? new Date(timestamp) : new Date()
            }).catch(err => console.error('[monitoring] DB log error:', err.message));
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[monitoring] Error triggering Pusher event:', err.message);
        res.status(500).json({ error: 'Failed to relay telemetry' });
    }
});


// ── REST endpoint for location updates ────────────────────────────────────────
app.post('/api/realtime/location-update', async (req, res) => {
    try {
        const { fleetManagerId, vehicleId, location, tripId } = req.body;

        if (fleetManagerId) {
            await pusher.trigger(`fleet-${fleetManagerId}`, 'location-update', {
                vehicleId, location, tripId
            });
        }
        // Also broadcast globally
        await pusher.trigger('global-monitoring', 'location-update', {
            vehicleId, location, tripId
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[location] Error triggering location-update:', err.message);
        res.status(500).json({ error: 'Failed to relay location update' });
    }
});

// Wrap the serverless handler
const serverlessHandler = serverless(app);

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    if (!isConnected) {
        await connectDB();
        isConnected = true;
    }
    return serverlessHandler(event, context);
};
