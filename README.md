# Mobitrak Backend Microservices

This project uses a microservices architecture managed by Docker Compose.

## Services

| Service Name | Port | Description |
| :--- | :--- | :--- |
| **User Service** | `5001` | Handles user registration, authentication, and user data. |
| **MongoDB** | `27017` | Cloud Database (MongoDB Atlas) for storing data. |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running.

## How to Run

1.  Open a terminal in the project root (`mobitrak-backend/`).
2.  Start the services:

    ```bash
    docker-compose up --build
    ```

## API Reference

### 1. User Service
**Base URL:** `http://localhost:5001`

#### **Register Business User**
Creates a new user account with the role of "business".

- **Endpoint:** `/api/users/register/business`
- **Method:** `POST`
- **Content-Type:** `application/json`

**Request Body**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `companyName` | `string` | Yes | The name of the company. |
| `businessEmail` | `string` | Yes | The email address of the business. |
| `password` | `string` | Yes | The password for the account. |

**Example Request:**
```json
{
  "companyName": "TechCorp",
  "businessEmail": "info@techcorp.com",
  "password": "securepassword123"
}
```

**Success Response (201 Created):**
```json
{
  "message": "Business user registered successfully",
  "user": {
    "id": "60d0fe4f5311236168a109ca",
    "email": "info@techcorp.com",
    "companyName": "TechCorp",
    "role": "business"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "message": "User already exists"
}
```
OR
```json
{
  "message": "Please enter all fields"
}

#### **Register Driver**
Creates a new user account with the role of "driver".

- **Endpoint:** `/api/users/register/driver`
- **Method:** `POST`
- **Content-Type:** `application/json`

**Request Body**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `firstName` | `string` | Yes | Driver's first name. |
| `lastName` | `string` | Yes | Driver's last name. |
| `driverLicenseId` | `string` | Yes | Driver's License ID. |
| `email` | `string` | Yes | Driver's email address. |
| `password` | `string` | Yes | Password for the account. |

**Example Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "driverLicenseId": "DL12345678",
  "email": "driver@example.com",
  "password": "securepassword123"
}
```

**Success Response (201 Created):**
```json
{
  "message": "Driver registered successfully",
  "user": {
    "id": "60d0...",
    "firstName": "John",
    "lastName": "Doe",
    "driverLicenseId": "DL12345678",
    "email": "driver@example.com",
    "role": "driver"
  }
}
```

---

---

### Google Authentication

#### **1. Google Login (Check User)**
Checks if a user exists with the given Google Token.

- **Endpoint:** `/api/users/auth/google`
- **Method:** `POST`
- **Body:** `{ "token": "GOOGLE_ID_TOKEN" }`

**Response:**
- **200 OK**: User exists (returns user data).
- **404 Not Found**: User does not exist (Frontend should redirect to registration).

#### **2. Register Business via Google**
Registers a new business user using Google Token.

- **Endpoint:** `/api/users/register/google/business`
- **Method:** `POST`
- **Body:** `{ "token": "...", "companyName": "TechCorp" }`

#### **3. Register Driver via Google**
Registers a new driver using Google Token.

- **Endpoint:** `/api/users/register/google/driver`
- **Method:** `POST`
- **Body:** 
  ```json
  { 
    "token": "...", 
    "firstName": "John", 
    "lastName": "Doe", 
    "driverLicenseId": "DL123" 
  }
  ```

---

## Connecting Frontend

To connect your frontend (e.g., React/Vite) to these services:

1.  **Set the Base URL:** `http://localhost:5001` is the entry point for the User Service.
2.  **Example Call:**

```javascript
const registerUser = async (email, password) => {
  try {
    const response = await fetch('http://localhost:5001/api/users/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    return data;
    
  } catch (error) {
    console.error('Registration failed:', error);
    throw error;
  }
};
```
