const express = require('express');
const router = express.Router();
const User = require('../models/User');
const adminAuth = require('../middleware/adminMiddleware');
const { sendVerificationApprovedEmail, sendVerificationRejectedEmail } = require('../services/emailService');

/**
 * @route   PUT /api/admin/users/:id/internal-update
 * @desc    Internal endpoint for updating user data from other services (no auth required for inter-service calls)
 * @access  Internal services only
 */
router.put('/users/:id/internal-update', async (req, res) => {
    try {
        const { companyName } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update fields if provided
        if (companyName !== undefined) {
            user.companyName = companyName;
        }

        await user.save();

        res.json({
            message: 'User updated successfully',
            user: {
                id: user._id,
                email: user.email,
                companyName: user.companyName
            }
        });
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (optionally filter by role)
 * @access  Admin only
 */
router.get('/users', adminAuth, async (req, res) => {
    try {
        const { role, page = 1, limit = 20, search } = req.query;
        
        let query = {};
        
        // Filter by role if provided
        if (role && role !== 'all') {
            query.role = role;
        }
        
        // Search by name, email, or company name
        if (search) {
            query.$or = [
                { email: { $regex: search, $options: 'i' } },
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const users = await User.find(query)
            .select('-password -otp -otpExpires')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await User.countDocuments(query);
        
        res.json({
            users,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

/**
 * @route   GET /api/admin/businesses
 * @desc    Get all fleet managers/businesses
 * @access  Admin only
 */
router.get('/businesses', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, verificationStatus } = req.query;
        
        let query = { role: 'fleetmanager' };
        
        // Filter by verification status
        if (verificationStatus && verificationStatus !== 'all') {
            query.verificationStatus = verificationStatus;
        }
        
        // Search by name, email, or company name
        if (search) {
            query.$or = [
                { email: { $regex: search, $options: 'i' } },
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const businesses = await User.find(query)
            .select('-password -otp -otpExpires')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await User.countDocuments(query);
        
        // Get verification stats
        const pendingCount = await User.countDocuments({ 
            role: 'fleetmanager', 
            verificationStatus: 'pending' 
        });
        const verifiedCount = await User.countDocuments({ 
            role: 'fleetmanager', 
            isVerifiedBusiness: true 
        });
        
        res.json({
            businesses,
            stats: {
                total,
                pending: pendingCount,
                verified: verifiedCount
            },
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error fetching businesses:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

/**
 * @route   GET /api/admin/drivers
 * @desc    Get all drivers
 * @access  Admin only
 */
router.get('/drivers', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, profileComplete } = req.query;
        
        let query = { role: 'driver' };
        
        // Filter by profile completion status
        if (profileComplete !== undefined && profileComplete !== 'all') {
            query.isProfileComplete = profileComplete === 'true';
        }
        
        // Search by name or email
        if (search) {
            query.$or = [
                { email: { $regex: search, $options: 'i' } },
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const drivers = await User.find(query)
            .select('-password -otp -otpExpires')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await User.countDocuments(query);
        
        // Get profile completion stats
        const completeCount = await User.countDocuments({ 
            role: 'driver', 
            isProfileComplete: true 
        });
        
        res.json({
            drivers,
            stats: {
                total,
                profileComplete: completeCount,
                profileIncomplete: total - completeCount
            },
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error fetching drivers:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

/**
 * @route   GET /api/admin/user/:id
 * @desc    Get single user details
 * @access  Admin only
 */
router.get('/user/:id', adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password -otp -otpExpires');
            
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({ user });
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

/**
 * @route   GET /api/admin/verification-requests
 * @desc    Get all pending verification requests
 * @access  Admin only
 */
router.get('/verification-requests', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const requests = await User.find({ 
            role: 'fleetmanager', 
            verificationStatus: 'pending' 
        })
            .select('-password -otp -otpExpires')
            .sort({ verificationRequestedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await User.countDocuments({ 
            role: 'fleetmanager', 
            verificationStatus: 'pending' 
        });
        
        res.json({
            requests,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error fetching verification requests:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

/**
 * @route   PUT /api/admin/verify-business/:id
 * @desc    Approve or reject business verification
 * @access  Admin only
 */
router.put('/verify-business/:id', adminAuth, async (req, res) => {
    try {
        const { action, notes } = req.body;
        
        if (!action || !['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'Invalid action. Use approve or reject.' });
        }
        
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (user.role !== 'fleetmanager') {
            return res.status(400).json({ message: 'User is not a fleet manager' });
        }
        
        if (action === 'approve') {
            user.verificationStatus = 'approved';
            user.isVerifiedBusiness = true;
        } else {
            user.verificationStatus = 'rejected';
            user.isVerifiedBusiness = false;
        }
        
        user.verificationProcessedAt = new Date();
        user.verificationProcessedBy = req.user.id;
        if (notes) {
            user.verificationNotes = notes;
        }
        
        await user.save();
        
        // Send email notification
        if (action === 'approve') {
            await sendVerificationApprovedEmail(user.email, user.companyName);
        } else {
            await sendVerificationRejectedEmail(user.email, user.companyName, notes);
        }
        
        res.json({
            message: `Business verification ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
            user: {
                id: user._id,
                companyName: user.companyName,
                email: user.email,
                isVerifiedBusiness: user.isVerifiedBusiness,
                verificationStatus: user.verificationStatus
            }
        });
    } catch (err) {
        console.error('Error processing verification:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

/**
 * @route   GET /api/admin/stats
 * @desc    Get dashboard statistics
 * @access  Admin only
 */
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalBusinesses = await User.countDocuments({ role: 'fleetmanager' });
        const totalDrivers = await User.countDocuments({ role: 'driver' });
        const verifiedBusinesses = await User.countDocuments({ 
            role: 'fleetmanager', 
            isVerifiedBusiness: true 
        });
        const pendingVerifications = await User.countDocuments({ 
            role: 'fleetmanager', 
            verificationStatus: 'pending' 
        });
        const driversWithCompleteProfile = await User.countDocuments({ 
            role: 'driver', 
            isProfileComplete: true 
        });
        
        // Recent registrations (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentRegistrations = await User.countDocuments({ 
            createdAt: { $gte: weekAgo } 
        });
        
        res.json({
            stats: {
                totalUsers,
                totalBusinesses,
                totalDrivers,
                verifiedBusinesses,
                pendingVerifications,
                driversWithCompleteProfile,
                recentRegistrations
            }
        });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
