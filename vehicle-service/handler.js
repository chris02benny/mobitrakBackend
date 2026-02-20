/**
 * vehicle-service/handler.js
 * AWS Lambda entry point for vehicle-service.
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
    if (!isConnected) {
        await connectDB();
        isConnected = true;
    }
    return serverlessHandler(event, context);
};
