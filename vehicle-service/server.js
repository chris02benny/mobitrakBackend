/**
 * vehicle-service/server.js
 * Local development entry point. Starts HTTP server on PORT.
 * For Lambda deployment, use handler.js instead.
 */

const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5002;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Vehicle Service running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
});
