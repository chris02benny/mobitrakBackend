const MaintenanceRecord = require('../models/MaintenanceRecord');
const Vehicle = require('../models/Vehicle');
const TripMinimal = require('../models/TripMinimal');

/**
 * Validates if there are overlapping trips for the given vehicle and date range.
 * Checks for:
 * 1. Partial overlaps
 * 2. Full containment overlaps
 * 3. Same-day overlaps
 * 4. Trips that started before and haven't ended (though schema requires endDateTime)
 */
const validateTripConflict = async (vehicleId, startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Consider the whole day for overlap
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(23, 59, 59, 999);

    const conflictingTrip = await TripMinimal.findOne({
        vehicleId,
        status: { $in: ['scheduled', 'in-progress'] },
        $or: [
            // New maintenance window starts during an existing trip
            { startDateTime: { $lte: start }, endDateTime: { $gte: start } },
            // New maintenance window ends during an existing trip
            { startDateTime: { $lte: end }, endDateTime: { $gte: end } },
            // New maintenance window completely contains an existing trip
            { startDateTime: { $gte: start }, endDateTime: { $lte: end } }
        ]
    });

    return conflictingTrip;
};

/**
 * Validates if there are existing scheduled or in-progress maintenance records.
 */
const validateMaintenanceConflict = async (vehicleId) => {
    return await MaintenanceRecord.findOne({
        vehicleId,
        status: { $in: ['SCHEDULED', 'IN_PROGRESS'] }
    });
};

/**
 * Schedule a new regular service.
 */
const scheduleMaintenance = async (data, userId) => {
    const { vehicleId, lastServiceDate, intervalMonths, plannedStartDate, plannedEndDate, notes } = data;

    // 1. Validate vehicle
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
        throw new Error('Vehicle not found');
    }

    // 2. Validate dates
    const start = new Date(plannedStartDate);
    const end = new Date(plannedEndDate);
    if (start > end) {
        throw new Error('Planned start date must be before end date');
    }

    // 3. Check for maintenance conflicts
    const maintenanceConflict = await validateMaintenanceConflict(vehicleId);
    if (maintenanceConflict) {
        throw new Error('Vehicle already has a scheduled or in-progress maintenance');
    }

    // 4. Check for trip conflicts
    const tripConflict = await validateTripConflict(vehicleId, start, end);
    if (tripConflict) {
        throw new Error(`Vehicle has an assigned trip during these dates (Trip ID: ${tripConflict._id})`);
    }

    // 5. Calculate next due date
    let nextDueDate = null;
    if (lastServiceDate && intervalMonths) {
        const lastDate = new Date(lastServiceDate);
        nextDueDate = new Date(lastDate);
        nextDueDate.setMonth(lastDate.getMonth() + parseInt(intervalMonths));
    }

    // 6. Create record
    const maintenance = new MaintenanceRecord({
        vehicleId,
        businessId: vehicle.businessId,
        type: 'REGULAR_SERVICE',
        lastServiceDate,
        intervalMonths,
        nextDueDate,
        schedule: {
            plannedStartDate: start,
            plannedEndDate: end
        },
        status: 'SCHEDULED',
        notes,
        createdBy: userId
    });

    await maintenance.save();

    // 7. Update vehicle status
    vehicle.status = 'SERVICE_SCHEDULED';
    await vehicle.save();

    return maintenance;
};

/**
 * Complete a maintenance task.
 */
const completeMaintenance = async (id, data, files) => {
    const { completedDate, totalCost, notes } = data;

    const maintenance = await MaintenanceRecord.findById(id);
    if (!maintenance) {
        throw new Error('Maintenance record not found');
    }

    if (maintenance.status === 'COMPLETED') {
        throw new Error('Maintenance is already completed');
    }

    // Prepare files metadata
    const uploadedFiles = files.map(file => ({
        fileName: file.originalname,
        fileUrl: file.path,
        publicId: file.filename,
        resourceType: file.mimetype.includes('pdf') ? 'raw' : 'image',
        uploadedAt: new Date()
    }));

    // Update record
    maintenance.status = 'COMPLETED';
    maintenance.completion = {
        completedDate: new Date(completedDate),
        totalCost: parseFloat(totalCost) || 0,
        notes,
        files: uploadedFiles
    };

    await maintenance.save();

    // Update vehicle
    const vehicle = await Vehicle.findById(maintenance.vehicleId);
    if (vehicle) {
        vehicle.status = 'AVAILABLE';
        vehicle.lastServiceDate = new Date(completedDate);
        await vehicle.save();
    }

    return maintenance;
};

/**
 * Get maintenance records for a vehicle or business.
 */
const getMaintenanceRecords = async (query) => {
    return await MaintenanceRecord.find(query).sort({ createdAt: -1 });
};

module.exports = {
    scheduleMaintenance,
    completeMaintenance,
    getMaintenanceRecords,
    validateTripConflict
};
