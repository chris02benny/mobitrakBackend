/**
 * vehicle-service/app.js
 * Express app setup — no server.listen here.
 * Used by both:
 *   - server.js (local Docker dev)
 *   - handler.js (AWS Lambda, wrapped with serverless-http)
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const vehicleRoutes = require('./src/routes/vehicleRoutes');
const adminVehicleRoutes = require('./src/routes/adminVehicleRoutes');
const trackingDeviceRoutes = require('./src/routes/trackingDeviceRoutes');

const app = express();

// ===== Middleware =====
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://mobitrakapp.vercel.app')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.options('*', (req, res) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type,x-auth-token,Authorization');
        res.set('Access-Control-Allow-Credentials', 'true');
    }
    res.sendStatus(200);
});

app.use(cors({
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
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
