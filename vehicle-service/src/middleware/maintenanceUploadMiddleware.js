const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const vehicleId = req.params.vehicleId || 'unknown';
        const maintenanceId = req.params.id || 'new';
        return {
            folder: `mobitrak/maintenance/${vehicleId}/${maintenanceId}`,
            allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
            resource_type: 'auto' // Important for PDF support
        };
    },
});

const uploadMaintenance = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 } // 5MB limit
});

module.exports = uploadMaintenance;
