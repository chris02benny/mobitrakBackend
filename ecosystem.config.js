/**
 * ecosystem.config.js
 * PM2 process manager configuration for EC2 deployment.
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 restart all
 *   pm2 logs
 *   pm2 status
 *
 * All services load their environment variables from the root .env file
 * via dotenv in their respective server.js entry points.
 */

module.exports = {
  apps: [
    // ===== User Service =====
    {
      name: 'user-service',
      script: './user-service/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5001
      },
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Restart strategy — exponential backoff on crash
      exp_backoff_restart_delay: 100,
      // Logging
      error_file: './logs/user-service-error.log',
      out_file: './logs/user-service-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    // ===== Vehicle Service =====
    {
      name: 'vehicle-service',
      script: './vehicle-service/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5002
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5002
      },
      kill_timeout: 5000,
      listen_timeout: 10000,
      exp_backoff_restart_delay: 100,
      error_file: './logs/vehicle-service-error.log',
      out_file: './logs/vehicle-service-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    // ===== Driver Management Service =====
    {
      name: 'driver-service',
      script: './driver-management-service/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5003
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5003
      },
      kill_timeout: 5000,
      listen_timeout: 10000,
      exp_backoff_restart_delay: 100,
      error_file: './logs/driver-service-error.log',
      out_file: './logs/driver-service-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    // ===== Trip Service =====
    // Note: Trip service also runs Socket.IO for real-time WebRTC/monitoring.
    // On EC2 this works natively (unlike Lambda where Pusher was needed).
    {
      name: 'trip-service',
      script: './trip-service/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5004
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5004
      },
      kill_timeout: 5000,
      listen_timeout: 10000,
      exp_backoff_restart_delay: 100,
      error_file: './logs/trip-service-error.log',
      out_file: './logs/trip-service-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
