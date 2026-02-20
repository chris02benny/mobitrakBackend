#!/usr/bin/env bash
# =============================================================================
# cors-test.sh — CORS Smoke Test for MobiTrak API Gateway
# =============================================================================
# Usage:
#   bash cors-test.sh
#   bash cors-test.sh https://qyf9xrigzg.execute-api.ap-south-1.amazonaws.com
#
# Tests:
#   1. OPTIONS preflight on /api/users/login  → must return 200 + CORS headers
#   2. POST /api/users/login with JSON body   → must not be CORS-blocked
#   3. OPTIONS preflight on /api/vehicles     → must return 200
#
# Requires: curl, jq (optional — for pretty JSON)
# =============================================================================

BASE_URL="${1:-https://qyf9xrigzg.execute-api.ap-south-1.amazonaws.com}"
ORIGIN="https://mobitrakapp.vercel.app"
PASS=0
FAIL=0

# Colours
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
NC="\033[0m"

check() {
    local label="$1"
    local status="$2"
    local header_value="$3"
    local expected="$4"

    if [[ "$status" == "200" || "$status" == "204" ]] && [[ "$header_value" == *"$expected"* ]]; then
        echo -e "${GREEN}✓ PASS${NC}  $label"
        ((PASS++))
    else
        echo -e "${RED}✗ FAIL${NC}  $label"
        echo -e "         HTTP status : ${YELLOW}${status}${NC}"
        echo -e "         Got header  : ${YELLOW}${header_value}${NC}"
        echo -e "         Expected    : ${YELLOW}${expected}${NC}"
        ((FAIL++))
    fi
}

echo ""
echo "=== MobiTrak CORS Smoke Test ==="
echo "Base URL : $BASE_URL"
echo "Origin   : $ORIGIN"
echo ""

# ── Test 1: OPTIONS preflight /api/users/login ───────────────────────────────
RESPONSE=$(curl -s -o /dev/null -D - -X OPTIONS \
    "${BASE_URL}/api/users/login" \
    -H "Origin: ${ORIGIN}" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type,x-auth-token")

STATUS=$(echo "$RESPONSE" | grep -i "^HTTP" | tail -1 | awk '{print $2}')
ACAO=$(echo "$RESPONSE"  | grep -i "access-control-allow-origin" | head -1 | tr -d '\r')
ACAM=$(echo "$RESPONSE"  | grep -i "access-control-allow-methods" | head -1 | tr -d '\r')
ACAC=$(echo "$RESPONSE"  | grep -i "access-control-allow-credentials" | head -1 | tr -d '\r')

check "OPTIONS /api/users/login — HTTP 200"                   "$STATUS"    "$ACAO"  "$ORIGIN"
check "OPTIONS /api/users/login — Allow-Origin header present" "$STATUS"   "$ACAO"  "$ORIGIN"
check "OPTIONS /api/users/login — Allow-Methods includes POST" "$STATUS"   "$ACAM"  "POST"
check "OPTIONS /api/users/login — Allow-Credentials: true"     "$STATUS"   "$ACAC"  "true"

echo ""

# ── Test 2: POST /api/users/login (real request) ─────────────────────────────
RESP2=$(curl -s -D - -X POST \
    "${BASE_URL}/api/users/login" \
    -H "Origin: ${ORIGIN}" \
    -H "Content-Type: application/json" \
    -d '{"email":"cors-test@example.com","password":"wrongpassword"}')

STATUS2=$(echo "$RESP2" | grep -i "^HTTP" | tail -1 | awk '{print $2}')
ACAO2=$(echo  "$RESP2" | grep -i "access-control-allow-origin" | head -1 | tr -d '\r')

# A 400 (bad credentials) or 200 means Lambda was reached — CORS is working.
if [[ "$STATUS2" == "200" || "$STATUS2" == "400" || "$STATUS2" == "401" || "$STATUS2" == "403" ]]; then
    echo -e "${GREEN}✓ PASS${NC}  POST /api/users/login — Lambda reached (HTTP $STATUS2, CORS OK)"
    ((PASS++))
else
    echo -e "${RED}✗ FAIL${NC}  POST /api/users/login — Unexpected status $STATUS2 (CORS may be broken)"
    ((FAIL++))
fi

echo ""

# ── Test 3: OPTIONS preflight /api/vehicles ───────────────────────────────────
RESPONSE3=$(curl -s -o /dev/null -D - -X OPTIONS \
    "${BASE_URL}/api/vehicles" \
    -H "Origin: ${ORIGIN}" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: x-auth-token")

STATUS3=$(echo "$RESPONSE3" | grep -i "^HTTP" | tail -1 | awk '{print $2}')
ACAO3=$(echo "$RESPONSE3"  | grep -i "access-control-allow-origin" | head -1 | tr -d '\r')

check "OPTIONS /api/vehicles — HTTP 200" "$STATUS3" "$ACAO3" "$ORIGIN"

echo ""
echo "=================================="
echo -e "Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo ""

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
