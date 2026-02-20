/**
 * driver-management-service/handler.js
 * AWS Lambda entry point for driver-management-service.
 *
 * Wraps the Express app with serverless-http.
 * Handles MongoDB connection caching for Lambda cold-start optimization.
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
