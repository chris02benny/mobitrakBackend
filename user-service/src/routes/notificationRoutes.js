const express = require('express');
const router = express.Router();
const NotificationService = require('../services/notificationService');
const jwt = require('jsonwebtoken');

// Middleware to authenticate user
const authenticateUser = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Middleware for internal service-to-service calls
const authenticateInternalService = (req, res, next) => {
    const internalHeader = req.header('X-Internal-Service');
    
    if (internalHeader === 'true') {
        // Internal service call - allow it
        next();
    } else {
        return res.status(403).json({ message: 'Forbidden' });
    }
};

/**
 * @route   POST /api/notifications/internal/create
 * @desc    Create notification (internal service call)
 * @access  Internal services only
 */
router.post('/internal/create', authenticateInternalService, async (req, res) => {
    try {
        const { userId, type, title, message, relatedEntity, metadata, priority, expiresAt } = req.body;

        const notification = await NotificationService.createNotification(
            userId,
            type,
            title,
            message,
            { relatedEntity, metadata, priority, expiresAt }
        );

        // Emit via Socket.IO if io is available
        const io = req.app.get('io');
        if (io) {
            io.to(`user-${userId}`).emit('new-notification', notification);
        }

        res.json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create notification',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { page, limit, unreadOnly } = req.query;

        const result = await NotificationService.getUserNotifications(userId, {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            unreadOnly: unreadOnly === 'true'
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        const count = await NotificationService.getUnreadCount(userId);

        res.json({
            success: true,
            count
        });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch unread count',
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/:id/read', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        const notificationId = req.params.id;

        const notification = await NotificationService.markAsRead(notificationId, userId);

        res.json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read',
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/mark-all-read', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await NotificationService.markAllAsRead(userId);

        res.json({
            success: true,
            message: 'All notifications marked as read',
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark all as read',
            error: error.message
        });
    }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        const notificationId = req.params.id;

        await NotificationService.deleteNotification(notificationId, userId);

        res.json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete notification',
            error: error.message
        });
    }
});

module.exports = router;
