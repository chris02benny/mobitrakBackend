const mongoose = require('mongoose');

/**
 * NotificationClient — writes notifications directly to MongoDB.
 *
 * Both driver-management-service and user-service connect to the same
 * MONGO_URI, so writing to the 'notifications' collection directly is
 * faster and more reliable than HTTP inter-service calls (which fail with
 * ECONNREFUSED in Lambda when USER_SERVICE_URL is not set).
 */

// Minimal notification schema — mirrors user-service/src/models/Notification.js
const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    type: {
        type: String,
        required: true,
        enum: [
            'OFFICE_LOCATION_UPDATE', 'HIRE_REQUEST_ACCEPTED', 'HIRE_REQUEST_REJECTED',
            'CONTRACT_TERMINATED', 'DRIVER_HIRED', 'VEHICLE_ADDED', 'VEHICLE_UPDATED', 'SYSTEM'
        ]
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedEntity: {
        entityType: { type: String, enum: ['user', 'vehicle', 'employment', 'jobRequest', 'trip'] },
        entityId: mongoose.Schema.Types.ObjectId
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false, index: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    expiresAt: { type: Date }
}, { timestamps: true, collection: 'notifications' });

// Avoid OverwriteModelError on Lambda warm re-use
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

class NotificationClient {
    /**
     * Create a notification by writing directly to MongoDB.
     */
    static async createNotification(notificationData) {
        try {
            const notification = new Notification(notificationData);
            await notification.save();
            console.log('[NOTIFICATION CLIENT] Notification created:', notification._id);
            return notification;
        } catch (error) {
            console.error('[NOTIFICATION CLIENT] Failed to create notification:', error.message);
            // Don't throw — notifications are non-critical
            return null;
        }
    }

    static async notifyHireRequestAccepted(companyId, driverId, driverName, jobRequestId) {
        return this.createNotification({
            userId: companyId,
            type: 'HIRE_REQUEST_ACCEPTED',
            title: 'Hire Request Accepted',
            message: `${driverName} has accepted your hire request`,
            relatedEntity: { entityType: 'jobRequest', entityId: jobRequestId },
            metadata: { driverId, driverName },
            priority: 'high'
        });
    }

    static async notifyHireRequestRejected(companyId, driverId, driverName, jobRequestId, reason) {
        return this.createNotification({
            userId: companyId,
            type: 'HIRE_REQUEST_REJECTED',
            title: 'Hire Request Rejected',
            message: `${driverName} has declined your hire request${reason ? `: ${reason}` : ''}`,
            relatedEntity: { entityType: 'jobRequest', entityId: jobRequestId },
            metadata: { driverId, driverName, reason },
            priority: 'medium'
        });
    }

    static async notifyContractTerminated(recipientIds, driverName, reason, employmentId) {
        const promises = recipientIds.map(userId =>
            this.createNotification({
                userId,
                type: 'CONTRACT_TERMINATED',
                title: 'Contract Terminated',
                message: `Contract with ${driverName} has been terminated${reason ? `: ${reason}` : ''}`,
                relatedEntity: { entityType: 'employment', entityId: employmentId },
                metadata: { driverName, reason: reason || 'Not specified' },
                priority: 'high'
            })
        );
        return Promise.all(promises);
    }

    static async notifyDriverHired(companyId, driverId, driverName, employmentId) {
        return this.createNotification({
            userId: companyId,
            type: 'DRIVER_HIRED',
            title: 'Driver Hired Successfully',
            message: `${driverName} has been successfully hired and is now part of your team`,
            relatedEntity: { entityType: 'employment', entityId: employmentId },
            metadata: { driverId, driverName },
            priority: 'high'
        });
    }
}

module.exports = NotificationClient;
