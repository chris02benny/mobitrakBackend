const axios = require('axios');

class MapboxService {
    constructor() {
        this.baseUrl = 'https://api.mapbox.com';
    }

    /**
     * Get route between coordinates
     * @param {Array} coordinates - Array of [longitude, latitude] pairs
     * @returns {Object} Route data with geometry and distance
     */
    async getRoute(coordinates) {
        try {
            if (!process.env.MAPBOX_ACCESS_TOKEN) {
                throw new Error('MAPBOX_ACCESS_TOKEN environment variable is not set');
            }

            const coordinatesStr = coordinates.map(coord => coord.join(',')).join(';');
            const url = `${this.baseUrl}/directions/v5/mapbox/driving/${coordinatesStr}`;
            
            console.log('Calculating route for coordinates:', coordinatesStr);
            console.log('Using Mapbox token:', process.env.MAPBOX_ACCESS_TOKEN.substring(0, 20) + '...');
            
            const response = await axios.get(url, {
                params: {
                    access_token: process.env.MAPBOX_ACCESS_TOKEN,
                    geometries: 'geojson',
                    steps: true,
                    overview: 'full'
                }
            });

            if (response.data.routes && response.data.routes.length > 0) {
                const route = response.data.routes[0];
                console.log('Route calculated successfully:', route.distance, 'meters');
                return {
                    geometry: route.geometry,
                    distance: route.distance / 1000, // Convert meters to kilometers
                    duration: route.duration / 60 // Convert seconds to minutes
                };
            }

            throw new Error('No route found');
        } catch (error) {
            console.error('Mapbox route error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || error.message || 'Failed to calculate route');
        }
    }

    /**
     * Suggest rest stops along a route
     * @param {Object} routeGeometry - GeoJSON LineString
     * @param {Number} distance - Total distance in km
     * @returns {Array} Suggested stops
     */
    suggestRestStops(routeGeometry, distance) {
        const suggestions = [];
        
        // Suggest a stop every 200km or if trip is longer than 4 hours
        const stopInterval = 200; // km
        const numberOfStops = Math.floor(distance / stopInterval);

        if (numberOfStops > 0 && routeGeometry.coordinates) {
            const coords = routeGeometry.coordinates;
            const totalPoints = coords.length;

            for (let i = 1; i <= numberOfStops; i++) {
                const pointIndex = Math.floor((totalPoints / (numberOfStops + 1)) * i);
                const coord = coords[pointIndex];

                suggestions.push({
                    location: {
                        type: 'Point',
                        coordinates: coord
                    },
                    name: `Rest Stop ${i}`,
                    reason: `Suggested rest stop after approximately ${stopInterval * i} km for driver safety`,
                    address: `Coordinates: ${coord[1].toFixed(4)}, ${coord[0].toFixed(4)}`
                });
            }
        }

        return suggestions;
    }

    /**
     * Calculate trip amount based on distance and trip type
     * @param {Number} distance - Distance in km
     * @param {String} tripType - 'commercial' or 'passenger'
     * @returns {Number} Calculated amount
     */
    calculateAmount(distance, tripType) {
        // Base rates per km
        const rates = {
            commercial: 15, // ₹15 per km
            passenger: 12   // ₹12 per km
        };

        const baseAmount = distance * rates[tripType];
        
        // Add surcharge for long distance
        let surcharge = 0;
        if (distance > 500) {
            surcharge = baseAmount * 0.1; // 10% surcharge for trips over 500km
        }

        return Math.round(baseAmount + surcharge);
    }
}

module.exports = new MapboxService();
