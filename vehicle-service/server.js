const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./src/config/db');
const vehicleRoutes = require('./src/routes/vehicleRoutes');

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

const PORT = process.env.PORT || 5002;

app.get('/', (req, res) => {
    res.send('Vehicle Service is running');
});

app.listen(PORT, () => {
    console.log(`Vehicle Service running on port ${PORT}`);
});
