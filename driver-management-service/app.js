/**
 * driver-management-service/app.js
 * Express app setup — no server.listen here.
 * Used by both:
 *   - server.js (local Docker dev)
 *   - handler.js (AWS Lambda, wrapped with serverless-http)
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const routes = require('./src/routes');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();

// ===== Middleware =====
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin '${origin}' not allowed`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization'],
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
