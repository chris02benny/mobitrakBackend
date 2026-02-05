/**
 * Test Script for Location Updates
 * 
 * This script simulates sending location updates for a trip
 * Run with: node test-location-update.js
 */

const axios = require('axios');

// Configuration
const TRIP_SERVICE_URL = 'http://localhost:5004/api/trips';
const AUTH_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token

// Sample trip ID (replace with actual trip ID)
const TRIP_ID = 'YOUR_TRIP_ID_HERE';

// Sample route coordinates (Mumbai to Pune)
const sampleRoute = [
    { lng: 72.8777, lat: 19.0760 }, // Mumbai
    { lng: 72.9876, lat: 19.1234 }, // Point 1
    { lng: 73.1234, lat: 19.2345 }, // Point 2
    { lng: 73.3456, lat: 19.3456 }, // Point 3
    { lng: 73.5678, lat: 19.4567 }, // Point 4
    { lng: 73.8567, lat: 18.5204 }  // Pune
];

/**
 * Update location for a trip
 */
async function updateLocation(tripId, longitude, latitude) {
    try {
        const response = await axios.put(
            `${TRIP_SERVICE_URL}/${tripId}/location`,
            { longitude, latitude },
            {
                headers: {
                    'x-auth-token': AUTH_TOKEN,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✓ Location updated:', response.data);
        return response.data;
    } catch (error) {
        console.error('✗ Error updating location:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Simulate a trip by sending location updates at intervals
 */
async function simulateTrip(tripId, route, intervalMs = 5000) {
    console.log(`Starting trip simulation for Trip ID: ${tripId}`);
    console.log(`Route has ${route.length} points, updating every ${intervalMs}ms\n`);

    for (let i = 0; i < route.length; i++) {
        const point = route[i];
        console.log(`[${i + 1}/${route.length}] Moving to: ${point.lat}, ${point.lng}`);
        
        try {
            await updateLocation(tripId, point.lng, point.lat);
        } catch (error) {
            console.error('Failed to update location, stopping simulation');
            break;
        }

        // Wait before next update (except for last point)
        if (i < route.length - 1) {
            console.log(`Waiting ${intervalMs / 1000} seconds...\n`);
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }

    console.log('\nTrip simulation complete!');
}

/**
 * Send a single location update
 */
async function sendSingleUpdate() {
    const sampleLng = 72.8777;
    const sampleLat = 19.0760;
    
    console.log('Sending single location update...');
    await updateLocation(TRIP_ID, sampleLng, sampleLat);
}

// Main execution
if (require.main === module) {
    console.log('=== Trip Location Update Test ===\n');
    
    // Check if credentials are set
    if (AUTH_TOKEN === 'YOUR_JWT_TOKEN_HERE' || TRIP_ID === 'YOUR_TRIP_ID_HERE') {
        console.error('❌ Please configure AUTH_TOKEN and TRIP_ID in the script');
        process.exit(1);
    }

    // Uncomment one of the following:
    
    // Option 1: Simulate a full trip
    simulateTrip(TRIP_ID, sampleRoute, 5000);
    
    // Option 2: Send a single update
    // sendSingleUpdate();
}

module.exports = { updateLocation, simulateTrip };
