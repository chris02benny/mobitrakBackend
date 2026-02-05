const Notification = require('../models/Notification');

class NotificationService {
    /**
     * Create a new notification
     */
    static async createNotification(userId, type, title, message, options = {}) {
        try {
            const notificationData = {
                userId,
                type,
                title,
                message,
                ...options // relatedEntity, metadata, priority, expiresAt
            };

            const notification = await Notification.createNotification(notificationData);
            
            console.log(`[NOTIFICATION] Created ${type} for user ${userId}`);
            
            return notification;
        } catch (error) {
            console.error('[NOTIFICATION] Error creating notification:', error);
            throw error;
        }
    }

    /**
     * Get notifications for a user
     */
    static async getUserNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
        try {
            const query = { userId };
            if (unreadOnly) {
                query.isRead = false;
            }

            const skip = (page - 1) * limit;

            const [notifications, total, unreadCount] = await Promise.all([
                Notification.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),
                Notification.countDocuments(query),
                Notification.getUnreadCount(userId)
            ]);

            return {
                notifications,
                total,
                unreadCount,
                page: parseInt(page),
                totalPages: Math.ceil(total / limit)
            };
        } catch (error) {
            console.error('[NOTIFICATION] Error fetching notifications:', error);
            throw error;
        }
    }

    /**
     * Mark notification as read
     */
    static async markAsRead(notificationId, userId) {
        try {
            const notification = await Notification.findOne({ _id: notificationId, userId });
            
            if (!notification) {
                throw new Error('Notification not found');
            }

            await notification.markAsRead();
            return notification;
        } catch (error) {
            console.error('[NOTIFICATION] Error marking as read:', error);
            throw error;
        }
    }

    /**
     * Mark all notifications as read
     */
    static async markAllAsRead(userId) {
        try {
            const result = await Notification.markAllAsRead(userId);
            return result;
        } catch (error) {
            console.error('[NOTIFICATION] Error marking all as read:', error);
            throw error;
        }
    }

    /**
     * Delete notification
     */
    static async deleteNotification(notificationId, userId) {
        try {
            const result = await Notification.deleteOne({ _id: notificationId, userId });
            return result;
        } catch (error) {
            console.error('[NOTIFICATION] Error deleting notification:', error);
            throw error;
        }
    }

    /**
     * Get unread count
     */
    static async getUnreadCount(userId) {
        try {
            return await Notification.getUnreadCount(userId);
        } catch (error) {
            console.error('[NOTIFICATION] Error getting unread count:', error);
            return 0;
        }
    }

    // ========== Specific Notification Creators ==========

    /**
     * Office location updated notification
     */
    static async notifyOfficeLocationUpdate(userId, locationData) {
        return this.createNotification(
            userId,
            'OFFICE_LOCATION_UPDATE',
            'Office Location Updated',
            `Your office location has been updated to ${locationData.address || 'a new location'}`,
            {
                metadata: {
                    address: locationData.address,
                    coordinates: locationData.coordinates
                },
                priority: 'medium'
            }
        );
    }

    /**
     * Hire request accepted notification
     */
    static async notifyHireRequestAccepted(companyId, driverId, driverName, jobRequestId) {
        return this.createNotification(
            companyId,
            'HIRE_REQUEST_ACCEPTED',
            'Hire Request Accepted',
            `${driverName} has accepted your hire request`,
            {
                relatedEntity: {
                    entityType: 'jobRequest',
                    entityId: jobRequestId
                },
                metadata: {
                    driverId,
                    driverName
                },
                priority: 'high'
            }
        );
    }

    /**
     * Hire request rejected notification
     */
    static async notifyHireRequestRejected(companyId, driverId, driverName, jobRequestId) {
        return this.createNotification(
            companyId,
            'HIRE_REQUEST_REJECTED',
            'Hire Request Rejected',
            `${driverName} has declined your hire request`,
            {
                relatedEntity: {
                    entityType: 'jobRequest',
                    entityId: jobRequestId
                },
                metadata: {
                    driverId,
                    driverName
                },
                priority: 'medium'
            }
        );
    }

    /**
     * Contract terminated notification
     */
    static async notifyContractTerminated(userId, driverName, reason, employmentId) {
        const isDriver = userId.toString() === driverName; // Simplified check
        
        return this.createNotification(
            userId,
            'CONTRACT_TERMINATED',
            'Contract Terminated',
            isDriver 
                ? `Your contract has been terminated. Reason: ${reason || 'Not specified'}`
                : `Contract with ${driverName} has been terminated`,
            {
                relatedEntity: {
                    entityType: 'employment',
                    entityId: employmentId
                },
                metadata: {
                    reason: reason || 'Not specified'
                },
                priority: 'high'
            }
        );
    }

    /**
     * Driver hired notification
     */
    static async notifyDriverHired(companyId, driverId, driverName, employmentId) {
        return this.createNotification(
            companyId,
            'DRIVER_HIRED',
            'Driver Hired Successfully',
            `${driverName} has been successfully hired and is now part of your team`,
            {
                relatedEntity: {
                    entityType: 'employment',
                    entityId: employmentId
                },
                metadata: {
                    driverId,
                    driverName
                },
                priority: 'high'
            }
        );
    }

    /**
     * Vehicle added notification
     */
    static async notifyVehicleAdded(userId, vehicleData) {
        return this.createNotification(
            userId,
            'VEHICLE_ADDED',
            'Vehicle Added Successfully',
            `${vehicleData.make} ${vehicleData.model} (${vehicleData.registrationNumber}) has been added to your fleet`,
            {
                relatedEntity: {
                    entityType: 'vehicle',
                    entityId: vehicleData.vehicleId
                },
                metadata: {
                    registrationNumber: vehicleData.registrationNumber,
                    make: vehicleData.make,
                    model: vehicleData.model
                },
                priority: 'medium'
            }
        );
    }
}

module.exports = NotificationService;
