const mongoose = require('mongoose');

/**
 * Connect to MongoDB with connection caching.
 * On Lambda, containers are reused across invocations — this prevents
 * opening a new connection on every request.
 */
const connectDB = async () => {
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (mongoose.connection.readyState === 1) {
        console.log('[trip-service] MongoDB already connected — reusing connection.');
        return;
    }

    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000
        });
        console.log('[trip-service] MongoDB connected.');
    } catch (error) {
        console.error('[trip-service] MongoDB connection error:', error.message);
        // Do NOT call process.exit(1) in Lambda — let the error propagate
        throw error;
    }
};

module.exports = connectDB;
