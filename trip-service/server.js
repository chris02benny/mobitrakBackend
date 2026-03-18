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

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // ── Existing: fleet tracking room ────────────────────────────────────────
    socket.on('join-fleet-room', (fleetManagerId) => {
        socket.join(`fleet-${fleetManagerId}`);
        console.log(`Client ${socket.id} joined fleet room: fleet-${fleetManagerId}`);
    });

    // ── NEW: Driver joins a monitoring room keyed by their driverId ──────────
    socket.on('join-monitoring-room', (driverId) => {
        socket.join(`monitoring-driver-${driverId}`);
        console.log(`Client ${socket.id} joined monitoring room for driver: ${driverId}`);
    });

    // ── NEW: Receive drowsiness telemetry from a driver ──────────────────────
    socket.on('driver_monitoring', async (data) => {
        const { driverId, tripId, status, perclos, ear, timestamp } = data;

        // Lazy-load Trip model
        if (!Trip) Trip = require('./src/models/Trip');

        try {
            // Route the alert to the correct fleet manager's room
            if (tripId) {
                const trip = await Trip.findById(tripId).select('fleetManagerId').lean();
                if (trip?.fleetManagerId) {
                    io.to(`fleet-${trip.fleetManagerId}`).emit('admin_monitoring', data);
                }
            }

            // Broadcast to any admin who joined the global monitoring room
            socket.broadcast.emit('admin_monitoring', data);
        } catch (err) {
            console.error('[monitoring] Error relaying driver_monitoring:', err.message);
        }

        // Persist to MongoDB (non-blocking — do not await, never throw)
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

    // ── NEW: WebRTC signaling relay (driver ↔ admin) ─────────────────────────
    // Admin requests video from a specific driver
    socket.on('webrtc-request', (data) => {
        // Forward to the driver's monitoring room
        io.to(`monitoring-driver-${data.driverId}`).emit('webrtc-start', {
            ...data,
            adminSocketId: socket.id
        });
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

    // ── Existing: disconnect ─────────────────────────────────────────────────
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
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
