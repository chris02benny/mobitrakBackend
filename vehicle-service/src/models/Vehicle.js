const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    businessId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User' // Assuming business is a User in user-service, though this is a loose ref
    },
    regnNo: { type: String, required: true },
    dateOfRegn: { type: String }, // Keeping as string to match OCR output likely, or can be Date
    regnValidity: { type: String },
    chassisNo: { type: String },
    engineNo: { type: String },
    ownerName: { type: String },
    address: { type: String },
    taxUpto: { type: String },
    fuelUsed: { type: String },
    dateOfEffect: { type: String },
    vehicleClass: { type: String },
    makersName: { type: String },
    colour: { type: String },
    bodyType: { type: String },
    seatingCapacity: { type: String },
    monthYearOfMfg: { type: String },
    rcBookImage: { type: String }, // Path to RC Book image
    images: [{ type: String }], // Array of vehicle image URLs
    description: { type: String },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Vehicle', vehicleSchema);
