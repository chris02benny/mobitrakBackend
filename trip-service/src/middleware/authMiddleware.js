const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        const token = req.header('x-auth-token');

        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Debug log to see what's in the token
        console.log('Decoded user:', decoded);
        
        // Handle both formats: { id, role } and { user: { id, role } }
        if (decoded.user) {
            req.user = decoded.user;
        } else {
            req.user = decoded;
        }
        
        console.log('Setting req.user:', req.user);
        
        next();
    } catch (error) {
        console.error('JWT verification error:', error.message);
        res.status(401).json({ message: 'Token is not valid' });
    }
};

const fleetManagerOnly = (req, res, next) => {
    console.log('Checking role:', req.user.role);
    
    // Accept fleetmanager, business, and admin roles
    const allowedRoles = ['fleetmanager', 'business', 'admin'];
    
    if (!allowedRoles.includes(req.user.role)) {
        console.log('Access denied for role:', req.user.role);
        return res.status(403).json({ 
            message: 'Access denied. Fleet managers or admins only.',
            currentRole: req.user.role,
            allowedRoles: allowedRoles
        });
    }
    
    console.log('Access granted for role:', req.user.role);
    next();
};

module.exports = { authMiddleware, fleetManagerOnly };
