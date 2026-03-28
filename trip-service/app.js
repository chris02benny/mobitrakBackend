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
app.use('/api/trips', tripRoutes);

// ===== Pusher & Real-time Routes =====
const Pusher = require('pusher');

let Trip = null;
let DriverBehaviorLog = null;

// Only initialize Pusher if credentials are provided to gracefully handle missing env vars
let pusherInstance = null;
if (process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET) {
    pusherInstance = new Pusher({
        appId: process.env.PUSHER_APP_ID,
        key: process.env.PUSHER_KEY,
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.PUSHER_CLUSTER || 'ap2',
        useTLS: true,
    });
    
    // 🔧 LOG PUSHER CONFIG ON STARTUP
    console.log('[Pusher] ✅ Initialized with config:', {
        appId: process.env.PUSHER_APP_ID,
        cluster: process.env.PUSHER_CLUSTER || 'ap2',
        useTLS: true,
        keyLength: process.env.PUSHER_KEY?.length || 0,
        secretLength: process.env.PUSHER_SECRET?.length || 0,
    });
} else {
    console.error('[Pusher] ❌ NOT INITIALIZED - Missing credentials:', {
        hasAppId: !!process.env.PUSHER_APP_ID,
        hasKey: !!process.env.PUSHER_KEY,
        hasSecret: !!process.env.PUSHER_SECRET,
    });
}

app.locals.pusher = pusherInstance;

// Deduplication cache: short-lived map to suppress duplicate events from rapid replays
const recentEventCache = new Map();
const DEDUP_WINDOW_MS = 2000; // 2-second dedup window per driver

function getEventHash(driverId, status, monitoringActive, source) {
    return `${driverId}:${status}:${monitoringActive}:${source}`;
}

function isDuplicate(hash) {
    if (recentEventCache.has(hash)) {
        return true;
    }
    recentEventCache.set(hash, true);
    setTimeout(() => recentEventCache.delete(hash), DEDUP_WINDOW_MS);
    return false;
}

/**
 * Normalize and validate monitoring telemetry payload.
 * Contract: {
 *   driverId (required): string,
 *   tripId (optional): string or null,
 *   monitoringActive (optional): boolean, default true,
 *   status (required): enum DROWSY|ALERT|LOW_LIGHT|NO_FACE,
 *   perclos (optional): number 0-1, default 0,
 *   ear (optional): number >=0, default 0,
 *   timestamp (optional): ISO8601, default now,
 *   driverName (optional): string for display
 * }
 * Returns normalized object or null if validation fails.
 */
function validateAndNormalizeMonitoringEvent(body) {
    // Required: driverId
    if (!body.driverId || typeof body.driverId !== 'string') {
        return null;
    }

    // Required: status from defined enum (including health states)
    const validStatuses = ['DROWSY', 'ALERT', 'LOW_LIGHT', 'NO_FACE', 'INACTIVE'];
    if (!body.status || !validStatuses.includes(body.status)) {
        return null;
    }

    // Defaults and coercion
    const normalized = {
        driverId: body.driverId,
        tripId: body.tripId || null,
        monitoringActive: body.monitoringActive !== undefined ? Boolean(body.monitoringActive) : true,
        status: body.status,
        healthStatus: body.status, // Map status to healthStatus field
        source: body.source || 'driver-monitoring',
        perclos: Math.max(0, Math.min(1, parseFloat(body.perclos) || 0)),
        ear: Math.max(0, parseFloat(body.ear) || 0),
        timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
        driverName: body.driverName || null
    };

    return normalized;
}

// ── REST endpoint for driver monitoring telemetry ──────────────────────────────
app.post('/api/realtime/driver-monitoring', async (req, res) => {
    try {
        // 📥 LOG INCOMING PAYLOAD
        console.log('[monitoring] 📥 Incoming telemetry from driver:', {
            driverId: req.body.driverId,
            tripId: req.body.tripId,
            status: req.body.status,
            source: req.body.source,
            monitoringActive: req.body.monitoringActive,
            timestamp: req.body.timestamp,
        });

        // Validate and normalize
        const normalized = validateAndNormalizeMonitoringEvent(req.body);
        if (!normalized) {
            console.warn('[monitoring] ❌ Invalid payload rejected:', JSON.stringify(req.body).slice(0, 100));
            return res.status(400).json({ error: 'Invalid payload: driverId, status required' });
        }

        const { driverId, tripId, status, healthStatus, monitoringActive, source, perclos, ear, timestamp, driverName } = normalized;

        if (!pusherInstance) {
            console.error('[monitoring] ❌ Pusher not configured. Telemetry ignored.');
            return res.status(503).json({ error: 'Pusher not configured' });
        }

        // Deduplication check
        const eventHash = getEventHash(driverId, status, monitoringActive, source);
        if (isDuplicate(eventHash)) {
            console.debug(`[monitoring] ⏭️  Duplicate suppressed: driverId=${driverId}, status=${status}`);
            return res.json({ success: true, suppressed: true });
        }

        // Lazy-load models
        if (!Trip) Trip = require('./src/models/Trip');

        // Build relay payload
        const relayPayload = {
            driverId,
            tripId: tripId || null,
            status,
            healthStatus,
            monitoringActive,
            perclos,
            ear,
            timestamp: timestamp.toISOString(),
            driverName,
            relayedAt: new Date().toISOString()
        };

        // Attempt to resolve fleet manager from tripId or driver's active trip
        let fleetManagerId = null;
        
        console.log('[monitoring] 🔍 Attempting to resolve fleetManagerId. TripId:', tripId);
        
        if (tripId) {
            try {
                const trip = await Trip.findById(tripId).select('fleetManagerId').lean();
                console.log('[monitoring] 📦 Trip lookup result:', { tripId, foundTrip: !!trip, fleetManagerId: trip?.fleetManagerId });
                fleetManagerId = trip?.fleetManagerId;
            } catch (tripErr) {
                console.warn(`[monitoring] ⚠️  Failed to fetch trip ${tripId}:`, tripErr.message);
            }
        } else {
            console.warn('[monitoring] ⚠️  TripId is missing/null - fleet-specific channel will not be triggered. Using fallback global channel.');
        }

        // If no fleet manager from trip, attempt best-effort lookup using fleetManagerId from request
        if (!fleetManagerId && req.user?.fleetManagerId) {
            console.log('[monitoring] 🔄 Fallback: Using fleetManagerId from req.user:', req.user.fleetManagerId);
            fleetManagerId = req.user.fleetManagerId;
        }

        // 🌐 TRIGGER GLOBAL CHANNEL (ALWAYS)
        try {
            await pusherInstance.trigger('global-monitoring', 'admin_monitoring', relayPayload);
            console.log(`[monitoring] ✅ Pushed to global-monitoring: driverId=${driverId}, status=${status}`);
        } catch (pushErr) {
            console.error('[monitoring] ❌ Failed to trigger global-monitoring:', pushErr.message);
        }

        // 👥 TRIGGER FLEET-SPECIFIC CHANNEL (IF RESOLVED)
        if (fleetManagerId) {
            try {
                await pusherInstance.trigger(`fleet-${fleetManagerId}`, 'admin_monitoring', relayPayload);
                console.log(`[monitoring] ✅ Pushed to fleet-${fleetManagerId}: driverId=${driverId}`);
            } catch (fleetPushErr) {
                console.error(`[monitoring] ❌ Failed to trigger fleet-${fleetManagerId}:`, fleetPushErr.message);
            }
        } else {
            console.warn('[monitoring] ⚠️  No fleetManagerId resolved - fleet-specific event NOT triggered (global fallback will handle it)');
        }

        // Persist to MongoDB (non-blocking) with extended schema
        if (!DriverBehaviorLog) {
            try { DriverBehaviorLog = require('./src/models/DriverBehaviorLog'); } catch (_) { }
        }
        if (DriverBehaviorLog) {
            DriverBehaviorLog.create({
                driverId,
                tripId: tripId || null,
                status,
                healthStatus,
                monitoringActive,
                source: source || 'driver-monitoring',
                perclos,
                ear,
                timestamp
            }).catch(err => console.error('[monitoring] DB log error:', err.message));
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[monitoring] ❌ Unhandled error:', err.message, err.stack);
        res.status(500).json({ error: 'Failed to relay telemetry' });
    }
});

// ── REST endpoint for location updates ────────────────────────────────────────
app.post('/api/realtime/location-update', async (req, res) => {
    try {
        const { fleetManagerId, vehicleId, location, tripId } = req.body;

        if (!pusherInstance) {
            return res.status(503).json({ error: 'Pusher not configured' });
        }

        if (fleetManagerId) {
            await pusherInstance.trigger(`fleet-${fleetManagerId}`, 'location-update', {
                vehicleId, location, tripId
            });
        }
        // Also broadcast globally
        await pusherInstance.trigger('global-monitoring', 'location-update', {
            vehicleId, location, tripId
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[location] Error triggering location-update:', err.message);
        res.status(500).json({ error: 'Failed to relay location update' });
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
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

module.exports = app;
