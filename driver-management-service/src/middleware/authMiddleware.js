const jwt = require('jsonwebtoken');

/**
 * Auth Middleware
 * 
 * Validates JWT token from User Service and extracts user info.
 * Does NOT perform authentication - only consumes pre-authenticated tokens.
 */

const authMiddleware = (req, res, next) => {
    // Get token from header
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');

    // Check if no token
    if (!token) {
        return res.status(401).json({ 
            success: false,
            message: 'No token, authorization denied' 
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Attach user info to request
        req.user = decoded.user || decoded;
        
        // Ensure userId is available
        if (!req.user.id && !req.user.userId) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid token structure' 
            });
        }

        // Normalize userId
        req.user.userId = req.user.id || req.user.userId;
        
        next();
    } catch (err) {
        console.error('Auth middleware error:', err.message);
        
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token has expired' 
            });
        }
        
        res.status(401).json({ 
            success: false,
            message: 'Token is not valid' 
        });
    }
};

/**
 * Role-based access middleware
 * @param  {...string} roles - Allowed roles
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false,
                message: 'Authentication required' 
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false,
                message: `Access denied. Required role: ${roles.join(' or ')}` 
            });
        }

        next();
    };
};

/**
 * Driver-only access middleware
 */
const requireDriver = requireRole('driver');

/**
 * Fleet Manager/Company-only access middleware
 */
const requireCompany = requireRole('fleetmanager', 'admin');

/**
 * Driver or Company access middleware
 */
const requireDriverOrCompany = requireRole('driver', 'fleetmanager', 'admin');

module.exports = {
    authMiddleware,
    requireRole,
    requireDriver,
    requireCompany,
    requireDriverOrCompany
};
