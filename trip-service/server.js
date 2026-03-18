/**
 * trip-service/server.js
 * Local development entry point. Starts HTTP server with Socket.IO.
 * For Lambda deployment, use handler.js instead.
 */

const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

const app = require('./app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5004;

const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = socketIO(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    }
});

// Make io accessible to routes
app.set('io', io);

// Lazy-load models to avoid circular requires at startup
let Trip = null;
let DriverBehaviorLog = null;

// Global socket mapping
const userSockets = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // ── Existing: fleet tracking room ────────────────────────────────────────
    socket.on('join-fleet-room', (fleetManagerId) => {
        socket.join(`fleet-${fleetManagerId}`);
        userSockets.set(fleetManagerId, socket.id);
        console.log(`Client ${socket.id} joined fleet room: fleet-${fleetManagerId}`);
    });

    // ── NEW: Driver joins a monitoring room keyed by their driverId ──────────
    socket.on('join-monitoring-room', (driverId) => {
        socket.join(`monitoring-driver-${driverId}`);
        userSockets.set(driverId, socket.id);
        console.log(`Client ${socket.id} joined monitoring room for driver: ${driverId}`);
    });

    // ── Receive drowsiness telemetry from a driver ──────────────────────
    socket.on('driver_monitoring', async (data) => {
        const { driverId, tripId, status, perclos, ear, timestamp } = data;

        // Lazy-load Trip model
        if (!Trip) Trip = require('./src/models/Trip');

        try {
            // Forward event to fleet managers
            // Always broadcast globally for now so any fleet manager can see it
            // (since we want all hired drivers to show up regardless of active trips)
            io.emit('admin_monitoring', data);

            // If there's an active trip, also send to the specific fleet manager's room
            if (tripId) {
                const trip = await Trip.findById(tripId).select('fleetManagerId').lean();
                if (trip?.fleetManagerId) {
                    io.to(`fleet-${trip.fleetManagerId}`).emit('admin_monitoring', data);
                }
            }
        } catch (err) {
            console.error('[monitoring] Error relaying driver_monitoring:', err.message);
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
    });

    // ── WebRTC signaling relay (driver ↔ admin) ─────────────────────────
    // Admin requests video from a specific driver
    socket.on('webrtc-request', (data) => {
        console.log('[WebRTC] Requesting video from driver:', data.driverId);
        // Forward to the driver's specific room
        io.to(`monitoring-driver-${data.driverId}`).emit('webrtc-start', {
            ...data,
            adminSocketId: socket.id
        });

        // Fallback: if driver socket is known in the map
        const driverSocketId = userSockets.get(data.driverId);
        if (driverSocketId) {
            io.to(driverSocketId).emit('webrtc-start', {
                ...data,
                adminSocketId: socket.id
            });
        }
    });

    // Driver sends SDP offer → forward to requesting admin
    socket.on('webrtc-offer', (data) => {
        if (data.targetSocketId) {
            io.to(data.targetSocketId).emit('webrtc-offer', data);
        } else {
            socket.broadcast.emit('webrtc-offer', data);
        }
    });

    // Admin sends SDP answer → forward to driver
    socket.on('webrtc-answer', (data) => {
        if (data.targetSocketId) {
            io.to(data.targetSocketId).emit('webrtc-answer', data);
        } else {
            socket.broadcast.emit('webrtc-answer', data);
        }
    });

    // ICE candidate relay (bidirectional)
    socket.on('webrtc-ice-candidate', (data) => {
        if (data.targetSocketId) {
            io.to(data.targetSocketId).emit('webrtc-ice-candidate', data);
        } else {
            socket.broadcast.emit('webrtc-ice-candidate', data);
        }
    });

    // ── Disconnect ─────────────────────────────────────────────────
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Remove from map
        for (const [userId, sockId] of userSockets.entries()) {
            if (sockId === socket.id) {
                userSockets.delete(userId);
                break;
            }
        }
    });
});

// Connect to MongoDB then start server
connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Trip Service running on port ${PORT}`);
        console.log('Socket.IO enabled for real-time updates');
    });
}).catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
});
