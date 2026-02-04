const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./src/config/db');
const tripRoutes = require('./src/routes/tripRoutes');

const app = express();

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

// Routes
app.use('/api/trips', tripRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'Trip Service is running' });
});

const PORT = process.env.PORT || 5004;

app.listen(PORT, () => {
    console.log(`Trip Service running on port ${PORT}`);
});
