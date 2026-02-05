const axios = require('axios');

/**
 * Helper function to send notifications to the user-service
 * This allows other microservices to create notifications
 */

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:5001';

class NotificationClient {
    /**
     * Send a notification request to user-service
     */
    static async createNotification(notificationData) {
        try {
            const response = await axios.post(
                `${USER_SERVICE_URL}/api/notifications/internal/create`,
                notificationData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        // Internal service communication - no auth required
                        'X-Internal-Service': 'true'
                    },
                    timeout: 5000
                }
            );
            
            console.log('[NOTIFICATION CLIENT] Notification created:', response.data);
            return response.data;
        } catch (error) {
            console.error('[NOTIFICATION CLIENT] Failed to create notification:', error.message);
            // Don't throw - notifications are non-critical
            return null;
        }
    }

    /**
     * Notify hire request accepted
     */
    static async notifyHireRequestAccepted(companyId, driverId, driverName, jobRequestId) {
        return this.createNotification({
            userId: companyId,
            type: 'HIRE_REQUEST_ACCEPTED',
            title: 'Hire Request Accepted',
            message: `${driverName} has accepted your hire request`,
            relatedEntity: {
                entityType: 'jobRequest',
                entityId: jobRequestId
            },
            metadata: {
                driverId,
                driverName
            },
            priority: 'high'
        });
    }

    /**
     * Notify hire request rejected
     */
    static async notifyHireRequestRejected(companyId, driverId, driverName, jobRequestId, reason) {
        return this.createNotification({
            userId: companyId,
            type: 'HIRE_REQUEST_REJECTED',
            title: 'Hire Request Rejected',
            message: `${driverName} has declined your hire request${reason ? `: ${reason}` : ''}`,
            relatedEntity: {
                entityType: 'jobRequest',
                entityId: jobRequestId
            },
            metadata: {
                driverId,
                driverName,
                reason
            },
            priority: 'medium'
        });
    }

    /**
     * Notify contract terminated
     */
    static async notifyContractTerminated(recipientIds, driverName, reason, employmentId) {
        const promises = recipientIds.map(userId =>
            this.createNotification({
                userId,
                type: 'CONTRACT_TERMINATED',
                title: 'Contract Terminated',
                message: `Contract with ${driverName} has been terminated${reason ? `: ${reason}` : ''}`,
                relatedEntity: {
                    entityType: 'employment',
                    entityId: employmentId
                },
                metadata: {
                    driverName,
                    reason: reason || 'Not specified'
                },
                priority: 'high'
            })
        );
        
        return Promise.all(promises);
    }

    /**
     * Notify driver hired
     */
    static async notifyDriverHired(companyId, driverId, driverName, employmentId) {
        return this.createNotification({
            userId: companyId,
            type: 'DRIVER_HIRED',
            title: 'Driver Hired Successfully',
            message: `${driverName} has been successfully hired and is now part of your team`,
            relatedEntity: {
                entityType: 'employment',
                entityId: employmentId
            },
            metadata: {
                driverId,
                driverName
            },
            priority: 'high'
        });
    }
}

module.exports = NotificationClient;
