const LiveTrackingDevice = require('../models/LiveTrackingDevice');

/**
 * Save or update live tracking device credentials
 */
const saveDeviceCredentials = async (req, res) => {
    try {
        const { email, password, vehicleId } = req.body;

        // Validate inputs
        if (!email || !password || !vehicleId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email, password, and vehicle ID are required' 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid email format' 
            });
        }

        // Store password in plain text
        // Check if credentials already exist for this vehicle
        let deviceCredentials = await LiveTrackingDevice.findOne({ vehicleId });

        if (deviceCredentials) {
            // Update existing credentials
            deviceCredentials.email = email;
            deviceCredentials.password = password;
            deviceCredentials.isActive = true;
            await deviceCredentials.save();

            return res.status(200).json({
                success: true,
                message: 'Device credentials updated successfully',
                data: {
                    vehicleId: deviceCredentials.vehicleId,
                    email: deviceCredentials.email,
                    isActive: deviceCredentials.isActive,
                    updatedAt: deviceCredentials.updatedAt
                }
            });
        } else {
            // Create new credentials
            deviceCredentials = new LiveTrackingDevice({
                vehicleId,
                email,
                password: password,
                isActive: true
            });

            await deviceCredentials.save();

            return res.status(201).json({
                success: true,
                message: 'Device credentials saved successfully',
                data: {
                    vehicleId: deviceCredentials.vehicleId,
                    email: deviceCredentials.email,
                    isActive: deviceCredentials.isActive,
                    createdAt: deviceCredentials.createdAt
                }
            });
        }
    } catch (error) {
        console.error('Error saving device credentials:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to save device credentials',
            details: error.message
        });
    }
};

/**
 * Get device credentials for a specific vehicle
 */
const getDeviceCredentials = async (req, res) => {
    try {
        const { vehicleId } = req.params;

        const deviceCredentials = await LiveTrackingDevice.findOne({ vehicleId })
            .select('-password'); // Exclude password from response

        if (!deviceCredentials) {
            return res.status(404).json({
                success: false,
                error: 'No device credentials found'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                vehicleId: deviceCredentials.vehicleId,
                email: deviceCredentials.email,
                isActive: deviceCredentials.isActive,
                lastSynced: deviceCredentials.lastSynced,
                updatedAt: deviceCredentials.updatedAt
            }
        });
    } catch (error) {
        console.error('Error fetching device credentials:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch device credentials',
            details: error.message
        });
    }
};

/**
 * Get decrypted device credentials for a specific vehicle (for live tracking)
 */
const getDecryptedCredentials = async (req, res) => {
    try {
        const { vehicleId } = req.params;

        const deviceCredentials = await LiveTrackingDevice.findOne({ vehicleId });

        if (!deviceCredentials) {
            return res.status(404).json({
                success: false,
                error: 'No device credentials found'
            });
        }

        // Return password as is (stored in plain text)
        return res.status(200).json({
            success: true,
            data: {
                email: deviceCredentials.email,
                password: deviceCredentials.password,
                isActive: deviceCredentials.isActive
            }
        });
    } catch (error) {
        console.error('Error fetching decrypted credentials:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch credentials',
            details: error.message
        });
    }
};

/**
 * Delete device credentials for a specific vehicle
 */
const deleteDeviceCredentials = async (req, res) => {
    try {
        const { vehicleId } = req.params;

        const result = await LiveTrackingDevice.findOneAndDelete({ vehicleId });

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'No device credentials found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Device credentials deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting device credentials:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete device credentials',
            details: error.message
        });
    }
};

module.exports = {
    saveDeviceCredentials,
    getDeviceCredentials,
    getDecryptedCredentials,
    deleteDeviceCredentials
};
