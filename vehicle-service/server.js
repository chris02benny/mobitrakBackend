const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./src/config/db');
const vehicleRoutes = require('./src/routes/vehicleRoutes');
const adminVehicleRoutes = require('./src/routes/adminVehicleRoutes');
const trackingDeviceRoutes = require('./src/routes/trackingDeviceRoutes');

dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploads directory static
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/vehicles/admin', adminVehicleRoutes);
app.use('/api/tracking-device', trackingDeviceRoutes);

const PORT = process.env.PORT || 5002;

app.get('/', (req, res) => {
    res.send('Vehicle Service is running');
});

app.listen(PORT, () => {
    console.log(`Vehicle Service running on port ${PORT}`);
});
