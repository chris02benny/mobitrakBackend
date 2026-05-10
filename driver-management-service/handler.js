/**
 * driver-management-service/handler.js
 * AWS Lambda entry point for driver-management-service.
 *
 * Wraps the Express app with serverless-http.
 * Handles MongoDB connection caching for Lambda cold-start optimization.
 *
 * IMPORTANT: DB connection is established BEFORE handing off to serverless-http.
 * Previously, app.use() was called AFTER serverless(app) — which caused race
 * conditions on cold starts and resulted in 404s from uninitialized routes.
 */

'use strict';

const serverless = require('serverless-http');
const app = require('./app');
const connectDB = require('./src/config/db');

let isConnected = false;

// Wrap the serverless handler so DB connect is always awaited first.
// context.callbackWaitsForEmptyEventLoop = false prevents Lambda from hanging
// on open MongoDB connections between invocations.
const serverlessHandler = serverless(app);

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    
    // Fast-path for CORS preflight OPTIONS requests
    const method = event.requestContext?.http?.method || event.httpMethod;
    if (method === 'OPTIONS') {
        return serverlessHandler(event, context);
    }
    
    if (!isConnected) {
        try {
            await connectDB();
            isConnected = true;
        } catch (err) {
            console.error('[handler] MongoDB connection failed, delegating error to Express:', err.message);
            // Intentionally not throwing so Express can return a 500 with CORS headers
        }
    }
    return serverlessHandler(event, context);
};
