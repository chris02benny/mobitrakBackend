#!/bin/bash
# =============================================
# MobiTrak EC2 Setup Script
# =============================================
# Run this script on a fresh Ubuntu 22.04+ EC2 instance.
#
# Usage:
#   chmod +x setup-ec2.sh
#   sudo ./setup-ec2.sh
#
# After running, you must:
#   1. Create ~/.env or ~/mobitrak-backend/.env with your secrets
#   2. Replace 'your-domain.com' in Nginx config with your domain/IP
#   3. Run: cd ~/mobitrak-backend && npm run install:all
#   4. Run: pm2 start ecosystem.config.js --env production
#   5. Run: pm2 save && pm2 startup
#

set -e  # Exit on any error

echo "==========================================="
echo "  MobiTrak EC2 Setup Script"
echo "==========================================="

# 1. System update
echo ""
echo "[1/6] Updating system packages..."
apt update && apt upgrade -y

# 2. Install Node.js 18 (via NodeSource)
echo ""
echo "[2/6] Installing Node.js 18..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
else
    echo "  Node.js already installed: $(node --version)"
fi

# Verify
echo "  Node: $(node --version)"
echo "  NPM:  $(npm --version)"

# 3. Install PM2 globally
echo ""
echo "[3/6] Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
else
    echo "  PM2 already installed: $(pm2 --version)"
fi

# 4. Install Nginx
echo ""
echo "[4/6] Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
else
    echo "  Nginx already installed: $(nginx -v 2>&1)"
fi

# 5. Install Certbot for SSL (optional — skips if already installed)
echo ""
echo "[5/6] Installing Certbot for SSL..."
if ! command -v certbot &> /dev/null; then
    apt install -y certbot python3-certbot-nginx
else
    echo "  Certbot already installed: $(certbot --version 2>&1)"
fi

# 6. Install Git
echo ""
echo "[6/6] Installing Git..."
if ! command -v git &> /dev/null; then
    apt install -y git
else
    echo "  Git already installed: $(git --version)"
fi

# Create logs directory for PM2
echo ""
echo "Creating logs directory..."
mkdir -p /home/ubuntu/mobitrak-backend/logs

# Setup PM2 to start on boot
echo ""
echo "Configuring PM2 startup..."
pm2 startup systemd -u ubuntu --hp /home/ubuntu
# Note: PM2 will print a command you may need to run manually

# Enable and start Nginx
echo ""
echo "Starting Nginx..."
systemctl enable nginx
systemctl start nginx

echo ""
echo "==========================================="
echo "  Setup Complete!"
echo "==========================================="
echo ""
echo "Next steps:"
echo "  1. Clone your repo:     git clone <your-repo-url> ~/mobitrak-backend"
echo "  2. Create .env file:    cp ~/mobitrak-backend/.env.ec2.example ~/mobitrak-backend/.env"
echo "  3. Edit .env:           nano ~/mobitrak-backend/.env"
echo "  4. Install deps:        cd ~/mobitrak-backend && npm run install:all"
echo "  5. Setup Nginx config:  sudo cp ~/mobitrak-backend/deployment/nginx.conf /etc/nginx/sites-available/mobitrak"
echo "                          sudo ln -sf /etc/nginx/sites-available/mobitrak /etc/nginx/sites-enabled/"
echo "                          sudo rm -f /etc/nginx/sites-enabled/default"
echo "                          sudo nginx -t && sudo systemctl reload nginx"
echo "  6. Start services:      cd ~/mobitrak-backend && pm2 start ecosystem.config.js --env production"
echo "  7. Save PM2 state:      pm2 save"
echo "  8. (Optional) SSL:      sudo certbot --nginx -d your-domain.com"
echo ""
