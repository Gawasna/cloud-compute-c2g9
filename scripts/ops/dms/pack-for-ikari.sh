#!/usr/bin/env bash
# ==============================================================================
# Script: scripts/ops/dms/pack-for-ikari.sh
# Purpose: Sudo packaging and provisioning script to stage and activate
#          Dead Man's Switch (DMS) for service account 'ikari' on HP Node.
# Usage: sudo ./pack-for-ikari.sh (or sudo ./scripts/pack-dms-to-ikari.sh)
# ==============================================================================

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
    echo "[ERROR] This packaging script requires root privileges to configure /home/ikari." >&2
    echo "Please execute with sudo:" >&2
    echo "    sudo $0" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_OPS_DIR="/home/ikari/ops/dms"
TARGET_SYSTEMD_DIR="/home/ikari/.config/systemd/user"
TARGET_ENV_FILE="/home/ikari/.env.dms"

echo "======================================================================"
echo "  PACKAGING DEAD MAN'S SWITCH (DMS) SUITE FOR SERVICE ACCOUNT IKARI"
echo "  Timestamp : $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "======================================================================"

# 1. Ensure user ikari exists
if ! id "ikari" >/dev/null 2>&1; then
    echo "[ERROR] User 'ikari' does not exist on this host." >&2
    exit 1
fi

# 2. Ensure lingering is enabled for user ikari
if command -v loginctl >/dev/null 2>&1; then
    loginctl enable-linger ikari || true
    echo "[INFO] Verified systemd user lingering for 'ikari'."
fi

# 3. Create destination directories
echo "[INFO] Creating destination directories..."
mkdir -p "${TARGET_OPS_DIR}"
mkdir -p "${TARGET_SYSTEMD_DIR}"

# 4. Copy scripts and systemd units
echo "[INFO] Deploying script files to ${TARGET_OPS_DIR}..."
cp "${SCRIPT_DIR}/dms-checkin.sh" "${TARGET_OPS_DIR}/dms-checkin.sh"
cp "${SCRIPT_DIR}/test-dms-checkin.sh" "${TARGET_OPS_DIR}/test-dms-checkin.sh"

echo "[INFO] Deploying systemd units to ${TARGET_SYSTEMD_DIR}..."
cp "${SCRIPT_DIR}/dms-checkin.service" "${TARGET_SYSTEMD_DIR}/dms-checkin.service"
cp "${SCRIPT_DIR}/dms-checkin.timer" "${TARGET_SYSTEMD_DIR}/dms-checkin.timer"

# 5. Restrict permissions (ikari ownership, least privilege)
echo "[INFO] Applying ownership and permissions..."
chown -R ikari:ikari "${TARGET_OPS_DIR}"
chmod 750 "${TARGET_OPS_DIR}"
chmod 700 "${TARGET_OPS_DIR}/dms-checkin.sh" "${TARGET_OPS_DIR}/test-dms-checkin.sh"

chown ikari:ikari "${TARGET_SYSTEMD_DIR}/dms-checkin.service" "${TARGET_SYSTEMD_DIR}/dms-checkin.timer"
chmod 644 "${TARGET_SYSTEMD_DIR}/dms-checkin.service" "${TARGET_SYSTEMD_DIR}/dms-checkin.timer"

# 6. Initialize .env.dms if absent
if [[ ! -f "${TARGET_ENV_FILE}" ]]; then
    echo "[INFO] Initializing ${TARGET_ENV_FILE} template..."
    cat << 'EOF' > "${TARGET_ENV_FILE}"
# Dead Man's Switch (DMS) Environment Configuration for user ikari
# Mode 600, Owned by ikari:ikari
DMS_ENDPOINT="https://cc-cloud-watchdog.hunglepy05.workers.dev/api/dms/checkin"
DMS_NODE_ID="elitedesk-mint"
DMS_SECRET_TOKEN="REPLACE_WITH_ACTUAL_DMS_SECRET_TOKEN"
EOF
    chown ikari:ikari "${TARGET_ENV_FILE}"
    chmod 600 "${TARGET_ENV_FILE}"
    echo "[WARN] Created template at ${TARGET_ENV_FILE}. Remember to fill in DMS_SECRET_TOKEN!"
else
    echo "[INFO] Existing environment file preserved at: ${TARGET_ENV_FILE}"
fi

# 7. Reload systemd user daemon and enable timer
echo "[INFO] Reloading systemd user daemon for ikari..."
systemctl --user -M ikari@ daemon-reload || true
systemctl --user -M ikari@ enable --now dms-checkin.timer || true

echo "======================================================================"
echo "[SUCCESS] Dead Man's Switch successfully packaged and staged for ikari!"
echo ""
echo "Active Timers for ikari:"
systemctl --user -M ikari@ list-timers --no-pager | grep -E "dms|NEXT" || true
echo ""
echo "To test check-in manually under ikari, run:"
echo "    sudo -u ikari -i bash /home/ikari/ops/dms/test-dms-checkin.sh"
echo ""
echo "To inspect live logs from journald, run:"
echo "    journalctl --user -M ikari@ -u dms-checkin.service -f"
echo "======================================================================"
