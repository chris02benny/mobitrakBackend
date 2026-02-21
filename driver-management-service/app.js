/**
 * driver-management-service/app.js
 * Express app setup — no server.listen here.
 * Used by both:
 *   - server.js (local Docker dev)
 *   - handler.js (AWS Lambda, wrapped with serverless-http)
 *
 * CORS ARCHITECTURE:
 *   API Gateway HTTP API with method:any routes forwards ALL methods — including
 *   OPTIONS — directly to Lambda. Both API Gateway cors config and Express cors()
 *   coexist safely. Express handles every invocation.
 *
 * MIDDLEWARE ORDER (enforced):
 *   1. JSON + URL-encoded body parsing
 *   2. cors() middleware (sets CORS headers on all responses)
 *   3. app.options('*', cors()) — responds 200 to any OPTIONS preflight
 *   4. Route registration
 *   5. 404 handler
 *   6. Global error handler
 *   Note: app.options fires before routes, so OPTIONS never reaches the 404 handler.
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const routes = require('./src/routes');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();

// ===== Body parsing (must come first) =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ===== CORS setup =====
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://mobitrakapp.vercel.app')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin '${origin}' not allowed`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization'],
    credentials: true,
    maxAge: 600,
};

// Apply CORS headers to all responses.
app.use(cors(corsOptions));

// Respond 200 to ALL OPTIONS preflights before any route or auth middleware.
// Required because API Gateway HTTP API with method:any forwards OPTIONS to Lambda.
// Registering before routes also prevents OPTIONS from reaching the 404 handler below.
app.options('*', cors(corsOptions));

// Structured request logging
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// ===== Routes =====
app.use('/api/drivers', routes);

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'driver-management-service',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'driver-management-service' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
