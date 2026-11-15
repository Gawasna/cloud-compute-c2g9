#!/usr/bin/env bash
# ==============================================================================
# Script: scripts/ops/dms/test-dms-checkin.sh
# Purpose: Interactive single-shot validation for Dead Man's Switch (DMS)
# Usage: ./test-dms-checkin.sh [OPTIONAL_TOKEN]
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Try reading from environment files
if [[ -f "/home/ikari/.env.dms" ]]; then
    # shellcheck disable=SC1091
    source "/home/ikari/.env.dms" 2>/dev/null || true
fi

# Override token if provided as argument
if [[ $# -ge 1 && -n "$1" ]]; then
    export DMS_SECRET_TOKEN="$1"
fi

if [[ -z "${DMS_SECRET_TOKEN:-}" ]]; then
    echo "[ERROR] DMS_SECRET_TOKEN is not defined."
    echo "Usage: $0 [DMS_SECRET_TOKEN]"
    echo "Or set DMS_SECRET_TOKEN in /home/ikari/.env.dms"
    exit 1
fi

echo "======================================================================"
echo "  DEAD MAN'S SWITCH (DMS) - MANUAL CHECK-IN PROBE"
echo "  Timestamp: $(date -u +"%Y-%m-%d %H:%M:%SZ")"
echo "======================================================================"

exec bash "${SCRIPT_DIR}/dms-checkin.sh"
