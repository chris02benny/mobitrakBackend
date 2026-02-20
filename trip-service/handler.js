/**
 * trip-service/handler.js
 * AWS Lambda entry point for trip-service.
 *
 * Wraps the Express app with serverless-http.
 * Handles MongoDB connection caching for Lambda cold-start optimization.
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

let isConnected = false;

// Middleware to ensure DB is connected before handling any request
app.use(async (req, res, next) => {
    if (!isConnected) {
        await connectDB();
        isConnected = true;
    }
    next();
});

module.exports.handler = serverless(app);
