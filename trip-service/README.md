# Trip Service

Trip management microservice for Mobitrak fleet management system.

## Features

- Create and manage trips (commercial and passenger)
- Route calculation using Mapbox Directions API
- Distance and duration calculation
- Automatic fare calculation based on trip type and distance
- Suggested rest stops for driver safety
- Real-time route visualization
- Support for multiple stops along the route

## API Endpoints

### Trips

- `POST /api/trips` - Create a new trip
- `GET /api/trips` - Get all trips (with filters)
- `GET /api/trips/:id` - Get single trip by ID
- `PUT /api/trips/:id` - Update a trip
- `DELETE /api/trips/:id` - Delete a trip
- `POST /api/trips/calculate-route` - Calculate route preview

## Environment Variables

```
PORT=5004
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production

```bash
npm start
```

## Trip Pricing

- **Commercial trips**: ₹15 per km
- **Passenger trips**: ₹12 per km
- **Long distance surcharge**: 10% for trips over 500km

## Rest Stop Suggestions

The system automatically suggests rest stops every 200km for driver safety and compliance with driving regulations.
