const maintenanceService = require('../services/maintenanceService');

/**
 * Schedule a regular service.
 */
exports.scheduleRegularService = async (req, res) => {
    try {
        const maintenance = await maintenanceService.scheduleMaintenance(req.body, req.user.id);
        res.status(201).json({
            success: true,
            data: maintenance
        });
    } catch (error) {
        console.error('Error scheduling maintenance:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Complete a maintenance task with file upload.
 */
exports.completeRegularService = async (req, res) => {
    try {
        const { id } = req.params;
        const files = req.files || [];

        const maintenance = await maintenanceService.completeMaintenance(id, req.body, files);

        res.status(200).json({
            success: true,
            data: maintenance
        });
    } catch (error) {
        console.error('Error completing maintenance:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get maintenance records.
 */
exports.getMaintenanceRecords = async (req, res) => {
    try {
        const { vehicleId } = req.query;
        const query = { businessId: req.user.id };

        if (vehicleId) {
            query.vehicleId = vehicleId;
        }

        const records = await maintenanceService.getMaintenanceRecords(query);

        res.status(200).json({
            success: true,
            data: records
        });
    } catch (error) {
        console.error('Error fetching maintenance records:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

/**
 * Update maintenance status (e.g. to IN_PROGRESS).
 */
exports.updateMaintenanceStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const MaintenanceRecord = require('../models/MaintenanceRecord');
        const maintenance = await MaintenanceRecord.findById(id);

        if (!maintenance) {
            return res.status(404).json({ success: false, message: 'Maintenance record not found' });
        }

        maintenance.status = status;
        await maintenance.save();

        res.status(200).json({
            success: true,
            data: maintenance
        });
    } catch (error) {
        console.error('Error updating maintenance status:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};
