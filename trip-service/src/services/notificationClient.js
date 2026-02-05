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
     * Notify trip created
     */
    static async notifyTripCreated(userId, tripData) {
        return this.createNotification({
            userId,
            type: 'TRIP_CREATED',
            title: 'Trip Created Successfully',
            message: `New trip from ${tripData.startDestination} to ${tripData.endDestination} scheduled for ${tripData.scheduledDate}`,
            relatedEntity: {
                entityType: 'trip',
                entityId: tripData.tripId
            },
            metadata: {
                startDestination: tripData.startDestination,
                endDestination: tripData.endDestination,
                scheduledDate: tripData.scheduledDate,
                tripType: tripData.tripType,
                vehicleId: tripData.vehicleId,
                driverId: tripData.driverId
            },
            priority: 'medium'
        });
    }

    /**
     * Notify trip updated
     */
    static async notifyTripUpdated(userId, tripData) {
        return this.createNotification({
            userId,
            type: 'TRIP_UPDATED',
            title: 'Trip Updated',
            message: `Trip from ${tripData.startDestination} to ${tripData.endDestination} has been updated`,
            relatedEntity: {
                entityType: 'trip',
                entityId: tripData.tripId
            },
            metadata: {
                startDestination: tripData.startDestination,
                endDestination: tripData.endDestination,
                scheduledDate: tripData.scheduledDate,
                tripType: tripData.tripType
            },
            priority: 'low'
        });
    }

    /**
     * Notify trip deleted
     */
    static async notifyTripDeleted(userId, tripData) {
        return this.createNotification({
            userId,
            type: 'TRIP_DELETED',
            title: 'Trip Deleted',
            message: `Trip from ${tripData.startDestination} to ${tripData.endDestination} has been deleted. Vehicle and driver are now available.`,
            relatedEntity: {
                entityType: 'trip',
                entityId: tripData.tripId
            },
            metadata: {
                startDestination: tripData.startDestination,
                endDestination: tripData.endDestination,
                vehicleId: tripData.vehicleId,
                driverId: tripData.driverId
            },
            priority: 'medium'
        });
    }
}

module.exports = NotificationClient;
