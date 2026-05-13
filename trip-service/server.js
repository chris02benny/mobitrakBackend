/**
 * trip-service/server.js
 * Local development entry point. Starts HTTP server with Socket.IO.
 * For Lambda deployment, use handler.js instead.
 *
 * REFACTORED: Uses modular socket handlers from src/socket/index.js
 * instead of inline monolithic socket code.
 */

const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

const app = require('./app');
const connectDB = require('./src/config/db');
const { registerSocketHandlers } = require('./src/socket/index');

const PORT = process.env.PORT || 5004;

const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = socketIO(server, {
    cors: {
        origin: (origin, callback) => {
            const allowed = [
                'http://localhost:5173',
                'https://mobitrakapp.vercel.app',
                process.env.FRONTEND_URL,
                ...(process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim())
            ].filter(Boolean);
            
            if (!origin || allowed.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    },
    // Production tuning
    pingTimeout: 30000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6, // 1MB max message size
});

// Make io accessible to routes
app.set('io', io);

// Socket.IO connection handling — delegated to modular handlers
io.on('connection', (socket) => {
    registerSocketHandlers(io, socket);
});

// Connect to MongoDB then start server
connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Trip Service running on port ${PORT}`);
        console.log('Socket.IO enabled for real-time updates');
        console.log('Incident management system active');
    });
}).catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
});
