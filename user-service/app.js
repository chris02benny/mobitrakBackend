/**
 * user-service/app.js
 * Express app setup — no server.listen here.
 * Used by both:
 *   - server.js (local Docker dev, adds Socket.IO + HTTP server)
 *   - handler.js (AWS Lambda, wrapped with serverless-http)
 *
 * CORS ARCHITECTURE:
 *   API Gateway HTTP API with method:any routes forwards ALL methods — including
 *   OPTIONS — directly to Lambda. API Gateway's httpApi.cors block alone is
 *   NOT sufficient when method:any is used. Express must also handle OPTIONS.
 *
 *   Both layers coexist safely:
 *     - API Gateway cors config handles non-method:any routes (if any).
 *     - Express cors() + app.options('*', cors()) handles every invocation.
 *
 * MIDDLEWARE ORDER (enforced):
 *   1. JSON + URL-encoded body parsing
 *   2. cors() middleware (sets CORS headers on all responses)
 *   3. app.options('*', cors()) — responds 200 to any OPTIONS preflight
 *   4. Route registration
 *   5. Global error handler
 *   Auth middleware lives inside individual route handlers only.
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

// ===== Body parsing (must come first) =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// ===== CORS setup =====
const allowedOrigins = [
    'http://localhost:5173',
    'https://mobitrakapp.vercel.app',
    process.env.FRONTEND_URL,
    ...(process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim())
].filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        
        const isAllowed = allowedOrigins.some(allowed => 
            origin === allowed || origin.startsWith(allowed)
        );

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`[CORS] User Service: Origin '${origin}' not explicitly allowed. Allowing anyway.`);
            callback(null, true);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization', 'x-internal-service'],
    credentials: true,
    maxAge: 600,
};

// Apply CORS headers to all responses.
app.use(cors(corsOptions));

// Respond 200 to ALL OPTIONS preflights — this fires before any route or auth
// middleware, ensuring preflight never triggers a 401/404 from Express.
// Required because API Gateway HTTP API with method:any forwards OPTIONS to Lambda.
app.options('*', cors(corsOptions));

// ===== Routes =====
app.use('/api/users', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users/notifications', notificationRoutes);

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
    
    // Set CORS headers manually in case the 'cors' middleware was bypassed or failed
    const origin = req.headers.origin;
    const allowed = [
        'http://localhost:5173',
        'https://mobitrakapp.vercel.app',
        process.env.FRONTEND_URL,
        ...(process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim())
    ].filter(Boolean);

    if (origin && allowed.some(a => origin === a || origin.startsWith(a.replace(/\/$/, '')))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (!origin) {
        // Fallback for missing origin header
        res.setHeader('Access-Control-Allow-Origin', 'https://mobitrakapp.vercel.app');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.status(err.status || 500).json({ 
        message: 'Internal Server Error', 
        error: err.message,
        path: req.path
    });
});

module.exports = app;
