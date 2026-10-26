#!/usr/bin/env bash
# ==============================================================================
# Script: deploy-kuma.sh
# Purpose: Deploy Uptime Kuma for Ops User 'ikari' on HP EliteDesk Node
# Target User: ikari (UID 1002)
# ==============================================================================

set -euo pipefail

CURRENT_UID=$(id -u)
CURRENT_USER=$(id -un)
REQUIRED_USER="ikari"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/data"

echo "[INFO] Running deployment check for Uptime Kuma on HP Node..."
echo "[INFO] Current executing user: ${CURRENT_USER} (UID: ${CURRENT_UID})"

# User Verification Guard
if [[ "${CURRENT_USER}" != "${REQUIRED_USER}" && "${CURRENT_UID}" -ne 0 ]]; then
    echo "[WARN] Notice: Target operational user is '${REQUIRED_USER}'."
    echo "[WARN] If running as 'gawasyu', switch to '${REQUIRED_USER}' or execute via:"
    echo "       sudo -u ${REQUIRED_USER} -i bash ${SCRIPT_DIR}/deploy-kuma.sh"
    echo ""
fi

# Detect Docker Socket (Rootless vs Root)
if [[ -S "/run/user/${CURRENT_UID}/docker.sock" ]]; then
    export XDG_RUNTIME_DIR="/run/user/${CURRENT_UID}"
    export DOCKER_HOST="unix:///run/user/${CURRENT_UID}/docker.sock"
    echo "[INFO] Using active rootless Docker socket: ${DOCKER_HOST}"
elif [[ "${CURRENT_USER}" == "${REQUIRED_USER}" && -S "/run/user/1002/docker.sock" ]]; then
    export XDG_RUNTIME_DIR="/run/user/1002"
    export DOCKER_HOST="unix:///run/user/1002/docker.sock"
    echo "[INFO] Using user 1002 Docker socket: ${DOCKER_HOST}"
elif [[ -S "/var/run/docker.sock" ]]; then
    echo "[INFO] Using system Docker socket: /var/run/docker.sock"
else
    echo "[ERROR] Docker socket not found. Ensure rootless dockerd is running for ${CURRENT_USER}."
    echo "        Check with: systemctl --user status docker"
    exit 1
fi

# Validate Docker CLI availability
if ! command -v docker >/dev/null 2>&1; then
    echo "[ERROR] 'docker' binary not found in PATH."
    exit 1
fi

# Prepare persistent data directory
if [[ ! -d "${DATA_DIR}" ]]; then
    echo "[INFO] Creating persistent data directory at: ${DATA_DIR}"
    mkdir -p "${DATA_DIR}"
    chmod 750 "${DATA_DIR}"
fi

# Determine Compose Command (docker compose plugin vs docker-compose binary vs docker run fallback)
cd "${SCRIPT_DIR}"

CONTAINER_NAME="ops_uptime_kuma"
BIND_IP="${KUMA_BIND_IP:-100.103.109.18}"
PORT="${KUMA_PORT:-3001}"

echo "[INFO] Target address: http://${BIND_IP}:${PORT}"

# Check port conflict before launching
if ss -tuln | grep -q ":${PORT} "; then
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "[INFO] Container '${CONTAINER_NAME}' is already running on port ${PORT}."
        docker ps --filter "name=${CONTAINER_NAME}"
        exit 0
    else
        echo "[WARN] Port ${PORT} is occupied by another process. Check with: ss -tulpn | grep :${PORT}"
    fi
fi

echo "[INFO] Pulling louislam/uptime-kuma:2 image..."
docker pull louislam/uptime-kuma:2

echo "[INFO] Starting Uptime Kuma container..."
# Clean up any failed or previous shim task
docker compose down 2>/dev/null || true
docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true

if docker compose version >/dev/null 2>&1; then
    docker compose up -d
elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose up -d
else
    echo "[INFO] Compose not found; deploying with native docker run command..."
    docker run -d \
        --name "${CONTAINER_NAME}" \
        --restart unless-stopped \
        -p "${BIND_IP}:${PORT}:3001" \
        -v "${DATA_DIR}:/app/data" \
        louislam/uptime-kuma:2
fi

# Verification
echo "[INFO] Waiting 5 seconds for service initialization..."
sleep 5

if docker ps --filter "name=${CONTAINER_NAME}" --format '{{.Status}}' | grep -q "Up"; then
    echo "[OK] Uptime Kuma successfully deployed and running!"
    echo "[OK] Access dashboard at: http://${BIND_IP}:${PORT}"
    echo "[OK] Container Details:"
    docker ps --filter "name=${CONTAINER_NAME}"
else
    echo "[ERROR] Failed to start container '${CONTAINER_NAME}'. Inspect logs with:"
    echo "        docker logs ${CONTAINER_NAME}"
    exit 1
fi
