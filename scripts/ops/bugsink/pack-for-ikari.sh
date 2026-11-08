#!/usr/bin/env bash
# ==============================================================================
# Script: pack-for-ikari.sh
# Purpose: Package bugsink ops scripts and stage in /tmp for user 'ikari'
# Usage: ./pack-for-ikari.sh
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_STAGING="/tmp/bugsink_pack"

echo "[INFO] Cleaning previous staging directory at: ${TARGET_STAGING}..."
rm -rf "${TARGET_STAGING}"

echo "[INFO] Copying scripts from ${SCRIPT_DIR} to ${TARGET_STAGING}..."
mkdir -p "${TARGET_STAGING}"
cp -r "${SCRIPT_DIR}/"* "${TARGET_STAGING}/"

echo "[INFO] Setting permissions to 777 for cross-user execution by 'ikari'..."
chmod -R 777 "${TARGET_STAGING}"

echo "======================================================================"
echo "[SUCCESS] Ops Pack staged at: ${TARGET_STAGING}"
echo ""
echo "Execute the diagnostic check under user 'ikari' with:"
echo "    sudo -u ikari -i bash /tmp/bugsink_pack/check-bugsink-status.sh"
echo ""
echo "Or update into service directory /srv/elitedesk_team_ops/bugsink/:"
echo "    sudo -u ikari -i bash -c 'cp -r /tmp/bugsink_pack/* /srv/elitedesk_team_ops/bugsink/ && cd /srv/elitedesk_team_ops/bugsink && ./check-bugsink-status.sh'"
echo "======================================================================"
