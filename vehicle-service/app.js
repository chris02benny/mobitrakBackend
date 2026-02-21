/**
 * vehicle-service/app.js
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
 *   5. Global error handler
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const vehicleRoutes = require('./src/routes/vehicleRoutes');
const adminVehicleRoutes = require('./src/routes/adminVehicleRoutes');
const trackingDeviceRoutes = require('./src/routes/trackingDeviceRoutes');

const app = express();

// ===== Body parsing (must come first) =====
app.use(express.json());
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
app.options('*', cors(corsOptions));

// ===== Routes =====
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/vehicles/admin', adminVehicleRoutes);
app.use('/api/tracking-device', trackingDeviceRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'vehicle-service' });
});

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'vehicle-service' });
});

// ===== Global Error Handler =====
app.use((err, req, res, next) => {
    console.error('[vehicle-service] Unhandled error:', err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

module.exports = app;
