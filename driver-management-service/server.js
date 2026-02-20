/**
 * driver-management-service/server.js
 * Local development entry point. Starts HTTP server on PORT.
 * For Lambda deployment, use handler.js instead.
 */

const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./src/config/db');
const driverEventEmitter = require('./src/config/eventEmitter');

const PORT = process.env.PORT || 5003;

// ===== Event Listeners (for logging/debugging in local dev) =====
if (process.env.NODE_ENV !== 'production') {
    driverEventEmitter.on('DRIVER_HIRED', (event) => {
        console.log('[EVENT LISTENER] DRIVER_HIRED:', JSON.stringify(event, null, 2));
    });

    driverEventEmitter.on('DRIVER_RELEASED', (event) => {
        console.log('[EVENT LISTENER] DRIVER_RELEASED:', JSON.stringify(event, null, 2));
    });
}

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

// ===== Database Connection & Server Start =====
const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log('=========================================');
            console.log('  Driver Management Service');
            console.log(`  Port: ${PORT}`);
            console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('=========================================');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
