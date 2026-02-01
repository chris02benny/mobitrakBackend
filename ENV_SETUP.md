# Environment Variables Setup

## Security Notice
**IMPORTANT:** Never commit the `.env` file to version control. It contains sensitive API keys and credentials.

## Setup Instructions

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Update the `.env` file with your actual credentials:**
   - Replace all placeholder values with your real API keys
   - MongoDB connection string
   - JWT secret
   - Google OAuth credentials
   - SMTP email credentials
   - Cloudinary credentials
   - OCR.space API keys
   - OpenRouter API keys

3. **Verify `.gitignore` includes `.env`:**
   The `.gitignore` file should already contain `.env` to prevent accidental commits.

## Environment Variables

| Variable | Description | Service |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | Both |
| `JWT_SECRET` | Secret key for JWT tokens | Both |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | User Service |
| `SMTP_HOST` | SMTP server host | User Service |
| `SMTP_PORT` | SMTP server port | User Service |
| `SMTP_USER` | SMTP username/email | User Service |
| `SMTP_PASS` | SMTP password/app password | User Service |
| `EMAIL_FROM` | From email address | User Service |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Both |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Both |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Both |
| `OCR_SPACE_API_KEY_USER` | OCR.space API key for user service | User Service |
| `OCR_SPACE_API_KEY_VEHICLE` | OCR.space API key for vehicle service | Vehicle Service |
| `OPENROUTER_API_KEY_USER` | OpenRouter API key for user service | User Service |
| `OPENROUTER_API_KEY_VEHICLE` | OpenRouter API key for vehicle service | Vehicle Service |
| `AI_API_URL` | AI API endpoint URL | Both |
| `AI_MODEL` | AI model to use | Both |
| `USER_SERVICE_PORT` | Port for user service | User Service |
| `VEHICLE_SERVICE_PORT` | Port for vehicle service | Vehicle Service |

## Running with Docker Compose

After setting up your `.env` file, run:

```bash
docker-compose up -d
```

Docker Compose will automatically load environment variables from the `.env` file.

## Security Best Practices

1. ✅ Never commit `.env` to version control
2. ✅ Use different API keys for development and production
3. ✅ Rotate API keys periodically
4. ✅ Use strong, unique JWT secrets
5. ✅ Store production secrets in secure vaults (AWS Secrets Manager, Azure Key Vault, etc.)
6. ✅ Share `.env.example` instead of actual `.env` with team members
