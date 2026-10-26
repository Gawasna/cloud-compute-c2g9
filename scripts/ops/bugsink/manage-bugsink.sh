#!/usr/bin/env bash
# ==============================================================================
# Script: manage-bugsink.sh
# Purpose: Lifecycle and operational management for Bugsink container
# Usage: ./manage-bugsink.sh [status|logs|restart|stop|start|backup|dsn]
# ==============================================================================

set -euo pipefail

CURRENT_UID=$(id -u)
CONTAINER_NAME="ops_bugsink"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/data"
DSN_FILE="${DATA_DIR}/dsn.txt"
ACTION="${1:-status}"

# Export rootless socket if available
if [[ -S "/run/user/${CURRENT_UID}/docker.sock" ]]; then
    export XDG_RUNTIME_DIR="/run/user/${CURRENT_UID}"
    export DOCKER_HOST="unix:///run/user/${CURRENT_UID}/docker.sock"
elif [[ -S "/run/user/1002/docker.sock" ]]; then
    export XDG_RUNTIME_DIR="/run/user/1002"
    export DOCKER_HOST="unix:///run/user/1002/docker.sock"
fi

case "${ACTION}" in
    status)
        echo "=== Bugsink Status ==="
        docker ps -a --filter "name=${CONTAINER_NAME}"
        echo ""
        echo "Resource Usage:"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" "${CONTAINER_NAME}" 2>/dev/null || echo "Container not actively running."
        ;;
    logs)
        echo "=== Bugsink Recent Logs (tail 100) ==="
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
    dsn)
        if [[ -f "${DSN_FILE}" ]]; then
            echo "Current Bugsink DSN:"
            cat "${DSN_FILE}"
        else
            echo "[INFO] DSN file not found. Running auto-provision-dsn.sh..."
            bash "${SCRIPT_DIR}/auto-provision-dsn.sh"
        fi
        ;;
    backup)
        BACKUP_TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
        BACKUP_FILE="${SCRIPT_DIR}/bugsink_data_backup_${BACKUP_TIMESTAMP}.tar.gz"
        echo "[INFO] Creating database and data backup to: ${BACKUP_FILE}"
        if [[ -d "${DATA_DIR}" ]]; then
            tar -czf "${BACKUP_FILE}" -C "${SCRIPT_DIR}" data
            echo "[OK] Backup created successfully: $(stat -c '%s bytes' "${BACKUP_FILE}")"
        else
            echo "[ERROR] Data directory does not exist: ${DATA_DIR}"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {status|logs|restart|stop|start|backup|dsn}"
        exit 1
        ;;
esac
