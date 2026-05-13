#!/bin/bash
# =============================================
# MobiTrak EC2 Health Check Script
# =============================================
# Checks if all microservices are responding correctly.
#
# Usage:
#   chmod +x health-check.sh
#   ./health-check.sh
#   ./health-check.sh https://your-domain.com   # Check via Nginx
#

BASE_URL=${1:-"http://localhost"}
ERRORS=0

echo "==========================================="
echo "  MobiTrak Health Check"
echo "  Target: $BASE_URL"
echo "  $(date)"
echo "==========================================="
echo ""

# Check individual services (direct ports)
check_direct() {
    local name=$1
    local port=$2
    local response

    response=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:$port/health" 2>/dev/null)
    if [ "$response" = "200" ]; then
        echo "  ✅ $name (localhost:$port) — HTTP $response"
    else
        echo "  ❌ $name (localhost:$port) — HTTP $response"
        ERRORS=$((ERRORS + 1))
    fi
}

echo "--- Direct Service Ports ---"
check_direct "User Service"    5001
check_direct "Vehicle Service"  5002
check_direct "Driver Service"   5003
check_direct "Trip Service"     5004

# Check through Nginx (if a domain/IP was provided)
if [ "$BASE_URL" != "http://localhost" ]; then
    echo ""
    echo "--- Through Nginx ($BASE_URL) ---"

    check_nginx() {
        local path=$1
        local name=$2
        local response

        response=$(curl -sf -o /dev/null -w "%{http_code}" "${BASE_URL}${path}" 2>/dev/null)
        if [ "$response" = "200" ]; then
            echo "  ✅ $name ($path) — HTTP $response"
        else
            echo "  ❌ $name ($path) — HTTP $response"
            ERRORS=$((ERRORS + 1))
        fi
    }

    check_nginx "/health" "Health endpoint"
fi

# PM2 status
echo ""
echo "--- PM2 Status ---"
pm2 jlist 2>/dev/null | python3 -c "
import json, sys
try:
    procs = json.load(sys.stdin)
    for p in procs:
        status = p.get('pm2_env', {}).get('status', 'unknown')
        name = p.get('name', 'unknown')
        restarts = p.get('pm2_env', {}).get('restart_time', 0)
        uptime = p.get('pm2_env', {}).get('pm_uptime', 0)
        icon = '✅' if status == 'online' else '❌'
        print(f'  {icon} {name}: {status} (restarts: {restarts})')
except:
    print('  Could not parse PM2 status')
" 2>/dev/null || echo "  PM2 not running or not installed"

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "🟢 All checks passed!"
else
    echo "🔴 $ERRORS check(s) failed!"
fi
echo ""
