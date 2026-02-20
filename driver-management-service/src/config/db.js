const mongoose = require('mongoose');

/**
 * Connect to MongoDB with connection caching.
 * On Lambda, containers are reused across invocations — this prevents
 * opening a new connection on every request.
 */
const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        console.log('[driver-service] MongoDB already connected — reusing connection.');
        return;
    }

    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000
        });
        console.log(`[driver-service] MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`[driver-service] MongoDB connection error: ${error.message}`);
        throw error;
    }
};

module.exports = connectDB;
