/**
 * user-service/app.js
 * Express app setup — no server.listen here.
 * Used by both:
 *   - server.js (local Docker dev, adds Socket.IO + HTTP server)
 *   - handler.js (AWS Lambda, wrapped with serverless-http)
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

// ===== Middleware =====
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server / Lambda inter-service calls (no origin) and approved origins
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
