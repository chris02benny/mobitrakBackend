const axios = require('axios');

/**
 * Helper function to send notifications to the user-service
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
                        'X-Internal-Service': 'true'
                    },
                    timeout: 5000
                }
            );
            
            console.log('[NOTIFICATION CLIENT] Notification created:', response.data);
            return response.data;
        } catch (error) {
            console.error('[NOTIFICATION CLIENT] Failed to create notification:', error.message);
            return null;
        }
    }

    /**
     * Notify vehicle added
     */
    static async notifyVehicleAdded(userId, vehicleData) {
        return this.createNotification({
            userId,
            type: 'VEHICLE_ADDED',
            title: 'Vehicle Added Successfully',
            message: `${vehicleData.make} ${vehicleData.model} (${vehicleData.registrationNumber}) has been added to your fleet`,
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
        });
    }

    /**
     * Notify vehicle updated
     */
    static async notifyVehicleUpdated(userId, vehicleData) {
        return this.createNotification({
            userId,
            type: 'VEHICLE_UPDATED',
            title: 'Vehicle Updated',
            message: `${vehicleData.make} ${vehicleData.model} (${vehicleData.registrationNumber}) details have been updated`,
            relatedEntity: {
                entityType: 'vehicle',
                entityId: vehicleData.vehicleId
            },
            metadata: {
                registrationNumber: vehicleData.registrationNumber,
                make: vehicleData.make,
                model: vehicleData.model,
                vehicleType: vehicleData.vehicleType
            },
            priority: 'low'
        });
    }
}

module.exports = NotificationClient;
