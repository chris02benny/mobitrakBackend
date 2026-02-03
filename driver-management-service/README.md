# Driver Management Service

A microservice for managing driver professional profiles, hiring workflows, employment relationships, and ratings for the MobiTrak fleet management SaaS.

## Features

- **Driver Profile Management**: Create and manage driver professional profiles
- **Hiring Workflow**: Handle job requests, accept/reject, interview scheduling
- **Employment Management**: Track driver-company relationships and history
- **Ratings & Reviews**: Multi-dimensional driver rating system
- **Domain Events**: Emit events for service integration

## Architecture

```
driver-management-service/
├── server.js                 # Application entry point
├── Dockerfile                # Docker configuration
├── package.json              # Dependencies
└── src/
    ├── config/
    │   ├── db.js             # MongoDB connection
    │   └── eventEmitter.js   # Domain event emitter
    ├── controllers/
    │   ├── profileController.js
    │   ├── jobRequestController.js
    │   ├── employmentController.js
    │   └── ratingController.js
    ├── middleware/
    │   ├── authMiddleware.js       # JWT validation
    │   ├── validationMiddleware.js # Input validation
    │   └── errorHandler.js         # Error handling
    ├── models/
    │   ├── DriverProfile.js
    │   ├── Employment.js
    │   ├── JobRequest.js
    │   └── DriverRating.js
    └── routes/
        ├── index.js
        ├── profileRoutes.js
        ├── jobRequestRoutes.js
        ├── employmentRoutes.js
        └── ratingRoutes.js
```

## API Endpoints

### Profile Management (`/api/drivers/profile`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | Driver | Create driver profile |
| GET | `/me` | Driver | Get own profile |
| PUT | `/` | Driver | Update profile |
| PATCH | `/availability` | Driver | Update availability |
| PUT | `/skills` | Driver | Update skills |
| POST | `/certifications` | Driver | Add certification |
| DELETE | `/certifications/:certId` | Driver | Remove certification |
| GET | `/search` | Company | Search available drivers |
| GET | `/:driverId` | Auth | Get driver profile |
| GET | `/:driverId/stats` | Auth | Get driver statistics |

### Hiring Workflow (`/api/drivers/job-requests`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | Company | Create job request |
| GET | `/sent` | Company | Get sent requests |
| GET | `/received` | Driver | Get received requests |
| GET | `/:requestId` | Auth | Get request details |
| POST | `/:requestId/respond` | Driver | Accept/reject request |
| POST | `/:requestId/withdraw` | Company | Withdraw request |
| POST | `/:requestId/hire` | Company | Finalize hiring |
| POST | `/:requestId/schedule-interview` | Company | Schedule interview |

### Employment Management (`/api/drivers/employments`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | Company | Create employment |
| GET | `/company` | Company | Get employees |
| GET | `/history` | Driver | Get employment history |
| GET | `/current` | Driver | Get current employment |
| GET | `/:employmentId` | Auth | Get employment details |
| PUT | `/:employmentId` | Company | Update employment |
| POST | `/:employmentId/assign-vehicle` | Company | Assign vehicle |
| POST | `/:employmentId/unassign-vehicle` | Company | Unassign vehicle |
| POST | `/:employmentId/terminate` | Company | Terminate employment |
| POST | `/:employmentId/resign` | Driver | Resign |
| POST | `/:employmentId/notes` | Company | Add note |

### Ratings (`/api/drivers/ratings`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | Company | Create rating |
| GET | `/company` | Company | Get given ratings |
| GET | `/my-ratings` | Driver | Get own ratings |
| GET | `/driver/:driverId` | Public | Get driver ratings |
| GET | `/:ratingId` | Auth | Get rating details |
| PUT | `/:ratingId` | Company | Update rating |
| DELETE | `/:ratingId` | Company | Delete rating |
| POST | `/:ratingId/respond` | Driver | Respond to rating |
| POST | `/:ratingId/helpful` | Auth | Vote helpful |

## Domain Events

### DRIVER_HIRED
```json
{
  "type": "DRIVER_HIRED",
  "timestamp": "2026-02-01T10:30:00.000Z",
  "payload": {
    "driverId": "ObjectId",
    "companyId": "ObjectId",
    "employmentId": "ObjectId",
    "assignedVehicleId": "ObjectId | null",
    "hiredAt": "Date",
    "position": "PRIMARY_DRIVER | BACKUP_DRIVER | ..."
  }
}
```

### DRIVER_RELEASED
```json
{
  "type": "DRIVER_RELEASED",
  "timestamp": "2026-02-01T10:30:00.000Z",
  "payload": {
    "driverId": "ObjectId",
    "companyId": "ObjectId",
    "employmentId": "ObjectId",
    "releasedAt": "Date",
    "reason": "RESIGNATION | TERMINATION | ..."
  }
}
```

### Other Events
- `DRIVER_PROFILE_UPDATED`
- `JOB_REQUEST_CREATED`
- `JOB_REQUEST_STATUS_CHANGED`
- `DRIVER_RATING_ADDED`

## Environment Variables

```env
PORT=5003
MONGO_URI=mongodb://mongo:27017/mobitrak_drivers
JWT_SECRET=your_jwt_secret
NODE_ENV=development
```

## Running the Service

### With Docker Compose
```bash
docker-compose up driver-management-service
```

### Standalone
```bash
cd driver-management-service
npm install
npm run dev
```

## Schemas

### DriverProfile
- `userId` - Reference to User Service
- `licenseDetails` - License number, type, validity
- `experience` - Years, vehicle types, routes
- `skills` - Skill name and level
- `certifications` - Certificates and validity
- `availability` - Status, preferences, salary
- `currentEmployment` - Active employment reference
- `ratings` - Aggregate rating data

### Employment
- `driverId`, `companyId` - References
- `position`, `employmentType`, `status`
- `salary`, `schedule`
- `assignedVehicle`, `vehicleAssignmentHistory`
- `termination` - Termination details

### JobRequest
- `companyId`, `driverId`
- `type`, `status`
- `jobDetails` - Position, description, requirements
- `offeredSalary`, `benefits`
- `interview` - Interview scheduling
- `statusHistory` - Workflow tracking

### DriverRating
- `driverId`, `ratedBy`
- `overallRating`, `categoryRatings`
- `review`, `tags`, `wouldRehire`
- `driverResponse`

## Status Enums

### Availability Status
`AVAILABLE`, `EMPLOYED`, `ON_LEAVE`, `UNAVAILABLE`, `SEEKING`

### Job Request Status
`PENDING` → `VIEWED` → `ACCEPTED`/`REJECTED`/`WITHDRAWN`/`EXPIRED` → `HIRED`

### Employment Status
`ACTIVE`, `ON_LEAVE`, `SUSPENDED`, `TERMINATED`, `RESIGNED`
