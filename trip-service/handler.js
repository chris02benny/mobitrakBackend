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
const app = require('./app');
const connectDB = require('./src/config/db');

let isConnected = false;

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
