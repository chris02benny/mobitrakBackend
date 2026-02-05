const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./src/config/db');
const tripRoutes = require('./src/routes/tripRoutes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = socketIO(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    }
});

// Make io accessible to routes
app.set('io', io);

// Connect to MongoDB
connectDB();

// Log environment variables (for debugging)
console.log('Environment check:');
console.log('- PORT:', process.env.PORT);
console.log('- MONGO_URI:', process.env.MONGO_URI ? 'Set' : 'Not set');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
console.log('- MAPBOX_ACCESS_TOKEN:', process.env.MAPBOX_ACCESS_TOKEN ? `Set (${process.env.MAPBOX_ACCESS_TOKEN.substring(0, 20)}...)` : 'NOT SET');

// Middleware
app.use(cors());
app.use(express.json());

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join-fleet-room', (fleetManagerId) => {
        socket.join(`fleet-${fleetManagerId}`);
        console.log(`Client ${socket.id} joined fleet room: fleet-${fleetManagerId}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Routes
app.use('/api/trips', tripRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'Trip Service is running' });
});

const PORT = process.env.PORT || 5004;

server.listen(PORT, () => {
    console.log(`Trip Service running on port ${PORT}`);
    console.log('Socket.IO enabled for real-time updates');
});
