#!/usr/bin/env bash
# ==============================================================================
# Script: manage-kuma.sh
# Purpose: Lifecycle and operational management for Uptime Kuma container
# Usage: ./manage-kuma.sh [status|logs|restart|stop|start|backup]
# ==============================================================================

set -euo pipefail

CURRENT_UID=$(id -u)
CONTAINER_NAME="ops_uptime_kuma"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/data"
ACTION="${1:-status}"

# Export rootless socket if available
if [[ -S "/run/user/${CURRENT_UID}/docker.sock" ]]; then
    export XDG_RUNTIME_DIR="/run/user/${CURRENT_UID}"
    export DOCKER_HOST="unix:///run/user/${CURRENT_UID}/docker.sock"
fi

case "${ACTION}" in
    status)
        echo "=== Uptime Kuma Status ==="
        docker ps -a --filter "name=${CONTAINER_NAME}"
        echo ""
        echo "Resource Usage:"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" "${CONTAINER_NAME}" 2>/dev/null || echo "Container not actively running."
        ;;
    logs)
        echo "=== Uptime Kuma Recent Logs (tail 100) ==="
        docker logs --tail 100 -f "${CONTAINER_NAME}"
        ;;
    restart)
        echo "[INFO] Restarting ${CONTAINER_NAME}..."
        docker restart "${CONTAINER_NAME}"
        echo "[OK] Restart completed."
        ;;
    stop)
        echo "[INFO] Stopping ${CONTAINER_NAME}..."
        docker stop "${CONTAINER_NAME}"
        echo "[OK] Stopped."
        ;;
    start)
        echo "[INFO] Starting ${CONTAINER_NAME}..."
        docker start "${CONTAINER_NAME}"
        echo "[OK] Started."
        ;;
    backup)
        BACKUP_TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
        BACKUP_FILE="${SCRIPT_DIR}/kuma_data_backup_${BACKUP_TIMESTAMP}.tar.gz"
        echo "[INFO] Creating database backup to: ${BACKUP_FILE}"
        if [[ -d "${DATA_DIR}" ]]; then
            tar -czf "${BACKUP_FILE}" -C "${SCRIPT_DIR}" data
            echo "[OK] Backup created successfully: $(stat -c '%s bytes' "${BACKUP_FILE}")"
        else
            echo "[ERROR] Data directory does not exist: ${DATA_DIR}"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {status|logs|restart|stop|start|backup}"
        exit 1
        ;;
esac
