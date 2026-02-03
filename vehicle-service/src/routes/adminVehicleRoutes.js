const express = require('express');
const router = express.Router();
const Vehicle = require('../models/Vehicle');
const jwt = require('jsonwebtoken');

/**
 * Admin Middleware - Verifies admin role
 */
const adminAuth = async (req, res, next) => {
    const token = req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        
        // Check if user role is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }
        
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

/**
 * @route   GET /api/vehicles/admin/business/:businessId
 * @desc    Get all vehicles for a specific business (Admin only)
 * @access  Admin
 */
router.get('/business/:businessId', adminAuth, async (req, res) => {
    try {
        const { businessId } = req.params;
        
        const vehicles = await Vehicle.find({ businessId }).sort({ createdAt: -1 });
        
        res.json({
            vehicles,
            count: vehicles.length
        });
    } catch (err) {
        console.error('Error fetching vehicles for business:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

/**
 * @route   GET /api/vehicles/admin/vehicle/:vehicleId
 * @desc    Get single vehicle details (Admin only)
 * @access  Admin
 */
router.get('/vehicle/:vehicleId', adminAuth, async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.vehicleId);
        
        if (!vehicle) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }
        
        res.json({ vehicle });
    } catch (err) {
        console.error('Error fetching vehicle:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

/**
 * @route   GET /api/vehicles/admin/stats
 * @desc    Get vehicle statistics (Admin only)
 * @access  Admin
 */
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const totalVehicles = await Vehicle.countDocuments();
        
        // Get vehicles by fuel type
        const fuelStats = await Vehicle.aggregate([
            { $group: { _id: '$fuelUsed', count: { $sum: 1 } } }
        ]);
        
        // Get vehicles by class
        const classStats = await Vehicle.aggregate([
            { $group: { _id: '$vehicleClass', count: { $sum: 1 } } }
        ]);
        
        res.json({
            totalVehicles,
            fuelStats,
            classStats
        });
    } catch (err) {
        console.error('Error fetching vehicle stats:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
