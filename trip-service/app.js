/**
 * trip-service/app.js
 * Express app setup — no server.listen here.
 * Used by both:
 *   - server.js (local Docker dev, adds Socket.IO + HTTP server)
 *   - handler.js (AWS Lambda, wrapped with serverless-http)
 *
 * NOTE: Socket.IO is initialized in server.js for local dev.
 *       On Lambda, Socket.IO polling transport works via HTTP fallback.
 *       app.set('io', io) is called from server.js for local, and from handler.js for Lambda.
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

const tripRoutes = require('./src/routes/tripRoutes');
const incidentRoutes = require('./src/routes/incidentRoutes');

const app = express();

// ===== Body parsing (must come first) =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== CORS setup =====
const allowedOrigins = [
    'http://localhost:5173',
    'https://mobitrakapp.vercel.app',
    process.env.FRONTEND_URL,
    ...(process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim())
].filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        // In production, if we're behind a proxy, origin might be missing for some requests
        if (!origin) return callback(null, true);
        
        // Check if origin is allowed
        const isAllowed = allowedOrigins.some(allowed => 
            origin === allowed || origin.startsWith(allowed)
        );

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Origin '${origin}' not explicitly allowed. Allowing anyway to prevent blocking, but logging for security review.`);
            // During troubleshooting, we allow all but log warning
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

// Respond 200 to ALL OPTIONS preflights before any route or auth middleware.
// Required because API Gateway HTTP API with method:any forwards OPTIONS to Lambda.
app.options('*', cors(corsOptions));

// ===== Routes =====
app.use('/api/trips', tripRoutes);
app.use('/api/incidents', incidentRoutes);

// ===== MongoDB-backed Real-time Routes (Pusher replacement) =====
let Alert = null;
let DriverBehaviorLog = null;

// Lazy-load models on first use
function getAlert() {
    if (!Alert) Alert = require('./src/models/Alert');
    return Alert;
}

function getDriverBehaviorLog() {
    if (!DriverBehaviorLog) {
        try { DriverBehaviorLog = require('./src/models/DriverBehaviorLog'); } catch (_) { }
    }
    return DriverBehaviorLog;
}

// ── REST endpoint for driver monitoring telemetry (MongoDB write) ──────────────
// Driver POSTs alert data here. The companyId links the alert to the hiring
// fleet manager (from the employments collection).
app.post('/api/realtime/driver-monitoring', async (req, res) => {
    try {
        const { driverId, status, perclos, ear, timestamp, monitoringActive, source } = req.body;
        // Accept both field names — frontend may send 'fleetManagerId', 'companyId', or 'businessId'
        const companyId = req.body.companyId || req.body.fleetManagerId || req.body.businessId;

        // Validate required fields
        if (!driverId || !companyId || !status) {
            return res.status(400).json({
                error: 'driverId, companyId (or fleetManagerId), and status are required'
            });
        }

        const AlertModel = getAlert();

        // Create alert document
        const alertDoc = await AlertModel.create({
            driverId,
            companyId,
            status,
            monitoringActive: monitoringActive !== undefined ? monitoringActive : true,
            source: source || 'frame-analysis',
            perclos: perclos || 0,
            ear: ear || 0,
            timestamp: timestamp ? new Date(timestamp) : new Date()
        });

        console.log('✅ Alert stored:', { id: alertDoc._id, driverId, companyId, status });

        // Emit real-time socket event if io is available
        const io = req.app.get('io');
        if (io) {
            // Emit to the specific fleet manager's room
            io.to(`fleet-${companyId}`).emit('new-alert', alertDoc);
            console.log(`[socket] Emitted new-alert to fleet-${companyId}`);
        }

        res.json({ success: true, id: alertDoc._id });
    } catch (err) {
        console.error('❌ Telemetry error:', err.message);
        res.status(500).json({ error: 'Failed to store alert' });
    }
});

// ── REST endpoint for fetching alerts (polling) ─────────────────────────────────
// Fleet manager GETs alerts for all drivers hired under their companyId.
app.get('/api/alerts', async (req, res) => {
    try {
        const { companyId, since, limit = 20 } = req.query;

        if (!companyId) {
            return res.status(400).json({ error: 'companyId is required' });
        }

        const AlertModel = getAlert();
        const query = { companyId };

        // Optional: filter by timestamp (incremental polling)
        if (since) {
            query.timestamp = { $gt: new Date(since) };
        }

        const alerts = await AlertModel.find(query)
            .sort({ timestamp: -1 })
            .limit(Number(limit) || 20)
            .lean();

        console.log('[alerts] Fetched', alerts.length, 'alerts for companyId', companyId);

        res.json(alerts);
    } catch (err) {
        console.error('❌ Fetch alerts error:', err.message);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

// ── Legacy location-update endpoint (stubbed for compatibility) ─────────────────
// Note: This previously used Pusher. Now returns a stub response.
app.post('/api/realtime/location-update', async (req, res) => {
    try {
        console.warn('[location] Legacy location-update endpoint called (no longer active)');
        // Return success without triggering anything
        res.json({ success: true, message: 'location-update endpoint is deprecated' });
    } catch (err) {
        console.error('[location] Error:', err.message);
        res.status(500).json({ error: 'location-update endpoint error' });
    }
});

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'trip-service' });
});

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'trip-service' });
});

// ===== Global Error Handler =====
app.use((err, req, res, next) => {
    console.error('[trip-service] Unhandled error:', err);
    
    // Set CORS headers manually in case the 'cors' middleware was bypassed or failed
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.status(err.status || 500).json({ 
        message: 'Internal Server Error', 
        error: err.message,
        path: req.path
    });
});

module.exports = app;
