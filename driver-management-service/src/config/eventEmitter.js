/**
 * Domain Event Emitter for Driver Management Service
 * 
 * Emits events that can be consumed by other microservices:
 * - DRIVER_HIRED: When a driver is hired by a company
 * - DRIVER_RELEASED: When a driver is released from a company
 * - DRIVER_PROFILE_UPDATED: When driver profile is updated
 * - JOB_REQUEST_CREATED: When a company sends a job request to a driver
 * - JOB_REQUEST_STATUS_CHANGED: When job request status changes
 * - DRIVER_RATING_ADDED: When a new rating is added for a driver
 */

const EventEmitter = require('events');

class DriverEventEmitter extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50); // Allow multiple listeners
    }

    /**
     * Emit DRIVER_HIRED event
     * @param {Object} payload - Event payload
     */
    emitDriverHired(payload) {
        const event = {
            type: 'DRIVER_HIRED',
            timestamp: new Date().toISOString(),
            payload: {
                driverId: payload.driverId,
                companyId: payload.companyId,
                employmentId: payload.employmentId,
                assignedVehicleId: payload.assignedVehicleId || null,
                hiredAt: payload.hiredAt,
                position: payload.position
            }
        };
        this.emit('DRIVER_HIRED', event);
        console.log('[EVENT] DRIVER_HIRED emitted:', event);
        return event;
    }

    /**
     * Emit DRIVER_RELEASED event
     * @param {Object} payload - Event payload
     */
    emitDriverReleased(payload) {
        const event = {
            type: 'DRIVER_RELEASED',
            timestamp: new Date().toISOString(),
            payload: {
                driverId: payload.driverId,
                companyId: payload.companyId,
                employmentId: payload.employmentId,
                releasedAt: payload.releasedAt,
                reason: payload.reason || 'Not specified'
            }
        };
        this.emit('DRIVER_RELEASED', event);
        console.log('[EVENT] DRIVER_RELEASED emitted:', event);
        return event;
    }

    /**
     * Emit DRIVER_PROFILE_UPDATED event
     * @param {Object} payload - Event payload
     */
    emitProfileUpdated(payload) {
        const event = {
            type: 'DRIVER_PROFILE_UPDATED',
            timestamp: new Date().toISOString(),
            payload: {
                driverId: payload.driverId,
                updatedFields: payload.updatedFields
            }
        };
        this.emit('DRIVER_PROFILE_UPDATED', event);
        console.log('[EVENT] DRIVER_PROFILE_UPDATED emitted:', event);
        return event;
    }

    /**
     * Emit JOB_REQUEST_CREATED event
     * @param {Object} payload - Event payload
     */
    emitJobRequestCreated(payload) {
        const event = {
            type: 'JOB_REQUEST_CREATED',
            timestamp: new Date().toISOString(),
            payload: {
                jobRequestId: payload.jobRequestId,
                driverId: payload.driverId,
                companyId: payload.companyId,
                position: payload.position,
                offeredSalary: payload.offeredSalary
            }
        };
        this.emit('JOB_REQUEST_CREATED', event);
        console.log('[EVENT] JOB_REQUEST_CREATED emitted:', event);
        return event;
    }

    /**
     * Emit JOB_REQUEST_STATUS_CHANGED event
     * @param {Object} payload - Event payload
     */
    emitJobRequestStatusChanged(payload) {
        const event = {
            type: 'JOB_REQUEST_STATUS_CHANGED',
            timestamp: new Date().toISOString(),
            payload: {
                jobRequestId: payload.jobRequestId,
                driverId: payload.driverId,
                companyId: payload.companyId,
                previousStatus: payload.previousStatus,
                newStatus: payload.newStatus
            }
        };
        this.emit('JOB_REQUEST_STATUS_CHANGED', event);
        console.log('[EVENT] JOB_REQUEST_STATUS_CHANGED emitted:', event);
        return event;
    }

    /**
     * Emit DRIVER_RATING_ADDED event
     * @param {Object} payload - Event payload
     */
    emitDriverRatingAdded(payload) {
        const event = {
            type: 'DRIVER_RATING_ADDED',
            timestamp: new Date().toISOString(),
            payload: {
                ratingId: payload.ratingId,
                driverId: payload.driverId,
                ratedBy: payload.ratedBy,
                rating: payload.rating,
                newAverageRating: payload.newAverageRating
            }
        };
        this.emit('DRIVER_RATING_ADDED', event);
        console.log('[EVENT] DRIVER_RATING_ADDED emitted:', event);
        return event;
    }
}

// Singleton instance
const driverEventEmitter = new DriverEventEmitter();

module.exports = driverEventEmitter;
