/**
 * user-service/app.js
 * Express app setup — no server.listen here.
 * Used by both:
 *   - server.js (local Docker dev, adds Socket.IO + HTTP server)
 *   - handler.js (AWS Lambda, wrapped with serverless-http)
 *
 * CORS ARCHITECTURE:
 *   In production (AWS Lambda + API Gateway HTTP API):
 *     1. Browser sends OPTIONS preflight to API Gateway.
 *     2. API Gateway reads httpApi.cors from serverless.yml and responds
 *        with the correct CORS headers — Lambda is NEVER invoked for OPTIONS.
 *     3. Browser sends the real POST/GET request; Lambda responds with
 *        CORS headers via the cors() middleware below.
 *
 *   In local development (serverless-offline / Docker):
 *     1. serverless-offline does NOT implement the httpApi.cors intercept.
 *     2. The OPTIONS preflight reaches Express. The app.options('*') handler
 *        below responds inline so local dev works without any proxy changes.
 *
 *   Result: keeping both layers is intentional and safe — they never conflict.
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const passport = require('passport');

dotenv.config();

const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

const app = express();

// Passport Config
require('./src/config/passport');

// ===== CORS setup =====
// Build allowed-origins list from env var so Express is consistent with
// the API Gateway config in serverless.yml.
// NOTE: This env var does NOT affect API Gateway — see serverless.yml comment.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://mobitrakapp.vercel.app')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

// Inline OPTIONS handler — only reached in local dev (serverless-offline).
// In production, API Gateway handles OPTIONS before invoking Lambda.
// Always responds 200 so local preflight never fails.
app.options('*', (req, res) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Access-Control-Allow-Credentials', 'true');
    }
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,x-auth-token,Authorization');
    res.set('Access-Control-Max-Age', '600');
    res.sendStatus(200);
});

app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server / Lambda inter-service calls (no origin header)
        // and any explicitly approved browser origin.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin '${origin}' not allowed`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization'],
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// ===== Routes =====
app.use('/api/users', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'user-service' });
});

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'user-service' });
});

// ===== Global Error Handler =====
app.use((err, req, res, next) => {
    console.error('[user-service] Unhandled error:', err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

module.exports = app;
