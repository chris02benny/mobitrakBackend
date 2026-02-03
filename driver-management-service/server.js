const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import configurations
const connectDB = require('./src/config/db');
const driverEventEmitter = require('./src/config/eventEmitter');

// Import routes
const routes = require('./src/routes');

// Import middleware
const { errorHandler } = require('./src/middleware/errorHandler');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5003;

// ===== Middleware =====
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// ===== Routes =====

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        service: 'Driver Management Service',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

// Health check with details
app.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'Driver Management Service',
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// API routes
app.use('/api/drivers', routes);

// ===== Error Handling =====

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Global error handler
app.use(errorHandler);

// ===== Event Listeners (for logging/debugging) =====
if (process.env.NODE_ENV !== 'production') {
    driverEventEmitter.on('DRIVER_HIRED', (event) => {
        console.log('[EVENT LISTENER] DRIVER_HIRED:', JSON.stringify(event, null, 2));
    });

    driverEventEmitter.on('DRIVER_RELEASED', (event) => {
        console.log('[EVENT LISTENER] DRIVER_RELEASED:', JSON.stringify(event, null, 2));
    });
}

// ===== Database Connection & Server Start =====
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start server
        app.listen(PORT, () => {
            console.log('=========================================');
            console.log(`  Driver Management Service`);
            console.log(`  Version: 1.0.0`);
            console.log(`  Port: ${PORT}`);
            console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('=========================================');
            console.log('  Available routes:');
            console.log('    GET  /                        - Service info');
            console.log('    GET  /health                  - Health check');
            console.log('    *    /api/drivers/profile     - Profile management');
            console.log('    *    /api/drivers/job-requests - Hiring workflow');
            console.log('    *    /api/drivers/employments - Employment management');
            console.log('    *    /api/drivers/ratings     - Ratings & reviews');
            console.log('=========================================');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;
