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
}

app.locals.pusher = pusherInstance;

// ── REST endpoint for driver monitoring telemetry ──────────────────────────────
app.post('/api/realtime/driver-monitoring', async (req, res) => {
    try {
        const { driverId, tripId, status, perclos, ear, timestamp, driverName } = req.body;
        if (!driverId) return res.status(400).json({ error: 'driverId required' });

        if (!pusherInstance) {
            console.warn('[monitoring] Pusher not configured. Telemetry ignored.');
            return res.status(503).json({ error: 'Pusher not configured' });
        }

        // Lazy-load models
        if (!Trip) Trip = require('./src/models/Trip');

        // Trigger to global channel so ALL fleet managers receive it
        await pusherInstance.trigger('global-monitoring', 'admin_monitoring', {
            driverId,
            tripId: tripId || null,
            status,
            perclos: perclos ?? 0,
            ear: ear ?? 0,
            timestamp: timestamp || new Date().toISOString(),
            driverName: driverName || null,
        });

        // Also trigger to the specific fleet manager's channel if there's an active trip
        if (tripId) {
            try {
                const trip = await Trip.findById(tripId).select('fleetManagerId').lean();
                if (trip?.fleetManagerId) {
                    await pusherInstance.trigger(`fleet-${trip.fleetManagerId}`, 'admin_monitoring', {
                        driverId,
                        tripId,
                        status,
                        perclos: perclos ?? 0,
                        ear: ear ?? 0,
                        timestamp: timestamp || new Date().toISOString(),
                        driverName: driverName || null,
                    });
                }
            } catch (tripErr) {
                console.error('[monitoring] Error fetching trip for fleet-room trigger:', tripErr.message);
            }
        }

        // Persist to MongoDB (non-blocking)
        if (!DriverBehaviorLog) {
            try { DriverBehaviorLog = require('./src/models/DriverBehaviorLog'); } catch (_) { }
        }
        if (DriverBehaviorLog) {
            DriverBehaviorLog.create({
                driverId,
                tripId: tripId || null,
                status,
                perclos: perclos || 0,
                ear: ear || 0,
                timestamp: timestamp ? new Date(timestamp) : new Date()
            }).catch(err => console.error('[monitoring] DB log error:', err.message));
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[monitoring] Error triggering Pusher event:', err.message);
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
