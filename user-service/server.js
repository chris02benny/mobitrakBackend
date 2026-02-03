const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const passport = require('passport');

dotenv.config();

const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/mobitrak_users';

// Passport Config
require('./src/config/passport'); // Added passport config

// Middleware
app.use(cors());
app.use(express.json());
app.use(passport.initialize()); // Added passport initialize

// Routes
app.use('/api/users', authRoutes);
app.use('/api/admin', adminRoutes);

// Health Check
app.get('/', (req, res) => {
    res.send('User Service is running');
});

// Database Connection
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB User Database Connected'))
    .catch(err => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
    console.log(`User Service running on port ${PORT}`);
});
