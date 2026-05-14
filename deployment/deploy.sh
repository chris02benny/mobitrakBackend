#!/bin/bash

# ========================================================
# MobiTrak Deployment Script (Nginx)
# ========================================================
# Run this on your EC2 instance to pull latest config and reload.

REPO_DIR="/home/ubuntu/mobitrak-backend"
NGINX_CONF="/etc/nginx/sites-available/mobitrak"

echo "Checking for updates in $REPO_DIR..."
cd $REPO_DIR
git pull origin master

echo "Verifying Nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "Reloading Nginx..."
    sudo systemctl reload nginx
    echo "Done! MobiTrak is live with latest configuration."
else
    echo "Nginx configuration test failed! Please check deployment/mobitrak-proxy.conf"
    exit 1
fi
