/**
 * trip-service/handler.js
 * AWS Lambda entry point for trip-service.
 *
 * Wraps the Express app with serverless-http.
 * Handles MongoDB connection caching for Lambda cold-start optimization.
 *
 * IMPORTANT: DB connection is established BEFORE handing off to serverless-http.
 * Previously, app.use() was called AFTER serverless(app) — which caused race
 * conditions on cold starts and resulted in 404s from uninitialized routes.
 *
 * NOTE on Socket.IO:
 *   Socket.IO will automatically fall back to HTTP long-polling transport
 *   when running under Lambda (true WebSocket requires API Gateway WebSocket APIs).
 *   Real-time events still work via polling — no client-side changes needed.
 */

'use strict';

const serverless = require('serverless-http');
const app = require('./app');
const connectDB = require('./src/config/db');
const { Server } = require('socket.io');
let Trip = null;
let DriverBehaviorLog = null;

let isConnected = false;

// ── SERVERLESS SOCKET.IO POLLING SETUP ──
// Initialize Socket.io strictly for polling, intercepting Lambda requests
const io = new Server({
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true
    },
    transports: ['polling']
});

// We must attach to a dummy http server so that io.engine is initialized
const http = require('http');
const dummyServer = http.createServer();
io.attach(dummyServer);

const userSockets = new Map();

io.on('connection', (socket) => {
    console.log('New client connected (polling):', socket.id);

    socket.on('join-fleet-room', (fleetManagerId) => {
        socket.join(`fleet-${fleetManagerId}`);
        userSockets.set(fleetManagerId, socket.id);
    });

    socket.on('join-monitoring-room', (driverId) => {
        socket.join(`monitoring-driver-${driverId}`);
        userSockets.set(driverId, socket.id);
    });

    socket.on('driver_monitoring', async (data) => {
        const { driverId, tripId, status, perclos, ear, timestamp } = data;
        if (!Trip) Trip = require('./src/models/Trip');

        try {
            io.emit('admin_monitoring', data);
            if (tripId) {
                const trip = await Trip.findById(tripId).select('fleetManagerId').lean();
                if (trip?.fleetManagerId) {
                    io.to(`fleet-${trip.fleetManagerId}`).emit('admin_monitoring', data);
                }
            }
        } catch (err) {
            console.error('[monitoring] Error relaying:', err.message);
        }

        if (!DriverBehaviorLog) {
            try { DriverBehaviorLog = require('./src/models/DriverBehaviorLog'); } catch (_) { }
        }
        if (DriverBehaviorLog) {
            DriverBehaviorLog.create({
                driverId, tripId: tripId || null, status, perclos: perclos || 0, ear: ear || 0, timestamp: timestamp ? new Date(timestamp) : new Date()
            }).catch(() => { });
        }
    });

    socket.on('webrtc-request', (data) => {
        io.to(`monitoring-driver-${data.driverId}`).emit('webrtc-start', { ...data, adminSocketId: socket.id });
        const driverSocketId = userSockets.get(data.driverId);
        if (driverSocketId) {
            io.to(driverSocketId).emit('webrtc-start', { ...data, adminSocketId: socket.id });
        }
    });

    socket.on('webrtc-offer', (data) => {
        if (data.targetSocketId) io.to(data.targetSocketId).emit('webrtc-offer', data);
        else socket.broadcast.emit('webrtc-offer', data);
    });

    socket.on('webrtc-answer', (data) => {
        if (data.targetSocketId) io.to(data.targetSocketId).emit('webrtc-answer', data);
        else socket.broadcast.emit('webrtc-answer', data);
    });

    socket.on('webrtc-ice-candidate', (data) => {
        if (data.targetSocketId) io.to(data.targetSocketId).emit('webrtc-ice-candidate', data);
        else socket.broadcast.emit('webrtc-ice-candidate', data);
    });

    socket.on('disconnect', () => {
        for (const [userId, sockId] of userSockets.entries()) {
            if (sockId === socket.id) {
                userSockets.delete(userId);
                break;
            }
        }
    });
});

// Intercept socket.io endpoint before Express 404s it
app.all('/socket.io*', (req, res) => {
    io.engine.handleRequest(req, res);
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
