const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // Who should see this notification
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    
    // Notification type/category
    type: {
        type: String,
        required: true,
        enum: [
            'OFFICE_LOCATION_UPDATE',
            'HIRE_REQUEST_ACCEPTED',
            'HIRE_REQUEST_REJECTED',
            'CONTRACT_TERMINATED',
            'DRIVER_HIRED',
            'VEHICLE_ADDED',
            'VEHICLE_UPDATED',
            'SYSTEM'
        ]
    },
    
    // Notification title
    title: {
        type: String,
        required: true
    },
    
    // Notification message/description
    message: {
        type: String,
        required: true
    },
    
    // Related entity (optional)
    relatedEntity: {
        entityType: {
            type: String,
            enum: ['user', 'vehicle', 'employment', 'jobRequest', 'trip']
        },
        entityId: mongoose.Schema.Types.ObjectId
    },
    
    // Metadata (flexible object for additional data)
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Status
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },
    
    // Priority level
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    
    // Expiry date (optional - for auto-cleanup)
    expiresAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

// TTL index to auto-delete expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance methods
notificationSchema.methods.markAsRead = function() {
    this.isRead = true;
    return this.save();
};

// Static methods
notificationSchema.statics.createNotification = async function(notificationData) {
    const notification = new this(notificationData);
    await notification.save();
    return notification;
};

notificationSchema.statics.getUnreadCount = async function(userId) {
    return this.countDocuments({ userId, isRead: false });
};

notificationSchema.statics.markAllAsRead = async function(userId) {
    return this.updateMany(
        { userId, isRead: false },
        { $set: { isRead: true } }
    );
};

module.exports = mongoose.model('Notification', notificationSchema);
