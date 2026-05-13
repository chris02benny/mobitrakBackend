/**
 * socket/index.js
 * Central Socket.IO handler hub.
 *
 * This module replaces the monolithic socket handling in server.js with
 * modular, domain-specific handlers. It:
 *   1. Manages the userSockets map (userId → socketId)
 *   2. Handles room joins (fleet rooms, driver monitoring rooms)
 *   3. Delegates to domain-specific handlers (incidents, WebRTC)
 *   4. Maintains backward compatibility with existing `driver_monitoring` events
 *
 * Architecture:
 *   io.on('connection') → registerSocketHandlers(io, socket)
 *     ├── Room Management (join-fleet-room, join-monitoring-room)
 *     ├── incidentHandler (incident:report, incident:new)
 *     ├── webrtcHandler (webrtc:request, webrtc:offer, ...)
 *     └── Legacy handler (driver_monitoring — backward compat)
 */

const { registerIncidentHandler } = require('./handlers/incidentHandler');
const { registerWebRTCHandler } = require('./handlers/webrtcHandler');

// Global socket mapping: userId → socketId
const userSockets = new Map();

/**
 * Register all socket handlers for a new connection.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerSocketHandlers(io, socket) {
    console.log('[socket] New client connected:', socket.id);

    // ── Room Management ─────────────────────────────────────────────────────

    /** Fleet manager joins their private room */
    socket.on('join-fleet-room', (fleetManagerId) => {
        socket.join(`fleet-${fleetManagerId}`);
        userSockets.set(fleetManagerId, socket.id);
        console.log(`[socket] ${socket.id} joined fleet room: fleet-${fleetManagerId}`);
    });

    /** Driver joins their monitoring room */
    socket.on('join-monitoring-room', (driverId) => {
        socket.join(`monitoring-driver-${driverId}`);
        userSockets.set(driverId, socket.id);
        console.log(`[socket] ${socket.id} joined monitoring room: monitoring-driver-${driverId}`);
    });

    // ── Domain Handlers ─────────────────────────────────────────────────────

    registerIncidentHandler(io, socket);
    registerWebRTCHandler(io, socket, userSockets);

    // ── Legacy Backward Compatibility ───────────────────────────────────────
    // The existing driver_monitoring event is still supported but now also
    // triggers the incident pipeline via internal re-emission.

    let Trip = null;
    let DriverBehaviorLog = null;

    socket.on('driver_monitoring', async (data) => {
        const { driverId, tripId, status, perclos, ear, timestamp } = data;

        // Lazy-load Trip model
        if (!Trip) {
            try { Trip = require('../../models/Trip'); } catch (_) { }
        }

        try {
            // Forward to fleet managers (legacy event)
            io.emit('admin_monitoring', data);
            io.emit('new-alert', data);

            // Also route through the incident pipeline if data has businessId
            if (data.businessId || data.fleetManagerId || data.companyId) {
                const bizId = data.businessId || data.fleetManagerId || data.companyId;
                socket.emit('incident:report', {
                    ...data,
                    businessId: bizId,
                });
            }

            // If there's an active trip, also send to the specific fleet manager
            if (tripId && Trip) {
                const trip = await Trip.findById(tripId).select('fleetManagerId').lean();
                if (trip?.fleetManagerId) {
                    io.to(`fleet-${trip.fleetManagerId}`).emit('admin_monitoring', data);
                    io.to(`fleet-${trip.fleetManagerId}`).emit('new-alert', data);
                }
            }
        } catch (err) {
            console.error('[socket] Error relaying driver_monitoring:', err.message);
        }

        // Persist to MongoDB (non-blocking)
        if (!DriverBehaviorLog) {
            try { DriverBehaviorLog = require('../../models/DriverBehaviorLog'); } catch (_) { }
        }
        if (DriverBehaviorLog) {
            DriverBehaviorLog.create({
                driverId,
                tripId: tripId || null,
                status,
                perclos: perclos || 0,
                ear: ear || 0,
                timestamp: timestamp ? new Date(timestamp) : new Date(),
            }).catch(err => console.error('[socket] DB log error:', err.message));
        }
    });

    // ── Legacy WebRTC (backward compat) ─────────────────────────────────────
    // These keep old clients working while new clients use webrtc:* namespace

    socket.on('webrtc-request', (data) => {
        io.to(`monitoring-driver-${data.driverId}`).emit('webrtc-start', {
            ...data,
            adminSocketId: socket.id,
        });
        const driverSocketId = userSockets.get(data.driverId);
        if (driverSocketId) {
            io.to(driverSocketId).emit('webrtc-start', {
                ...data,
                adminSocketId: socket.id,
            });
        }
    });

    socket.on('webrtc-offer', (data) => {
        if (data.targetSocketId) {
            io.to(data.targetSocketId).emit('webrtc-offer', data);
        }
    });

    socket.on('webrtc-answer', (data) => {
        if (data.targetSocketId) {
            io.to(data.targetSocketId).emit('webrtc-answer', data);
        }
    });

    socket.on('webrtc-ice-candidate', (data) => {
        if (data.targetSocketId) {
            io.to(data.targetSocketId).emit('webrtc-ice-candidate', data);
        }
    });

    // ── Disconnect ──────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
        console.log('[socket] Client disconnected:', socket.id);
        for (const [userId, sockId] of userSockets.entries()) {
            if (sockId === socket.id) {
                userSockets.delete(userId);
                break;
            }
        }
    });
}

module.exports = { registerSocketHandlers, userSockets };
