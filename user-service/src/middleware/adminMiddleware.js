const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Admin Middleware
 * Verifies that the authenticated user has admin role
 */
module.exports = async function (req, res, next) {
    // Get token from header
    const token = req.header('x-auth-token');

    // Check if no token
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;

        // Check if user is admin
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        next();
    } catch (err) {
        console.error('Admin middleware error:', err);
        res.status(401).json({ message: 'Token is not valid' });
    }
};
