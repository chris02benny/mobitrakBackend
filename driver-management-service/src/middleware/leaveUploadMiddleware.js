const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'mobitrak_leave_documents',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
        resource_type: 'auto',
        transformation: [{ width: 1500, crop: 'limit' }]
    },
});

const leaveDocumentUpload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 10 } // 10MB limit
});

module.exports = leaveDocumentUpload;
