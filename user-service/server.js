const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const passport = require('passport');

dotenv.config();

const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/mobitrak_users';

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

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected to user-service:', socket.id);

    socket.on('join-user-room', (userId) => {
        socket.join(`user-${userId}`);
        console.log(`Client ${socket.id} joined user room: user-${userId}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected from user-service:', socket.id);
    });
});

// Passport Config
require('./src/config/passport'); // Added passport config

// Middleware
app.use(cors());
app.use(express.json());
app.use(passport.initialize()); // Added passport initialize

// Routes
app.use('/api/users', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Health Check
app.get('/', (req, res) => {
    res.send('User Service is running');
});

// Database Connection
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB User Database Connected'))
    .catch(err => console.error('MongoDB connection error:', err));

server.listen(PORT, () => {
    console.log(`User Service running on port ${PORT}`);
    console.log('Socket.IO enabled for real-time profile updates');
});
