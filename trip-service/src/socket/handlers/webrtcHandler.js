/**
 * webrtcHandler.js
 * Modular Socket.IO handler for WebRTC signaling.
 *
 * Handles the live escalation flow:
 *   1. Fleet manager requests live video via `webrtc:request`
 *   2. Server relays `webrtc:start` to the driver
 *   3. SDP Offer/Answer and ICE candidates are relayed peer-to-peer
 *   4. Sessions are tracked in MongoDB for audit
 *
 * Security:
 *   - Room-based isolation (fleet manager can only request drivers in their fleet)
 *   - Socket ID targeting prevents cross-session interference
 *   - Session lifecycle tracking for cleanup
 */

const LiveSession = require('../../models/LiveSession');
const Incident = require('../../models/Incident');

/**
 * Register WebRTC signaling handlers on a socket.
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @param {import('socket.io').Socket} socket - Connected socket
 * @param {Map} userSockets - Map of userId → socketId
 */
function registerWebRTCHandler(io, socket, userSockets) {
    /**
     * webrtc:request
     * Fleet manager requests live video from a specific driver.
     *
     * Payload: {
     *   driverId: string,
     *   incidentId?: string,
     *   managerId: string,
     *   businessId: string
     * }
     */
    socket.on('webrtc:request', async (data) => {
        const { driverId, incidentId, managerId, businessId } = data;

        console.log(`[WebRTC] Manager ${managerId} requesting live feed from driver ${driverId}`);

        try {
            // Create LiveSession record
            const session = await LiveSession.create({
                incidentId: incidentId || null,
                driverId,
                managerId,
                businessId,
                status: 'PENDING',
                connectionMeta: {
                    adminSocketId: socket.id,
                },
            });

            // Update incident status to MONITORING if linked
            if (incidentId) {
                await Incident.findByIdAndUpdate(incidentId, {
                    $set: { status: 'MONITORING', liveSessionActive: true },
                    $push: {
                        timeline: {
                            status: 'MONITORING',
                            actor: managerId,
                            note: 'Live video monitoring initiated',
                        },
                    },
                });

                // Broadcast status update
                io.to(`fleet-${businessId}`).emit('incident:status_update', {
                    incidentId,
                    status: 'MONITORING',
                    actor: managerId,
                });
            }

            // Forward start request to the driver's monitoring room
            io.to(`monitoring-driver-${driverId}`).emit('webrtc:start', {
                ...data,
                sessionId: session._id,
                adminSocketId: socket.id,
            });

            // Fallback: if driver socket is known in the map
            const driverSocketId = userSockets.get(driverId);
            if (driverSocketId && driverSocketId !== socket.id) {
                io.to(driverSocketId).emit('webrtc:start', {
                    ...data,
                    sessionId: session._id,
                    adminSocketId: socket.id,
                });
            }

            // Notify the requesting manager that the request was sent
            socket.emit('webrtc:request_sent', {
                sessionId: session._id,
                driverId,
                status: 'PENDING',
            });

            console.log(`[WebRTC] ✅ Session ${session._id} created, request sent to driver ${driverId}`);
        } catch (err) {
            console.error('[WebRTC] Error creating session:', err.message);
            socket.emit('webrtc:error', { error: 'Failed to initiate live monitoring' });
        }
    });

    /**
     * webrtc:offer
     * Driver sends SDP offer → relay to requesting fleet manager.
     */
    socket.on('webrtc:offer', async (data) => {
        const { targetSocketId, sessionId } = data;
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc:offer', data);
        }

        // Update session status
        if (sessionId) {
            await LiveSession.findByIdAndUpdate(sessionId, {
                $set: {
                    status: 'CONNECTING',
                    'connectionMeta.driverSocketId': socket.id,
                },
            }).catch(err => console.error('[WebRTC] Session update error:', err.message));
        }
    });

    /**
     * webrtc:answer
     * Fleet manager sends SDP answer → relay to driver.
     */
    socket.on('webrtc:answer', async (data) => {
        const { targetSocketId, sessionId } = data;
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc:answer', data);
        }

        // Update session status to ACTIVE
        if (sessionId) {
            await LiveSession.findByIdAndUpdate(sessionId, {
                $set: { status: 'ACTIVE', startedAt: new Date() },
            }).catch(err => console.error('[WebRTC] Session update error:', err.message));
        }
    });

    /**
     * webrtc:ice-candidate
     * ICE candidate relay (bidirectional).
     */
    socket.on('webrtc:ice-candidate', (data) => {
        const { targetSocketId } = data;
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc:ice-candidate', data);
        }
    });

    /**
     * webrtc:end
     * Either party ends the live monitoring session.
     */
    socket.on('webrtc:end', async (data) => {
        const { sessionId, reason, incidentId, businessId } = data;

        console.log(`[WebRTC] Session ${sessionId} ending. Reason: ${reason}`);

        if (sessionId) {
            const session = await LiveSession.findById(sessionId);
            if (session && session.status !== 'ENDED') {
                session.status = 'ENDED';
                session.endedAt = new Date();
                session.endReason = reason || 'MANAGER_ENDED';
                if (session.startedAt) {
                    session.durationSeconds = Math.round(
                        (session.endedAt - session.startedAt) / 1000
                    );
                }
                await session.save();
            }
        }

        // Update incident status
        if (incidentId) {
            await Incident.findByIdAndUpdate(incidentId, {
                $set: { liveSessionActive: false },
            }).catch(err => console.error('[WebRTC] Incident update error:', err.message));
        }

        // Notify the other party
        const { targetSocketId } = data;
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc:ended', {
                sessionId,
                reason: reason || 'MANAGER_ENDED',
            });
        }

        // Broadcast to fleet room
        if (businessId) {
            io.to(`fleet-${businessId}`).emit('incident:status_update', {
                incidentId,
                liveSessionActive: false,
            });
        }
    });
}

module.exports = { registerWebRTCHandler };
