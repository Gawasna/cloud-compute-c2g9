#!/usr/bin/env bash
# ==============================================================================
# Script: scripts/ops/dms/dms-checkin.sh
# Purpose: Dead Man's Switch (DMS) outbound telemetry check-in from on-premise
#          HP EliteDesk node to Cloudflare Worker Edge Watchdog.
# Service Account: ikari (UID 1002)
# Cadence: 10 minutes (triggered by systemd user timer)
# ==============================================================================

set -euo pipefail

# 1. Source environment files if readable
if [[ -r "/home/ikari/ops/.env" ]]; then
    # shellcheck disable=SC1091
    source "/home/ikari/ops/.env"
fi

if [[ -r "/home/ikari/.env.dms" ]]; then
    # shellcheck disable=SC1091
    source "/home/ikari/.env.dms"
fi

# 2. Configuration & defaults
DMS_ENDPOINT="${DMS_ENDPOINT:-https://cc-cloud-watchdog.hunglepy05.workers.dev/api/dms/checkin}"
DMS_NODE_ID="${DMS_NODE_ID:-elitedesk-mint}"
DMS_SECRET_TOKEN="${DMS_SECRET_TOKEN:-}"

if [[ -z "${DMS_SECRET_TOKEN}" ]]; then
    echo "[ERROR] [$(date -u +"%Y-%m-%dT%H:%M:%SZ")] DMS_SECRET_TOKEN is empty. Check /home/ikari/.env.dms." >&2
    exit 1
fi

# 3. Harvest system telemetry metrics
LOAD_AVG=$(awk '{print $1}' /proc/loadavg 2>/dev/null || echo "0.0")

MEM_TOTAL="0"
MEM_USED="0"
if command -v free >/dev/null 2>&1; then
    MEM_TOTAL=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}')
    MEM_USED=$(free -m 2>/dev/null | awk '/^Mem:/{print $3}')
fi

UPTIME_SEC="0"
if [[ -f "/proc/uptime" ]]; then
    UPTIME_SEC=$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo "0")
fi

# 4. Probe local Uptime Kuma instance (Port 3001)
KUMA_STATUS="down"
HTTP_KUMA=$(curl -s -m 2 -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/ 2>/dev/null || true)
if [[ "${HTTP_KUMA}" =~ ^(200|302|401)$ ]]; then
    KUMA_STATUS="up"
fi

ISO_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 5. Assemble JSON payload
PAYLOAD=$(cat <<EOF
{
  "node": "${DMS_NODE_ID}",
  "uptime_kuma": "${KUMA_STATUS}",
  "load_avg": ${LOAD_AVG:-0.0},
  "memory_used_mb": ${MEM_USED:-0},
  "memory_total_mb": ${MEM_TOTAL:-0},
  "uptime_sec": ${UPTIME_SEC:-0},
  "timestamp": "${ISO_TIMESTAMP}"
}
EOF
)

# 6. Dispatch HTTP POST to Cloudflare Worker Edge
HTTP_RESPONSE=$(curl -s -S -m 10 -w "\n%{http_code}" -X POST "${DMS_ENDPOINT}" \
    -H "Authorization: Bearer ${DMS_SECRET_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${PAYLOAD}" 2>&1 || true)

HTTP_CODE=$(echo "${HTTP_RESPONSE}" | tail -n 1)
HTTP_BODY=$(echo "${HTTP_RESPONSE}" | sed '$d')

if [[ "${HTTP_CODE}" == "200" ]]; then
    echo "[OK] [${ISO_TIMESTAMP}] DMS check-in accepted (HTTP 200). Node: ${DMS_NODE_ID}, Load: ${LOAD_AVG}, Mem: ${MEM_USED}/${MEM_TOTAL}MB, Kuma: ${KUMA_STATUS}"
    exit 0
else
    echo "[FAIL] [${ISO_TIMESTAMP}] DMS check-in rejected (HTTP ${HTTP_CODE}). Body: ${HTTP_BODY}" >&2
    exit 1
fi
